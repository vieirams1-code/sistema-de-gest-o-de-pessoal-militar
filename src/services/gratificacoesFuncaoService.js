import { base44 } from '@/api/base44Client';
import { getEffectiveEmail } from '@/services/getScopedMilitaresClient';

export const GRATIFICACAO_STATUS = {
  RASCUNHO: 'rascunho',
  SOLICITADO_DP: 'solicitado_dp',
  AGUARDANDO_PUBLICACAO_NOMEACAO: 'aguardando_publicacao_nomeacao',
  NOMEADO_ATIVO: 'nomeado_ativo',
  DISPENSA_SOLICITADA: 'dispensa_solicitada',
  AGUARDANDO_PUBLICACAO_DISPENSA: 'aguardando_publicacao_dispensa',
  DISPENSADO: 'dispensado',
  CANCELADO: 'cancelado',
};

export const COTA_STATUS = {
  ATIVA: 'ativa',
  SUSPENSA: 'suspensa',
  ENCERRADA: 'encerrada',
};

export const GRATIFICACAO_STATUS_LABELS = {
  [GRATIFICACAO_STATUS.RASCUNHO]: 'Rascunho',
  [GRATIFICACAO_STATUS.SOLICITADO_DP]: 'Solicitado ao DP',
  [GRATIFICACAO_STATUS.AGUARDANDO_PUBLICACAO_NOMEACAO]: 'Aguardando publicação',
  [GRATIFICACAO_STATUS.NOMEADO_ATIVO]: 'Nomeado ativo',
  [GRATIFICACAO_STATUS.DISPENSA_SOLICITADA]: 'Dispensa solicitada',
  [GRATIFICACAO_STATUS.AGUARDANDO_PUBLICACAO_DISPENSA]: 'Aguardando publicação da dispensa',
  [GRATIFICACAO_STATUS.DISPENSADO]: 'Dispensado',
  [GRATIFICACAO_STATUS.CANCELADO]: 'Cancelado',
};

export const GRATIFICACAO_TABS = {
  RASCUNHOS: 'rascunhos',
  ATIVOS: 'ativos',
  AGUARDANDO_PUBLICACAO: 'aguardando_publicacao',
  DISPENSA_EM_ANDAMENTO: 'dispensa_em_andamento',
  HISTORICO: 'historico',
  COTAS: 'cotas',
  TIPOS: 'tipos',
};

export const GRATIFICACAO_TAB_LABELS = {
  [GRATIFICACAO_TABS.RASCUNHOS]: 'Rascunhos',
  [GRATIFICACAO_TABS.ATIVOS]: 'Ativos',
  [GRATIFICACAO_TABS.AGUARDANDO_PUBLICACAO]: 'Aguardando publicação',
  [GRATIFICACAO_TABS.DISPENSA_EM_ANDAMENTO]: 'Dispensa em andamento',
  [GRATIFICACAO_TABS.HISTORICO]: 'Histórico',
  [GRATIFICACAO_TABS.COTAS]: 'Cotas',
  [GRATIFICACAO_TABS.TIPOS]: 'Tipos de gratificação',
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const normalizeText = (value) => String(value ?? '').trim().toLowerCase();
const normalizeStatus = (value) => normalizeText(value);

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function includesText(value, query) {
  if (!query) return true;
  return normalizeText(value).includes(query);
}

function getTipoNomeById(tipos = []) {
  return new Map((tipos || []).map((tipo) => [String(tipo?.id || ''), tipo?.nome || tipo?.sigla || tipo?.codigo || '']));
}

export function getNomeMilitarGratificacao(item = {}) {
  return item.nome_completo_snapshot || item?.militar_snapshot?.nome_completo || item.nome_guerra_snapshot || item?.militar_snapshot?.nome_guerra || '—';
}

export function getMatriculaGratificacao(item = {}) {
  return item.matricula_snapshot || item?.militar_snapshot?.matricula || '—';
}

export function getTipoGratificacaoLabel(item = {}, tiposById = new Map()) {
  return item.tipo_gratificacao || tiposById.get(String(item.tipo_gratificacao_funcao_id || '')) || '—';
}

export function calcularResumoGratificacoesFuncao(gratificacoes = [], cotas = []) {
  const cotasAutorizadas = (cotas || [])
    .filter((cota) => normalizeStatus(cota?.status || COTA_STATUS.ATIVA) === COTA_STATUS.ATIVA)
    .reduce((total, cota) => total + toNumber(cota?.quantidade_autorizada), 0);

  const cotasOcupadas = (gratificacoes || [])
    .filter((item) => normalizeStatus(item?.status) === GRATIFICACAO_STATUS.NOMEADO_ATIVO)
    .length;

  const solicitacoesPendentes = (gratificacoes || [])
    .filter((item) => [
      GRATIFICACAO_STATUS.SOLICITADO_DP,
      GRATIFICACAO_STATUS.AGUARDANDO_PUBLICACAO_NOMEACAO,
    ].includes(normalizeStatus(item?.status)))
    .length;

  const dispensasPendentes = (gratificacoes || [])
    .filter((item) => [
      GRATIFICACAO_STATUS.DISPENSA_SOLICITADA,
      GRATIFICACAO_STATUS.AGUARDANDO_PUBLICACAO_DISPENSA,
    ].includes(normalizeStatus(item?.status)))
    .length;

  return {
    cotasAutorizadas,
    cotasOcupadas,
    cotasDisponiveis: Math.max(cotasAutorizadas - cotasOcupadas, 0),
    cotasExcedentes: Math.max(cotasOcupadas - cotasAutorizadas, 0),
    solicitacoesPendentes,
    nomeacoesAtivas: cotasOcupadas,
    dispensasPendentes,
  };
}

export function filtrarGratificacoesPorAba(gratificacoes = [], aba = GRATIFICACAO_TABS.ATIVOS) {
  const statusHistorico = new Set([GRATIFICACAO_STATUS.DISPENSADO, GRATIFICACAO_STATUS.CANCELADO]);
  return (gratificacoes || []).filter((item) => {
    const status = normalizeStatus(item?.status);
    if (aba === GRATIFICACAO_TABS.RASCUNHOS) return status === GRATIFICACAO_STATUS.RASCUNHO;
    if (aba === GRATIFICACAO_TABS.ATIVOS) return status === GRATIFICACAO_STATUS.NOMEADO_ATIVO;
    if (aba === GRATIFICACAO_TABS.AGUARDANDO_PUBLICACAO) return [GRATIFICACAO_STATUS.SOLICITADO_DP, GRATIFICACAO_STATUS.AGUARDANDO_PUBLICACAO_NOMEACAO].includes(status);
    if (aba === GRATIFICACAO_TABS.DISPENSA_EM_ANDAMENTO) return [GRATIFICACAO_STATUS.DISPENSA_SOLICITADA, GRATIFICACAO_STATUS.AGUARDANDO_PUBLICACAO_DISPENSA].includes(status);
    if (aba === GRATIFICACAO_TABS.HISTORICO) return statusHistorico.has(status);
    return true;
  });
}

export function aplicarFiltrosGratificacoesFuncao(gratificacoes = [], filtros = {}, tipos = []) {
  const busca = normalizeText(filtros.busca);
  const tiposById = getTipoNomeById(tipos);
  return (gratificacoes || []).filter((item) => {
    const status = normalizeStatus(item?.status);
    if (filtros.status && filtros.status !== 'todos' && status !== filtros.status) return false;
    if (filtros.tipo && filtros.tipo !== 'todos') {
      const tipoId = String(item?.tipo_gratificacao_funcao_id || '');
      const tipoTexto = normalizeText(item?.tipo_gratificacao);
      if (tipoId !== filtros.tipo && tipoTexto !== normalizeText(filtros.tipo)) return false;
    }
    if (filtros.funcao && filtros.funcao !== 'todos' && normalizeText(item?.funcao_gratificada) !== normalizeText(filtros.funcao)) return false;
    if (filtros.unidade && filtros.unidade !== 'todos') {
      const unidadeId = String(item?.unidade_id || item?.setor_id || '');
      const unidadeNome = normalizeText(item?.unidade_nome_snapshot || item?.setor_nome_snapshot);
      if (unidadeId !== filtros.unidade && unidadeNome !== normalizeText(filtros.unidade)) return false;
    }
    if (!busca) return true;

    return [
      getNomeMilitarGratificacao(item),
      item.nome_guerra_snapshot,
      getMatriculaGratificacao(item),
      item.funcao_gratificada,
      item.codigo_funcao,
      item.numero_processo,
      item.documento_solicitacao,
      item.documento_solicitacao_dispensa,
      item.doems_nomeacao_numero,
      item.doems_nomeacao_edicao,
      item.doems_dispensa_numero,
      item.doems_dispensa_edicao,
      item.ato_nomeacao_numero,
      item.ato_dispensa_numero,
      getTipoGratificacaoLabel(item, tiposById),
    ].some((value) => includesText(value, busca));
  });
}

export function listarOpcoesGratificacao(gratificacoes = [], cotas = [], tipos = []) {
  const funcoes = Array.from(new Set([...(gratificacoes || []), ...(cotas || [])]
    .map((item) => item?.funcao_gratificada)
    .filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const unidadesMap = new Map();
  [...(gratificacoes || []), ...(cotas || [])].forEach((item) => {
    const id = item?.unidade_id || item?.setor_id || item?.unidade_nome_snapshot || item?.setor_nome_snapshot;
    const label = item?.unidade_nome_snapshot || item?.setor_nome_snapshot || id;
    if (id && label) unidadesMap.set(String(id), label);
  });

  const tiposOpcoes = (tipos || [])
    .map((tipo) => ({ value: String(tipo?.id || tipo?.nome || tipo?.sigla || ''), label: tipo?.nome || tipo?.sigla || tipo?.codigo || 'Tipo sem nome' }))
    .filter((tipo) => tipo.value);

  const tiposTextuais = Array.from(new Set([...(gratificacoes || []), ...(cotas || [])]
    .map((item) => item?.tipo_gratificacao)
    .filter(Boolean)))
    .map((tipo) => ({ value: tipo, label: tipo }));

  return {
    funcoes,
    unidades: Array.from(unidadesMap.entries()).map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
    tipos: [...tiposOpcoes, ...tiposTextuais.filter((textual) => !tiposOpcoes.some((tipo) => normalizeText(tipo.label) === normalizeText(textual.label)))],
  };
}

function normalizarLimit(limit) {
  const parsed = Number(limit);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.floor(parsed), 1), MAX_LIMIT);
}

function montarPayloadEscopado(payload = {}) {
  const effectiveEmail = payload.effectiveEmail !== undefined ? payload.effectiveEmail : getEffectiveEmail();
  const finalPayload = { ...(payload || {}), limit: normalizarLimit(payload.limit), offset: Math.max(Number(payload.offset) || 0, 0) };
  if (effectiveEmail) finalPayload['effectiveEmail'] = effectiveEmail;
  else delete finalPayload['effectiveEmail'];
  return finalPayload;
}

function assertFunctionResponse(body, fallbackMessage) {
  if (body?.error) {
    const error = new Error(body.error || fallbackMessage);
    if (body?.meta?.status) error['status'] = body.meta.status;
    throw error;
  }
}

export async function fetchScopedCotasGratificacaoFuncao(payload = {}) {
  const response = await base44.functions.invoke('getScopedCotasGratificacaoFuncao', montarPayloadEscopado(payload));
  const body = response?.data ?? response ?? {};
  assertFunctionResponse(body, 'Erro ao carregar cotas escopadas de Gratificação de Função.');
  return {
    cotas: Array.isArray(body?.cotas) ? body.cotas : [],
    totais: body?.totais && typeof body.totais === 'object' ? body.totais : {},
    tipos: Array.isArray(body?.tipos) ? body.tipos : [],
    meta: body?.meta && typeof body.meta === 'object' ? body.meta : { scopedFunction: true, hasNext: false },
  };
}

export async function fetchPainelGratificacoesFuncao(payload = {}) {
  const finalPayload = montarPayloadEscopado(payload);
  const [painelResponse, cotasResponse] = await Promise.all([
    base44.functions.invoke('getScopedPainelGratificacoesFuncao', finalPayload),
    base44.functions.invoke('getScopedCotasGratificacaoFuncao', finalPayload),
  ]);

  const painelBody = painelResponse?.data ?? painelResponse ?? {};
  const cotasBody = cotasResponse?.data ?? cotasResponse ?? {};
  assertFunctionResponse(painelBody, 'Erro ao carregar painel escopado de Gratificação de Função.');
  assertFunctionResponse(cotasBody, 'Erro ao carregar cotas escopadas de Gratificação de Função.');

  const tiposPainel = Array.isArray(painelBody?.tipos) ? painelBody.tipos : [];
  const tiposCotas = Array.isArray(cotasBody?.tipos) ? cotasBody.tipos : [];

  return {
    gratificacoes: Array.isArray(painelBody?.gratificacoes) ? painelBody.gratificacoes : [],
    cotas: Array.isArray(cotasBody?.cotas) ? cotasBody.cotas : [],
    tipos: tiposPainel.length ? tiposPainel : tiposCotas,
    counters: painelBody?.counters && typeof painelBody.counters === 'object' ? painelBody.counters : {},
    cotasTotais: cotasBody?.totais && typeof cotasBody.totais === 'object' ? cotasBody.totais : {},
    facets: painelBody?.facets && typeof painelBody.facets === 'object' ? painelBody.facets : {},
    meta: {
      ...(painelBody?.meta && typeof painelBody.meta === 'object' ? painelBody.meta : {}),
      cotas: cotasBody?.meta && typeof cotasBody.meta === 'object' ? cotasBody.meta : {},
      scopedFunction: true,
      readOnly: true,
    },
  };
}

export async function gerirCadastrosGratificacaoFuncao({ operacao, id, data } = {}) {
  const response = await base44.functions.invoke('gerirCadastrosGratificacaoFuncao', { operacao, id, data });
  const body = response?.data ?? response ?? {};
  assertFunctionResponse(body, 'Erro ao salvar cadastro de Gratificação de Função.');
  return body?.data || null;
}

export async function gerirRascunhoGratificacaoFuncao({ operacao, id, data } = {}) {
  const response = await base44.functions.invoke('gerirRascunhoGratificacaoFuncao', { operacao, id, data });
  const body = response?.data ?? response ?? {};
  assertFunctionResponse(body, 'Erro ao salvar rascunho de Gratificação de Função.');
  return body?.data || null;
}
