import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// =====================================================================
// Helper: Retry com Backoff Exponencial
// =====================================================================
async function fetchWithRetry(queryFn, label = 'query', retries = 4, delay = 800) {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const result = await queryFn();
            if (attempt > 0) {
                console.info(`[getUserPermissions] [${label}] sucesso após ${attempt} retentativa(s).`);
            }
            return result;
        } catch (error) {
            lastError = error;
            const status = error?.response?.status || error?.status;
            const isTransient = status === 429 || status === 502 || status === 503 || status === 504;

            console.warn(`[getUserPermissions] [${label}] falha tentativa ${attempt + 1}/${retries + 1}. Status: ${status || 'N/A'}. Mensagem: ${error?.message}`);

            if (!isTransient || attempt === retries) {
                break;
            }

            const waitMs = delay * Math.pow(2, attempt);
            console.info(`[getUserPermissions] [${label}] aguardando ${waitMs}ms antes de retry...`);
            await new Promise(res => setTimeout(res, waitMs));
        }
    }
    throw lastError;
}

// =====================================================================
// Handler principal
// =====================================================================
// Centraliza a resolução das permissões do usuário autenticado:
//   - Carrega UsuarioAcesso (todos os registros ativos do usuário)
//   - Carrega o(s) PerfilPermissao vinculado(s) (quando houver)
//   - Retorna um objeto consolidado com:
//       user            => dados básicos do usuário autenticado
//       acessos         => registros de UsuarioAcesso ativos
//       perfis          => mapa { perfil_id: PerfilPermissao }
//       isAdminByRole   => true quando user.role === 'admin'
// =====================================================================
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Não autenticado' }, { status: 401 });
        }

        // 1. Buscar todos os UsuarioAcesso ativos do usuário
        const acessos = await fetchWithRetry(
            () => base44.asServiceRole.entities.UsuarioAcesso.filter(
                { user_email: user.email, ativo: true }
            ),
            'usuarioAcesso.list'
        );

        // 2. Coletar perfil_ids únicos
        const perfilIds = Array.from(
            new Set((acessos || []).map(a => a?.perfil_id).filter(Boolean))
        );

        // 3. Buscar perfis em UMA única chamada com $in
        let perfis = [];
        if (perfilIds.length > 0) {
            perfis = await fetchWithRetry(
                () => base44.asServiceRole.entities.PerfilPermissao.filter(
                    { id: { $in: perfilIds }, ativo: true }
                ),
                'perfilPermissao.in'
            );
        }

        // 4. Consolidar em mapa para fácil consumo no frontend
        const perfisMap = {};
        (perfis || []).forEach(p => {
            if (p?.id) perfisMap[p.id] = p;
        });

        const isAdminByRole = user.role === 'admin';

        return Response.json({
            user: {
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                role: user.role,
            },
            isAdminByRole,
            acessos: acessos || [],
            perfis: perfisMap,
            meta: {
                total_acessos: (acessos || []).length,
                total_perfis: (perfis || []).length,
            }
        });

    } catch (error) {
        const status = error?.response?.status || error?.status || 500;
        console.error('[getUserPermissions] erro fatal:', {
            message: error?.message,
            status,
            stack: error?.stack,
        });
        return Response.json({
            error: error?.message || 'Erro interno ao buscar permissões',
            acessos: [],
            perfis: {},
        }, { status });
    }
});