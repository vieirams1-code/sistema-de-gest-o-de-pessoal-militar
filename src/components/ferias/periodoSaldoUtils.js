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

function getPeriodoKeys(periodo = {}) {
  const referencia =
    periodo?.ano_referencia ||
    periodo?.referencia ||
    periodo?.periodo_aquisitivo_ref;

  return [periodo?.id, referencia].filter(Boolean);
}

export function filtrarFeriasDoPeriodo(periodo = {}, ferias = []) {
  const keys = new Set(getPeriodoKeys(periodo));
  if (!keys.size) return [];

  return (ferias || []).filter(
    (item) =>
      item &&
      (keys.has(item.periodo_aquisitivo_id) ||
        keys.has(item.periodo_aquisitivo_ref))
  );
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
