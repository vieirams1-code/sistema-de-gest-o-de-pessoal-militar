import { base44 } from '@/api/base44Client';

// =====================================================================
// getPreviaAntiguidadeMilitaresClient
// ---------------------------------------------------------------------
// Wrapper fino sobre a Deno Function `getPreviaAntiguidadeMilitares`.
// Retorna apenas os registros de HistoricoPromocaoMilitarV2 necessários
// para o motor `calcularPreviaAntiguidadeGeral` calcular a prévia no
// frontend (fonte única da verdade do motor permanece no frontend).
// =====================================================================

/**
 * @param {{ idsMilitares: string[] }} params
 * @returns {Promise<{ historicoPromocoes: Array, meta: Object }>}
 */
export async function fetchPreviaAntiguidadeMilitares({ idsMilitares } = {}) {
  const ids = Array.isArray(idsMilitares)
    ? idsMilitares.map((id) => String(id || '').trim()).filter(Boolean)
    : [];

  if (ids.length === 0) {
    return { historicoPromocoes: [], meta: { total: 0, militaresSolicitados: 0 } };
  }

  const response = await base44.functions.invoke('getPreviaAntiguidadeMilitares', {
    idsMilitares: ids,
  });
  const data = response?.data ?? response ?? {};
  return {
    historicoPromocoes: Array.isArray(data.historicoPromocoes) ? data.historicoPromocoes : [],
    meta: data.meta || {},
  };
}