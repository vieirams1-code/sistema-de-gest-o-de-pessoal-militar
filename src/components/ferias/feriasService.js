import { recalcularPeriodoAquisitivoVinculado } from './recalcularPeriodoAquisitivo';
import { aplicarAjusteNegativo, prepararDispensaComDesconto } from './ajustePeriodoService';

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

export async function registrarDispensaComDescontoFerias({
  periodoId,
  quantidade,
  motivo,
  observacao,
  data,
  usuario,
}) {
  return prepararDispensaComDesconto({
    periodoId,
    quantidade,
    motivo,
    observacao,
    data,
    usuario,
  });
}

export async function subtrairDiasPeriodoAquisitivo({ periodoId, quantidade, motivo, observacao }) {
  return aplicarAjusteNegativo({
    periodoId,
    quantidade,
    motivo,
    observacao,
  });
}
