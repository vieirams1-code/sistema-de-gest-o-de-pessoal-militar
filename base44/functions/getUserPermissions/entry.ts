import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// =====================================================================
// Constantes
// =====================================================================
const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 450;
const RETRY_STATUS = new Set([408, 429, 500, 502, 503, 504]);

// Campos selecionados em UsuarioAcesso (reduz payload)
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
const normalizeEmail = (e) => String(e || '').trim().toLowerCase();

// Consolida modules e actions a partir dos perfis ativos.
// Estratégia: prefixos "acesso_" => modules, "perm_" => actions.
// Faz OR entre os perfis (qualquer perfil que conceda já habilita).
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
//
// Suporte a "effectiveEmail" (modo usuário efetivo / impersonação para
// suporte e testes administrativos).
//
// IMPORTANTE: a barra "Você está agindo como..." do preview do Base44 é uma
// camada externa e NÃO altera o retorno de base44.auth.me(). Para permitir
// que um administrador real valide o sistema sob a perspectiva de outro
// usuário, esta função aceita opcionalmente um campo effectiveEmail no
// payload. A validação real (somente admins reais podem usar effectiveEmail)
// ocorre obrigatoriamente aqui no backend; o frontend usa apenas como ponte.
// =====================================================================
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        const authUser = await base44.auth.me();
        if (!authUser) {
            return Response.json({ error: 'Não autenticado' }, { status: 401 });
        }

        // Lê payload opcional
        let payload = {};
        try {
            payload = await req.json();
        } catch (_e) {
            payload = {};
        }

        const effectiveEmailRaw = payload?.effectiveEmail;
        const authUserEmail = normalizeEmail(authUser.email);
        const effectiveEmailNorm = normalizeEmail(effectiveEmailRaw);
        const wantsImpersonation = Boolean(effectiveEmailNorm) && effectiveEmailNorm !== authUserEmail;

        // ----- Buscar UsuarioAcesso do usuário autenticado real (sempre, para validar admin) -----
        const acessosAuth = await fetchWithRetry(
            () =>
                base44.asServiceRole.entities.UsuarioAcesso.filter(
                    { user_email: authUser.email, ativo: true },
                    undefined,
                    100,
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

        // ----- Validação de impersonação -----
        if (wantsImpersonation && !authIsAdmin) {
            console.warn('[getUserPermissions] tentativa de impersonação por não-admin', {
                authUserEmail,
                effectiveEmailNorm,
            });
            return Response.json(
                { error: 'Ação não permitida: somente administradores podem usar effectiveEmail.' },
                { status: 403 }
            );
        }

        // ----- Decide email-alvo para resolução de permissões -----
        const isImpersonating = wantsImpersonation && authIsAdmin;
        const targetEmail = isImpersonating ? effectiveEmailNorm : authUser.email;

        // ----- Busca UsuarioAcesso do email-alvo -----
        // Se não estiver impersonando, reaproveita os acessos já buscados.
        const acessos = isImpersonating
            ? await fetchWithRetry(
                () =>
                    base44.asServiceRole.entities.UsuarioAcesso.filter(
                        { user_email: targetEmail, ativo: true },
                        undefined,
                        100,
                        0,
                        CAMPOS_USUARIO_ACESSO
                    ),
                'usuarioAcesso.list.target'
            )
            : (acessosAuth || []);

        // 2. Coletar perfil_ids únicos
        const perfilIds = Array.from(
            new Set((acessos || []).map((a) => a?.perfil_id).filter(Boolean))
        );

        // 3. Buscar perfis em UMA chamada
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

        // 4. Mapa de perfis e flags admin DO USUÁRIO EFETIVO
        const perfisMap = {};
        (perfis || []).forEach((p) => {
            if (p?.id) perfisMap[p.id] = p;
        });

        // SEGURANÇA: Quando impersonando, isAdminByRole é FALSE.
        // Não temos acesso seguro à role real do usuário efetivo a partir do
        // SDK (auth.me retorna o autenticado), e não podemos deixar a role do
        // admin autenticado contaminar as permissões do usuário efetivo.
        // O único sinal confiável de admin para o usuário efetivo é a
        // presença de UsuarioAcesso com tipo_acesso === 'admin'.
        const isAdminByRole = isImpersonating
            ? false
            : (String(authUser.role || '').toLowerCase() === 'admin');
        const isAdminByAccess = (acessos || []).some(
            (a) => normalizeTipo(a.tipo_acesso) === 'admin'
        );
        const isAdmin = isAdminByRole || isAdminByAccess;

        // 5. modules/actions
        const { modules, actions } = consolidarModulesActions(perfis);

        // 6. scope estável
        const scope = descreverScope(acessos || [], isAdmin);

        // 7. accessMode / permissionsResolvedAs
        const accessMode = isAdmin ? 'admin' : 'restricted';
        const permissionsResolvedAs = isAdmin ? 'admin' : 'profiles';

        // 8. Montar user representando o usuário efetivo
        const userOut = isImpersonating
            ? {
                id: null,
                email: targetEmail,
                full_name: null,
                role: null,
            }
            : {
                id: authUser.id,
                email: authUser.email,
                full_name: authUser.full_name,
                role: authUser.role,
            };

        return Response.json({
            authUserEmail: authUser.email,
            effectiveUserEmail: isImpersonating ? targetEmail : authUser.email,
            isImpersonating,
            user: userOut,
            isAdminByRole,
            isAdminByAccess,
            isAdmin,
            accessMode,
            permissionsResolvedAs,
            acessos: acessos || [],
            perfis: perfisMap,
            scope,
            modules,
            actions,
            meta: {
                total_acessos: (acessos || []).length,
                total_perfis: (perfis || []).length,
                schemaStrategy: 'dynamic_prefix_acesso_perm',
                generatedAt: new Date().toISOString(),
                impersonationRequested: wantsImpersonation,
                authIsAdmin,
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
                accessMode: 'restricted',
                permissionsResolvedAs: 'profiles',
                isImpersonating: false,
            },
            { status }
        );
    }
});