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
  const { data: user, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 5 * 60 * 1000,
  });

  const isAdmin = user?.role === 'admin';
  // setorId: ID do Setor (Grupamento) ou Subsetor (Subgrupamento) atribuído ao usuário
  const subgrupamentoId = user?.subgrupamento_id || null;
  const subgrupamentoTipo = user?.subgrupamento_tipo || null; // 'Grupamento' (Setor) ou 'Subgrupamento' (Subsetor/Seção)

  // Modo de acesso:
  // 'admin' - acesso total
  // 'setor' - acesso a todos os registros do setor e subsetores
  // 'subsetor' - acesso apenas ao próprio subsetor
  // 'proprio' - sem setor atribuído: acesso apenas aos próprios dados (por email)
  const modoAcesso = isAdmin
    ? 'admin'
    : subgrupamentoId
      ? (subgrupamentoTipo === 'Grupamento' ? 'setor' : 'subsetor')
      : 'proprio';

  const userEmail = user?.email || null;

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

    const possibleEmails = [
      registro.email,
      registro.militar_email,
      registro.created_by,
      registro.usuario_email,
    ].filter(Boolean);

    return !!userEmail && possibleEmails.includes(userEmail);
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
    hasAccess,
    hasSelfAccess,
    hasModuleAccess,
  };
}
