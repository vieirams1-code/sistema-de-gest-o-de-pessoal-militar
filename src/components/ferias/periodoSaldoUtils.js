const STATUS_GOZADA = new Set(['Gozada']);
const STATUS_PREVISTA = new Set(['Prevista', 'Autorizada', 'Em Curso', 'Interrompida']);

export const DIAS_BASE_PADRAO = 30;

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

  return (ferias || []).filter((item) =>
    item && (keys.has(item.periodo_aquisitivo_id) || keys.has(item.periodo_aquisitivo_ref))
  );
}

function somarDiasPorStatus(feriasPeriodo = []) {
  return feriasPeriodo.reduce(
    (acc, item) => {
      const dias = Math.max(0, toNumber(item?.dias, 0));
      const status = item?.status || '';

      if (STATUS_GOZADA.has(status)) acc.dias_gozados += dias;
      else if (STATUS_PREVISTA.has(status)) acc.dias_previstos += dias;

      return acc;
    },
    { dias_gozados: 0, dias_previstos: 0 }
  );
}

export function recalcularSaldoPeriodo(periodo = {}, ferias = []) {
  const dias_base = toNumber(periodo?.dias_base, DIAS_BASE_PADRAO);
  const dias_ajuste = toNumber(periodo?.dias_ajuste, 0);
  const dias_total = dias_base + dias_ajuste;

  const feriasDoPeriodo = getFeriasDoPeriodo(periodo, ferias);
  const { dias_gozados, dias_previstos } = somarDiasPorStatus(feriasDoPeriodo);
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

export function getSaldoConsolidadoPeriodo({ periodo, ferias = [] }) {
  const derivado = recalcularSaldoPeriodo(periodo, ferias);
  return {
    ...periodo,
    ...derivado,
    saldo_disponivel: derivado.dias_saldo,
  };
}

export function validarDiasNoSaldoPeriodo({ periodo, ferias = [], diasSolicitados = 0, ignorarFeriasId = null }) {
  const dias = Math.max(0, toNumber(diasSolicitados, 0));
  const baseFerias = ignorarFeriasId ? ferias.filter((item) => item?.id !== ignorarFeriasId) : ferias;
  const saldo = recalcularSaldoPeriodo(periodo, baseFerias);

  if (dias <= saldo.dias_saldo) {
    return {
      ok: true,
      ...saldo,
      dias_solicitados: dias,
      mensagem: null,
    };
  }

  return {
    ok: false,
    ...saldo,
    dias_solicitados: dias,
    mensagem: `Saldo insuficiente no período (${saldo.dias_saldo} dia(s) disponível(is) para ${dias} solicitado(s)).`,
  };
}
