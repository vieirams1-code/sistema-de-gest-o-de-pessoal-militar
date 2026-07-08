export const STATUS_AJUSTE_SALDO_FERIAS = Object.freeze({
  RASCUNHO: 'rascunho',
  PENDENTE_PUBLICACAO: 'pendente_publicacao',
  ATIVO: 'ativo',
  CANCELADO: 'cancelado',
  REVERTIDO: 'revertido',
});

export const TIPOS_AJUSTE_SALDO_FERIAS = Object.freeze({
  CREDITO: 'credito',
  DEBITO: 'debito',
});

const STATUS_AJUSTE_VALIDOS = new Set(Object.values(STATUS_AJUSTE_SALDO_FERIAS));
const STATUS_FERIAS_COM_IMPACTO = new Set(['Gozada', 'Prevista', 'Autorizada', 'Em Curso', 'Interrompida']);
const DIAS_BASE_PADRAO = 30;

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function hasNumericValue(value) {
  return Number.isFinite(Number(value));
}

function normalizarTexto(value) {
  return String(value ?? '').trim();
}

function normalizarId(value) {
  return normalizarTexto(value);
}

function obterDiasAjuste(ajuste = {}) {
  return Math.max(0, toNumber(ajuste?.dias, 0));
}

function obterDiasFerias(ferias = {}) {
  return Math.max(0, toNumber(ferias?.dias, 0));
}

function normalizarTipoAjuste(tipo) {
  const tipoNormalizado = normalizarTexto(tipo).toLowerCase();
  return tipoNormalizado === TIPOS_AJUSTE_SALDO_FERIAS.DEBITO
    ? TIPOS_AJUSTE_SALDO_FERIAS.DEBITO
    : TIPOS_AJUSTE_SALDO_FERIAS.CREDITO;
}

function obterDiasBase(periodo = {}) {
  if (hasNumericValue(periodo?.dias_direito)) return toNumber(periodo.dias_direito, DIAS_BASE_PADRAO);
  if (hasNumericValue(periodo?.dias_adquiridos)) return toNumber(periodo.dias_adquiridos, DIAS_BASE_PADRAO);
  if (hasNumericValue(periodo?.dias_base)) return toNumber(periodo.dias_base, DIAS_BASE_PADRAO);
  return DIAS_BASE_PADRAO;
}

function normalizarReferenciaPeriodo(periodo = {}) {
  return normalizarId(periodo?.ano_referencia || periodo?.referencia || periodo?.periodo_aquisitivo_ref);
}

function isFeriasDoPeriodo(ferias = {}, periodo = {}) {
  const feriasPeriodoId = normalizarId(ferias?.periodo_aquisitivo_id);
  const periodoId = normalizarId(periodo?.id);

  if (feriasPeriodoId) return Boolean(periodoId && feriasPeriodoId === periodoId);

  const feriasRef = normalizarId(ferias?.periodo_aquisitivo_ref);
  const periodoRef = normalizarReferenciaPeriodo(periodo);
  return Boolean(feriasRef && periodoRef && feriasRef === periodoRef);
}

function isFeriasComImpactoNoSaldo(item = {}) {
  return STATUS_FERIAS_COM_IMPACTO.has(normalizarTexto(item?.status));
}

export function normalizarStatusAjuste(status) {
  const statusNormalizado = normalizarTexto(status).toLowerCase();
  return STATUS_AJUSTE_VALIDOS.has(statusNormalizado)
    ? statusNormalizado
    : STATUS_AJUSTE_SALDO_FERIAS.RASCUNHO;
}

export function isAjusteAtivo(ajuste = {}) {
  return normalizarStatusAjuste(ajuste?.status) === STATUS_AJUSTE_SALDO_FERIAS.ATIVO;
}

export function isAjustePendente(ajuste = {}) {
  return normalizarStatusAjuste(ajuste?.status) === STATUS_AJUSTE_SALDO_FERIAS.PENDENTE_PUBLICACAO;
}

export function calcularAjustesPeriodo(ajustes = []) {
  return (ajustes || []).reduce((acc, ajuste) => {
    const status = normalizarStatusAjuste(ajuste?.status);
    const tipo = normalizarTipoAjuste(ajuste?.tipo);
    const dias = obterDiasAjuste(ajuste);

    if (status === STATUS_AJUSTE_SALDO_FERIAS.ATIVO) {
      if (tipo === TIPOS_AJUSTE_SALDO_FERIAS.CREDITO) acc.creditos_ativos += dias;
      if (tipo === TIPOS_AJUSTE_SALDO_FERIAS.DEBITO) acc.debitos_ativos += dias;
      return acc;
    }

    if (status === STATUS_AJUSTE_SALDO_FERIAS.PENDENTE_PUBLICACAO) acc.ajustes_pendentes += 1;
    if (status === STATUS_AJUSTE_SALDO_FERIAS.CANCELADO) acc.ajustes_cancelados += 1;
    if (status === STATUS_AJUSTE_SALDO_FERIAS.REVERTIDO) acc.ajustes_revertidos += 1;

    return acc;
  }, {
    creditos_ativos: 0,
    debitos_ativos: 0,
    ajustes_pendentes: 0,
    ajustes_cancelados: 0,
    ajustes_revertidos: 0,
  });
}


export function calcularDireitoLiquidoPeriodo({ periodo = {}, ajustes = [] } = {}) {
  const dias_base = obterDiasBase(periodo);
  const { creditos_ativos, debitos_ativos } = calcularAjustesPeriodo(ajustes);

  return {
    dias_base,
    creditos_ativos,
    debitos_ativos,
    direito_liquido: dias_base + creditos_ativos - debitos_ativos,
  };
}

export function calcularSaldoLiquidoPeriodo({ periodo = {}, ajustes = [], ferias = [] } = {}) {
  const dias_base = obterDiasBase(periodo);
  const ajustesAtivos = (ajustes || []).filter(isAjusteAtivo);
  const detalhes_creditos = ajustesAtivos.filter((ajuste) => normalizarTipoAjuste(ajuste?.tipo) === TIPOS_AJUSTE_SALDO_FERIAS.CREDITO);
  const detalhes_debitos = ajustesAtivos.filter((ajuste) => normalizarTipoAjuste(ajuste?.tipo) === TIPOS_AJUSTE_SALDO_FERIAS.DEBITO);
  const creditos_ativos = detalhes_creditos.reduce((acc, ajuste) => acc + obterDiasAjuste(ajuste), 0);
  const debitos_ativos = detalhes_debitos.reduce((acc, ajuste) => acc + obterDiasAjuste(ajuste), 0);
  const dias_gozados_previstos = (ferias || [])
    .filter((item) => item && isFeriasDoPeriodo(item, periodo) && isFeriasComImpactoNoSaldo(item))
    .reduce((acc, item) => acc + obterDiasFerias(item), 0);
  const saldo_liquido = dias_base + creditos_ativos - debitos_ativos - dias_gozados_previstos;

  return {
    dias_base,
    creditos_ativos,
    debitos_ativos,
    dias_gozados_previstos,
    saldo_liquido,
    detalhes_creditos,
    detalhes_debitos,
  };
}
