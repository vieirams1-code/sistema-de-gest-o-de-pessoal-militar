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
export function useScopedMilitarIds() {
  const {
    isAdmin,
    modoAcesso,
    userEmail,
    linkedMilitarId,
    linkedMilitarEmail,
    getMilitarScopeFilters,
    isAccessResolved,
  } = useCurrentUser();

  const queryKey = [
    'scoped-militar-ids',
    isAdmin ? 'admin' : modoAcesso || 'sem-escopo',
    userEmail || 'self',
    linkedMilitarId || null,
  ];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (isAdmin) return null; // admin: null = sem restrição
      if (modoAcesso === 'proprio') {
        const ids = new Set();
        if (linkedMilitarId) ids.add(linkedMilitarId);
        const knownEmails = [userEmail, linkedMilitarEmail].filter(Boolean);
        for (const email of knownEmails) {
          const consultas = await Promise.all([
            base44.entities.Militar.filter({ email: email }),
            base44.entities.Militar.filter({ email_particular: email }),
            base44.entities.Militar.filter({ email_funcional: email }),
          ]);
          consultas.flat().forEach((m) => { if (m?.id) ids.add(m.id); });
        }
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
    enabled: isAccessResolved,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    ids: query.data === undefined ? [] : query.data, // undefined = ainda carregando → tratar como "sem ids ainda"
    isAdmin,
    isLoading: query.isLoading || !isAccessResolved,
    isReady: isAccessResolved && !query.isLoading && query.data !== undefined,
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