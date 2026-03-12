export const DIAS_BASE_PADRAO = 30;

const STATUS_GOZADA = new Set(['Gozada']);
const STATUS_PREVISTA = new Set(['Prevista', 'Autorizada', 'Em Curso', 'Interrompida']);

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getPeriodoKeys(periodo = {}) {
  const referencia = periodo?.ano_referencia || periodo?.referencia;
  return [periodo?.id, referencia].filter(Boolean);
}

function getFeriasDoPeriodo(periodo = {}, ferias = []) {
  const keys = new Set(getPeriodoKeys(periodo));
  if (!keys.size) return [];

  return (ferias || []).filter(
    (item) => item && (keys.has(item.periodo_aquisitivo_id) || keys.has(item.periodo_aquisitivo_ref))
  );
}

export function obterDiasBase(periodo = {}) {
  return toNumber(periodo?.dias_base, DIAS_BASE_PADRAO);
}

export function obterDiasAjuste(periodo = {}) {
  return toNumber(periodo?.dias_ajuste, 0);
}

export function calcularDiasTotal(periodo = {}) {
  return obterDiasBase(periodo) + obterDiasAjuste(periodo);
}

function somarDiasPorStatus(feriasPeriodo = []) {
  return (feriasPeriodo || []).reduce(
    (acc, item) => {
      const dias = Math.max(0, toNumber(item?.dias, 0));
      const status = item?.status || '';

      if (STATUS_GOZADA.has(status)) acc += dias;

      return acc;
    },
    0
  );
}

function somarDiasPrevistosPorStatus(feriasPeriodo = []) {
  return (feriasPeriodo || []).reduce(
    (acc, item) => {
      const dias = Math.max(0, toNumber(item?.dias, 0));
      const status = item?.status || '';

      if (STATUS_PREVISTA.has(status)) acc += dias;

      return acc;
    },
    0
  );
}

export function calcularDiasGozados(periodo = {}, ferias = []) {
  return somarDiasPorStatus(getFeriasDoPeriodo(periodo, ferias));
}

export function calcularDiasPrevistos(periodo = {}, ferias = []) {
  return somarDiasPrevistosPorStatus(getFeriasDoPeriodo(periodo, ferias));
}

export function calcularDiasSaldo(periodo = {}, ferias = []) {
  return calcularDiasTotal(periodo) - calcularDiasGozados(periodo, ferias) - calcularDiasPrevistos(periodo, ferias);
}

export function filtrarFeriasDoPeriodo(periodo = {}, ferias = []) {
  return getFeriasDoPeriodo(periodo, ferias);
}

export function recalcularSaldoPeriodo(periodo = {}, ferias = []) {
  const dias_base = obterDiasBase(periodo);
  const dias_ajuste = obterDiasAjuste(periodo);
  const dias_total = calcularDiasTotal(periodo);
  const dias_gozados = calcularDiasGozados(periodo, ferias);
  const dias_previstos = calcularDiasPrevistos(periodo, ferias);
  const dias_saldo = calcularDiasSaldo(periodo, ferias);

  return {
    dias_base,
    dias_ajuste,
    dias_total,
    dias_gozados,
    dias_previstos,
    dias_saldo,
  };
}

