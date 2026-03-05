import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useCurrentUser() {
  const { data: user, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 5 * 60 * 1000,
  });

  const isAdmin = user?.role === 'admin';
  const subgrupamentoId = user?.subgrupamento_id || null;
  const subgrupamentoTipo = user?.subgrupamento_tipo || null; // 'Grupamento' ou 'Subgrupamento'

  // Retorna true se o usuário tem acesso ao registro com base no subgrupamento_id e grupamento_id do registro
  const hasAccess = (registro) => {
    if (isAdmin) return true;
    if (!subgrupamentoId) return false;

    // Se o usuário é de um Grupamento, vê tudo do grupamento + todos os subgrupamentos filhos
    if (subgrupamentoTipo === 'Grupamento') {
      return (
        registro.subgrupamento_id === subgrupamentoId ||
        registro.grupamento_id === subgrupamentoId
      );
    }

    // Se o usuário é de um Subgrupamento específico, vê apenas o próprio
    return registro.subgrupamento_id === subgrupamentoId;
  };

  return { user, isLoading, isAdmin, subgrupamentoId, subgrupamentoTipo, hasAccess };
}