import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * useCurrentUser — Lote 1A
 * ----------------------------------------------------------------------------
 * Refatorado para consumir a Deno Function `getUserPermissions` como única
 * fonte de verdade para usuário + acesso + perfil + permissões consolidadas.
 *
 * Removidas as seguintes chamadas diretas ao SDK:
 *   - base44.entities.UsuarioAcesso.filter
 *   - base44.entities.UsuarioAcesso.list  (fallback)
 *   - base44.entities.UsuarioAcesso.get
 *   - base44.entities.PerfilPermissao.get
 *   - base44.entities.PerfilPermissao.filter
 *
 * Mantida a chamada a base44.entities.Subgrupamento.filter apenas para
 * compor unidadesFilhas no escopo "subsetor" (consumida por GlobalMilitarSearch
 * e MilitarSelector via getMilitarScopeFilters). Esta é uma chamada leve por
 * subgrupamento e está fora do escopo do Lote 1A.
 *
 * A API pública do hook (campos retornados) foi preservada integralmente.
 * ----------------------------------------------------------------------------
 */

const ACCESS_QUERY_STALE_TIME = 5 * 60 * 1000;
const ACCESS_QUERY_GC_TIME = 15 * 60 * 1000;

const SELF_RESTRICTED_SCOPES = new Set(['proprio', 'próprio', 'individual', 'self', 'auto']);

const toLowerSafe = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : null);

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

// Construtor de objeto de "permissions completas" para admin.
// Mantém compatibilidade com consumidores que verificam `permissions === 'ALL'`
// ou `canAccessAll === true`.
const ALL_PERMISSIONS_SENTINEL = 'ALL';

async function fetchUserPermissions() {
  const response = await base44.functions.invoke('getUserPermissions', {});
  // base44.functions.invoke retorna axios-like: { data, status, headers }
  const payload = response?.data ?? response;

  if (!payload) {
    throw new Error('Resposta vazia da função getUserPermissions');
  }

  if (payload?.error && !payload?.user) {
    const err = new Error(payload.error || 'Falha ao carregar permissões');
    err.status = response?.status || 500;
    throw err;
  }

  return payload;
}

export function useCurrentUser() {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['current-user-permissions'],
    queryFn: fetchUserPermissions,
    staleTime: ACCESS_QUERY_STALE_TIME,
    gcTime: ACCESS_QUERY_GC_TIME,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const user = data?.user || null;
  const acessos = Array.isArray(data?.acessos) ? data.acessos : [];
  const acesso = acessos[0] || null; // primeiro registro de acesso ativo
  const perfisMap = data?.perfis || {};
  const perfilAcesso = acesso?.perfil_id ? (perfisMap[acesso.perfil_id] || null) : null;

  const scope = data?.scope || { tipo: 'vazio', estruturaIds: [], militarId: null, reason: null };
  const modules = data?.modules || {};
  const actions = data?.actions || {};
  const meta = data?.meta || {};

  const isAdminByRole = Boolean(data?.isAdminByRole);
  const isAdminByAccess = Boolean(data?.isAdminByAccess);
  const isAdmin = Boolean(data?.isAdmin);
  const accessMode = data?.accessMode || (isAdmin ? 'admin' : 'restricted');
  const permissionsResolvedAs = data?.permissionsResolvedAs || (isAdmin ? 'admin' : 'profiles');

  // Compatibilidade com consumidores que tratam superadmin como "acesso total".
  // No backend, isAdmin engloba role admin + acesso admin. Não temos mais um
  // "superadmin" separado: para fins de UI, isAdmin é o nível máximo.
  const superAdmin = isAdmin;
  const hasAbsoluteAccess = isAdmin;

  // Modo de acesso para guards/escopo. Usa scope.tipo do backend quando possível,
  // com fallback para o tipo_acesso do primeiro registro.
  const resolvedTipoAcesso = isAdmin
    ? 'admin'
    : (normalizeAccessMode(scope?.tipo) || normalizeAccessMode(acesso?.tipo_acesso) || 'proprio');

  const modoAcesso = resolvedTipoAcesso;

  // Subgrupamento / escopo organizacional.
  // Para setor/subsetor/unidade, `scope.estruturaIds[0]` é o id principal.
  // Para "proprio", não há subgrupamento.
  const isSelfRestrictedScope = modoAcesso === 'proprio';

  let subgrupamentoId = null;
  let subgrupamentoTipo = null;
  if (!isSelfRestrictedScope && !isAdmin) {
    if (modoAcesso === 'setor') {
      subgrupamentoId = acesso?.grupamento_id || (Array.isArray(scope?.estruturaIds) ? scope.estruturaIds[0] : null) || null;
      subgrupamentoTipo = 'Grupamento';
    } else if (modoAcesso === 'subsetor') {
      subgrupamentoId = acesso?.subgrupamento_id || (Array.isArray(scope?.estruturaIds) ? scope.estruturaIds[0] : null) || null;
      subgrupamentoTipo = 'Subgrupamento';
    } else if (modoAcesso === 'unidade') {
      subgrupamentoId = acesso?.subgrupamento_id || (Array.isArray(scope?.estruturaIds) ? scope.estruturaIds[0] : null) || null;
      subgrupamentoTipo = 'Unidade';
    }
  }

  const userEmail = user?.email || null;
  const linkedMilitarId = scope?.militarId || acesso?.militar_id || null;
  const linkedMilitarEmail = acesso?.militar_email || null;

  // Carregamento de unidades filhas para escopo "subsetor".
  // Mantido por compatibilidade com getMilitarScopeFilters quando o usuário
  // tem visão de subsetor e precisa enxergar as unidades-filhas.
  // Esta é uma chamada leve e fora do escopo do Lote 1A.
  const requiresUnidades = modoAcesso === 'subsetor' && Boolean(subgrupamentoId);
  const {
    data: unidadesFilhas = [],
    isLoading: loadingUnidades,
    isFetched: fetchedUnidades,
  } = useQuery({
    queryKey: ['unidadesFilhas', subgrupamentoId],
    queryFn: () => base44.entities.Subgrupamento.filter({ tipo: 'Unidade', grupamento_id: subgrupamentoId }),
    enabled: requiresUnidades,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Estados de erro/carregamento mapeados para a API antiga.
  const isAuthError = isError && (error?.status === 401);
  const isPermissionsError = isError && !isAuthError;
  // hasUserButNoAccess: usuário autenticado mas sem registro de UsuarioAcesso
  // (cenário atendido pelo getUserPermissions que retorna 200 com acessos: [])
  const hasUserButNoAccess = Boolean(
    !isLoading
    && !isError
    && data?.user
    && !isAdmin
    && acessos.length === 0,
  );

  const isAccessError = Boolean(isAuthError || isPermissionsError || hasUserButNoAccess);
  const isPermissionPartialError = false; // backend consolida tudo em uma chamada
  const shouldBlockAccessByPermissionError = false;
  const permissionErrorMessage = isPermissionsError ? (error?.message || 'Falha ao carregar permissões.') : null;

  const accessErrorDetails = {
    critical: {
      auth: Boolean(isAuthError),
      usuarioAcesso: Boolean(isPermissionsError),
      usuarioAcessoBlocking: Boolean(isPermissionsError),
      commonUserWithoutValidAccess: Boolean(hasUserButNoAccess),
    },
    nonCritical: {
      usuarioAcessoCompleto: false,
      perfilPermissao: false,
      perfilPermissaoFatal: false,
      resolvedPermissions: false,
      unidades: Boolean(requiresUnidades && fetchedUnidades === false && !loadingUnidades && !data),
    },
  };

  const isAccessResolved = !isLoading && !isError && Boolean(data) && (!requiresUnidades || (fetchedUnidades && !loadingUnidades));

  // Função utilitária: testa permissão de módulo.
  // Para admin, retorna true sempre.
  // Para restritos, consulta `modules[modulo]` (chave canônica do backend).
  const canAccessModule = (modulo) => {
    if (!modulo) return false;
    if (hasAbsoluteAccess) return true;
    if (isLoading || !isAccessResolved) return false;
    if (isError) return false;
    return modules[modulo] === true;
  };

  const canAccessAction = (acao) => {
    if (!acao) return false;
    if (hasAbsoluteAccess) return true;
    if (isLoading || !isAccessResolved) return false;
    if (isError) return false;
    return actions[acao] === true;
  };

  // Verificação de escopo por registro (mantida da API anterior).
  const hasAccess = (registro) => {
    if (!registro) return false;
    if (isAdmin) return true;

    if (modoAcesso === 'setor') {
      return (
        registro.grupamento_id === subgrupamentoId
        || registro.subgrupamento_id === subgrupamentoId
      );
    }

    if (modoAcesso === 'subsetor') {
      const scopeIds = [subgrupamentoId, ...(unidadesFilhas || []).map((u) => u.id)];
      return scopeIds.includes(registro.subgrupamento_id);
    }

    if (modoAcesso === 'unidade') {
      return registro.subgrupamento_id === subgrupamentoId;
    }

    if (modoAcesso === 'proprio') {
      return (
        registro.created_by === userEmail
        || registro.militar_email === userEmail
        || registro.email === userEmail
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

  // Filtros de escopo de Militar — preservados para GlobalMilitarSearch,
  // MilitarSelector e demais consumidores até que cada um migre para
  // getScopedMilitares (lotes 1B em diante).
  const getMilitarScopeFilters = () => {
    if (isAdmin) return [];

    if (modoAcesso === 'setor' && subgrupamentoId) {
      return [{ grupamento_id: subgrupamentoId }, { subgrupamento_id: subgrupamentoId }];
    }

    if (modoAcesso === 'subsetor' && subgrupamentoId) {
      return [
        { subgrupamento_id: subgrupamentoId },
        ...(unidadesFilhas || []).map((u) => ({ subgrupamento_id: u.id })),
      ];
    }

    if (modoAcesso === 'unidade' && subgrupamentoId) {
      return [{ subgrupamento_id: subgrupamentoId }];
    }

    if (modoAcesso === 'proprio' && linkedMilitarId) {
      return [{ id: linkedMilitarId }];
    }

    return [];
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

  // Permissions object: para admin, usar sentinela 'ALL' (compatível com
  // RequireModuleAccess que checa `permissions === 'ALL'`).
  // Para restritos, agregamos modules + actions em um único objeto plano,
  // mantendo as chaves canônicas (com prefixos `acesso_` e `perm_`) e também
  // os aliases sem prefixo (compatibilidade com código legado).
  const permissionsObject = (() => {
    if (hasAbsoluteAccess) return ALL_PERMISSIONS_SENTINEL;
    const flat = {};
    Object.entries(modules).forEach(([key, value]) => {
      const truthy = value === true;
      flat[`acesso_${key}`] = truthy;
      flat[key] = truthy;
    });
    Object.entries(actions).forEach(([key, value]) => {
      const truthy = value === true;
      flat[`perm_${key}`] = truthy;
      flat[key] = truthy;
    });
    return flat;
  })();

  const debugAccess = {
    emailAuthOriginal: user?.email || null,
    emailNormalizado: userEmail,
    status: {
      currentUser: {
        isLoading,
        isError,
        hasData: Boolean(user),
      },
      auth: {
        isAuthenticated: Boolean(user),
        isImpersonating: false,
      },
      getUserPermissions: {
        isLoading,
        isError,
        hasData: Boolean(data),
        accessMode,
        permissionsResolvedAs,
      },
    },
    usuarioAcessoEncontradosQuantidade: acessos.length,
    usuarioAcessoEncontradosIds: acessos.map((a) => a?.id).filter(Boolean),
    selectedUsuarioAcessoId: acesso?.id || null,
    duplicatedCount: Math.max(0, acessos.length - 1),
    perfil_id: acesso?.perfil_id || null,
    modulesPermitidos: {
      count: Object.values(modules).filter(Boolean).length,
      lista: Object.entries(modules).filter(([, v]) => v === true).map(([k]) => `acesso_${k}`),
    },
    actionsPermitidas: {
      count: Object.values(actions).filter(Boolean).length,
      lista: Object.entries(actions).filter(([, v]) => v === true).map(([k]) => `perm_${k}`),
    },
    scope,
    meta,
    isAccessError,
    isPermissionPartialError,
    shouldBypassUsuarioAcessoBlocking: false,
    isAuthAdminUser: isAdminByRole,
    accessErrorDetails,
  };

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!isAccessError && !isError) return;
    console.warn('[useCurrentUser] estado de erro de acesso/permissões', {
      email: userEmail,
      isAuthError,
      isPermissionsError,
      hasUserButNoAccess,
      message: error?.message || null,
    });
  }, [isAccessError, isError, isAuthError, isPermissionsError, hasUserButNoAccess, userEmail, error]);

  const refetchAccess = async () => {
    await refetch();
  };

  const resolvedAccessContext = {
    isImpersonating: false,
    baseEmail: userEmail,
    effectiveEmail: userEmail,
    hasAcessoRecord: Boolean(acesso),
    modoAcesso,
    isAdmin,
    isSuperAdmin: superAdmin,
    permissions: permissionsObject,
    canAccessAll: hasAbsoluteAccess,
  };

  return {
    // Núcleo
    user,
    acesso,
    perfilAcesso,
    isAdmin,
    isSuperAdmin: superAdmin,
    permissions: permissionsObject,
    canAccessAll: hasAbsoluteAccess,

    // Estado
    isLoading,
    isAccessError,
    isPermissionPartialError,
    shouldBlockAccessByPermissionError,
    permissionErrorMessage,
    accessErrorDetails,
    debugAccess,
    isAccessResolved,

    // Escopo organizacional
    modoAcesso,
    subgrupamentoId,
    subgrupamentoTipo,
    userEmail,
    linkedMilitarId,
    linkedMilitarEmail,
    unidadesFilhas,

    // Helpers de permissão / escopo
    canAccessModule,
    canAccessAction,
    hasAccess,
    hasSelfAccess,
    getMilitarScopeFilters,
    getAccessModeFromUser,

    // Contexto consolidado
    resolvedAccessContext,
    refetchAccess,
  };
}