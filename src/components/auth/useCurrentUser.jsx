import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const modulePermissionsByRole = {
  admin: { all: true },
  default: {
    all: false,
    solicitacoesAtualizacao: false,
    estruturaOrganizacional: false,
  },
};

export function useCurrentUser() {
  const { data: user, isLoading: loadingAuth } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: usuarioAcessoList, isLoading: loadingAcesso } = useQuery({
    queryKey: ['usuarioAcesso', user?.email],
    queryFn: () => base44.entities.UsuarioAcesso.filter({ user_email: user.email, ativo: true }),
    enabled: !!user?.email,
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = loadingAuth || loadingAcesso;
  const acesso = usuarioAcessoList?.[0]; // Pega o primeiro acesso ativo encontrado

  // Resolve as propriedades explicitamente usando UsuarioAcesso, com fallback para o modelo antigo (User)
  const isAdmin = acesso 
    ? acesso.tipo_acesso === 'admin' 
    : (user?.role === 'admin' || user?.isAdmin === true);

  const subgrupamentoId = acesso 
    ? (acesso.subgrupamento_id || acesso.grupamento_id || null) 
    : (user?.subgrupamento_id || null);

  const subgrupamentoTipo = acesso 
    ? (acesso.tipo_acesso === 'setor' ? 'Grupamento' : acesso.tipo_acesso === 'subsetor' ? 'Subgrupamento' : null) 
    : (user?.subgrupamento_tipo || null);

  const userEmail = user?.email || null;
  const linkedMilitarId = acesso ? (acesso.militar_id || null) : (user?.militar_id || null);
  const linkedMilitarEmail = acesso ? (acesso.militar_email || null) : (user?.militar_email || null);

  // Modo de acesso: 'admin', 'setor', 'subsetor', 'proprio'
  let modoAcesso = 'proprio';
  if (acesso) {
    modoAcesso = acesso.tipo_acesso || 'proprio';
  } else {
    if (isAdmin) modoAcesso = 'admin';
    else if (subgrupamentoId) modoAcesso = subgrupamentoTipo === 'Grupamento' ? 'setor' : 'subsetor';
    else modoAcesso = 'proprio';
  }

  const getAccessModeFromUser = (targetUser, targetAcesso = null) => {
    if (targetAcesso) return targetAcesso.tipo_acesso || 'proprio';
    if (!targetUser) return 'proprio';
    if (targetUser.role === 'admin' || targetUser.isAdmin === true) return 'admin';
    if (targetUser.subgrupamento_tipo === 'Grupamento') return 'setor';
    if (targetUser.subgrupamento_tipo === 'Subgrupamento') return 'subsetor';
    return 'proprio';
  };

  /**
   * Retorna true se o usuário tem acesso ao registro.
   * @param registro - objeto com grupamento_id, subgrupamento_id e/ou created_by
   */
  const hasAccess = (registro) => {
    if (!registro) return false;
    if (isAdmin) return true;

    // Modo Setor: vê tudo do setor (via grupamento_id) e seus subsetores
    if (modoAcesso === 'setor') {
      return (
        registro.grupamento_id === subgrupamentoId ||
        registro.subgrupamento_id === subgrupamentoId
      );
    }

    // Modo Subsetor/Seção: vê apenas o próprio subsetor
    if (modoAcesso === 'subsetor') {
      return registro.subgrupamento_id === subgrupamentoId;
    }

    // Modo Próprio: acessa apenas registros criados pelo próprio email ou com created_by igual ao email
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
      return [{ subgrupamento_id: subgrupamentoId }];
    }

    if (modoAcesso === 'proprio' && userEmail) {
      const filters = [];
      if (linkedMilitarId) filters.push({ id: linkedMilitarId });
      filters.push({ email: userEmail }, { email_particular: userEmail }, { email_funcional: userEmail }, { created_by: userEmail });
      if (linkedMilitarEmail && linkedMilitarEmail !== userEmail) {
        filters.push({ email: linkedMilitarEmail }, { email_particular: linkedMilitarEmail }, { email_funcional: linkedMilitarEmail }, { militar_email: linkedMilitarEmail });
      }
      return filters;
    }

    return [];
  };

  const hasModuleAccess = (moduleKey) => {
    if (isAdmin) return true;
    const rolePermissions = modulePermissionsByRole[user?.role] || modulePermissionsByRole.default;
    if (rolePermissions.all) return true;
    return !!rolePermissions[moduleKey];
  };

  return {
    user,
    isLoading,
    isAdmin,
    subgrupamentoId,
    subgrupamentoTipo,
    modoAcesso,
    userEmail,
    linkedMilitarId,
    linkedMilitarEmail,
    hasAccess,
    hasSelfAccess,
    hasModuleAccess,
    getAccessModeFromUser,
    getMilitarScopeFilters,
  };
}
