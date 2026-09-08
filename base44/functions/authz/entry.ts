// Contrato canônico de autorização backend do SGP-Militar.
//
// Regras invariáveis:
//   1. PerfilPermissao define O QUE o usuário pode fazer (modules/actions).
//   2. UsuarioAcesso define ONDE / SOBRE QUEM o usuário pode agir (escopo).
//   3. Somente User.role === 'admin' concede bypass funcional de plataforma.
//   4. UsuarioAcesso.tipo_acesso === 'admin' significa somente escopo global.
//   5. effectiveEmail (impersonação) é permitido somente ao admin real da plataforma
//      e nunca transfere o bypass do administrador para o usuário efetivo.

const DEFAULT_ACCESS_FIELDS = [
  'id',
  'user_email',
  'ativo',
  'tipo_acesso',
  'grupamento_id',
  'grupamento_nome',
  'subgrupamento_id',
  'subgrupamento_nome',
  'militar_id',
  'perfil_id',
];

export const normalizeTipoAcesso = (value: unknown) => String(value || '').trim().toLowerCase();
export const normalizeAuthEmail = (value: unknown) => String(value || '').trim().toLowerCase();
export const isPlatformAdminRole = (user: any) => String(user?.role || '').trim().toLowerCase() === 'admin';

export function extrairMatrizPermissoesPerfil(descricao: unknown): Record<string, boolean> {
  if (typeof descricao !== 'string' || !descricao) return {};
  const markerStart = '[SGP_PERMISSIONS_MATRIX]';
  const markerEnd = '[/SGP_PERMISSIONS_MATRIX]';
  const start = descricao.indexOf(markerStart);
  const end = descricao.indexOf(markerEnd);
  if (start === -1 || end === -1 || end <= start) return {};
  try {
    const parsed = JSON.parse(descricao.slice(start + markerStart.length, end).trim());
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_error) {
    return {};
  }
}

export function consolidarPermissoesFuncionais(perfis: any[] = []) {
  const modules: Record<string, boolean> = {};
  const actions: Record<string, boolean> = {};

  const aplicarFonte = (fonte: any) => {
    if (!fonte) return;
    for (const [key, value] of Object.entries(fonte)) {
      if (typeof value !== 'boolean') continue;
      if (key.startsWith('acesso_')) {
        const moduleKey = key.replace(/^acesso_/, '');
        if (value === true) modules[moduleKey] = true;
        else if (!(moduleKey in modules)) modules[moduleKey] = false;
      } else if (key.startsWith('perm_')) {
        const actionKey = key.replace(/^perm_/, '');
        if (value === true) actions[actionKey] = true;
        else if (!(actionKey in actions)) actions[actionKey] = false;
      }
    }
  };

  for (const perfil of perfis || []) {
    if (!perfil) continue;
    aplicarFonte(perfil);
    aplicarFonte(extrairMatrizPermissoesPerfil(perfil?.descricao));
  }

  return { modules, actions };
}

export async function resolverAcessoPorEmail(
  base44: any,
  email: string,
  options: { accessFields?: string[]; limit?: number } = {},
) {
  const emailNorm = normalizeAuthEmail(email);
  const accessFields = options.accessFields || DEFAULT_ACCESS_FIELDS;
  const limit = Number(options.limit) > 0 ? Number(options.limit) : 1000;
  if (!emailNorm) {
    return { email: '', acessos: [], perfis: [], modules: {}, actions: {}, hasGlobalScope: false };
  }

  const acessos = await base44.asServiceRole.entities.UsuarioAcesso.filter(
    { user_email: emailNorm, ativo: true },
    undefined,
    limit,
    0,
    accessFields,
  );

  const perfilIds = Array.from(new Set((acessos || []).map((a: any) => a?.perfil_id).filter(Boolean)));
  const perfis = perfilIds.length > 0
    ? await base44.asServiceRole.entities.PerfilPermissao.filter({ id: { $in: perfilIds }, ativo: true })
    : [];
  const { modules, actions } = consolidarPermissoesFuncionais(perfis || []);
  const hasGlobalScope = (acessos || []).some((a: any) => normalizeTipoAcesso(a?.tipo_acesso) === 'admin');

  return {
    email: emailNorm,
    acessos: acessos || [],
    perfis: perfis || [],
    modules,
    actions,
    hasGlobalScope,
  };
}

export function forbiddenAuth(message: string, code = 'FORBIDDEN_AUTHORIZATION') {
  const error: any = new Error(message);
  error.status = 403;
  error.code = code;
  return error;
}

export async function resolverContextoAutorizacao({
  base44,
  authUser,
  effectiveEmail,
  accessFields,
  limit,
}: {
  base44: any;
  authUser: any;
  effectiveEmail?: unknown;
  accessFields?: string[];
  limit?: number;
}) {
  if (!authUser) throw forbiddenAuth('Usuário não autenticado.', 'UNAUTHENTICATED');

  const authUserEmail = normalizeAuthEmail(authUser?.email);
  const effectiveEmailNorm = normalizeAuthEmail(effectiveEmail);
  const authIsPlatformAdmin = isPlatformAdminRole(authUser);
  const wantsImpersonation = Boolean(effectiveEmailNorm) && effectiveEmailNorm !== authUserEmail;

  if (wantsImpersonation && !authIsPlatformAdmin) {
    throw forbiddenAuth('Ação não permitida: somente administradores da plataforma podem usar effectiveEmail.', 'IMPERSONATION_REQUIRES_PLATFORM_ADMIN');
  }

  const authAccess = await resolverAcessoPorEmail(base44, authUserEmail, { accessFields, limit });
  const isImpersonating = wantsImpersonation && authIsPlatformAdmin;
  const targetEmail = isImpersonating ? effectiveEmailNorm : authUserEmail;
  const targetAccess = isImpersonating
    ? await resolverAcessoPorEmail(base44, targetEmail, { accessFields, limit })
    : authAccess;

  // O bypass do admin real vale somente quando ele atua como ele próprio.
  // Durante impersonação, toda autorização funcional e todo escopo vêm do alvo.
  const targetIsPlatformAdmin = !isImpersonating && authIsPlatformAdmin;
  const hasGlobalScope = targetIsPlatformAdmin || targetAccess.hasGlobalScope;

  return {
    authUserEmail,
    effectiveUserEmail: targetEmail,
    wantsImpersonation,
    isImpersonating,
    authIsPlatformAdmin,
    targetIsPlatformAdmin,
    hasGlobalScope,
    authAccess,
    targetAccess,
    acessos: targetAccess.acessos,
    perfis: targetAccess.perfis,
    modules: targetAccess.modules,
    actions: targetAccess.actions,
  };
}

export function possuiAction(context: any, actionKey: string) {
  return Boolean(context?.targetIsPlatformAdmin || context?.actions?.[actionKey] === true);
}

export function possuiModule(context: any, moduleKey: string) {
  return Boolean(context?.targetIsPlatformAdmin || context?.modules?.[moduleKey] === true);
}
