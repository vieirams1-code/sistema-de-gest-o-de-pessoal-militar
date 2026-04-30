import { useCallback } from 'react';
import { useScopedMilitarIds } from '@/hooks/useScopedMilitarIds';

// =====================================================================
// useUsuarioPodeAgirSobreMilitar — Lote 1D-F (Trava Emergencial Escrita)
// ---------------------------------------------------------------------
// Helper de validação de escopo para AÇÕES DE ESCRITA (criar / editar /
// excluir / publicar / homologar / movimentar) sobre dados vinculados a
// um militar específico.
//
// Regra de segurança:
//   1. Admin ⇒ pode agir sobre qualquer militar.
//   2. Não-admin ⇒ só pode agir se o `militar_id` alvo estiver dentro
//      do universo escopado retornado por `useScopedMilitarIds`.
//   3. Quando o `militar_id` não puder ser identificado com segurança
//      (null/undefined/'') ⇒ bloquear não-admin.
//
// Esta trava é uma camada de defesa em profundidade no FRONTEND. O
// backend permanece como fonte canônica de verdade — funções com escrita
// sensível devem replicar a validação (ex.: moverMilitaresLotacao).
// =====================================================================

const ACESSO_NEGADO_MSG = 'Acesso negado: militar fora do seu escopo.';
const ESCOPO_CARREGANDO_MSG = 'Aguardando resolução do seu escopo. Tente novamente em instantes.';
const SEM_ALVO_MSG = 'Acesso negado: não foi possível identificar o militar alvo desta ação.';

export function useUsuarioPodeAgirSobreMilitar() {
  const { ids: scopedIds, isAdmin, isReady } = useScopedMilitarIds();

  /**
   * Valida se o usuário corrente pode agir sobre o militar informado.
   *
   * @param {string|null|undefined} militarId - ID do militar alvo.
   * @returns {{ permitido: boolean, motivo: string|null }}
   */
  const validar = useCallback((militarId) => {
    if (isAdmin) return { permitido: true, motivo: null };

    if (!isReady) {
      return { permitido: false, motivo: ESCOPO_CARREGANDO_MSG };
    }

    const idNormalizado = militarId == null ? '' : String(militarId).trim();
    if (!idNormalizado) {
      return { permitido: false, motivo: SEM_ALVO_MSG };
    }

    const set = new Set((scopedIds || []).map(String));
    if (!set.has(idNormalizado)) {
      return { permitido: false, motivo: ACESSO_NEGADO_MSG };
    }

    return { permitido: true, motivo: null };
  }, [isAdmin, isReady, scopedIds]);

  return {
    /** Função síncrona que retorna { permitido, motivo }. */
    validar,
    /** Atalho boolean para UI: true se a ação pode prosseguir. */
    podeAgirSobre: (militarId) => validar(militarId).permitido,
    isReady,
    isAdmin,
  };
}

export const MENSAGENS_TRAVA_ESCOPO = {
  ACESSO_NEGADO: ACESSO_NEGADO_MSG,
  ESCOPO_CARREGANDO: ESCOPO_CARREGANDO_MSG,
  SEM_ALVO: SEM_ALVO_MSG,
};