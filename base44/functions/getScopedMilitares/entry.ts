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
    'condicao_movimento',
    'condicao_origem_destino',
    'destino',
    'ltip_data_inicio',
    'ltip_data_fim',
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

// Sanitiza array de militarIds: aceita apenas strings não vazias, dedup,
// e impõe um teto de segurança (LIMIT_MAX) para evitar queries enormes.
function sanitizeMilitarIds(raw) {
    if (!Array.isArray(raw)) return null;
    const set = new Set();
    for (const v of raw) {
        if (typeof v !== 'string') continue;
        const trimmed = v.trim();
        if (trimmed) set.add(trimmed);
        if (set.size >= LIMIT_MAX) break;
    }
    return set.size > 0 ? Array.from(set) : null;
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


async function listarDescendentesSubgrupamento(base44, raizIds) {
    const visitados = new Set((raizIds || []).filter(Boolean));
    const fila = [...visitados];

    while (fila.length > 0) {
        const lote = fila.splice(0, LIMIT_MAX);
        const filhos = await fetchWithRetry(
            () =>
                base44.asServiceRole.entities.Subgrupamento.filter(
                    { parent_id: { $in: lote } },
                    undefined,
                    LIMIT_MAX,
                    0,
                    ['id']
                ),
            'subgrupamento.descendentes_lotacao_filtro'
        );

        for (const filho of filhos || []) {
            const id = filho?.id;
            if (!id || visitados.has(id)) continue;
            visitados.add(id);
            fila.push(id);
        }
    }

    return Array.from(visitados);
}

async function resolverEstruturasLotacaoFiltro(base44, lotacaoFiltro, permitidos = null) {
    const lotacaoId = String(lotacaoFiltro || '').trim();
    if (!lotacaoId) return [];

    const candidatos = new Set([lotacaoId]);

    const itemSubgrupamento = await fetchWithRetry(
        () => base44.asServiceRole.entities.Subgrupamento.get(lotacaoId),
        'subgrupamento.get.lotacao_filtro'
    ).catch(() => null);

    if (itemSubgrupamento?.id) {
        const subDesc = await listarDescendentesSubgrupamento(base44, [itemSubgrupamento.id]);
        subDesc.forEach((id) => candidatos.add(id));
    }

    const descendentesSetor = await fetchWithRetry(
        () =>
            base44.asServiceRole.entities.Subgrupamento.filter(
                { grupamento_raiz_id: lotacaoId },
                undefined,
                LIMIT_MAX,
                0,
                ['id']
            ),
        'subgrupamento.descendentes_setor_lotacao_filtro'
    ).catch(() => []);
    (descendentesSetor || []).forEach((d) => d?.id && candidatos.add(d.id));

    if (!permitidos) return Array.from(candidatos);

    const permitidosSet = new Set((permitidos || []).map((id) => String(id)));
    return Array.from(candidatos).filter((id) => permitidosSet.has(String(id)));
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
//
// Suporte a "militarIds" (Lote 1B.1): permite hidratar 1+ militares
// específicos sem ampliar o escopo. A interseção com o escopo do usuário
// efetivo é SEMPRE aplicada — IDs fora do escopo são silenciosamente
// descartados. Quando militarIds é informado, "search" é ignorado.
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
            postoGraduacaoFiltros: postoGraduacaoFiltrosRaw,
            search,
            statusCadastro,
            situacaoMilitar,
            condicaoMovimento,
            limit,
            offset,
            includeFoto,
            effectiveEmail,
            militarIds: militarIdsRaw,
        } = payload || {};

        // Sanitização: aceita 'entrada' | 'saida'
        const condicaoMovimentoFiltro = (() => {
            const v = String(condicaoMovimento || '').trim().toLowerCase();
            return v === 'entrada' || v === 'saida' ? v : null;
        })();

        // Suporte a múltiplos postos via $in (Lote 1C-A) — aditivo e
        // retrocompatível com postoGraduacaoFiltro (string única).
        // Se ambos forem fornecidos, postoGraduacaoFiltros prevalece.
        const postoGraduacaoFiltros = Array.isArray(postoGraduacaoFiltrosRaw)
            ? [...new Set(postoGraduacaoFiltrosRaw.filter((p) => typeof p === 'string' && p.trim()))]
            : null;

        const effLimit = clampLimit(limit);
        const effOffset = clampOffset(offset);
        const effIncludeFoto = includeFoto === true;
        const militarIdsFiltro = sanitizeMilitarIds(militarIdsRaw);
        const aplicouFiltroMilitarIds = militarIdsFiltro !== null;
        const militarIdsSolicitados = aplicouFiltroMilitarIds ? militarIdsFiltro.length : 0;

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
            aplicou_filtro_militar_ids: aplicouFiltroMilitarIds,
            militar_ids_solicitados: militarIdsSolicitados,
        };

        if (!isAdmin && escopo.tipo === 'vazio') {
            return Response.json(
                {
                    militares: [],
                    meta: {
                        ...baseMeta,
                        returned: 0,
                        militar_ids_retornados: 0,
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
                    meta: { ...baseMeta, militar_ids_retornados: 0, reason: escopo.reason },
                },
                { status: 403 }
            );
        }

        // 6. Filtro base
        const baseFilter = {};
        if (postoGraduacaoFiltros && postoGraduacaoFiltros.length > 0) {
            baseFilter.posto_graduacao = { $in: postoGraduacaoFiltros };
        } else if (postoGraduacaoFiltro) {
            baseFilter.posto_graduacao = postoGraduacaoFiltro;
        }
        if (statusCadastro) baseFilter.status_cadastro = statusCadastro;
        if (situacaoMilitar) baseFilter.situacao_militar = situacaoMilitar;
        if (condicaoMovimentoFiltro) baseFilter.condicao_movimento = condicaoMovimentoFiltro;

        // 7. Aplicar escopo + lotacaoFiltro
        let militarFilter = { ...baseFilter };
        let usouFiltroProprios = false;

        if (isAdmin) {
            if (lotacaoFiltro) {
                const estruturasFiltradas = await resolverEstruturasLotacaoFiltro(base44, lotacaoFiltro);
                militarFilter.estrutura_id = estruturasFiltradas.length > 0
                    ? { $in: estruturasFiltradas }
                    : lotacaoFiltro;
            }
        } else if (escopo.tipo === 'proprio') {
            if (lotacaoFiltro) {
                return Response.json(
                    {
                        militares: [],
                        meta: {
                            ...baseMeta,
                            returned: 0,
                            militar_ids_retornados: 0,
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
                                militar_ids_retornados: 0,
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

                const estruturasFiltradas = await resolverEstruturasLotacaoFiltro(base44, lotacaoFiltro, permitidos);
                if (estruturasFiltradas.length === 0) {
                    return Response.json(
                        {
                            militares: [],
                            meta: {
                                ...baseMeta,
                                returned: 0,
                                militar_ids_retornados: 0,
                                limit: effLimit,
                                offset: effOffset,
                                hasMore: false,
                                offsetAplicadoNaConsulta: false,
                                scope_tipo: 'estrutura',
                                reason: 'LOTACAO_SEM_DESCENDENTES_PERMITIDOS',
                            },
                        },
                        { status: 200 }
                    );
                }
                militarFilter.estrutura_id = { $in: estruturasFiltradas };
            } else if (permitidos.length > 0) {
                militarFilter.estrutura_id = { $in: permitidos };
            }

            usouFiltroProprios = proprios.length > 0;
        }

        // 8. Seleção de campos
        const campos = effIncludeFoto ? [...CAMPOS_BASE_MILITAR, 'foto'] : CAMPOS_BASE_MILITAR;

        // 9. Buscar militares
        // ATENÇÃO: quando militarIds é informado, ignoramos `search` (não faz
        // sentido cruzar) e ignoramos a paginação completa — a interseção
        // resultante é o conjunto autoritativo, e aplicamos limit/offset apenas
        // no slice final.
        const semBusca = aplicouFiltroMilitarIds || !search || !String(search).trim();

        let militares = [];
        let offsetAplicadoNaConsulta = false;
        let buscaAplicada = false;
        let buscaLimitadaPorAmostra = false;
        let hasMore = false;

        if (aplicouFiltroMilitarIds) {
            // Caminho dedicado: militarIds com interseção de escopo.
            const idsSolicitadosSet = new Set(militarIdsFiltro);
            let idsPermitidosParaConsulta;

            if (isAdmin) {
                idsPermitidosParaConsulta = militarIdsFiltro;
            } else if (escopo.tipo === 'proprio') {
                idsPermitidosParaConsulta = militarIdsFiltro.filter((id) =>
                    (escopo.militarIds || []).includes(id)
                );
            } else if (escopo.tipo === 'estrutura') {
                // Para estrutura, a interseção real depende do estrutura_id de cada
                // militar — então fazemos a query restringindo por id ∈ militarIds
                // E aplicando o filtro de escopo (estrutura_id ∈ permitidos OU id ∈ próprios).
                // Para simplificar e manter precisão, fazemos duas queries e unimos:
                //   q1: id ∈ militarIds AND estrutura_id ∈ permitidos
                //   q2: id ∈ militarIds AND id ∈ militarIdsProprios
                idsPermitidosParaConsulta = militarIdsFiltro;
            } else {
                idsPermitidosParaConsulta = [];
            }

            if (idsPermitidosParaConsulta.length === 0) {
                militares = [];
            } else if (isAdmin || escopo.tipo === 'proprio') {
                const filtroFinal = { ...baseFilter, id: { $in: idsPermitidosParaConsulta } };
                if (isAdmin && lotacaoFiltro) {
                    const estruturasFiltradas = await resolverEstruturasLotacaoFiltro(base44, lotacaoFiltro);
                    filtroFinal.estrutura_id = estruturasFiltradas.length > 0
                        ? { $in: estruturasFiltradas }
                        : lotacaoFiltro;
                }
                const result = await fetchWithRetry(
                    () =>
                        base44.asServiceRole.entities.Militar.filter(
                            filtroFinal,
                            '-nome_completo',
                            LIMIT_MAX,
                            0,
                            campos
                        ),
                    'militar.filter.por_ids.admin_ou_proprio'
                );
                militares = (result || []).filter((m) => idsSolicitadosSet.has(m?.id));
            } else if (escopo.tipo === 'estrutura') {
                const permitidos = escopo.estruturaIds || [];
                const propriosScope = escopo.militarIdsProprios || [];
                const mapa = new Map();
                const estruturasPermitidasLotacao = lotacaoFiltro
                    ? await resolverEstruturasLotacaoFiltro(base44, lotacaoFiltro, permitidos)
                    : permitidos;

                if (estruturasPermitidasLotacao.length > 0) {
                    const filtroEstr = {
                        ...baseFilter,
                        id: { $in: idsPermitidosParaConsulta },
                        estrutura_id: { $in: estruturasPermitidasLotacao },
                    };
                    const r1 = await fetchWithRetry(
                        () =>
                            base44.asServiceRole.entities.Militar.filter(
                                filtroEstr,
                                '-nome_completo',
                                LIMIT_MAX,
                                0,
                                campos
                            ),
                        'militar.filter.por_ids.estrutura'
                    );
                    (r1 || []).forEach((m) => {
                        if (m?.id && idsSolicitadosSet.has(m.id)) mapa.set(m.id, m);
                    });
                }

                if (!lotacaoFiltro && propriosScope.length > 0) {
                    const idsInter = idsPermitidosParaConsulta.filter((id) => propriosScope.includes(id));
                    if (idsInter.length > 0) {
                        const filtroProp = { ...baseFilter, id: { $in: idsInter } };
                        const r2 = await fetchWithRetry(
                            () =>
                                base44.asServiceRole.entities.Militar.filter(
                                    filtroProp,
                                    '-nome_completo',
                                    LIMIT_MAX,
                                    0,
                                    campos
                                ),
                            'militar.filter.por_ids.proprios'
                        );
                        (r2 || []).forEach((m) => {
                            if (m?.id && idsSolicitadosSet.has(m.id) && !mapa.has(m.id)) {
                                mapa.set(m.id, m);
                            }
                        });
                    }
                }

                militares = Array.from(mapa.values());
            }

            // Paginação no slice final
            offsetAplicadoNaConsulta = false;
            const total = militares.length;
            militares = militares.slice(effOffset, effOffset + effLimit);
            hasMore = effOffset + militares.length < total;
        } else if (semBusca) {
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
                militar_ids_retornados: aplicouFiltroMilitarIds ? militaresProjetados.length : 0,
                limit: effLimit,
                offset: effOffset,
                hasMore,
                offsetAplicadoNaConsulta,
                scope_tipo: isAdmin ? 'admin' : escopo.tipo,
                aplicou_filtro_lotacao: !!lotacaoFiltro,
                aplicou_filtro_posto: !!postoGraduacaoFiltro || (postoGraduacaoFiltros && postoGraduacaoFiltros.length > 0),
                postos_solicitados: postoGraduacaoFiltros ? postoGraduacaoFiltros.length : (postoGraduacaoFiltro ? 1 : 0),
                aplicou_filtro_status: !!statusCadastro,
                aplicou_filtro_situacao: !!situacaoMilitar,
                aplicou_filtro_condicao_movimento: !!condicaoMovimentoFiltro,
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