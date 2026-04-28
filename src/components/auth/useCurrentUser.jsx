import { useEffect } from 'react';
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
const USUARIO_ACESSO_FALLBACK_LIMIT = 500;
const USUARIO_ACESSO_RETRY_COUNT = 3;

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

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

const countGrantedPermissions = (permissions = {}) => (
  Object.values(permissions || {}).filter((value) => value === true).length
);

const countGrantedByPrefix = (permissions = {}, prefix = '') => (
  Object.entries(permissions || {}).filter(([key, value]) => key.startsWith(prefix) && value === true).length
);

const listGrantedByPrefix = (permissions = {}, prefix = '') => (
  Object.entries(permissions || {})
    .filter(([key, value]) => key.startsWith(prefix) && value === true)
    .map(([key]) => key)
);

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

const toTimestamp = (value) => {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
};

const sortUsuarioAcessoByRecent = (a, b) => {
  const aTime = Math.max(toTimestamp(a?.updated_date), toTimestamp(a?.created_date));
  const bTime = Math.max(toTimestamp(b?.updated_date), toTimestamp(b?.created_date));
  return bTime - aTime;
};

const isUsuarioAcessoAtivo = (item) => item?.ativo === true;

const filtrarUsuarioAcessoPorEmail = (items = [], emailNormalizado = '') => (
  (Array.isArray(items) ? items : [])
    .filter((item) => normalizeEmail(item?.user_email) === emailNormalizado && isUsuarioAcessoAtivo(item))
    .sort(sortUsuarioAcessoByRecent)
);

const buscarUsuarioAcessoPorEmail = async (emailNormalizado) => {
  const safeEmail = normalizeEmail(emailNormalizado);
  const debug = {
    filterAttempt: 'not_used',
    fallbackList: {
      used: false,
      status: 'not_used',
      foundCount: 0,
    },
    selectedUsuarioAcessoId: null,
    duplicatedCount: 0,
  };

  if (!safeEmail) {
    return {
      emailNormalizado: safeEmail,
      selected: null,
      list: [],
      debug,
    };
  }

  let filterError = null;
  try {
    const filterResult = await base44.entities.UsuarioAcesso.filter({ user_email: safeEmail, ativo: true });
    const fromFilter = filtrarUsuarioAcessoPorEmail(filterResult, safeEmail);
    debug.filterAttempt = 'success';
    if (fromFilter.length > 0) {
      debug.selectedUsuarioAcessoId = fromFilter[0]?.id || null;
      debug.duplicatedCount = Math.max(0, fromFilter.length - 1);
      return {
        emailNormalizado: safeEmail,
        selected: fromFilter[0] || null,
        list: fromFilter,
        debug,
      };
    }
  } catch {
    debug.filterAttempt = 'error';
    filterError = new Error('USUARIO_ACESSO_FILTER_FAILED');
  }

  debug.fallbackList.used = true;

  try {
    const fallbackList = await base44.entities.UsuarioAcesso.list('-created_date', USUARIO_ACESSO_FALLBACK_LIMIT);
    const filteredFallback = filtrarUsuarioAcessoPorEmail(fallbackList, safeEmail);
    debug.fallbackList.status = 'success';
    debug.fallbackList.foundCount = filteredFallback.length;
    debug.selectedUsuarioAcessoId = filteredFallback[0]?.id || null;
    debug.duplicatedCount = Math.max(0, filteredFallback.length - 1);
    return {
      emailNormalizado: safeEmail,
      selected: filteredFallback[0] || null,
      list: filteredFallback,
      debug,
    };
  } catch {
    debug.fallbackList.status = 'error';
    const accessLookupError = new Error('Falha ao carregar UsuarioAcesso por filter e fallback list');
    accessLookupError.cause = filterError;
    throw accessLookupError;
  }
};

export function useCurrentUser() {
  const {
    data: user,
    isLoading: loadingAuth,
    isError: isAuthError,
    refetch: refetchCurrentUser,
  } = useQuery({
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
  const normalizedBaseEmail = toLowerSafe(impersonationContext.baseEmail);
  const isRecoveryEmail = Boolean(
    normalizedBaseEmail && SUPER_ADMIN_EMAILS.includes(normalizedBaseEmail),
  );
  const isPrivilegedRecoveryUser = (
    normalizedUserRole && ADMIN_RECOVERY_ROLES.has(normalizedUserRole)
  ) || user?.isSuperAdmin === true || user?.isDeveloper === true || isRecoveryEmail;
  const shouldBypassUsuarioAcessoBlocking = Boolean(
    isPrivilegedRecoveryUser && !impersonationContext.isImpersonating,
  );

  const {
    data: usuarioAcessoQueryData,
    isLoading: loadingAcesso,
    isFetched: fetchedAcesso,
    isError: isAcessoError,
    refetch: refetchAcesso,
  } = useQuery({
    queryKey: ['usuarioAcesso', accessLookupEmail, impersonationContext.isImpersonating],
    queryFn: () => buscarUsuarioAcessoPorEmail(accessLookupEmail),
    enabled: !!accessLookupEmail,
    staleTime: 0,
    gcTime: 60 * 1000,
    refetchOnMount: 'always',
    retry: USUARIO_ACESSO_RETRY_COUNT,
    retryDelay: (attemptIndex) => Math.min(250 * (2 ** attemptIndex), 1500),
  });

  const usuarioAcessoList = usuarioAcessoQueryData?.list || [];
  const acesso = usuarioAcessoQueryData?.selected || usuarioAcessoList?.[0] || null;
  const usuarioAcessoDebug = usuarioAcessoQueryData?.debug || {
    filterAttempt: 'not_used',
    fallbackList: {
      used: false,
      status: 'not_used',
      foundCount: 0,
    },
    selectedUsuarioAcessoId: null,
    duplicatedCount: 0,
  };
  const hasUsuarioAcessoFallbackData = usuarioAcessoList.length > 0;
  const hasUsuarioAcessoCriticalError = isAcessoError && !hasUsuarioAcessoFallbackData;

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (usuarioAcessoDebug.duplicatedCount > 0 && accessLookupEmail) {
      console.warn('[useCurrentUser] Múltiplos UsuarioAcesso ativos para o mesmo e-mail. Mantendo o mais recente.', {
        email: accessLookupEmail,
        duplicatedCount: usuarioAcessoDebug.duplicatedCount,
        selectedUsuarioAcessoId: usuarioAcessoDebug.selectedUsuarioAcessoId,
      });
    }
  }, [
    accessLookupEmail,
    usuarioAcessoDebug.duplicatedCount,
    usuarioAcessoDebug.selectedUsuarioAcessoId,
  ]);

  const {
    data: acessoCompleto,
    isLoading: loadingAcessoCompleto,
    isError: isAcessoCompletoError,
    refetch: refetchAcessoCompleto,
  } = useQuery({
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

  const resolvePerfilPermissao = async (acessoSource) => {
    const perfilId = acessoSource?.perfil_id;
    const perfilNome = acessoSource?.perfil_nome;
    if (!perfilId && !perfilNome) return { profile: null, fallbackReason: null };

    try {
      if (perfilId) {
        const directProfile = await base44.entities.PerfilPermissao.get(perfilId);
        if (directProfile?.id) return { profile: directProfile, fallbackReason: null };
      }
    } catch {
      // fallback abaixo
    }

    if (perfilId) {
      try {
        const filteredById = await base44.entities.PerfilPermissao.filter({ id: perfilId });
        if (Array.isArray(filteredById) && filteredById[0]?.id) {
          return { profile: filteredById[0], fallbackReason: 'filter_by_id' };
        }
      } catch {
        // mantém fluxo para próximo fallback
      }
    }

    if (perfilNome) {
      try {
        const filteredByName = await base44.entities.PerfilPermissao.filter({ nome_perfil: perfilNome });
        if (Array.isArray(filteredByName) && filteredByName[0]?.id) {
          return { profile: filteredByName[0], fallbackReason: 'filter_by_name' };
        }
      } catch {
        // sem fallback adicional
      }
    }

    throw new Error('PERFIL_PERMISSAO_NOT_FOUND');
  };

  const {
    data: perfilAcessoResult,
    isLoading: loadingPerfilAcesso,
    isError: isPerfilAcessoError,
    refetch: refetchPerfilAcesso,
  } = useQuery({
    queryKey: ['perfilPermissao', acessoResolvido?.perfil_id],
    queryFn: () => resolvePerfilPermissao(acessoResolvido),
    enabled: !!acessoResolvido && !!(acessoResolvido?.perfil_id || acessoResolvido?.perfil_nome),
    staleTime: 60 * 1000,
    retry: 4,
    retryDelay: (attemptIndex) => Math.min(400 * (attemptIndex + 1), 2000),
  });
  const perfilAcesso = perfilAcessoResult?.profile || null;
  const perfilFallbackReason = perfilAcessoResult?.fallbackReason || null;
  const hasPerfilVinculado = Boolean(acessoResolvido?.perfil_id || acessoResolvido?.perfil_nome);

  const {
    data: resolvedPermissionsData,
    isLoading: loadingResolvedPermissions,
    isError: isResolvedPermissionsError,
    refetch: refetchResolvedPermissions,
  } = useQuery({
    queryKey: ['resolvedPermissions', acessoResolvido?.id, perfilAcesso?.id],
    enabled: !!acessoResolvido && (!hasPerfilVinculado || !loadingPerfilAcesso),
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
  const fallbackAcessoPermissions = buildPermissionsFromSource(acessoResolvido || {});
  const normalizedResolvedPermissions = superAdmin
    ? buildFullAccessPermissions()
    : buildPermissionsFromSource(
      isResolvedPermissionsError ? fallbackAcessoPermissions : resolvedPermissionMatrix,
      fallbackAcessoPermissions,
    );
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
  const {
    data: unidadesFilhas = [],
    isLoading: loadingUnidades,
    isFetched: fetchedUnidades,
    isError: isUnidadesError,
    refetch: refetchUnidades,
  } = useQuery({
    queryKey: ['unidadesFilhas', subgrupamentoId],
    queryFn: () => base44.entities.Subgrupamento.filter({ tipo: 'Unidade', grupamento_id: subgrupamentoId }),
    enabled: requiresUnidades,
    staleTime: 5 * 60 * 1000,
  });

  const profileFetchInFlight = hasPerfilVinculado && loadingPerfilAcesso;
  const profileFetchFatalError = hasPerfilVinculado && !loadingPerfilAcesso && isPerfilAcessoError;

  const isLoading = loadingAuth
    || loadingAcesso
    || loadingAcessoCompleto
    || loadingResolvedPermissions
    || profileFetchInFlight
    || (requiresUnidades && loadingUnidades);
  const criticalAccessError = Boolean(
    isAuthError
    || (!shouldBypassUsuarioAcessoBlocking && hasUsuarioAcessoCriticalError)
  );
  const nonCriticalPermissionError = Boolean(
    isAcessoCompletoError
    || isPerfilAcessoError
    || isResolvedPermissionsError
    || (requiresUnidades && isUnidadesError)
  );
  const accessErrorDetails = {
    critical: {
      auth: Boolean(isAuthError),
      usuarioAcesso: Boolean(hasUsuarioAcessoCriticalError),
      usuarioAcessoBlocking: Boolean(!shouldBypassUsuarioAcessoBlocking && hasUsuarioAcessoCriticalError),
    },
    nonCritical: {
      usuarioAcessoCompleto: Boolean(isAcessoCompletoError),
      perfilPermissao: Boolean(isPerfilAcessoError),
      perfilPermissaoFatal: Boolean(profileFetchFatalError),
      resolvedPermissions: Boolean(isResolvedPermissionsError),
      unidades: Boolean(requiresUnidades && isUnidadesError),
    },
  };
  const isAccessError = criticalAccessError;
  const isPermissionPartialError = nonCriticalPermissionError;
  const isAccessResolved = !accessLookupEmail || (
    !criticalAccessError
    && (
      shouldBypassUsuarioAcessoBlocking
        ? (
          !loadingAcessoCompleto
          && !loadingResolvedPermissions
          && !profileFetchInFlight
          && (!requiresUnidades || (!loadingUnidades && fetchedUnidades))
        )
        : (
          !loadingAcesso
          && !loadingAcessoCompleto
          && !loadingResolvedPermissions
          && !profileFetchInFlight
          && fetchedAcesso
          && (!requiresUnidades || (!loadingUnidades && fetchedUnidades))
        )
    )
  );

  const hasPerfilPermissaoPartialError = accessErrorDetails.nonCritical.perfilPermissao;
  const hasResolvedPermissionsPartialError = accessErrorDetails.nonCritical.resolvedPermissions;
  const hasUnidadesPartialError = accessErrorDetails.nonCritical.unidades;
  const permissionErrorMessage = profileFetchFatalError
    ? 'Não foi possível carregar o perfil de permissões.'
    : null;
  const shouldBlockAccessByPermissionError = profileFetchFatalError && !superAdmin;
  const grantedModules = listGrantedByPrefix(normalizedResolvedPermissions, 'acesso_');
  const grantedActions = listGrantedByPrefix(normalizedResolvedPermissions, 'perm_');
  const debugAccess = {
    emailAuthOriginal: user?.email || null,
    emailNormalizado: accessLookupEmail || null,
    status: {
      currentUser: {
        isLoading: Boolean(loadingAuth),
        isError: Boolean(isAuthError),
        hasData: Boolean(user),
      },
      auth: {
        isAuthenticated: Boolean(user),
        isImpersonating: Boolean(impersonationContext.isImpersonating),
      },
      usuarioAcessoFilter: {
        enabled: Boolean(accessLookupEmail),
        isLoading: Boolean(loadingAcesso),
        isFetched: Boolean(fetchedAcesso),
        isError: Boolean(isAcessoError),
        result: usuarioAcessoDebug.filterAttempt,
      },
      usuarioAcessoFallbackList: {
        used: Boolean(usuarioAcessoDebug.fallbackList.used),
        result: usuarioAcessoDebug.fallbackList.status,
        foundCount: usuarioAcessoDebug.fallbackList.foundCount,
      },
      perfilPermissaoGet: {
        attempted: Boolean(acessoResolvido?.perfil_id),
        isLoading: Boolean(loadingPerfilAcesso),
        isError: Boolean(isPerfilAcessoError),
      },
      perfilPermissaoFallbackFilter: {
        used: Boolean(perfilFallbackReason),
        strategy: perfilFallbackReason || null,
        isError: Boolean(isPerfilAcessoError && !perfilAcesso?.id),
      },
      resolvedPermissions: {
        isLoading: Boolean(loadingResolvedPermissions),
        isError: Boolean(isResolvedPermissionsError),
        hasData: Boolean(resolvedPermissionsData?.permissions),
      },
    },
    usuarioAcessoEncontradosQuantidade: Array.isArray(usuarioAcessoList) ? usuarioAcessoList.length : 0,
    usuarioAcessoEncontradosIds: Array.isArray(usuarioAcessoList) ? usuarioAcessoList.map((item) => item?.id).filter(Boolean) : [],
    selectedUsuarioAcessoId: usuarioAcessoDebug.selectedUsuarioAcessoId,
    duplicatedCount: usuarioAcessoDebug.duplicatedCount,
    perfil_id: acessoResolvido?.perfil_id || null,
    modulesPermitidos: {
      count: grantedModules.length,
      lista: grantedModules,
    },
    actionsPermitidas: {
      count: grantedActions.length,
      lista: grantedActions,
    },
    isAccessError,
    isPermissionPartialError,
    shouldBypassUsuarioAcessoBlocking,
    accessErrorDetails,
  };

  useEffect(() => {
    if (!import.meta.env.DEV || (!nonCriticalPermissionError && !acessoResolvido)) return;

    console.info('[useCurrentUser] Diagnóstico de permissões', {
      email: accessLookupEmail || null,
      perfil_id: acessoResolvido?.perfil_id || null,
      perfil_nome: acessoResolvido?.perfil_nome || null,
      perfil_carregado: Boolean(perfilAcesso?.id),
      perfil_fallback: perfilFallbackReason || null,
      perfil_erro: Boolean(hasPerfilPermissaoPartialError),
      resolved_permissions_erro: Boolean(hasResolvedPermissionsPartialError),
      modules_permitidos: countGrantedByPrefix(normalizedResolvedPermissions, 'acesso_'),
      actions_permitidas: countGrantedByPrefix(normalizedResolvedPermissions, 'perm_'),
      total_permissoes_permitidas: countGrantedPermissions(normalizedResolvedPermissions),
      access_blocked_by_profile_error: shouldBlockAccessByPermissionError,
    });
  }, [
    acessoResolvido,
    accessLookupEmail,
    normalizedResolvedPermissions,
    perfilAcesso?.id,
    perfilFallbackReason,
    shouldBlockAccessByPermissionError,
    hasPerfilPermissaoPartialError,
    hasResolvedPermissionsPartialError,
    hasUnidadesPartialError,
    nonCriticalPermissionError,
  ]);

  const refetchAccess = async () => {
    await refetchCurrentUser();
    await refetchAcesso();
    if (acesso?.id) await refetchAcessoCompleto();
    if (acessoResolvido?.perfil_id) await refetchPerfilAcesso();
    if (acessoResolvido) await refetchResolvedPermissions();
    if (requiresUnidades) await refetchUnidades();
  };

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
    if (shouldBlockAccessByPermissionError) return false;

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
    if (shouldBlockAccessByPermissionError) return false;

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
    isAccessError,
    isPermissionPartialError,
    shouldBlockAccessByPermissionError,
    permissionErrorMessage,
    accessErrorDetails,
    debugAccess,
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
    refetchAccess,
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
