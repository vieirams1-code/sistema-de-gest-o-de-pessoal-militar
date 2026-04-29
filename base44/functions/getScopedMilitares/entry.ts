import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// =====================================================================
// Constantes
// =====================================================================
const LIMIT_DEFAULT = 100;
const LIMIT_MAX = 300;
const OFFSET_DEFAULT = 0;

const RETRY_MAX_ATTEMPTS = 3; // total de tentativas (incluindo a primeira)
const RETRY_BASE_DELAY_MS = 450; // entre 400ms e 500ms
const RETRY_STATUS = new Set([408, 429, 500, 502, 503, 504]);

// Campos base da entidade Militar (sem foto por padrão para reduzir payload)
const CAMPOS_BASE_MILITAR = [
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
    'funcao',
    'condicao',
];

// =====================================================================
// Helper: Retry com backoff exponencial + jitter
// =====================================================================
async function fetchWithRetry(queryFn, label = 'query') {
    let lastError;
    for (let attempt = 1; attempt <= RETRY_MAX_ATTEMPTS; attempt++) {
        try {
            const result = await queryFn();
            if (attempt > 1) {
                console.info(`[getScopedMilitares] step=${label} attempt=${attempt} status=ok (after retry)`);
            }
            return result;
        } catch (error) {
            lastError = error;
            const status = error?.response?.status || error?.status || 0;
            const isRetryable = RETRY_STATUS.has(status);
            console.warn(
                `[getScopedMilitares] step=${label} attempt=${attempt}/${RETRY_MAX_ATTEMPTS} status=${status || 'N/A'} retryable=${isRetryable}`
            );

            if (!isRetryable || attempt === RETRY_MAX_ATTEMPTS) break;

            const exp = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
            const jitter = Math.floor(Math.random() * 200);
            const waitMs = exp + jitter;
            console.info(`[getScopedMilitares] step=${label} backoff=${waitMs}ms`);
            await new Promise((res) => setTimeout(res, waitMs));
        }
    }
    throw lastError;
}

// =====================================================================
// Utilitários
// =====================================================================
const normalizeTipo = (t) => String(t || '').trim().toLowerCase();

const normalizeText = (s) =>
    String(s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

function clampLimit(raw) {
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0) return LIMIT_DEFAULT;
    return Math.min(n, LIMIT_MAX);
}

function clampOffset(raw) {
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0) return OFFSET_DEFAULT;
    return n;
}

// =====================================================================
// Resolução de escopo consolidado a partir de TODOS os UsuarioAcesso ativos
// =====================================================================
// Retorna:
//   { isAdmin: true }                                  -> sem restrição
//   { tipo: 'proprio', militarIds: [...] }             -> apenas militares específicos
//   { tipo: 'estrutura', estruturaIds: [...] }         -> filtro $in em estrutura_id
//   { tipo: 'vazio' }                                  -> usuário sem escopo válido
//   { tipo: 'invalido', reason: '...' }                -> erro de configuração (ex: proprio sem militar_id)
async function resolverEscopoConsolidado(base44, acessos) {
    if (!acessos || acessos.length === 0) {
        return { tipo: 'vazio' };
    }

    // Prioridade: admin > setor > subsetor > unidade > proprio
    const haveAdmin = acessos.some((a) => normalizeTipo(a.tipo_acesso) === 'admin');
    if (haveAdmin) return { isAdmin: true };

    const setores = acessos.filter((a) => normalizeTipo(a.tipo_acesso) === 'setor' && a.grupamento_id);
    const subsetores = acessos.filter((a) => normalizeTipo(a.tipo_acesso) === 'subsetor' && a.subgrupamento_id);
    const unidades = acessos.filter((a) => normalizeTipo(a.tipo_acesso) === 'unidade' && a.subgrupamento_id);
    const proprios = acessos.filter((a) => normalizeTipo(a.tipo_acesso) === 'proprio');

    // Se só houver "proprio", trata como filtro por militar_id
    const haNaoProprio = setores.length || subsetores.length || unidades.length;
    if (!haNaoProprio && proprios.length > 0) {
        const militarIds = proprios.map((a) => a.militar_id).filter(Boolean);
        if (militarIds.length === 0) {
            return {
                tipo: 'invalido',
                reason: 'PROPRIO_SEM_MILITAR_ID',
            };
        }
        return { tipo: 'proprio', militarIds };
    }

    // União de IDs de estrutura permitidos (sem ampliar além do que está cadastrado)
    const estruturaIds = new Set();

    // setor: grupamento_raiz_id => todos os descendentes
    if (setores.length > 0) {
        const grupamentoIds = [...new Set(setores.map((s) => s.grupamento_id).filter(Boolean))];
        grupamentoIds.forEach((id) => estruturaIds.add(id));
        const descendentes = await fetchWithRetry(
            () =>
                base44.asServiceRole.entities.Subgrupamento.filter(
                    { grupamento_raiz_id: { $in: grupamentoIds } },
                    undefined,
                    undefined,
                    ['id']
                ),
            'subgrupamento.descendentes_setor'
        );
        (descendentes || []).forEach((d) => d?.id && estruturaIds.add(d.id));
    }

    // subsetor: parent_id => unidades filhas diretas
    if (subsetores.length > 0) {
        const subIds = [...new Set(subsetores.map((s) => s.subgrupamento_id).filter(Boolean))];
        subIds.forEach((id) => estruturaIds.add(id));
        const filhos = await fetchWithRetry(
            () =>
                base44.asServiceRole.entities.Subgrupamento.filter(
                    { parent_id: { $in: subIds } },
                    undefined,
                    undefined,
                    ['id']
                ),
            'subgrupamento.filhos_subsetor'
        );
        (filhos || []).forEach((f) => f?.id && estruturaIds.add(f.id));
    }

    // unidade: somente o id da unidade
    if (unidades.length > 0) {
        unidades.forEach((u) => u.subgrupamento_id && estruturaIds.add(u.subgrupamento_id));
    }

    // Caso haja "proprio" combinado com escopo estrutural, mantemos os dois caminhos
    const militarIdsProprios = proprios.map((a) => a.militar_id).filter(Boolean);

    if (estruturaIds.size === 0 && militarIdsProprios.length === 0) {
        return { tipo: 'vazio' };
    }

    return {
        tipo: 'estrutura',
        estruturaIds: Array.from(estruturaIds),
        militarIdsProprios,
    };
}

// =====================================================================
// Handler
// =====================================================================
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Não autenticado', militares: [] }, { status: 401 });
        }

        // Parse seguro do body
        let payload = {};
        try {
            payload = await req.json();
        } catch (_e) {
            payload = {};
        }

        const {
            lotacaoFiltro,
            postoGraduacaoFiltro,
            search,
            statusCadastro,
            situacaoMilitar,
            limit,
            offset,
            includeFoto,
        } = payload || {};

        const effLimit = clampLimit(limit);
        const effOffset = clampOffset(offset);
        const effIncludeFoto = includeFoto === true;

        // 1. Buscar TODOS os UsuarioAcesso ativos do usuário
        const acessos = await fetchWithRetry(
            () =>
                base44.asServiceRole.entities.UsuarioAcesso.filter(
                    { user_email: user.email, ativo: true },
                    undefined,
                    undefined,
                    ['tipo_acesso', 'grupamento_id', 'subgrupamento_id', 'militar_id', 'perfil_id']
                ),
            'usuarioAcesso.list'
        );

        const isAdminByRole = String(user.role || '').toLowerCase() === 'admin';
        const isAdminByAccess = (acessos || []).some(
            (a) => normalizeTipo(a.tipo_acesso) === 'admin'
        );
        const isAdmin = isAdminByRole || isAdminByAccess;

        // 2. Resolver escopo
        let escopo;
        if (isAdmin) {
            escopo = { isAdmin: true };
        } else {
            escopo = await resolverEscopoConsolidado(base44, acessos || []);
        }

        // Caso: usuário sem nenhum acesso configurado e sem role admin
        if (!isAdmin && escopo.tipo === 'vazio') {
            return Response.json(
                {
                    militares: [],
                    meta: {
                        total: 0,
                        reason: 'SEM_ACESSO_CONFIGURADO',
                        scope_tipo: 'vazio',
                    },
                },
                { status: 200 }
            );
        }

        // Caso: configuração inválida (ex: proprio sem militar_id)
        if (!isAdmin && escopo.tipo === 'invalido') {
            return Response.json(
                {
                    error: 'Acesso "proprio" sem militar_id vinculado.',
                    militares: [],
                    meta: { reason: escopo.reason },
                },
                { status: 403 }
            );
        }

        // 3. Construir filtro base de Militar
        const baseFilter = {};

        if (postoGraduacaoFiltro) baseFilter.posto_graduacao = postoGraduacaoFiltro;
        if (statusCadastro) baseFilter.status_cadastro = statusCadastro;
        if (situacaoMilitar) baseFilter.situacao_militar = situacaoMilitar;

        // 4. Aplicar escopo + lotacaoFiltro
        let militarFilter = { ...baseFilter };
        let usouFiltroProprios = false;

        if (isAdmin) {
            if (lotacaoFiltro) {
                militarFilter.estrutura_id = lotacaoFiltro;
            }
        } else if (escopo.tipo === 'proprio') {
            // Acesso somente individual
            if (lotacaoFiltro) {
                // Não pode ampliar escopo
                return Response.json(
                    {
                        militares: [],
                        meta: { reason: 'LOTACAO_FORA_DO_ESCOPO', scope_tipo: 'proprio' },
                    },
                    { status: 200 }
                );
            }
            militarFilter.id = { $in: escopo.militarIds };
            usouFiltroProprios = true;
        } else if (escopo.tipo === 'estrutura') {
            const permitidos = escopo.estruturaIds || [];
            const proprios = escopo.militarIdsProprios || [];

            if (lotacaoFiltro) {
                if (!permitidos.includes(lotacaoFiltro)) {
                    return Response.json(
                        {
                            militares: [],
                            meta: { reason: 'LOTACAO_FORA_DO_ESCOPO', scope_tipo: 'estrutura' },
                        },
                        { status: 200 }
                    );
                }
                militarFilter.estrutura_id = lotacaoFiltro;
            } else if (permitidos.length > 0) {
                militarFilter.estrutura_id = { $in: permitidos };
            }

            // Se houver "proprios" combinados com estrutura, faremos uma segunda busca
            // mais abaixo, e uniremos os resultados (sem ampliar além do cadastrado).
            usouFiltroProprios = proprios.length > 0;
        }

        // 5. Seleção de campos (foto somente se solicitado)
        const campos = effIncludeFoto ? [...CAMPOS_BASE_MILITAR, 'foto'] : CAMPOS_BASE_MILITAR;

        // 6. Buscar militares (com paginação SDK quando search NÃO foi enviado)
        // Quando search é enviado, ampliamos o conjunto carregado (até LIMIT_MAX)
        // para filtrar localmente, mas SEM remover o limite.
        const fetchLimit = search ? LIMIT_MAX : effLimit;
        const fetchOffset = search ? 0 : effOffset;

        const militaresEstrutura = await fetchWithRetry(
            () =>
                base44.asServiceRole.entities.Militar.filter(
                    militarFilter,
                    '-nome_completo',
                    fetchLimit,
                    campos,
                    fetchOffset
                ),
            'militar.filter.principal'
        );

        // 6b. União com militares "proprios" quando aplicável (escopo estrutura + proprio)
        let militaresProprios = [];
        if (
            !isAdmin &&
            escopo.tipo === 'estrutura' &&
            usouFiltroProprios &&
            (escopo.militarIdsProprios || []).length > 0 &&
            !lotacaoFiltro // se há lotacaoFiltro, já restringimos a estrutura
        ) {
            const proprioFilter = { ...baseFilter, id: { $in: escopo.militarIdsProprios } };
            militaresProprios = await fetchWithRetry(
                () =>
                    base44.asServiceRole.entities.Militar.filter(
                        proprioFilter,
                        '-nome_completo',
                        LIMIT_MAX,
                        campos
                    ),
                'militar.filter.proprios'
            );
        }

        // União por id
        const mapaUniao = new Map();
        (militaresEstrutura || []).forEach((m) => m?.id && mapaUniao.set(m.id, m));
        (militaresProprios || []).forEach((m) => m?.id && !mapaUniao.has(m.id) && mapaUniao.set(m.id, m));
        let militares = Array.from(mapaUniao.values());

        // 7. Busca textual (aplicada localmente sobre o conjunto já escopado)
        let buscaAplicada = false;
        let buscaLimitada = false;
        if (search && String(search).trim()) {
            const term = normalizeText(String(search).trim());
            militares = militares.filter((m) => {
                return (
                    normalizeText(m.nome_completo).includes(term) ||
                    normalizeText(m.nome_guerra).includes(term) ||
                    normalizeText(m.matricula).includes(term)
                );
            });
            buscaAplicada = true;
            // Se trouxemos LIMIT_MAX, há risco de o resultado completo ter ficado fora
            buscaLimitada = (militaresEstrutura || []).length >= LIMIT_MAX;

            // Reaplicar paginação após filtro textual
            militares = militares.slice(effOffset, effOffset + effLimit);
        }

        return Response.json({
            militares,
            meta: {
                total: militares.length,
                limit: effLimit,
                offset: effOffset,
                scope_tipo: isAdmin ? 'admin' : escopo.tipo,
                aplicou_filtro_lotacao: !!lotacaoFiltro,
                aplicou_filtro_posto: !!postoGraduacaoFiltro,
                aplicou_filtro_status: !!statusCadastro,
                aplicou_filtro_situacao: !!situacaoMilitar,
                busca_aplicada: buscaAplicada,
                busca_limitada_por_amostra: buscaLimitada,
                include_foto: effIncludeFoto,
            },
        });
    } catch (error) {
        const status = error?.response?.status || error?.status || 500;
        console.error('[getScopedMilitares] erro fatal:', {
            message: error?.message,
            status,
        });
        return Response.json(
            {
                error: error?.message || 'Erro interno ao buscar militares',
                militares: [],
            },
            { status }
        );
    }
});