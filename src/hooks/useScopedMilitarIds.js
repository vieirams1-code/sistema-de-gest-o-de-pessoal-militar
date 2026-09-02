import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/components/auth/useCurrentUser';

/**
 * useScopedMilitarIds
 * ----------------------------------------------------------------------------
 * Hook utilitário (Lote 1D-E — Auditoria de Escopo Transversal).
 *
 * Centraliza a obtenção dos `militar_id`s aos quais o usuário corrente tem
 * acesso, segundo o seu escopo organizacional (admin / setor / subsetor /
 * unidade / próprio).
 *
 * Comportamento:
 *  - admin                         → retorna `{ ids: null, isAdmin: true }`
 *                                    (null sinaliza "sem restrição" para
 *                                    consumidores; eles podem chamar `.list()`
 *                                    global tranquilamente).
 *  - escopo setor/subsetor/unidade → carrega militares do escopo via
 *                                    `getMilitarScopeFilters()` e devolve
 *                                    `{ ids: string[], isAdmin: false }`.
 *  - escopo próprio                → resolve apenas o militar vinculado.
 *  - sem escopo                    → `{ ids: [], isAdmin: false }`.
 *
 * Não altera regras de negócio. Não toca em entidades de domínio. Apenas
 * resolve o universo de `militar_id` permitidos para o usuário corrente.
 */
export function useScopedMilitarIds(options = {}) {
  const { seedIds } = options;
  const {
    isAdmin,
    modoAcesso,
    userEmail,
    linkedMilitarId,
    linkedMilitarEmail,
    getMilitarScopeFilters,
    isAccessResolved,
  } = useCurrentUser();

  // Escopo geral (UsuarioAcesso.tipo_acesso = 'admin' em usuário sem role
  // de plataforma admin) também é "sem restrição": o backend (cudEscopado,
  // getUserPermissions) trata isAdminByAccess como bypass de escopo militar.
  // Sem este tratamento, o escopo geral caía no branch de filtros vazios e
  // era interpretado como "nenhum militar permitido", negando acesso indevidamente.
  const semRestricao = isAdmin || modoAcesso === 'admin';

  const queryKey = [
    'scoped-militar-ids',
    semRestricao ? 'admin' : modoAcesso || 'sem-escopo',
    userEmail || 'self',
    linkedMilitarId || null,
  ];

  const hasSeedIds = Array.isArray(seedIds);

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (isAdmin) return null; // admin: null = sem restrição
      if (modoAcesso === 'proprio') {
        const ids = new Set();
        if (linkedMilitarId) ids.add(linkedMilitarId);

        const knownEmails = Array.from(new Set([userEmail, linkedMilitarEmail].filter(Boolean)));

        const batches = await Promise.all(
          knownEmails.flatMap((email) => [
            base44.entities.Militar.filter({ email }),
            base44.entities.Militar.filter({ email_particular: email }),
            base44.entities.Militar.filter({ email_funcional: email }),
          ])
        );

        batches.flat().forEach((m) => {
          if (m?.id) ids.add(m.id);
        });

        return Array.from(ids);
      }

      const filters = getMilitarScopeFilters();
      if (!filters.length) return [];

      const batches = await Promise.all(
        filters.map((filter) => base44.entities.Militar.filter(filter))
      );
      const ids = new Set();
      for (const m of batches.flat()) {
        if (m?.id) ids.add(m.id);
      }
      return Array.from(ids);
    },
    enabled: isAccessResolved && !hasSeedIds && !semRestricao,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const resolvedIds = hasSeedIds
    ? Array.from(new Set((seedIds || []).map(String)))
    : semRestricao
      ? null
      : query.data === undefined
        ? []
        : query.data;

  const isLoading = !isAccessResolved || (!hasSeedIds && !semRestricao && query.isLoading);
  const isReady = isAccessResolved && (semRestricao || hasSeedIds || query.data !== undefined) && !isLoading;

  return {
    ids: resolvedIds,
    // isAdmin aqui significa "escopo sem restrição" (role admin OU escopo geral),
    // espelhando o bypass de escopo aplicado pelo backend.
    isAdmin: semRestricao,
    isLoading,
    isReady,
  };
}

/**
 * Helper puro: filtra uma coleção (já carregada) pelos militar_id permitidos.
 * Para admin (`scopedIds === null`), retorna a lista intacta.
 */
export function filtrarPorMilitarIdsPermitidos(lista = [], scopedIds) {
  if (scopedIds === null) return lista; // admin
  if (!Array.isArray(scopedIds) || scopedIds.length === 0) return [];
  const set = new Set(scopedIds.map(String));
  return (lista || []).filter((item) => {
    const mid = item?.militar_id;
    if (!mid) return false;
    return set.has(String(mid));
  });
}