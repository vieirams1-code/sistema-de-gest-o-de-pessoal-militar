import { calcularSaldoLiquidoPeriodo } from './calculadoraSaldoFeriasService.js';

export function calcularSaldoOperacionalPeriodo({ periodo = {}, ajustes = [], ferias = [] } = {}) {
  const saldo = calcularSaldoLiquidoPeriodo({ periodo, ajustes, ferias });

  return {
    dias_base: saldo.dias_base,
    creditos_ativos: saldo.creditos_ativos,
    debitos_ativos: saldo.debitos_ativos,
    direito_liquido: saldo.dias_base + saldo.creditos_ativos - saldo.debitos_ativos,
    ferias_previstas_gozadas: saldo.dias_gozados_previstos,
    saldo_restante: saldo.saldo_liquido,
    detalhes_creditos: saldo.detalhes_creditos,
    detalhes_debitos: saldo.detalhes_debitos,
  };
}

export function filtrarAjustesDoPeriodo(ajustes = [], periodo = {}) {
  const periodoId = String(periodo?.id || '').trim();
  const periodoRef = String(periodo?.ano_referencia || periodo?.referencia || periodo?.periodo_aquisitivo_ref || '').trim();
  const militarId = String(periodo?.militar_id || '').trim();

  return (ajustes || []).filter((ajuste) => {
    const ajustePeriodoId = String(ajuste?.periodo_aquisitivo_id || '').trim();
    if (periodoId && ajustePeriodoId) return ajustePeriodoId === periodoId;

    const ajusteRef = String(ajuste?.periodo_aquisitivo_ref || ajuste?.ano_referencia || '').trim();
    const ajusteMilitarId = String(ajuste?.militar_id || '').trim();
    return Boolean(periodoRef && ajusteRef && periodoRef === ajusteRef && (!militarId || !ajusteMilitarId || militarId === ajusteMilitarId));
  });
}

export function calcularSaldoOperacionalPeriodoComTodosAjustes({ periodo = {}, ajustes = [], ferias = [] } = {}) {
  return calcularSaldoOperacionalPeriodo({
    periodo,
    ajustes: filtrarAjustesDoPeriodo(ajustes, periodo),
    ferias,
  });
}
