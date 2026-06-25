import {
  STATUS_AJUSTE_SALDO_FERIAS,
  TIPOS_AJUSTE_SALDO_FERIAS,
  calcularSaldoLiquidoPeriodo,
} from './calculadoraSaldoFeriasService.js';

const STATUS_CREDITO_EXTRA_CANCELADO = 'CANCELADO';
const STATUS_DESCONTO_COM_IMPACTO = 'ativo';

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizarTexto(value) {
  return String(value ?? '').trim();
}

function normalizarLower(value) {
  return normalizarTexto(value).toLowerCase();
}

function normalizarUpper(value) {
  return normalizarTexto(value).toUpperCase();
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

function montarAjusteVirtual(base = {}, extra = {}) {
  return {
    militar_id: base?.militar_id || '',
    militar_nome: base?.militar_nome || '',
    periodo_aquisitivo_id: base?.periodo_aquisitivo_id || '',
    periodo_aquisitivo_ref: base?.periodo_aquisitivo_ref || '',
    status: STATUS_AJUSTE_SALDO_FERIAS.ATIVO,
    origem: 'diagnostico_virtual_legado',
    ...extra,
  };
}

function creditoExtraAtivo(credito = {}) {
  return normalizarUpper(credito?.status || 'DISPONIVEL') !== STATUS_CREDITO_EXTRA_CANCELADO;
}

function descontoComImpacto(desconto = {}) {
  return normalizarLower(desconto?.status) === STATUS_DESCONTO_COM_IMPACTO && desconto?.saldo_aplicado === true;
}

export function converterRegistrosLegadosEmAjustesVirtuais({ creditosExtraordinarios = [], descontos = [] } = {}) {
  const creditosVirtuais = (creditosExtraordinarios || [])
    .filter(creditoExtraAtivo)
    .map((credito) => montarAjusteVirtual(credito, {
      tipo: TIPOS_AJUSTE_SALDO_FERIAS.CREDITO,
      dias: Math.max(0, toNumber(credito?.quantidade_dias ?? credito?.dias, 0)),
      motivo: credito?.tipo_credito || 'Crédito extraordinário legado',
      entidade_origem: 'CreditoExtraFerias',
      entidade_origem_id: credito?.id || '',
      observacoes: credito?.observacoes || '',
    }));

  const debitosVirtuais = (descontos || [])
    .filter(descontoComImpacto)
    .map((desconto) => montarAjusteVirtual(desconto, {
      tipo: TIPOS_AJUSTE_SALDO_FERIAS.DEBITO,
      dias: Math.max(0, toNumber(desconto?.dias, 0)),
      motivo: 'Desconto de férias legado aplicado',
      entidade_origem: 'DescontoFerias',
      entidade_origem_id: desconto?.id || '',
      publicacao_id: desconto?.publicacao_id || '',
      observacoes: desconto?.observacoes || '',
    }));

  return [...creditosVirtuais, ...debitosVirtuais];
}

function montarInconsistencias({ periodo, saldoAtualSistema, saldoDerivado, ajustesPeriodo }) {
  const inconsistencias = [];

  if (!normalizarId(periodo?.id)) inconsistencias.push('periodo_sem_id');
  if (!Number.isFinite(Number(periodo?.dias_saldo))) inconsistencias.push('saldo_atual_sistema_indisponivel');
  if (saldoAtualSistema !== saldoDerivado) inconsistencias.push('saldo_atual_diferente_do_derivado');

  const ajustesSemDias = ajustesPeriodo.filter((ajuste) => !Number.isFinite(Number(ajuste?.dias)) || Number(ajuste?.dias) < 0);
  if (ajustesSemDias.length > 0) inconsistencias.push('ajuste_com_dias_invalidos');

  return inconsistencias;
}

export function compararSaldoPeriodo({ periodo = {}, ajustes = [], ferias = [] } = {}) {
  const ajustesPeriodo = (ajustes || []).filter((ajuste) => isRegistroDoPeriodo(ajuste, periodo));
  const saldo = calcularSaldoLiquidoPeriodo({ periodo, ajustes: ajustesPeriodo, ferias });
  const saldo_atual_sistema = obterSaldoAtualSistema(periodo);
  const saldo_derivado = saldo.saldo_liquido;

  return {
    periodo_id: periodo?.id || '',
    periodo_ref: normalizarReferenciaPeriodo(periodo),
    saldo_atual_sistema,
    saldo_derivado,
    diferenca: saldo_derivado - saldo_atual_sistema,
    dias_base: saldo.dias_base,
    creditos_ativos: saldo.creditos_ativos,
    debitos_ativos: saldo.debitos_ativos,
    dias_gozados_previstos: saldo.dias_gozados_previstos,
    inconsistencias: montarInconsistencias({ periodo, saldoAtualSistema: saldo_atual_sistema, saldoDerivado: saldo_derivado, ajustesPeriodo }),
  };
}
