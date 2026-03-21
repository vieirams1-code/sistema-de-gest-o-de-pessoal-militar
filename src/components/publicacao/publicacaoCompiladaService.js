import { aplicarTemplate, formatDateBR } from '@/components/utils/templateUtils';

export const PUBLICACAO_COMPILADA_FERIAS_TIPO = 'Publicação Compilada - Férias';
export const PUBLICACAO_COMPILADA_FERIAS_CODIGO = 'publicacao_compilada_ferias';
export const TEMPLATE_PADRAO_ITEM_PUBLICACAO_COMPILADA_FERIAS = '{{ordem}}. {{posto}} {{nome}} - Matrícula: {{matricula}} - Tipo: {{tipo}}{{separador_periodo}}{{periodo}}';

const TEMPLATE_PADRAO_PUBLICACAO_COMPILADA_FERIAS = [
  'PUBLICAÇÃO COMPILADA DE FÉRIAS',
  '',
  'Quantidade de itens: {{quantidade_itens}}',
  'Data de geração: {{data_geracao}}',
  '',
  '{{lista_compilada}}',
].join('\n');

const TIPOS_FERIAS_COMPILAVEIS = new Set([
  'Saída Férias',
  'Interrupção de Férias',
  'Nova Saída / Retomada',
  'Retorno Férias',
]);

const TIPOS_CODIGO_COMPILAVEIS = new Set([
  'saida_ferias',
  'interrupcao_de_ferias',
  'nova_saida_retomada',
  'retorno_ferias',
]);

const STATUS_COMPATIVEIS = new Set([
  'aguardando_publicacao',
  'aguardando_publicacao_no_bg',
  'aguardando_publicacao_bg',
  'aguardando_nota',
]);

function toCodigo(value) {
  if (!value) return '';
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function detectarOrigemLivro(registro = {}) {
  if (registro?.origem_tipo) return registro.origem_tipo === 'livro';
  return !!(registro?.tipo_label || registro?.status_codigo || registro?.vinculos?.ferias || registro?.ferias_id);
}

function isFeriasOperacional(registro = {}) {
  return Boolean(
    registro?.ferias_id ||
    registro?.vinculos?.ferias?.id ||
    registro?.vinculos_contrato?.ferias?.id ||
    registro?.grupo_display === 'Férias'
  );
}

function isTipoFeriasCompilavel(registro = {}) {
  const tipoLabel = registro?.tipo_registro || registro?.tipo_label || registro?.tipo;
  const tipoCodigo = registro?.tipo_codigo || toCodigo(tipoLabel);
  return TIPOS_FERIAS_COMPILAVEIS.has(tipoLabel) || TIPOS_CODIGO_COMPILAVEIS.has(tipoCodigo);
}

function isPublicado(registro = {}) {
  return Boolean(registro?.numero_bg && registro?.data_bg);
}

function hasInconsistencia(registro = {}) {
  return Boolean(
    registro?.inconsistencia ||
    registro?.inconsistencia_contrato ||
    registro?.motivo_inconsistencia ||
    registro?.inconsistencia_motivo_curto ||
    toCodigo(registro?.status_codigo || registro?.status || registro?.status_calculado || registro?.status_publicacao) === 'inconsistente'
  );
}

function getStatusCodigoNormalizado(registro = {}) {
  return toCodigo(registro?.status_codigo || registro?.status || registro?.status_calculado || registro?.status_publicacao);
}

function formatDate(value) {
  if (!value) return null;
  try {
    const date = String(value).includes('T') ? new Date(value) : new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(date);
  } catch {
    return String(value);
  }
}

function getPeriodoDescricao(registro = {}) {
  const datas = [
    ['Início', registro?.data_inicio || registro?.data_inicio_iso || registro?.data_registro],
    ['Término', registro?.data_termino || registro?.data_fim],
    ['Retorno', registro?.data_retorno],
  ]
    .map(([label, value]) => {
      const formatada = formatDate(value);
      return formatada ? `${label}: ${formatada}` : null;
    })
    .filter(Boolean);

  if (registro?.periodo_aquisitivo) {
    datas.push(`Período aquisitivo: ${registro.periodo_aquisitivo}`);
  }

  if (registro?.dias) {
    datas.push(`Dias: ${registro.dias}`);
  }

  return datas.join(' | ');
}

function hasPublicacaoCompiladaId(registro = {}) {
  const value = registro?.publicacao_compilada_id;
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
}

function isCompiladoEmLoteTrue(registro = {}) {
  return registro?.compilado_em_lote === true;
}

function sanitizeTextoContinuo(texto = '') {
  return String(texto).replace(/\s+/g, ' ').trim();
}

function buildItemVarsCompiladoFerias(registro = {}, index = 0) {
  const ordem = registro?.publicacao_compilada_ordem ?? (index + 1);
  const nomeInst = registro?.militar_nome_institucional || registro?.militar_nome || 'Militar não identificado';
  const posto = registro?.militar_posto_graduacao || registro?.militar_posto || '';
  const matricula = registro?.militar_matricula || '—';
  const tipo = registro?.tipo_registro || registro?.tipo_label || registro?.tipo || 'Registro';
  const periodo = getPeriodoDescricao(registro) || '';

  return {
    ordem: String(ordem),
    posto: String(posto),
    nome: String(nomeInst),
    matricula: String(matricula),
    tipo: String(tipo),
    periodo: String(periodo),
    separador_periodo: periodo ? ' - ' : '',
  };
}

export function isRegistroEmLoteCompilado(registro = {}) {
  return hasPublicacaoCompiladaId(registro) || isCompiladoEmLoteTrue(registro);
}

export function isRegistroFilhoDePublicacaoCompilada(registro = {}) {
  return detectarOrigemLivro(registro) && isRegistroEmLoteCompilado(registro);
}

export function isLoteCompiladoPublicado(lote = {}) {
  return Boolean(lote?.numero_bg && lote?.data_bg);
}

export function getTemplatePublicacaoCompiladaFerias(templates = []) {
  if (!Array.isArray(templates)) return null;
  return templates.find((t) =>
    (t.tipo_registro === PUBLICACAO_COMPILADA_FERIAS_TIPO || t.tipo_registro === PUBLICACAO_COMPILADA_FERIAS_CODIGO) &&
    t.modulo === 'Livro' &&
    t.ativo !== false
  ) || null;
}

export function podeDesfazerLoteCompilado(lote = {}) {
  const statusCodigo = getStatusCodigoNormalizado(lote);
  if (statusCodigo === 'aguardando_publicacao' || statusCodigo === 'gerada' || statusCodigo === 'publicado') {
    return false;
  }
  if (statusCodigo === 'aguardando_nota') {
    return true;
  }
  return !isLoteCompiladoPublicado(lote) && !lote?.nota_para_bg;
}

export async function limparVinculoLoteDosFilhos({
  entity,
  loteId,
  filhos = [],
} = {}) {
  if (!entity || !loteId) return [];

  const registrosFilhos = filhos.length
    ? filhos.filter((registro) => registro?.publicacao_compilada_id === loteId)
    : await entity.filter({ publicacao_compilada_id: loteId });

  await Promise.all(
    registrosFilhos.map((filho) => entity.update(filho.id, {
      publicacao_compilada_id: null,
      compilado_em_lote: false,
      publicacao_compilada_ordem: null,
      nota_para_bg: '',
      numero_bg: '',
      data_bg: '',
    }))
  );

  return registrosFilhos;
}

export function isRegistroElegivelParaCompilacaoFerias(registro = {}) {
  const statusCodigo = getStatusCodigoNormalizado(registro);
  const publicacaoCompiladaId = hasPublicacaoCompiladaId(registro);
  const compiladoEmLote = isCompiladoEmLoteTrue(registro);

  return (
    detectarOrigemLivro(registro) &&
    isFeriasOperacional(registro) &&
    isTipoFeriasCompilavel(registro) &&
    STATUS_COMPATIVEIS.has(statusCodigo) &&
    !registro?.numero_bg &&
    !registro?.data_bg &&
    !isPublicado(registro) &&
    !hasInconsistencia(registro) &&
    !publicacaoCompiladaId &&
    !compiladoEmLote
  );
}

export function validarCompatibilidadeLoteFerias(registros = []) {
  const lista = registros.filter(Boolean);

  if (lista.length < 2) {
    return {
      compativel: false,
      motivo: 'Selecione pelo menos 2 registros elegíveis para montar o lote de férias.',
    };
  }

  const inelegivel = lista.find((registro) => !isRegistroElegivelParaCompilacaoFerias(registro));
  if (inelegivel) {
    return {
      compativel: false,
      motivo: 'Um ou mais registros não atendem às regras mínimas de compilação de férias.',
      registro_id: inelegivel.id,
    };
  }

  const origens = new Set(lista.map((registro) => registro?.origem_tipo || 'livro'));
  if (origens.size > 1 || !origens.has('livro')) {
    return {
      compativel: false,
      motivo: 'O lote compilado desta fase aceita somente registros do módulo Livro.',
    };
  }

  return {
    compativel: true,
    motivo: null,
    quantidade_itens: lista.length,
    escopo_inicial: 'ferias',
    tipo_lote: 'ferias',
  };
}

export function buildItensTextoCompiladoFerias(registros = [], itemTemplate = null) {
  const lista = registros
    .filter(Boolean)
    .slice()
    .sort((a, b) => (a?.publicacao_compilada_ordem ?? Number.MAX_SAFE_INTEGER) - (b?.publicacao_compilada_ordem ?? Number.MAX_SAFE_INTEGER));

  const tmpl = itemTemplate || TEMPLATE_PADRAO_ITEM_PUBLICACAO_COMPILADA_FERIAS;

  return lista.map((registro, index) => sanitizeTextoContinuo(aplicarTemplate(tmpl, buildItemVarsCompiladoFerias(registro, index))));
}

export function buildListaCompiladaTextoFerias(registros = [], itemTemplate = null) {
  return sanitizeTextoContinuo(buildItensTextoCompiladoFerias(registros, itemTemplate).join(' '));
}

export function buildVarsPublicacaoCompiladaFerias(registros = [], itemTemplate = null) {
  const lista = registros.filter(Boolean);
  const listaCompilada = buildListaCompiladaTextoFerias(lista, itemTemplate);

  return {
    quantidade_itens: String(lista.length),
    data_geracao: formatDateBR(new Date().toISOString().slice(0, 10)),
    lista_compilada: listaCompilada,
    tipo_publicacao: PUBLICACAO_COMPILADA_FERIAS_TIPO,
    codigo_publicacao: PUBLICACAO_COMPILADA_FERIAS_CODIGO,
  };
}

export function buildTextoCompiladoFerias(registros = [], templates = []) {
  const lista = registros.filter(Boolean);
  if (!lista.length) return '';

  const templateAtivo = getTemplatePublicacaoCompiladaFerias(templates);
  const template = templateAtivo?.template || TEMPLATE_PADRAO_PUBLICACAO_COMPILADA_FERIAS;
  const itemTemplate = templateAtivo?.item_template || TEMPLATE_PADRAO_ITEM_PUBLICACAO_COMPILADA_FERIAS;

  return aplicarTemplate(template, buildVarsPublicacaoCompiladaFerias(lista, itemTemplate));
}

export function buildPayloadPublicacaoCompilada(registros = [], overrides = {}, templates = []) {
  const compatibilidade = validarCompatibilidadeLoteFerias(registros);

  if (!compatibilidade.compativel) {
    return {
      ok: false,
      erro: compatibilidade.motivo,
      detalhes: compatibilidade,
      payload: null,
    };
  }

  const textoPublicacao = overrides?.texto_publicacao ?? buildTextoCompiladoFerias(registros, templates);
  const {
    nota_para_bg: _notaParaBgIgnorada,
    numero_bg: _numeroBgIgnorado,
    data_bg: _dataBgIgnorada,
    texto_publicacao: _textoPublicacaoOverride,
    ...safeOverrides
  } = overrides || {};

  return {
    ok: true,
    erro: null,
    detalhes: compatibilidade,
    payload: {
      tipo_lote: 'ferias',
      status: 'Aguardando Nota',
      nota_conciliada_boletim: '',
      quantidade_itens: registros.length,
      ativo: true,
      escopo_inicial: 'ferias',
      origem: 'livro',
      tipo_registro: PUBLICACAO_COMPILADA_FERIAS_TIPO,
      tipo_codigo: PUBLICACAO_COMPILADA_FERIAS_CODIGO,
      ...safeOverrides,
      nota_para_bg: '',
      numero_bg: '',
      data_bg: '',
      texto_publicacao: textoPublicacao,
    },
  };
}

export const isRegistroElegivelParaPublicacaoCompiladaFerias = isRegistroElegivelParaCompilacaoFerias;
export const validarCompatibilidadeBasicaPublicacaoCompilada = validarCompatibilidadeLoteFerias;
export const prepararPayloadPublicacaoCompilada = ({ registros = [], overrides = {}, templates = [] } = {}) => (
  buildPayloadPublicacaoCompilada(registros, overrides, templates)
);

export {
  TIPOS_FERIAS_COMPILAVEIS,
  TIPOS_CODIGO_COMPILAVEIS,
  TEMPLATE_PADRAO_PUBLICACAO_COMPILADA_FERIAS,
};
