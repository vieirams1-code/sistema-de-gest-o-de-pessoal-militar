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

export function filtrarFeriasDoPeriodo(periodo = {}, ferias = []) {
  return getFeriasDoPeriodo(periodo, ferias);
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

export function validarAjusteDiasPeriodo({ periodo, ferias = [], tipo, quantidade }) {
  const qtd = Math.max(0, toNumber(quantidade, 0));

  if (!qtd) {
    return {
      ok: false,
      mensagem: 'Informe uma quantidade de dias maior que zero para ajustar.',
    };
  }

  if (!['adicao', 'dispensa_desconto'].includes(tipo)) {
    return {
      ok: false,
      mensagem: 'Tipo de ajuste inválido. Utilize adição ou dispensa com desconto.',
    };
  }

  const saldoAtual = recalcularSaldoPeriodo(periodo, ferias);
  const sinal = tipo === 'adicao' ? 1 : -1;
  const novoAjuste = saldoAtual.dias_ajuste + (sinal * qtd);
  const novoTotal = saldoAtual.dias_base + novoAjuste;

  if (novoTotal < 0) {
    return {
      ok: false,
      ...saldoAtual,
      dias_total_projetado: novoTotal,
      mensagem: `A operação foi bloqueada: o total ficaria negativo (${novoTotal} dia(s)).`,
    };
  }

  const diasConsumidos = saldoAtual.dias_gozados + saldoAtual.dias_previstos;
  if (diasConsumidos > novoTotal) {
    return {
      ok: false,
      ...saldoAtual,
      dias_total_projetado: novoTotal,
      mensagem: `A operação foi bloqueada: o período já possui ${diasConsumidos} dia(s) gozados/previstos, acima do total ajustado (${novoTotal}).`,
    };
  }

  return {
    ok: true,
    ...saldoAtual,
    dias_ajuste_projetado: novoAjuste,
    dias_total_projetado: novoTotal,
    dias_saldo_projetado: novoTotal - saldoAtual.dias_gozados - saldoAtual.dias_previstos,
    mensagem: null,
  };
}
