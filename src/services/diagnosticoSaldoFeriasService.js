import { calcularSaldoOperacionalPeriodoComTodosAjustes } from './saldoFeriasOperacionalService.js';

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizarTexto(value) {
  return String(value ?? '').trim();
}

function normalizarId(value) {
  return normalizarTexto(value);
}

function normalizarReferenciaPeriodo(periodo = {}) {
  return normalizarId(periodo?.ano_referencia || periodo?.referencia || periodo?.periodo_aquisitivo_ref);
}

function obterSaldoAtualSistema(periodo = {}) {
  if (Number.isFinite(Number(periodo?.dias_saldo))) return toNumber(periodo.dias_saldo);
  if (Number.isFinite(Number(periodo?.saldo_atual_sistema))) return toNumber(periodo.saldo_atual_sistema);
  if (Number.isFinite(Number(periodo?.saldo_disponivel))) return toNumber(periodo.saldo_disponivel);
  return 0;
}

function isRegistroDoPeriodo(registro = {}, periodo = {}) {
  const registroPeriodoId = normalizarId(registro?.periodo_aquisitivo_id);
  const periodoId = normalizarId(periodo?.id);

  if (registroPeriodoId) return Boolean(periodoId && registroPeriodoId === periodoId);

  const registroRef = normalizarId(registro?.periodo_aquisitivo_ref);
  const periodoRef = normalizarReferenciaPeriodo(periodo);
  return Boolean(registroRef && periodoRef && registroRef === periodoRef);
}

function montarModeloOperacional({ periodo = {}, ajustes = [], ferias = [] } = {}) {
  const saldo = calcularSaldoOperacionalPeriodoComTodosAjustes({ periodo, ajustes, ferias });

  return {
    saldo: saldo.saldo_restante,
    base: saldo.dias_base,
    direito_liquido: saldo.direito_liquido,
    creditos_ativos: saldo.creditos_ativos,
    debitos_ativos: saldo.debitos_ativos,
    gozados_previstos: saldo.ferias_previstas_gozadas,
    detalhes_creditos: saldo.detalhes_creditos || [],
    detalhes_debitos: saldo.detalhes_debitos || [],
  };
}

function montarInconsistencias({ periodo, saldoAtualSistema, saldoOperacional, ajustesPeriodo }) {
  const inconsistencias = [];

  if (!normalizarId(periodo?.id)) inconsistencias.push('periodo_sem_id');
  if (!Number.isFinite(Number(periodo?.dias_saldo))) inconsistencias.push('saldo_atual_sistema_indisponivel');
  if (saldoAtualSistema !== saldoOperacional) inconsistencias.push('saldo_atual_diferente_do_operacional');

  const ajustesSemDias = ajustesPeriodo.filter((ajuste) => !Number.isFinite(Number(ajuste?.dias)) || Number(ajuste?.dias) < 0);
  if (ajustesSemDias.length > 0) inconsistencias.push('ajuste_com_dias_invalidos');

  return inconsistencias;
}

export function compararSaldoPeriodo({ periodo = {}, ajustes = [], ferias = [] } = {}) {
  const ajustesPeriodo = (ajustes || []).filter((ajuste) => isRegistroDoPeriodo(ajuste, periodo));
  const modelo_operacional = montarModeloOperacional({ periodo, ajustes: ajustesPeriodo, ferias });
  const saldo_atual_sistema = obterSaldoAtualSistema(periodo);
  const saldo_operacional = modelo_operacional.saldo;

  return {
    periodo_id: periodo?.id || '',
    periodo_ref: normalizarReferenciaPeriodo(periodo),
    modelo_oficial_atual: {
      saldo_atual_sistema,
      base_atual: toNumber(periodo?.dias_base ?? periodo?.dias_direito ?? periodo?.dias_adquiridos, 30),
      previstos: toNumber(periodo?.dias_previstos, 0),
      gozados: toNumber(periodo?.dias_gozados, 0),
    },
    modelo_operacional,
    diferenca_oficial_vs_operacional: saldo_operacional - saldo_atual_sistema,
    saldo_atual_sistema,
    saldo_derivado: saldo_operacional,
    diferenca: saldo_operacional - saldo_atual_sistema,
    dias_base: modelo_operacional.base,
    creditos_ativos: modelo_operacional.creditos_ativos,
    debitos_ativos: modelo_operacional.debitos_ativos,
    dias_gozados_previstos: modelo_operacional.gozados_previstos,
    inconsistencias: montarInconsistencias({
      periodo,
      saldoAtualSistema: saldo_atual_sistema,
      saldoOperacional: saldo_operacional,
      ajustesPeriodo,
    }),
  };
}
