import { recalcularPeriodoAquisitivoVinculado } from './recalcularPeriodoAquisitivo';

export async function sincronizarPeriodoAquisitivoDaFerias({
  periodoAquisitivoId,
  periodoAquisitivoRef,
  militarId,
}) {
  return recalcularPeriodoAquisitivoVinculado({
    periodoId: periodoAquisitivoId || null,
    periodoRef: periodoAquisitivoRef || null,
    militarId: militarId || null,
  });
}
