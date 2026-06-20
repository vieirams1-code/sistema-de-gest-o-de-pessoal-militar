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
  if (hasNumericValue(periodo?.dias_adquiridos)) {
    return toNumber(periodo.dias_adquiridos, DIAS_BASE_PADRAO);
  }

  if (hasNumericValue(periodo?.dias_base)) {
    return toNumber(periodo.dias_base, DIAS_BASE_PADRAO);
  }

  if (hasNumericValue(periodo?.dias_direito)) {
    return toNumber(periodo.dias_direito, DIAS_BASE_PADRAO);
  }

  return DIAS_BASE_PADRAO;
}

export function obterDiasAdicionais(periodo = {}) {
  return Math.max(0, toNumber(periodo?.dias_adicionais ?? periodo?.dias_credito_extra ?? periodo?.creditos_extra, 0));
}

export function obterDiasDescontados(periodo = {}) {
  // Somente descontos ativos/publicados devem reduzir saldo.
  // Assume-se que o campo dias_descontados no PeriodoAquisitivo já é atualizado somente para descontos ativos pelo service.
  return Math.max(0, toNumber(periodo?.dias_descontados, 0));
}

export function calcularSaldoUtilizavelPeriodo(periodo = {}) {
  const base = obterDiasBase(periodo);
  const adicionais = obterDiasAdicionais(periodo);
  const descontados = obterDiasDescontados(periodo);

  return Math.max(0, base + adicionais - descontados);
}

export function calcularDiasTotal(periodo = {}) {
  return calcularSaldoUtilizavelPeriodo(periodo);
}

export function calcularDiasGozados(periodo = {}, ferias = [], { ignorarFeriasId = null } = {}) {
  const feriasPeriodo = filtrarFeriasDoPeriodo(periodo, ferias)
    .filter((item) => !ignorarFeriasId || normalizarId(item?.id) !== normalizarId(ignorarFeriasId));

  return feriasPeriodo.reduce((acc, item) => {
    const dias = Math.max(0, toNumber(item?.dias, 0));
    const status = item?.status || '';

    if (STATUS_GOZADA.has(status)) return acc + dias;
    return acc;
  }, 0);
}

export function calcularDiasPrevistos(periodo = {}, ferias = [], { ignorarFeriasId = null } = {}) {
  const feriasPeriodo = filtrarFeriasDoPeriodo(periodo, ferias)
    .filter((item) => !ignorarFeriasId || normalizarId(item?.id) !== normalizarId(ignorarFeriasId));

  return feriasPeriodo.reduce((acc, item) => {
    const dias = Math.max(0, toNumber(item?.dias, 0));
    const status = item?.status || '';

    if (STATUS_PREVISTA.has(status)) return acc + dias;
    return acc;
  }, 0);
}

export function calcularDiasSaldo(periodo = {}, ferias = [], options = {}) {
  return (
    calcularDiasTotal(periodo) -
    calcularDiasGozados(periodo, ferias, options) -
    calcularDiasPrevistos(periodo, ferias, options)
  );
}

export function recalcularSaldoPeriodo(periodo = {}, ferias = [], options = {}) {
  const dias_base = obterDiasBase(periodo);
  const dias_total = calcularDiasTotal(periodo);
  const dias_adicionais = obterDiasAdicionais(periodo);
  const dias_descontados = obterDiasDescontados(periodo);
  const dias_gozados = calcularDiasGozados(periodo, ferias, options);
  const dias_previstos = calcularDiasPrevistos(periodo, ferias, options);
  const dias_saldo = calcularDiasSaldo(periodo, ferias, options);

  return {
    dias_base,
    dias_total,
    dias_adicionais,
    dias_descontados,
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

export function validarDiasNoSaldoPeriodo({ periodo = {}, ferias = [], quantidade, ignorarFeriasId = null }) {
  const qtd = Math.max(0, toNumber(quantidade, 0));
  const options = { ignorarFeriasId };
  const dias_total_projetado = calcularDiasTotal(periodo);
  const dias_gozados = calcularDiasGozados(periodo, ferias, options);
  const dias_previstos = calcularDiasPrevistos(periodo, ferias, options);
  const dias_saldo_projetado = dias_total_projetado - dias_gozados - dias_previstos - qtd;

  if (dias_saldo_projetado < 0) {
    return {
      ok: false,
      mensagem:
        `Quantidade de dias informada (${qtd}d) ultrapassa o saldo utilizável do período (${Math.max(0, dias_total_projetado - dias_gozados - dias_previstos)}d), já considerando dias adicionais e dias descontados.`,
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
