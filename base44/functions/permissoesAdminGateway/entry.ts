import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-App-Id',
  'Content-Type': 'application/json',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: HEADERS });

function hasAnyAction(authz: any, actions: string[]): boolean {
  if (authz?.isAdmin === true) return true;
  return actions.some((action) => authz?.actions?.[action] === true);
}

async function carregarAuthz(base44: any) {
  const response = await base44.functions.invoke('getUserPermissions', {});
  return response?.data ?? response ?? {};
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  try {
    const base44 = createClientFromRequest(req);
    let user: any = null;
    try {
      user = await base44.auth.me();
    } catch {
      user = null;
    }
    if (!user) return json({ error: 'Usuário não autenticado.' }, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '').trim().toUpperCase();
    const payload = body?.payload || {};
    const authz = await carregarAuthz(base44);

    const podeGerirPerfis = hasAnyAction(authz, ['gerir_perfis_permissao', 'gerir_permissoes']);
    const podeGerirUsuarios = hasAnyAction(authz, ['gerir_permissoes_usuarios', 'gerir_permissoes']);

    if (action === 'LIST_PROFILES') {
      if (!podeGerirPerfis && !podeGerirUsuarios) {
        return json({ error: 'Usuário sem permissão para consultar perfis de permissão.' }, 403);
      }
      const perfis = await base44.asServiceRole.entities.PerfilPermissao.list('nome_perfil');
      return json({ ok: true, perfis: perfis || [] });
    }

    if (action === 'GET_PROFILE') {
      if (!podeGerirPerfis && !podeGerirUsuarios) {
        return json({ error: 'Usuário sem permissão para consultar perfis de permissão.' }, 403);
      }
      const profileId = String(payload?.profileId || '').trim();
      if (!profileId) return json({ error: 'profileId é obrigatório.' }, 400);
      const perfil = await base44.asServiceRole.entities.PerfilPermissao.get(profileId).catch(() => null);
      if (!perfil) return json({ error: 'Perfil de permissão não encontrado.' }, 404);
      return json({ ok: true, perfil });
    }

    if (action === 'LIST_ACCESS') {
      if (!podeGerirUsuarios) {
        return json({ error: 'Usuário sem permissão para consultar acessos de usuários.' }, 403);
      }
      const acessos = await base44.asServiceRole.entities.UsuarioAcesso.list();
      return json({ ok: true, acessos: acessos || [] });
    }

    if (action === 'GET_ACCESS') {
      if (!podeGerirUsuarios) {
        return json({ error: 'Usuário sem permissão para consultar acessos de usuários.' }, 403);
      }
      const accessId = String(payload?.accessId || '').trim();
      if (!accessId) return json({ error: 'accessId é obrigatório.' }, 400);
      const acesso = await base44.asServiceRole.entities.UsuarioAcesso.get(accessId).catch(() => null);
      if (!acesso) return json({ error: 'Acesso de usuário não encontrado.' }, 404);
      return json({ ok: true, acesso });
    }

    if (action === 'LIST_PROFILE_USAGE') {
      if (!podeGerirPerfis) {
        return json({ error: 'Usuário sem permissão para consultar uso dos perfis.' }, 403);
      }
      const acessos = await base44.asServiceRole.entities.UsuarioAcesso.list();
      const uso = (acessos || []).map((item: any) => ({
        id: item?.id || '',
        perfil_id: item?.perfil_id || '',
        ativo: item?.ativo !== false,
      }));
      return json({ ok: true, uso });
    }

    return json({ error: 'Ação não reconhecida.' }, 400);
  } catch (error: any) {
    console.error('[permissoesAdminGateway]', error?.message || error);
    return json({ error: 'Falha ao consultar dados administrativos de permissões.' }, 500);
  }
});
