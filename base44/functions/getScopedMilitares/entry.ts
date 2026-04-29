import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// =====================================================================
// Helper: Retry com Backoff Exponencial
// =====================================================================
// Tenta executar a função queryFn várias vezes em caso de falha,
// dobrando o tempo de espera entre tentativas.
// Retentativas apenas para erros transitórios (429, 502, 503, 504).
async function fetchWithRetry(queryFn, label = 'query', retries = 4, delay = 800) {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const result = await queryFn();
            if (attempt > 0) {
                console.info(`[getScopedMilitares] [${label}] sucesso após ${attempt} retentativa(s).`);
            }
            return result;
        } catch (error) {
            lastError = error;
            const status = error?.response?.status || error?.status;
            const isTransient = status === 429 || status === 502 || status === 503 || status === 504;

            console.warn(`[getScopedMilitares] [${label}] falha tentativa ${attempt + 1}/${retries + 1}. Status: ${status || 'N/A'}. Mensagem: ${error?.message}`);

            if (!isTransient || attempt === retries) {
                break;
            }

            const waitMs = delay * Math.pow(2, attempt);
            console.info(`[getScopedMilitares] [${label}] aguardando ${waitMs}ms antes de retry...`);
            await new Promise(res => setTimeout(res, waitMs));
        }
    }
    throw lastError;
}

// =====================================================================
// Helper: Resolução de escopo de lotações permitidas
// =====================================================================
// A partir do registro de UsuarioAcesso, retorna a lista de IDs de
// estrutura permitidos. Retorna null quando o usuário é "admin" (sem
// restrição de escopo).
async function resolverEscopoLotacoes(base44, userAccess) {
    if (!userAccess) return [];
    const tipo = userAccess.tipo_acesso;

    if (tipo === 'admin') {
        return null; // sem restrição
    }

    if (tipo === 'setor' && userAccess.grupamento_id) {
        // Inclui o próprio grupamento + todos os descendentes (subsetores e unidades)
        const descendentes = await fetchWithRetry(
            () => base44.asServiceRole.entities.Subgrupamento.filter(
                { grupamento_raiz_id: userAccess.grupamento_id },
                undefined,
                undefined,
                ['id']
            ),
            'subgrupamento.descendentes_setor'
        );
        const ids = new Set([userAccess.grupamento_id]);
        (descendentes || []).forEach(d => d?.id && ids.add(d.id));
        return Array.from(ids);
    }

    if (tipo === 'subsetor' && userAccess.subgrupamento_id) {
        // Inclui o próprio subsetor + suas unidades filhas diretas
        const filhos = await fetchWithRetry(
            () => base44.asServiceRole.entities.Subgrupamento.filter(
                { parent_id: userAccess.subgrupamento_id },
                undefined,
                undefined,
                ['id']
            ),
            'subgrupamento.filhos_subsetor'
        );
        const ids = new Set([userAccess.subgrupamento_id]);
        (filhos || []).forEach(f => f?.id && ids.add(f.id));
        return Array.from(ids);
    }

    if (tipo === 'unidade' && userAccess.subgrupamento_id) {
        return [userAccess.subgrupamento_id];
    }

    if (tipo === 'proprio' && userAccess.militar_id) {
        // Caso especial: acesso a apenas o próprio militar
        return { __militarId: userAccess.militar_id };
    }

    return [];
}

// =====================================================================
// Handler principal
// =====================================================================
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Não autenticado' }, { status: 401 });
        }

        // Parse seguro do body
        let payload = {};
        try {
            payload = await req.json();
        } catch (_e) {
            payload = {};
        }
        const { lotacaoFiltro, postoGraduacaoFiltro } = payload;

        // 1. Buscar UsuarioAcesso do usuário autenticado
        const userAccessRecords = await fetchWithRetry(
            () => base44.asServiceRole.entities.UsuarioAcesso.filter(
                { user_email: user.email, ativo: true },
                undefined,
                undefined,
                ['tipo_acesso', 'grupamento_id', 'subgrupamento_id', 'militar_id', 'perfil_id']
            ),
            'usuarioAcesso.list'
        );

        const userAccess = (userAccessRecords || [])[0] || null;

        // Admin "puro" via role do User também é considerado admin de escopo
        const isAdminByRole = user.role === 'admin';
        const effectiveAccess = userAccess || (isAdminByRole ? { tipo_acesso: 'admin' } : null);

        if (!effectiveAccess) {
            return Response.json({
                error: 'Acesso não configurado para este usuário.',
                militares: [],
            }, { status: 403 });
        }

        // 2. Resolver escopo de lotações permitidas
        const escopo = await resolverEscopoLotacoes(base44, effectiveAccess);

        // 3. Construir filtro de Militar
        const militarFilter = {};

        if (escopo && typeof escopo === 'object' && escopo.__militarId) {
            militarFilter.id = escopo.__militarId;
        } else if (Array.isArray(escopo)) {
            if (escopo.length === 0) {
                // Usuário com escopo restrito mas sem nenhuma estrutura associada
                return Response.json({
                    militares: [],
                    meta: { total: 0, escopo: 'vazio' }
                });
            }
            // Aplica filtro $in na estrutura
            if (lotacaoFiltro) {
                // Se filtro específico foi enviado, valida se está dentro do permitido
                if (!escopo.includes(lotacaoFiltro)) {
                    return Response.json({
                        error: 'Lotação solicitada fora do escopo permitido.',
                        militares: [],
                    }, { status: 403 });
                }
                militarFilter.estrutura_id = lotacaoFiltro;
            } else {
                militarFilter.estrutura_id = { $in: escopo };
            }
        } else {
            // escopo === null => admin sem restrição
            if (lotacaoFiltro) {
                militarFilter.estrutura_id = lotacaoFiltro;
            }
        }

        if (postoGraduacaoFiltro) {
            militarFilter.posto_graduacao = postoGraduacaoFiltro;
        }

        // 4. Buscar militares com seleção de campos para reduzir payload
        const camposMilitar = [
            'id',
            'nome_completo',
            'nome_guerra',
            'matricula',
            'posto_graduacao',
            'quadro',
            'lotacao',
            'estrutura_id',
            'estrutura_nome',
            'estrutura_tipo',
            'situacao_militar',
            'status_cadastro',
            'comportamento',
            'foto',
            'funcao',
            'condicao'
        ];

        const militares = await fetchWithRetry(
            () => base44.asServiceRole.entities.Militar.filter(
                militarFilter,
                undefined,
                undefined,
                camposMilitar
            ),
            'militar.filter'
        );

        return Response.json({
            militares: militares || [],
            meta: {
                total: (militares || []).length,
                escopo_tipo: effectiveAccess.tipo_acesso,
                aplicou_filtro_lotacao: !!lotacaoFiltro,
                aplicou_filtro_posto: !!postoGraduacaoFiltro,
            }
        });

    } catch (error) {
        const status = error?.response?.status || error?.status || 500;
        console.error('[getScopedMilitares] erro fatal:', {
            message: error?.message,
            status,
            stack: error?.stack,
        });
        return Response.json({
            error: error?.message || 'Erro interno ao buscar militares',
            militares: [],
        }, { status });
    }
});