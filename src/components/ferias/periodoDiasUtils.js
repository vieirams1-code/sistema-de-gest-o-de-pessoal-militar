const DEFAULT_DIAS_BASE = 30;

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getPeriodoDiasBase(periodo = {}) {
  return toNumber(periodo.dias_base, DEFAULT_DIAS_BASE);
}

export function getPeriodoDiasAjuste(periodo = {}) {
  return toNumber(periodo.dias_ajuste, 0);
}

function normalizarListaFerias(ferias = []) {
  return (ferias || []).filter(Boolean);
}

function somarDiasPorStatus(ferias = []) {
  return normalizarListaFerias(ferias).reduce((acc, item) => {
    const dias = Math.max(0, toNumber(item?.dias, 0));
    const status = item?.status;

    if (status === 'Gozada') {
      acc.dias_gozados += dias;
      return acc;
    }

    // Mantém compatibilidade: férias em curso/interrompidas continuam reservando dias.
    if (['Prevista', 'Autorizada', 'Em Curso', 'Interrompida'].includes(status)) {
      acc.dias_previstos += dias;
    }

    return acc;
  }, { dias_gozados: 0, dias_previstos: 0 });
}

export function calcularSaldosPeriodo(periodo = {}, feriasRelacionadas = null) {
  const dias_base = getPeriodoDiasBase(periodo);
  const dias_ajuste = getPeriodoDiasAjuste(periodo);

  const possuiFeriasRelacionadas = Array.isArray(feriasRelacionadas);

  const totaisFerias = possuiFeriasRelacionadas
    ? somarDiasPorStatus(feriasRelacionadas)
    : {
        dias_gozados: toNumber(periodo?.dias_gozados, 0),
        dias_previstos: toNumber(periodo?.dias_previstos, 0),
      };

  const dias_total = toNumber(periodo?.dias_total, dias_base + dias_ajuste);
  const dias_gozados = totaisFerias.dias_gozados;
  const dias_previstos = totaisFerias.dias_previstos;
  const dias_saldo = dias_total - dias_gozados - dias_previstos;

  return {
    dias_base,
    dias_ajuste,
    dias_total,
    dias_gozados,
    dias_previstos,
    dias_saldo,
  };
}

export function montarPayloadPeriodoComSaldos(periodo = {}, feriasRelacionadas = null, extra = {}) {
  const saldos = calcularSaldosPeriodo(periodo, feriasRelacionadas);
  return {
    ...saldos,
    ...extra,
  };
}
