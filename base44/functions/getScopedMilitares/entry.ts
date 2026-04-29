import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// =====================================================================
// Constantes
// =====================================================================
const LIMIT_DEFAULT = 100;
const LIMIT_MAX = 300;
const OFFSET_DEFAULT = 0;

const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 450;
const RETRY_STATUS = new Set([408, 429, 500, 502, 503, 504]);

// Campos base da entidade Militar (sem foto por padrão)
// IMPORTANTE: A seleção de campos do SDK Base44 nem sempre é honrada na resposta;
// por isso aplicamos uma projeção manual no servidor antes de retornar.
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

const CAMPOS_USUARIO_ACESSO = [
    'id',
    'user_email',
    'ativo',
    'tipo_acesso',
    'grupamento_id',
    'subgrupamento_id',
    'militar_id',
    'perfil_id',
];

function projetarMilitar(m, campos) {
    if (!m || typeof m !== 'object') return m;
    const out = {};
    campos.forEach((k) => {
        if (k in m) out[k] = m[k];
    });
    return out;
}

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
const normalizeEmail = (e) => String(e || '').trim().toLowerCase();

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
// Resolução de escopo consolidado
// =====================================================================
async function resolverEscopoConsolidado(base44, acessos) {
    if (!acessos || acessos.length === 0) {
        return { tipo: 'vazio' };
    }

    const haveAdmin = acessos.some((a) => normalizeTipo(a.tipo_acesso) === 'admin');
    if (haveAdmin) return { isAdmin: true };

    const setores = acessos.filter((a) => normalizeTipo(a.tipo_acesso) === 'setor' && a.grupamento_id);
    const subsetores = acessos.filter((a) => normalizeTipo(a.tipo_acesso) === 'subsetor' && a.subgrupamento_id);
    const unidades = acessos.filter((a) => normalizeTipo(a.tipo_acesso) === 'unidade' && a.subgrupamento_id);
    const proprios = acessos.filter((a) => normalizeTipo(a.tipo_acesso) === 'proprio');

    const haNaoProprio = setores.length || subsetores.length || unidades.length;
    if (!haNaoProprio && proprios.length > 0) {
        const militarIds = proprios.map((a) => a.militar_id).filter(Boolean);
        if (militarIds.length === 0) {
            return { tipo: 'invalido', reason: 'PROPRIO_SEM_MILITAR_ID' };
        }
        return { tipo: 'proprio', militarIds };
    }

    const estruturaIds = new Set();

    if (setores.length > 0) {
        const grupamentoIds = [...new Set(setores.map((s) => s.grupamento_id).filter(Boolean))];
        grupamentoIds.forEach((id) => estruturaIds.add(id));
        const descendentes = await fetchWithRetry(
            () =>
                base44.asServiceRole.entities.Subgrupamento.filter(
                    { grupamento_raiz_id: { $in: grupamentoIds } },
                    undefined,
                    LIMIT_MAX,
                    0,
                    ['id']
                ),
            'subgrupamento.descendentes_setor'
        );
        (descendentes || []).forEach((d) => d?.id && estruturaIds.add(d.id));
    }

    if (subsetores.length > 0) {
        const subIds = [...new Set(subsetores.map((s) => s.subgrupamento_id).filter(Boolean))];
        subIds.forEach((id) => estruturaIds.add(id));
        const filhos = await fetchWithRetry(
            () =>
                base44.asServiceRole.entities.Subgrupamento.filter(
                    { parent_id: { $in: subIds } },
                    undefined,
                    LIMIT_MAX,
                    0,
                    ['id']
                ),
            'subgrupamento.filhos_subsetor'
        );
        (filhos || []).forEach((f) => f?.id && estruturaIds.add(f.id));
    }

    if (unidades.length > 0) {
        unidades.forEach((u) => u.subgrupamento_id && estruturaIds.add(u.subgrupamento_id));
    }

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
//
// Suporte a "effectiveEmail" (modo usuário efetivo / impersonação para
// suporte e testes administrativos). A validação é a mesma de
// getUserPermissions: somente admins reais (por role ou por UsuarioAcesso
// tipo_acesso='admin') podem usar effectiveEmail. A barra "Você está
// agindo como..." do preview do Base44 NÃO é fonte para isso — usamos
// somente sgp_effective_user_email (sessionStorage) como ponte controlada.
// =====================================================================
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        const authUser = await base44.auth.me();
        if (!authUser) {
            return Response.json({ error: 'Não autenticado', militares: [] }, { status: 401 });
        }

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
            effectiveEmail,
        } = payload || {};

        const effLimit = clampLimit(limit);
        const effOffset = clampOffset(offset);
        const effIncludeFoto = includeFoto === true;

        const authUserEmail = normalizeEmail(authUser.email);
        const effectiveEmailNorm = normalizeEmail(effectiveEmail);
        const wantsImpersonation = Boolean(effectiveEmailNorm) && effectiveEmailNorm !== authUserEmail;

        // 1. Buscar UsuarioAcesso do usuário autenticado real (sempre, para validar admin)
        const acessosAuth = await fetchWithRetry(
            () =>
                base44.asServiceRole.entities.UsuarioAcesso.filter(
                    { user_email: authUser.email, ativo: true },
                    undefined,
                    LIMIT_MAX,
                    0,
                    CAMPOS_USUARIO_ACESSO
                ),
            'usuarioAcesso.list.auth'
        );

        const authIsAdminByRole = String(authUser.role || '').toLowerCase() === 'admin';
        const authIsAdminByAccess = (acessosAuth || []).some(
            (a) => normalizeTipo(a.tipo_acesso) === 'admin'
        );
        const authIsAdmin = authIsAdminByRole || authIsAdminByAccess;

        // 2. Validação de impersonação
        if (wantsImpersonation && !authIsAdmin) {
            console.warn('[getScopedMilitares] tentativa de impersonação por não-admin', {
                authUserEmail,
                effectiveEmailNorm,
            });
            return Response.json(
                { error: 'Ação não permitida: somente administradores podem usar effectiveEmail.', militares: [] },
                { status: 403 }
            );
        }

        const isImpersonating = wantsImpersonation && authIsAdmin;
        const targetEmail = isImpersonating ? effectiveEmailNorm : authUser.email;

        // 3. Buscar UsuarioAcesso do email-alvo (reaproveita se não impersonando)
        const acessos = isImpersonating
            ? await fetchWithRetry(
                () =>
                    base44.asServiceRole.entities.UsuarioAcesso.filter(
                        { user_email: targetEmail, ativo: true },
                        undefined,
                        LIMIT_MAX,
                        0,
                        CAMPOS_USUARIO_ACESSO
                    ),
                'usuarioAcesso.list.target'
            )
            : (acessosAuth || []);

        // 4. Calcular admin DO USUÁRIO EFETIVO
        // SEGURANÇA: quando impersonando, NÃO consideramos role do autenticado.
        const isAdminByRole = isImpersonating
            ? false
            : authIsAdminByRole;
        const isAdminByAccess = (acessos || []).some(
            (a) => normalizeTipo(a.tipo_acesso) === 'admin'
        );
        const isAdmin = isAdminByRole || isAdminByAccess;

        // 5. Resolver escopo
        let escopo;
        if (isAdmin) {
            escopo = { isAdmin: true };
        } else {
            escopo = await resolverEscopoConsolidado(base44, acessos || []);
        }

        const baseMeta = {
            authUserEmail: authUser.email,
            effectiveUserEmail: isImpersonating ? targetEmail : authUser.email,
            isImpersonating,
        };

        if (!isAdmin && escopo.tipo === 'vazio') {
            return Response.json(
                {
                    militares: [],
                    meta: {
                        ...baseMeta,
                        returned: 0,
                        limit: effLimit,
                        offset: effOffset,
                        hasMore: false,
                        offsetAplicadoNaConsulta: false,
                        scope_tipo: 'vazio',
                        reason: 'SEM_ACESSO_CONFIGURADO',
                    },
                },
                { status: 200 }
            );
        }

        if (!isAdmin && escopo.tipo === 'invalido') {
            return Response.json(
                {
                    error: 'Acesso "proprio" sem militar_id vinculado.',
                    militares: [],
                    meta: { ...baseMeta, reason: escopo.reason },
                },
                { status: 403 }
            );
        }

        // 6. Filtro base
        const baseFilter = {};
        if (postoGraduacaoFiltro) baseFilter.posto_graduacao = postoGraduacaoFiltro;
        if (statusCadastro) baseFilter.status_cadastro = statusCadastro;
        if (situacaoMilitar) baseFilter.situacao_militar = situacaoMilitar;

        // 7. Aplicar escopo + lotacaoFiltro
        let militarFilter = { ...baseFilter };
        let usouFiltroProprios = false;

        if (isAdmin) {
            if (lotacaoFiltro) militarFilter.estrutura_id = lotacaoFiltro;
        } else if (escopo.tipo === 'proprio') {
            if (lotacaoFiltro) {
                return Response.json(
                    {
                        militares: [],
                        meta: {
                            ...baseMeta,
                            returned: 0,
                            limit: effLimit,
                            offset: effOffset,
                            hasMore: false,
                            offsetAplicadoNaConsulta: false,
                            scope_tipo: 'proprio',
                            reason: 'LOTACAO_FORA_DO_ESCOPO',
                        },
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
                            meta: {
                                ...baseMeta,
                                returned: 0,
                                limit: effLimit,
                                offset: effOffset,
                                hasMore: false,
                                offsetAplicadoNaConsulta: false,
                                scope_tipo: 'estrutura',
                                reason: 'LOTACAO_FORA_DO_ESCOPO',
                            },
                        },
                        { status: 200 }
                    );
                }
                militarFilter.estrutura_id = lotacaoFiltro;
            } else if (permitidos.length > 0) {
                militarFilter.estrutura_id = { $in: permitidos };
            }

            usouFiltroProprios = proprios.length > 0;
        }

        // 8. Seleção de campos
        const campos = effIncludeFoto ? [...CAMPOS_BASE_MILITAR, 'foto'] : CAMPOS_BASE_MILITAR;

        // 9. Buscar militares
        const semBusca = !search || !String(search).trim();

        let militares = [];
        let offsetAplicadoNaConsulta = false;
        let buscaAplicada = false;
        let buscaLimitadaPorAmostra = false;
        let hasMore = false;

        if (semBusca) {
            const fetchLimit = effLimit + 1;
            const result = await fetchWithRetry(
                () =>
                    base44.asServiceRole.entities.Militar.filter(
                        militarFilter,
                        '-nome_completo',
                        fetchLimit,
                        effOffset,
                        campos
                    ),
                'militar.filter.principal'
            );
            offsetAplicadoNaConsulta = true;
            const arr = result || [];
            hasMore = arr.length > effLimit;
            militares = hasMore ? arr.slice(0, effLimit) : arr;

            if (
                !isAdmin &&
                escopo.tipo === 'estrutura' &&
                usouFiltroProprios &&
                (escopo.militarIdsProprios || []).length > 0 &&
                !lotacaoFiltro
            ) {
                const proprioFilter = { ...baseFilter, id: { $in: escopo.militarIdsProprios } };
                const proprios = await fetchWithRetry(
                    () =>
                        base44.asServiceRole.entities.Militar.filter(
                            proprioFilter,
                            '-nome_completo',
                            LIMIT_MAX,
                            0,
                            campos
                        ),
                    'militar.filter.proprios'
                );
                const mapa = new Map();
                militares.forEach((m) => m?.id && mapa.set(m.id, m));
                (proprios || []).forEach((m) => m?.id && !mapa.has(m.id) && mapa.set(m.id, m));
                militares = Array.from(mapa.values()).slice(0, effLimit);
            }
        } else {
            const amostra = await fetchWithRetry(
                () =>
                    base44.asServiceRole.entities.Militar.filter(
                        militarFilter,
                        '-nome_completo',
                        LIMIT_MAX,
                        0,
                        campos
                    ),
                'militar.filter.search'
            );
            offsetAplicadoNaConsulta = false;
            buscaLimitadaPorAmostra = (amostra || []).length >= LIMIT_MAX;

            const term = normalizeText(String(search).trim());
            let filtrados = (amostra || []).filter((m) => {
                return (
                    normalizeText(m.nome_completo).includes(term) ||
                    normalizeText(m.nome_guerra).includes(term) ||
                    normalizeText(m.matricula).includes(term)
                );
            });
            buscaAplicada = true;

            const total = filtrados.length;
            const pageSlice = filtrados.slice(effOffset, effOffset + effLimit);
            hasMore = effOffset + pageSlice.length < total || buscaLimitadaPorAmostra;
            militares = pageSlice;
        }

        const militaresProjetados = militares.map((m) => projetarMilitar(m, campos));

        return Response.json({
            militares: militaresProjetados,
            meta: {
                ...baseMeta,
                returned: militaresProjetados.length,
                limit: effLimit,
                offset: effOffset,
                hasMore,
                offsetAplicadoNaConsulta,
                scope_tipo: isAdmin ? 'admin' : escopo.tipo,
                aplicou_filtro_lotacao: !!lotacaoFiltro,
                aplicou_filtro_posto: !!postoGraduacaoFiltro,
                aplicou_filtro_status: !!statusCadastro,
                aplicou_filtro_situacao: !!situacaoMilitar,
                busca_aplicada: buscaAplicada,
                busca_limitada_por_amostra: buscaLimitadaPorAmostra,
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
            { error: error?.message || 'Erro interno ao buscar militares', militares: [] },
            { status }
        );
    }
});