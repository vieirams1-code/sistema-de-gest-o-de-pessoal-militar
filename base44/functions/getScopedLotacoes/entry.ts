import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// =====================================================================
// getScopedLotacoes — Lote 1C-A
// ---------------------------------------------------------------------
// Deno Function que retorna a lista de Subgrupamentos (lotações) que o
// usuário efetivo tem permissão de visualizar, aplicando o mesmo modelo
// de impersonação e resolução de escopo já adotado em getScopedMilitares
// e getUserPermissions.
//
// Esta função substitui a chamada direta `base44.entities.Subgrupamento.list`
// que era feita no frontend pelo filtro de lotações em pages/Militares.jsx
// e que vinha causando o erro "Rate limit excedido ao carregar lotações".
//
// Regras de escopo:
//   - admin       → todas as lotações ativas
//   - setor       → grupamento_id + descendentes (via grupamento_raiz_id)
//   - subsetor    → subgrupamento_id + filhos diretos (via parent_id)
//   - unidade     → apenas o subgrupamento_id
//   - proprio     → vazio (não faz sentido listar lotações para escopo
//                   individual; manteremos por simplicidade e segurança)
//   - sem acesso  → vazio com meta.reason = SEM_ACESSO_CONFIGURADO
// =====================================================================

const LIMIT_MAX = 500;

const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 450;
const RETRY_STATUS = new Set([408, 429, 500, 502, 503, 504]);

const CAMPOS_SUBGRUPAMENTO = [
    'id',
    'nome',
    'sigla',
    'tipo',
    'parent_id',
    'grupamento_id',
    'grupamento_raiz_id',
    'ativo',
];

const normalizeTipo = (t) => String(t || '').trim().toLowerCase();
const normalizeEmail = (e) => String(e || '').trim().toLowerCase();

function projetar(item, campos) {
    if (!item || typeof item !== 'object') return item;
    const out = {};
    campos.forEach((k) => {
        if (k in item) out[k] = item[k];
    });
    return out;
}

async function fetchWithRetry(queryFn, label = 'query') {
    let lastError;
    for (let attempt = 1; attempt <= RETRY_MAX_ATTEMPTS; attempt++) {
        try {
            const result = await queryFn();
            if (attempt > 1) {
                console.info(`[getScopedLotacoes] step=${label} attempt=${attempt} status=ok (after retry)`);
            }
            return result;
        } catch (error) {
            lastError = error;
            const status = error?.response?.status || error?.status || 0;
            const isRetryable = RETRY_STATUS.has(status);
            console.warn(
                `[getScopedLotacoes] step=${label} attempt=${attempt}/${RETRY_MAX_ATTEMPTS} status=${status || 'N/A'} retryable=${isRetryable}`
            );
            if (!isRetryable || attempt === RETRY_MAX_ATTEMPTS) break;
            const exp = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
            const jitter = Math.floor(Math.random() * 200);
            await new Promise((res) => setTimeout(res, exp + jitter));
        }
    }
    throw lastError;
}

async function resolverAutorizacaoCanonica(base44, effectiveEmail) {
    const requestPayload = effectiveEmail ? { effectiveEmail } : {};
    const response = await base44.functions.invoke('getUserPermissions', requestPayload);
    return response?.data ?? response ?? {};
}

// =====================================================================
// Construção de árvore hierárquica de lotações
// ---------------------------------------------------------------------
// Replica a função `buildLotacoesTree` antes existente em
// pages/Militares.jsx para que o frontend receba a árvore pronta e não
// precise reconstruí-la a cada render.
// =====================================================================
const TIPO_ORDEM_TREE = { root: 0, setor: 1, subsetor: 2, unidade: 3 };

function normalizeLotacaoTipoTree(item = {}) {
    const tipoRaw = String(item?.estrutura_tipo || item?.tipo || item?.subgrupamento_tipo || '').toLowerCase();
    if (tipoRaw.includes('setor') || tipoRaw.includes('grupamento')) return 'setor';
    if (tipoRaw.includes('subsetor') || tipoRaw.includes('subgrupamento')) return 'subsetor';
    if (tipoRaw.includes('unidade')) return 'unidade';
    if (!item?.parent_id && !item?.grupamento_id) return 'setor';
    return 'unidade';
}

function buildLotacoesTree(flatLotacoes = []) {
    const byId = new Map();

    (flatLotacoes || []).forEach((item) => {
        const id = String(item?.id || '');
        if (!id) return;
        const nome = String(item?.nome || '').trim();
        const sigla = String(item?.sigla || '').trim();
        const tipo = normalizeLotacaoTipoTree(item);
        const subtitle = [sigla, tipo !== 'unidade' ? tipo.toUpperCase() : ''].filter(Boolean).join(' • ');
        const parentId = String(
            item?.parent_id
            || item?.setor_pai_id
            || item?.grupamento_id
            || item?.grupamento_raiz_id
            || ''
        ).trim();

        byId.set(id, {
            id,
            label: nome || sigla || id,
            subtitle: subtitle || undefined,
            type: tipo,
            parentId,
            children: [],
        });
    });

    const roots = [];
    byId.forEach((node) => {
        if (node.parentId && byId.has(node.parentId) && node.parentId !== node.id) {
            byId.get(node.parentId).children.push(node);
        } else {
            roots.push(node);
        }
    });

    const sortNodes = (nodes) => {
        nodes.sort((a, b) => {
            const typeDiff = (TIPO_ORDEM_TREE[a.type] ?? 99) - (TIPO_ORDEM_TREE[b.type] ?? 99);
            if (typeDiff !== 0) return typeDiff;
            return a.label.localeCompare(b.label, 'pt-BR');
        });
        nodes.forEach((node) => sortNodes(node.children));
        return nodes;
    };

    return sortNodes(roots).map(({ parentId, ...node }) => node);
}

function isLotacaoAtiva(item) {
    // Mesma heurística usada antes no frontend: se algum dos flags marca
    // o item como inativo/excluído/arquivado, descartamos.
    if (!item) return false;
    if (item.ativo === false) return false;
    if (item.deleted === true) return false;
    if (item.is_deleted === true) return false;
    if (item.excluido === true) return false;
    if (item.archived === true) return false;
    if (item.arquivado === true) return false;
    const status = String(item.status || '').trim().toLowerCase();
    if (status === 'excluído' || status === 'excluido' || status === 'inativo') return false;
    return true;
}

// =====================================================================
// Resolução de escopo de lotações
// =====================================================================
// Retorna:
//   { isAdmin: true }                              — admin
//   { tipo: 'estrutura', estruturaIds: [...] }     — setor/subsetor/unidade
//   { tipo: 'proprio' }                            — apenas escopo próprio
//   { tipo: 'vazio' }                              — sem acesso
async function resolverEscopoLotacoes(base44, acessos) {
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
        // proprio puro: não listamos lotações
        return { tipo: 'proprio' };
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

    if (estruturaIds.size === 0) {
        return { tipo: 'vazio' };
    }

    return { tipo: 'estrutura', estruturaIds: Array.from(estruturaIds) };
}

// =====================================================================
// Handler
// =====================================================================
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        const authUser = await base44.auth.me();
        if (!authUser) {
            return Response.json({ error: 'Não autenticado', lotacoes: [] }, { status: 401 });
        }

        let payload = {};
        try {
            payload = await req.json();
        } catch (_e) {
            payload = {};
        }

        const { effectiveEmail } = payload || {};

        const authz = await resolverAutorizacaoCanonica(base44, effectiveEmail);
        if (authz?.error) {
            return Response.json({ error: authz.error, lotacoes: [] }, { status: 403 });
        }
        const authUserEmail = normalizeEmail(authz?.authUserEmail || authUser.email);
        const targetEmail = normalizeEmail(authz?.effectiveUserEmail || authUser.email);
        const isImpersonating = authz?.isImpersonating === true;
        const isPlatformAdmin = authz?.isAdmin === true;
        const hasGlobalScope = authz?.hasGlobalScope === true;
        const acessos = Array.isArray(authz?.acessos) ? authz.acessos : [];

        const baseMeta = {
            authUserEmail,
            effectiveUserEmail: targetEmail,
            isImpersonating,
            isPlatformAdmin,
            hasGlobalScope,
        };

        // tipo_acesso=admin representa alcance global; somente role=admin é privilégio.
        const escopo = hasGlobalScope
            ? { isAdmin: true }
            : await resolverEscopoLotacoes(base44, acessos);

        // 6. Caminhos curtos: vazio / proprio
        if (!hasGlobalScope && escopo.tipo === 'vazio') {
            return Response.json(
                {
                    lotacoes: [],
                    meta: {
                        ...baseMeta,
                        returned: 0,
                        scope_tipo: 'vazio',
                        reason: 'SEM_ACESSO_CONFIGURADO',
                    },
                },
                { status: 200 }
            );
        }

        if (!hasGlobalScope && escopo.tipo === 'proprio') {
            return Response.json(
                {
                    lotacoes: [],
                    meta: {
                        ...baseMeta,
                        returned: 0,
                        scope_tipo: 'proprio',
                    },
                },
                { status: 200 }
            );
        }

        // 7. Buscar Subgrupamentos
        let lotacoes = [];
        if (hasGlobalScope) {
            const result = await fetchWithRetry(
                () =>
                    base44.asServiceRole.entities.Subgrupamento.filter(
                        {},
                        'nome',
                        LIMIT_MAX,
                        0,
                        CAMPOS_SUBGRUPAMENTO
                    ),
                'subgrupamento.filter.admin'
            );
            lotacoes = result || [];
        } else if (escopo.tipo === 'estrutura') {
            const ids = escopo.estruturaIds || [];
            if (ids.length === 0) {
                lotacoes = [];
            } else {
                const result = await fetchWithRetry(
                    () =>
                        base44.asServiceRole.entities.Subgrupamento.filter(
                            { id: { $in: ids } },
                            'nome',
                            LIMIT_MAX,
                            0,
                            CAMPOS_SUBGRUPAMENTO
                        ),
                    'subgrupamento.filter.estrutura'
                );
                lotacoes = result || [];
            }
        }

        // 8. Filtrar inativos/excluídos e aplicar projeção manual
        const filtradas = lotacoes
            .filter(isLotacaoAtiva)
            .map((item) => projetar(item, CAMPOS_SUBGRUPAMENTO));

        // 9. Construir árvore hierárquica (movida do frontend)
        const lotacoesTree = buildLotacoesTree(filtradas);

        return Response.json({
            lotacoes: filtradas,
            lotacoesTree,
            meta: {
                ...baseMeta,
                returned: filtradas.length,
                scope_tipo: isAdmin ? 'admin' : escopo.tipo,
            },
        });
    } catch (error) {
        const status = error?.response?.status || error?.status || 500;
        console.error('[getScopedLotacoes] erro fatal:', {
            message: error?.message,
            status,
        });
        return Response.json(
            { error: error?.message || 'Erro interno ao buscar lotações', lotacoes: [] },
            { status }
        );
    }
});