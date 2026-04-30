export const DIAS_BASE_PADRAO = 30;

const STATUS_GOZADA = new Set(['Gozada']);
const STATUS_PREVISTA = new Set(['Prevista', 'Autorizada', 'Em Curso', 'Interrompida']);

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function hasNumericValue(value) {
  return Number.isFinite(Number(value));
}

function normalizarId(valor) {
  return String(valor ?? '').trim();
}

function normalizarReferenciaPeriodo(periodo = {}) {
  return normalizarId(
    periodo?.ano_referencia ||
    periodo?.referencia ||
    periodo?.periodo_aquisitivo_ref
  );
}

export function isFeriasDoPeriodo(ferias = {}, periodo = {}) {
  const militarFeriasId = normalizarId(ferias?.militar_id);
  const militarPeriodoId = normalizarId(periodo?.militar_id);
  const mesmoMilitar = militarFeriasId && militarFeriasId === militarPeriodoId;
  if (!mesmoMilitar) return false;

  const feriasPeriodoId = normalizarId(ferias?.periodo_aquisitivo_id);
  const periodoId = normalizarId(periodo?.id);

  if (feriasPeriodoId) {
    return Boolean(periodoId && feriasPeriodoId === periodoId);
  }

  const feriasRef = normalizarId(ferias?.periodo_aquisitivo_ref);
  const periodoRef = normalizarReferenciaPeriodo(periodo);
  return Boolean(feriasRef && periodoRef && feriasRef === periodoRef);
}

export function filtrarFeriasDoPeriodo(periodo = {}, ferias = []) {
  return (ferias || []).filter((item) => item && isFeriasDoPeriodo(item, periodo));
}

export function obterDiasBase(periodo = {}) {
  if (hasNumericValue(periodo?.dias_base)) {
    return toNumber(periodo.dias_base, DIAS_BASE_PADRAO);
  }

  return DIAS_BASE_PADRAO;
}

export function calcularDiasTotal(periodo = {}) {
  if (hasNumericValue(periodo?.dias_base)) {
    return toNumber(periodo.dias_base, DIAS_BASE_PADRAO);
  }

  return DIAS_BASE_PADRAO;
}

export function calcularDiasGozados(periodo = {}, ferias = []) {
  const feriasPeriodo = filtrarFeriasDoPeriodo(periodo, ferias);

  return feriasPeriodo.reduce((acc, item) => {
    const dias = Math.max(0, toNumber(item?.dias, 0));
    const status = item?.status || '';

    if (STATUS_GOZADA.has(status)) return acc + dias;
    return acc;
  }, 0);
}

export function calcularDiasPrevistos(periodo = {}, ferias = []) {
  const feriasPeriodo = filtrarFeriasDoPeriodo(periodo, ferias);

  return feriasPeriodo.reduce((acc, item) => {
    const dias = Math.max(0, toNumber(item?.dias, 0));
    const status = item?.status || '';

    if (STATUS_PREVISTA.has(status)) return acc + dias;
    return acc;
  }, 0);
}

export function calcularDiasSaldo(periodo = {}, ferias = []) {
  return (
    calcularDiasTotal(periodo) -
    calcularDiasGozados(periodo, ferias) -
    calcularDiasPrevistos(periodo, ferias)
  );
}

export function recalcularSaldoPeriodo(periodo = {}, ferias = []) {
  const dias_base = obterDiasBase(periodo);
  const dias_total = calcularDiasTotal(periodo);
  const dias_gozados = calcularDiasGozados(periodo, ferias);
  const dias_previstos = calcularDiasPrevistos(periodo, ferias);
  const dias_saldo = calcularDiasSaldo(periodo, ferias);

  return {
    dias_base,
    dias_total,
    dias_gozados,
    dias_previstos,
    dias_saldo,
  };
}

export function getSaldoConsolidadoPeriodo({ periodo, ferias = [] }) {
  const derivado = recalcularSaldoPeriodo(periodo, ferias);

  return {
    ...periodo,
    ...derivado,
    saldo_disponivel: derivado.dias_saldo,
  };
}

export function validarDiasNoSaldoPeriodo({ periodo = {}, ferias = [], quantidade }) {
  const qtd = Math.max(0, toNumber(quantidade, 0));
  const dias_total_projetado = calcularDiasTotal(periodo);
  const dias_gozados = calcularDiasGozados(periodo, ferias);
  const dias_previstos = calcularDiasPrevistos(periodo, ferias);
  const dias_saldo_projetado = dias_total_projetado - dias_gozados - dias_previstos - qtd;

  if (dias_saldo_projetado < 0) {
    return {
      ok: false,
      mensagem:
        'Quantidade de dias informada deixa o período com saldo inconsistente em relação aos dias já gozados/previstos.',
    };
  }

  return {
    ok: true,
    dias_total_projetado,
    dias_saldo_projetado,
    dias_gozados,
    dias_previstos,
  };
}
