import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// =====================================================================
// Constantes
// =====================================================================
const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 450;
const RETRY_STATUS = new Set([408, 429, 500, 502, 503, 504]);

// =====================================================================
// Helper: Retry com backoff exponencial + jitter
// =====================================================================
async function fetchWithRetry(queryFn, label = 'query') {
    let lastError;
    for (let attempt = 1; attempt <= RETRY_MAX_ATTEMPTS; attempt++) {
        try {
            const result = await queryFn();
            if (attempt > 1) {
                console.info(`[getUserPermissions] step=${label} attempt=${attempt} status=ok (after retry)`);
            }
            return result;
        } catch (error) {
            lastError = error;
            const status = error?.response?.status || error?.status || 0;
            const isRetryable = RETRY_STATUS.has(status);
            console.warn(
                `[getUserPermissions] step=${label} attempt=${attempt}/${RETRY_MAX_ATTEMPTS} status=${status || 'N/A'} retryable=${isRetryable}`
            );

            if (!isRetryable || attempt === RETRY_MAX_ATTEMPTS) break;

            const exp = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
            const jitter = Math.floor(Math.random() * 200);
            const waitMs = exp + jitter;
            console.info(`[getUserPermissions] step=${label} backoff=${waitMs}ms`);
            await new Promise((res) => setTimeout(res, waitMs));
        }
    }
    throw lastError;
}

// =====================================================================
// Utilitários
// =====================================================================
const normalizeTipo = (t) => String(t || '').trim().toLowerCase();

// Consolida modules e actions a partir dos perfis ativos.
// Conforme o schema atual de PerfilPermissao:
//   - Campos com prefixo "acesso_" representam módulos
//   - Campos com prefixo "perm_" representam ações específicas
// A consolidação faz OR (qualquer perfil que conceda já habilita a permissão).
function consolidarModulesActions(perfis) {
    const modules = {};
    const actions = {};
    (perfis || []).forEach((p) => {
        if (!p) return;
        Object.entries(p).forEach(([key, val]) => {
            if (typeof val !== 'boolean') return;
            if (key.startsWith('acesso_')) {
                const moduleKey = key.replace(/^acesso_/, '');
                if (val === true) modules[moduleKey] = true;
                else if (modules[moduleKey] !== true) modules[moduleKey] = false;
            } else if (key.startsWith('perm_')) {
                const actionKey = key.replace(/^perm_/, '');
                if (val === true) actions[actionKey] = true;
                else if (actions[actionKey] !== true) actions[actionKey] = false;
            }
        });
    });
    return { modules, actions };
}

// Resolve um descritor estável de "scope" a partir dos acessos ativos.
// Não busca descendentes aqui (isso é feito em getScopedMilitares); apenas
// descreve a configuração para o frontend.
function descreverScope(acessos, isAdmin) {
    if (isAdmin) {
        return { tipo: 'admin', estruturaIds: [], militarId: null, reason: null };
    }
    if (!acessos || acessos.length === 0) {
        return { tipo: 'vazio', estruturaIds: [], militarId: null, reason: 'SEM_ACESSO_CONFIGURADO' };
    }

    const setores = acessos.filter((a) => normalizeTipo(a.tipo_acesso) === 'setor' && a.grupamento_id);
    const subsetores = acessos.filter((a) => normalizeTipo(a.tipo_acesso) === 'subsetor' && a.subgrupamento_id);
    const unidades = acessos.filter((a) => normalizeTipo(a.tipo_acesso) === 'unidade' && a.subgrupamento_id);
    const proprios = acessos.filter((a) => normalizeTipo(a.tipo_acesso) === 'proprio');

    if (setores.length > 0) {
        return {
            tipo: 'setor',
            estruturaIds: [...new Set(setores.map((s) => s.grupamento_id).filter(Boolean))],
            militarId: null,
            reason: null,
        };
    }
    if (subsetores.length > 0) {
        return {
            tipo: 'subsetor',
            estruturaIds: [...new Set(subsetores.map((s) => s.subgrupamento_id).filter(Boolean))],
            militarId: null,
            reason: null,
        };
    }
    if (unidades.length > 0) {
        return {
            tipo: 'unidade',
            estruturaIds: [...new Set(unidades.map((u) => u.subgrupamento_id).filter(Boolean))],
            militarId: null,
            reason: null,
        };
    }
    if (proprios.length > 0) {
        const militarId = proprios.map((p) => p.militar_id).find(Boolean) || null;
        return {
            tipo: 'proprio',
            estruturaIds: [],
            militarId,
            reason: militarId ? null : 'PROPRIO_SEM_MILITAR_ID',
        };
    }

    return { tipo: 'vazio', estruturaIds: [], militarId: null, reason: 'TIPO_ACESSO_DESCONHECIDO' };
}

// =====================================================================
// Handler
// =====================================================================
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Não autenticado' }, { status: 401 });
        }

        // 1. Buscar todos os UsuarioAcesso ativos
        const acessos = await fetchWithRetry(
            () => base44.asServiceRole.entities.UsuarioAcesso.filter({ user_email: user.email, ativo: true }),
            'usuarioAcesso.list'
        );

        // 2. Coletar perfil_ids únicos
        const perfilIds = Array.from(
            new Set((acessos || []).map((a) => a?.perfil_id).filter(Boolean))
        );

        // 3. Buscar perfis em UMA única chamada com $in
        let perfis = [];
        if (perfilIds.length > 0) {
            perfis = await fetchWithRetry(
                () =>
                    base44.asServiceRole.entities.PerfilPermissao.filter({
                        id: { $in: perfilIds },
                        ativo: true,
                    }),
                'perfilPermissao.in'
            );
        }

        // 4. Mapa de perfis e flags admin
        const perfisMap = {};
        (perfis || []).forEach((p) => {
            if (p?.id) perfisMap[p.id] = p;
        });

        const isAdminByRole = String(user.role || '').toLowerCase() === 'admin';
        const isAdminByAccess = (acessos || []).some(
            (a) => normalizeTipo(a.tipo_acesso) === 'admin'
        );
        const isAdmin = isAdminByRole || isAdminByAccess;

        // 5. Consolidar modules/actions
        const { modules, actions } = consolidarModulesActions(perfis);

        // 6. Scope estável
        const scope = descreverScope(acessos || [], isAdmin);

        return Response.json({
            user: {
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                role: user.role,
            },
            isAdminByRole,
            isAdminByAccess,
            isAdmin,
            acessos: acessos || [],
            perfis: perfisMap,
            scope,
            modules,
            actions,
            meta: {
                total_acessos: (acessos || []).length,
                total_perfis: (perfis || []).length,
                generatedAt: new Date().toISOString(),
            },
        });
    } catch (error) {
        const status = error?.response?.status || error?.status || 500;
        console.error('[getUserPermissions] erro fatal:', {
            message: error?.message,
            status,
        });
        return Response.json(
            {
                error: error?.message || 'Erro interno ao buscar permissões',
                acessos: [],
                perfis: {},
                modules: {},
                actions: {},
                scope: { tipo: 'erro', estruturaIds: [], militarId: null, reason: 'INTERNAL_ERROR' },
            },
            { status }
        );
    }
});