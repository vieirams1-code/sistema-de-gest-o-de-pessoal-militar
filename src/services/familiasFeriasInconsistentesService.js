import { calcularSaldoOperacionalPeriodoComTodosAjustes } from './saldoFeriasOperacionalService.js';

// Diagnóstico SOMENTE LEITURA de famílias de férias inconsistentes.
// Uma família (todas as férias válidas de um período aquisitivo) é inconsistente
// quando a SOMA das férias válidas > direito líquido operacional do período.
//
// Regras oficiais reutilizadas (nada é recalculado por datas nem por limite fixo):
// - Status com impacto: Prevista, Autorizada, Em Curso, Interrompida, Gozada.
// - Vínculo: periodo_aquisitivo_id; fallback textual (ref) apenas para legado sem ID.
// - Limite: direito_liquido retornado por calcularSaldoOperacionalPeriodoComTodosAjustes.

const STATUS_COM_IMPACTO = new Set(['Prevista', 'Autorizada', 'Em Curso', 'Interrompida', 'Gozada']);

function normalizarTexto(value) {
  return String(value ?? '').trim();
}

function normalizarId(value) {
  return normalizarTexto(value);
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizarReferenciaPeriodo(periodo = {}) {
  return normalizarId(periodo?.ano_referencia || periodo?.referencia || periodo?.periodo_aquisitivo_ref);
}

export function isRegistroDoPeriodo(registro = {}, periodo = {}) {
  const registroPeriodoId = normalizarId(registro?.periodo_aquisitivo_id);
  const periodoId = normalizarId(periodo?.id);

  if (registroPeriodoId) return Boolean(periodoId && registroPeriodoId === periodoId);

  const registroRef = normalizarId(registro?.periodo_aquisitivo_ref);
  const periodoRef = normalizarReferenciaPeriodo(periodo);
  return Boolean(registroRef && periodoRef && registroRef === periodoRef);
}

export function isFeriasValidaParaSoma(ferias = {}, periodo = {}) {
  return isRegistroDoPeriodo(ferias, periodo) && STATUS_COM_IMPACTO.has(normalizarTexto(ferias?.status));
}

// Avalia UM período: retorna dados da família e se é inconsistente.
export function avaliarFamiliaPeriodo({ periodo = {}, ajustes = [], ferias = [] } = {}) {
  const feriasValidas = (ferias || []).filter((item) => isFeriasValidaParaSoma(item, periodo));
  const somaValida = feriasValidas.reduce((acc, item) => acc + Math.max(0, toNumber(item?.dias, 0)), 0);

  const saldo = calcularSaldoOperacionalPeriodoComTodosAjustes({ periodo, ajustes, ferias });
  const direitoOperacional = toNumber(saldo?.direito_liquido, 0);
  const excesso = somaValida - direitoOperacional;

  return {
    periodo_id: periodo?.id || '',
    periodo_ref: normalizarReferenciaPeriodo(periodo),
    militar_id: periodo?.militar_id || '',
    direito_operacional: direitoOperacional,
    soma_valida: somaValida,
    excesso,
    quantidade_registros: feriasValidas.length,
    feriasValidas,
    inconsistente: excesso > 0,
  };
}

// Retorna somente as famílias inconsistentes (soma válida > direito operacional).
export function listarFamiliasInconsistentes({ periodos = [], ajustes = [], ferias = [] } = {}) {
  return (periodos || [])
    .map((periodo) => avaliarFamiliaPeriodo({ periodo, ajustes, ferias }))
    .filter((familia) => familia.inconsistente);
}

// Mapa por periodo_aquisitivo_id -> { soma_valida, direito_operacional, excesso }
// usado para o badge na tela principal de Férias.
export function montarMapaInconsistenciaPorPeriodo({ periodos = [], ajustes = [], ferias = [] } = {}) {
  const mapa = new Map();
  (periodos || []).forEach((periodo) => {
    const familia = avaliarFamiliaPeriodo({ periodo, ajustes, ferias });
    if (!familia.inconsistente) return;
    if (familia.periodo_id) {
      mapa.set(`id:${familia.periodo_id}`, familia);
    }
    if (familia.periodo_ref && familia.militar_id) {
      mapa.set(`ref:${familia.militar_id}:${familia.periodo_ref}`, familia);
    }
  });
  return mapa;
}

export function getChaveInconsistenciaFerias(ferias = {}) {
  const id = normalizarId(ferias?.periodo_aquisitivo_id);
  if (id) return `id:${id}`;
  const militarId = normalizarId(ferias?.militar_id);
  const ref = normalizarId(ferias?.periodo_aquisitivo_ref);
  return militarId && ref ? `ref:${militarId}:${ref}` : '';
}