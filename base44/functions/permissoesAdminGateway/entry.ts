import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-App-Id',
  'Content-Type': 'application/json',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: HEADERS });

const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase();

function extrairMatrizPermissoes(descricao: unknown): Record<string, boolean> {
  if (typeof descricao !== 'string' || !descricao) return {};
  const inicio = descricao.indexOf('[SGP_PERMISSIONS_MATRIX]');
  const fim = descricao.indexOf('[/SGP_PERMISSIONS_MATRIX]');
  if (inicio === -1 || fim === -1 || fim <= inicio) return {};
  const raw = descricao.slice(inicio + '[SGP_PERMISSIONS_MATRIX]'.length, fim).trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function perfilTemPermissao(perfil: any, key: string): boolean {
  if (perfil?.[key] === true) return true;
  const matriz = extrairMatrizPermissoes(perfil?.descricao);
  return matriz?.[key] === true;
}

async function resolverCapacidadesAdministrativas(base44: any, user: any) {
  const isPlatformAdmin = String(user?.role || '').trim().toLowerCase() === 'admin';
  if (isPlatformAdmin) {
    return {
      isPlatformAdmin: true,
      gerirPerfis: true,
      gerirUsuarios: true,
    };
  }

  const email = normalizeEmail(user?.email);
  if (!email) return { isPlatformAdmin: false, gerirPerfis: false, gerirUsuarios: false };

  const acessos = await base44.asServiceRole.entities.UsuarioAcesso.filter(
    { user_email: user.email, ativo: true },
    undefined,
    100,
    0,
    ['id', 'perfil_id'],
  );
  const perfilIds = [...new Set((acessos || []).map((item: any) => item?.perfil_id).filter(Boolean))];
  if (perfilIds.length === 0) {
    return { isPlatformAdmin: false, gerirPerfis: false, gerirUsuarios: false };
  }

  const perfis = await base44.asServiceRole.entities.PerfilPermissao.filter({
    id: { $in: perfilIds },
    ativo: true,
  });

  const tem = (key: string) => (perfis || []).some((perfil: any) => perfilTemPermissao(perfil, key));
  const gerirTudo = tem('perm_gerir_permissoes');
  return {
    isPlatformAdmin: false,
    gerirPerfis: gerirTudo || tem('perm_gerir_perfis_permissao'),
    gerirUsuarios: gerirTudo || tem('perm_gerir_permissoes_usuarios'),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return json({ error: 'Usuário não autenticado.' }, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '').trim().toUpperCase();
    const payload = body?.payload || {};
    const caps = await resolverCapacidadesAdministrativas(base44, user);

    if (action === 'LIST_PROFILES') {
      if (!caps.gerirPerfis && !caps.gerirUsuarios) {
        return json({ error: 'Usuário sem permissão para consultar perfis de permissão.' }, 403);
      }
      const perfis = await base44.asServiceRole.entities.PerfilPermissao.list('nome_perfil', 1000, 0);
      return json({ ok: true, perfis: Array.isArray(perfis) ? perfis : [] });
    }

    if (action === 'GET_PROFILE') {
      if (!caps.gerirPerfis && !caps.gerirUsuarios) {
        return json({ error: 'Usuário sem permissão para consultar perfis de permissão.' }, 403);
      }
      const profileId = String(payload?.profileId || '').trim();
      if (!profileId) return json({ error: 'profileId é obrigatório.' }, 400);
      const perfil = await base44.asServiceRole.entities.PerfilPermissao.get(profileId).catch(() => null);
      if (!perfil) return json({ error: 'Perfil de permissão não encontrado.' }, 404);
      return json({ ok: true, perfil });
    }

    if (action === 'LIST_ACCESS') {
      if (!caps.gerirUsuarios) {
        return json({ error: 'Usuário sem permissão para consultar acessos de usuários.' }, 403);
      }
      const acessos = await base44.asServiceRole.entities.UsuarioAcesso.list('nome_usuario', 1000, 0);
      return json({ ok: true, acessos: Array.isArray(acessos) ? acessos : [] });
    }

    if (action === 'GET_ACCESS') {
      if (!caps.gerirUsuarios) {
        return json({ error: 'Usuário sem permissão para consultar acessos de usuários.' }, 403);
      }
      const accessId = String(payload?.accessId || '').trim();
      if (!accessId) return json({ error: 'accessId é obrigatório.' }, 400);
      const acesso = await base44.asServiceRole.entities.UsuarioAcesso.get(accessId).catch(() => null);
      if (!acesso) return json({ error: 'Acesso de usuário não encontrado.' }, 404);
      return json({ ok: true, acesso });
    }

    if (action === 'LIST_PROFILE_USAGE') {
      if (!caps.gerirPerfis) {
        return json({ error: 'Usuário sem permissão para consultar uso dos perfis.' }, 403);
      }
      const acessos = await base44.asServiceRole.entities.UsuarioAcesso.list(undefined, 1000, 0);
      const uso = (acessos || []).map((item: any) => ({
        id: item?.id || '',
        perfil_id: item?.perfil_id || '',
        ativo: item?.ativo !== false,
        nome_usuario: item?.nome_usuario || '',
        user_email: item?.user_email || '',
      }));
      return json({ ok: true, uso });
    }

    return json({ error: 'Ação não reconhecida.' }, 400);
  } catch (error: any) {
    const status = error?.response?.status || error?.status || 500;
    const message = error?.message || 'Falha ao consultar dados administrativos de permissões.';
    console.error('[permissoesAdminGateway]', { status, message });
    return json({ error: message, errorStage: 'PERMISSIONS_ADMIN_GATEWAY' }, status >= 400 && status < 600 ? status : 500);
  }
});