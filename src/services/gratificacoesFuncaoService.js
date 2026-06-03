import { base44 } from '@/api/base44Client';

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
  ATIVOS: 'ativos',
  AGUARDANDO_PUBLICACAO: 'aguardando_publicacao',
  DISPENSA_EM_ANDAMENTO: 'dispensa_em_andamento',
  HISTORICO: 'historico',
  COTAS: 'cotas',
  TIPOS: 'tipos',
};

export const GRATIFICACAO_TAB_LABELS = {
  [GRATIFICACAO_TABS.ATIVOS]: 'Ativos',
  [GRATIFICACAO_TABS.AGUARDANDO_PUBLICACAO]: 'Aguardando publicação',
  [GRATIFICACAO_TABS.DISPENSA_EM_ANDAMENTO]: 'Dispensa em andamento',
  [GRATIFICACAO_TABS.HISTORICO]: 'Histórico',
  [GRATIFICACAO_TABS.COTAS]: 'Cotas',
  [GRATIFICACAO_TABS.TIPOS]: 'Tipos de gratificação',
};

const DEFAULT_LIMIT = 1000;

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
    cotasDisponiveis: cotasAutorizadas - cotasOcupadas,
    solicitacoesPendentes,
    nomeacoesAtivas: cotasOcupadas,
    dispensasPendentes,
  };
}

export function filtrarGratificacoesPorAba(gratificacoes = [], aba = GRATIFICACAO_TABS.ATIVOS) {
  const statusHistorico = new Set([GRATIFICACAO_STATUS.DISPENSADO, GRATIFICACAO_STATUS.CANCELADO]);
  return (gratificacoes || []).filter((item) => {
    const status = normalizeStatus(item?.status);
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

export async function fetchPainelGratificacoesFuncao({ limit = DEFAULT_LIMIT } = {}) {
  const [gratificacoes, cotas, tipos] = await Promise.all([
    base44.entities.GratificacaoFuncao.list('-updated_date', limit),
    base44.entities.CotaGratificacaoFuncao.list('-updated_date', limit),
    base44.entities.TipoGratificacaoFuncao.list('nome', limit),
  ]);

  return {
    gratificacoes: Array.isArray(gratificacoes) ? gratificacoes : [],
    cotas: Array.isArray(cotas) ? cotas : [],
    tipos: Array.isArray(tipos) ? tipos : [],
    meta: {
      limit,
      scopedFunction: false,
      risk: 'Ainda não há function escopada específica para Gratificação de Função; leitura inicial limitada ao perfil administrativo e a 1000 registros por entidade.',
    },
  };
}
