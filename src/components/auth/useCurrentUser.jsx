import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  buildFullAccessPermissions,
  buildPermissionsFromSource,
  isAdminRecoveryPermission,
  isSuperAdmin as isServiceSuperAdmin,
  resolveUserPermissions,
} from '@/services/permissionMatrixService';

const toLowerSafe = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : null);
const SELF_RESTRICTED_SCOPES = new Set(['proprio', 'próprio', 'individual', 'self', 'auto']);

const ADMIN_ALWAYS_ALLOWED_MODULES = new Set([
  'acesso_dashboard',
  'dashboard',
  'acesso_militares',
  'acesso_configuracoes',
]);
const ADMIN_ALWAYS_ALLOWED_ACTIONS = new Set([
  'perm_gerir_permissoes',
  'perm_gerir_configuracoes',
]);
const ADMIN_RECOVERY_ROLES = new Set(['superadmin', 'developer', 'desenvolvedor']);
const SUPER_ADMIN_EMAILS = [
  'vieirams1@gmail.com',
];

const normalizeAccessMode = (value) => {
  const normalized = toLowerSafe(value);
  if (!normalized) return null;
  if (SELF_RESTRICTED_SCOPES.has(normalized)) return 'proprio';
  if (normalized === 'setor') return 'setor';
  if (normalized === 'subsetor') return 'subsetor';
  if (normalized === 'unidade') return 'unidade';
  if (normalized === 'admin') return 'admin';
  return normalized;
};

const getNestedValue = (obj, path) => {
  if (!obj) return null;
  return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : null), obj);
};

const resolveImpersonationContext = (user) => {
  const baseEmail = toLowerSafe(user?.email);

  const impersonatedEmailCandidates = [
    'impersonated_user_email',
    'impersonatedEmail',
    'impersonated.email',
    'impersonation.user_email',
    'impersonation.email',
    'impersonation.target_user_email',
    'acting_as_email',
    'actingAsEmail',
    'acting_as.user_email',
    'acting_as.email',
    'act_as_email',
    'as_user_email',
    'target_user_email',
    'target.email',
  ]
    .map((path) => toLowerSafe(getNestedValue(user, path)))
    .filter(Boolean);

  const explicitFlag = [
    user?.is_impersonating,
    user?.isImpersonating,
    user?.impersonation_active,
    user?.acting_as,
    user?.impersonation?.active,
  ].some(Boolean);

  const impersonatedEmail = impersonatedEmailCandidates.find((email) => email !== baseEmail) || null;
  const isImpersonating = Boolean(explicitFlag || impersonatedEmail);

  return {
    baseEmail,
    impersonatedEmail,
    isImpersonating,
    effectiveEmail: impersonatedEmail || baseEmail,
  };
};

export function useCurrentUser() {
  const { data: user, isLoading: loadingAuth } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 0,
    gcTime: 60 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const impersonationContext = resolveImpersonationContext(user);
  const accessLookupEmail = impersonationContext.effectiveEmail;
  const normalizedUserRole = toLowerSafe(user?.role);
  const isPrivilegedRecoveryUser = (
    normalizedUserRole && ADMIN_RECOVERY_ROLES.has(normalizedUserRole)
  ) || user?.isSuperAdmin === true || user?.isDeveloper === true;

  const { data: usuarioAcessoList, isLoading: loadingAcesso, isFetched: fetchedAcesso } = useQuery({
    queryKey: ['usuarioAcesso', accessLookupEmail, impersonationContext.isImpersonating],
    queryFn: () => base44.entities.UsuarioAcesso.filter({ user_email: accessLookupEmail, ativo: true }),
    enabled: !!accessLookupEmail,
    staleTime: 0,
    gcTime: 60 * 1000,
    refetchOnMount: 'always',
  });

  const acesso = usuarioAcessoList?.[0] || null;

  const { data: acessoCompleto, isLoading: loadingAcessoCompleto } = useQuery({
    queryKey: ['usuarioAcessoCompleto', acesso?.id],
    queryFn: () => base44.entities.UsuarioAcesso.get(acesso.id),
    enabled: !!acesso?.id,
    staleTime: 0,
  });

  const acessoResolvido = acessoCompleto || acesso;
  const isSuperAdminFallback = (
    normalizedUserRole === 'admin'
    || normalizedUserRole === 'owner'
    || SUPER_ADMIN_EMAILS.includes(toLowerSafe(user?.email))
  );
  const superAdmin = isServiceSuperAdmin(user, acessoResolvido, { safeEmails: SUPER_ADMIN_EMAILS }) || isSuperAdminFallback;
  const hasAbsoluteAccess = superAdmin;

  const { data: perfilAcesso } = useQuery({
    queryKey: ['perfilPermissao', acessoResolvido?.perfil_id],
    queryFn: () => base44.entities.PerfilPermissao.get(acessoResolvido.perfil_id),
    enabled: !!acessoResolvido?.perfil_id,
    staleTime: 60 * 1000,
  });

  const { data: resolvedPermissionsData } = useQuery({
    queryKey: ['resolvedPermissions', acessoResolvido?.id, perfilAcesso?.id],
    enabled: !!acessoResolvido,
    queryFn: async () => {
      return resolveUserPermissions({
        userSource: acessoResolvido,
        profileSource: perfilAcesso || {},
        preferProfilePermissions: true,
      });
    },
    staleTime: 0,
  });

  const resolvedPermissionMatrix = resolvedPermissionsData?.permissions || {};
  const normalizedResolvedPermissions = superAdmin
    ? buildFullAccessPermissions()
    : buildPermissionsFromSource(resolvedPermissionMatrix);
  const resolvedTipoAcesso = normalizeAccessMode(acessoResolvido?.tipo_acesso) || 'proprio';
  const isSelfRestrictedScope = resolvedTipoAcesso === 'proprio';

  // Resolve as propriedades explicitamente usando UsuarioAcesso.
  // Em modo de impersonação, não herdar permissões do admin original (fail-closed).
  const isAdmin = acessoResolvido
    ? (superAdmin || resolvedTipoAcesso === 'admin')
    : (superAdmin || (!impersonationContext.isImpersonating && (user?.role === 'admin' || user?.isAdmin === true)));

  const subgrupamentoId = acessoResolvido
    ? (isSelfRestrictedScope ? null : (acessoResolvido.subgrupamento_id || acessoResolvido.grupamento_id || null))
    : (!impersonationContext.isImpersonating ? (user?.subgrupamento_id || null) : null);

  const subgrupamentoTipo = acessoResolvido
    ? (isSelfRestrictedScope ? null
      : (resolvedTipoAcesso === 'setor' ? 'Grupamento' :
       resolvedTipoAcesso === 'subsetor' ? 'Subgrupamento' :
       resolvedTipoAcesso === 'unidade' ? 'Unidade' : null))
    : (!impersonationContext.isImpersonating ? (user?.subgrupamento_tipo || null) : null);

  const userEmail = accessLookupEmail || null;
  const linkedMilitarId = acessoResolvido ? (acessoResolvido.militar_id || null) : (!impersonationContext.isImpersonating ? (user?.militar_id || null) : null);
  const linkedMilitarEmail = acessoResolvido ? (acessoResolvido.militar_email || null) : (!impersonationContext.isImpersonating ? (user?.militar_email || null) : null);

  // Modo de acesso: 'admin', 'setor', 'subsetor', 'unidade', 'proprio'
  let modoAcesso = 'proprio';
  if (acessoResolvido) {
    modoAcesso = superAdmin ? 'admin' : resolvedTipoAcesso;
  } else if (!impersonationContext.isImpersonating) {
    if (isAdmin) modoAcesso = 'admin';
    else if (subgrupamentoId) {
      if (subgrupamentoTipo === 'Grupamento') modoAcesso = 'setor';
      else if (subgrupamentoTipo === 'Subgrupamento') modoAcesso = 'subsetor';
      else if (subgrupamentoTipo === 'Unidade') modoAcesso = 'unidade';
      else modoAcesso = 'subsetor';
    } else {
      modoAcesso = 'proprio';
    }
  }

  const requiresUnidades = modoAcesso === 'subsetor' && !!subgrupamentoId;
  const { data: unidadesFilhas = [], isLoading: loadingUnidades, isFetched: fetchedUnidades } = useQuery({
    queryKey: ['unidadesFilhas', subgrupamentoId],
    queryFn: () => base44.entities.Subgrupamento.filter({ tipo: 'Unidade', grupamento_id: subgrupamentoId }),
    enabled: requiresUnidades,
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = loadingAuth || loadingAcesso || loadingAcessoCompleto || (requiresUnidades && loadingUnidades);
  const isAccessResolved = !accessLookupEmail || (!loadingAcesso && !loadingAcessoCompleto && fetchedAcesso && (!requiresUnidades || (!loadingUnidades && fetchedUnidades)));

  const getAccessModeFromUser = (targetUser, targetAcesso = null) => {
    if (targetAcesso) return normalizeAccessMode(targetAcesso.tipo_acesso) || 'proprio';
    if (!targetUser) return 'proprio';
    if (targetUser.role === 'admin' || targetUser.isAdmin === true) return 'admin';
    if (targetUser.subgrupamento_tipo === 'Grupamento') return 'setor';
    if (targetUser.subgrupamento_tipo === 'Subgrupamento') return 'subsetor';
    if (targetUser.subgrupamento_tipo === 'Unidade') return 'unidade';
    return 'proprio';
  };

  const canAccessModule = (modulo) => {
    if (hasAbsoluteAccess) return true;
    if (accessLookupEmail && !isAccessResolved) return false;

    if (acessoResolvido) {
      const campo = `acesso_${modulo}`;
      const resolvedValue = normalizedResolvedPermissions[campo];
      if (isAdmin && isPrivilegedRecoveryUser && (isAdminRecoveryPermission(campo, 'module') || ADMIN_ALWAYS_ALLOWED_MODULES.has(campo))) return true;
      if (isAdmin) return resolvedValue === true;
      return resolvedValue === true;
    }

    if (impersonationContext.isImpersonating) return false;
    if (isAdmin) return true;
    return false;
  };

  const canAccessAction = (acao) => {
    if (hasAbsoluteAccess) return true;
    if (accessLookupEmail && !isAccessResolved) return false;

    if (acessoResolvido) {
      const campo = `perm_${acao}`;
      const resolvedValue = normalizedResolvedPermissions[campo];
      if (isAdmin && isPrivilegedRecoveryUser && (isAdminRecoveryPermission(campo, 'action') || ADMIN_ALWAYS_ALLOWED_ACTIONS.has(campo))) return true;
      if (isAdmin) return resolvedValue === true;
      return resolvedValue === true;
    }

    if (impersonationContext.isImpersonating) return false;
    if (isAdmin) return true;
    return false;
  };

  const hasAccess = (registro) => {
    if (!registro) return false;
    if (isAdmin) return true;

    if (modoAcesso === 'setor') {
      return (
        registro.grupamento_id === subgrupamentoId ||
        registro.subgrupamento_id === subgrupamentoId
      );
    }

    if (modoAcesso === 'subsetor') {
      const scopeIds = [subgrupamentoId, ...unidadesFilhas.map(u => u.id)];
      return scopeIds.includes(registro.subgrupamento_id);
    }

    if (modoAcesso === 'unidade') {
      return registro.subgrupamento_id === subgrupamentoId;
    }

    if (modoAcesso === 'proprio') {
      return (
        registro.created_by === userEmail ||
        registro.militar_email === userEmail ||
        registro.email === userEmail
      );
    }

    return false;
  };

  const hasSelfAccess = (registro) => {
    if (!registro) return false;
    if (isAdmin) return true;

    if (linkedMilitarId && registro.id === linkedMilitarId) {
      return true;
    }

    const possibleEmails = [
      registro.email,
      registro.email_particular,
      registro.email_funcional,
      registro.militar_email,
      registro.created_by,
      registro.usuario_email,
    ].filter(Boolean);

    const knownEmails = [userEmail, linkedMilitarEmail].filter(Boolean);
    return knownEmails.some((email) => possibleEmails.includes(email));
  };

  const getMilitarScopeFilters = () => {
    if (isAdmin) return [];

    if (modoAcesso === 'setor' && subgrupamentoId) {
      return [{ grupamento_id: subgrupamentoId }, { subgrupamento_id: subgrupamentoId }];
    }

    if (modoAcesso === 'subsetor' && subgrupamentoId) {
      return [{ subgrupamento_id: subgrupamentoId }, ...unidadesFilhas.map(u => ({ subgrupamento_id: u.id }))];
    }

    if (modoAcesso === 'unidade' && subgrupamentoId) {
      return [{ subgrupamento_id: subgrupamentoId }];
    }

    if (modoAcesso === 'proprio' && linkedMilitarId) {
      return [{ id: linkedMilitarId }];
    }

    return [];
  };

  const resolvedAccessContext = {
    isImpersonating: impersonationContext.isImpersonating,
    baseEmail: impersonationContext.baseEmail,
    effectiveEmail: accessLookupEmail,
    hasAcessoRecord: Boolean(acessoResolvido),
    modoAcesso,
    isAdmin,
    isSuperAdmin: superAdmin,
    permissions: hasAbsoluteAccess ? 'ALL' : normalizedResolvedPermissions,
    canAccessAll: hasAbsoluteAccess,
  };

  const resolvedUser = {
    user,
    acesso: acessoResolvido,
    isAdmin,
    isSuperAdmin: superAdmin,
    permissions: normalizedResolvedPermissions,
    canAccessAll: false,
    isLoading,
    isAccessResolved,
    modoAcesso,
    subgrupamentoId,
    subgrupamentoTipo,
    userEmail,
    linkedMilitarId,
    linkedMilitarEmail,
    unidadesFilhas,
    canAccessModule,
    canAccessAction,
    hasAccess,
    hasSelfAccess,
    getMilitarScopeFilters,
    getAccessModeFromUser,
    resolvedAccessContext,
  };

  if (isSuperAdminFallback) {
    return {
      ...resolvedUser,
      isSuperAdmin: true,
      permissions: 'ALL',
      canAccessAll: true,
      resolvedAccessContext: {
        ...resolvedAccessContext,
        isSuperAdmin: true,
        permissions: 'ALL',
        canAccessAll: true,
      },
    };
  }

  return resolvedUser;
}
