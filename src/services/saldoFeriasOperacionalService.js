import { calcularSaldoLiquidoPeriodo } from './calculadoraSaldoFeriasService.js';

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
  const mesmoMilitar = !militarFeriasId || !militarPeriodoId || militarFeriasId === militarPeriodoId;
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
  if (hasNumericValue(periodo?.dias_direito)) return toNumber(periodo.dias_direito, DIAS_BASE_PADRAO);
  if (hasNumericValue(periodo?.dias_adquiridos)) return toNumber(periodo.dias_adquiridos, DIAS_BASE_PADRAO);
  if (hasNumericValue(periodo?.dias_base)) return toNumber(periodo.dias_base, DIAS_BASE_PADRAO);
  return DIAS_BASE_PADRAO;
}

function calcularDiasPorStatus(periodo = {}, ferias = [], statuses = new Set()) {
  return filtrarFeriasDoPeriodo(periodo, ferias).reduce((acc, item) => {
    if (!statuses.has(item?.status || '')) return acc;
    return acc + Math.max(0, toNumber(item?.dias, 0));
  }, 0);
}

export function calcularSaldoOperacionalPeriodo({ periodo = {}, ajustes = [], ferias = [] } = {}) {
  const saldo = calcularSaldoLiquidoPeriodo({ periodo, ajustes, ferias });
  const base = saldo.dias_base;
  const feriasPrevistasGozadas = saldo.dias_gozados_previstos;
  const direitoLiquido = base + saldo.creditos_ativos - saldo.debitos_ativos;
  const saldoRestante = direitoLiquido - feriasPrevistasGozadas;

  return {
    base,
    dias_base: base,
    creditos_ativos: saldo.creditos_ativos,
    debitos_ativos: saldo.debitos_ativos,
    direito_liquido: direitoLiquido,
    ferias_previstas_gozadas: feriasPrevistasGozadas,
    dias_gozados: calcularDiasPorStatus(periodo, ferias, STATUS_GOZADA),
    dias_previstos: calcularDiasPorStatus(periodo, ferias, STATUS_PREVISTA),
    dias_total: direitoLiquido,
    dias_saldo: saldoRestante,
    saldo_disponivel: saldoRestante,
    saldo_restante: saldoRestante,
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
  const periodoOperacional = periodo?.raw ? { ...periodo.raw, ...periodo } : periodo;

  return calcularSaldoOperacionalPeriodo({
    periodo: periodoOperacional,
    ajustes: filtrarAjustesDoPeriodo(ajustes, periodoOperacional),
    ferias,
  });
}
