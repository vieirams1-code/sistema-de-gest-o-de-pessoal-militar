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

function isStatusCompativel(registro = {}) {
  const statusCodigo = getStatusCodigoNormalizado(registro);
  return STATUS_COMPATIVEIS.has(statusCodigo);
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

export function isRegistroEmLoteCompilado(registro = {}) {
  return hasPublicacaoCompiladaId(registro) || isCompiladoEmLoteTrue(registro);
}


export function isRegistroFilhoDePublicacaoCompilada(registro = {}) {
  return detectarOrigemLivro(registro) && isRegistroEmLoteCompilado(registro);
}

export function isLoteCompiladoPublicado(lote = {}) {
  return Boolean(lote?.numero_bg && lote?.data_bg);
}

export function podeDesfazerLoteCompilado(lote = {}) {
  return !isLoteCompiladoPublicado(lote);
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

export function buildTextoCompiladoFerias(registros = []) {
  const lista = registros.filter(Boolean);
  if (!lista.length) return '';

  const itens = lista.map((registro, index) => {
    const nome = registro?.militar_nome_institucional || registro?.militar_nome || 'Militar não identificado';
    const matricula = registro?.militar_matricula || '—';
    const tipo = registro?.tipo_registro || registro?.tipo_label || registro?.tipo || 'Registro';
    const periodo = getPeriodoDescricao(registro);
    return `${index + 1}. ${nome} - Matrícula: ${matricula} - Tipo: ${tipo}${periodo ? ` - ${periodo}` : ''}`;
  });

  return [
    'PUBLICAÇÃO COMPILADA DE FÉRIAS',
    '',
    'Relação consolidada dos registros elegíveis do Livro para publicação em lote:',
    '',
    ...itens,
  ].join('\n');
}

export function buildPayloadPublicacaoCompilada(registros = [], overrides = {}) {
  const compatibilidade = validarCompatibilidadeLoteFerias(registros);

  if (!compatibilidade.compativel) {
    return {
      ok: false,
      erro: compatibilidade.motivo,
      detalhes: compatibilidade,
      payload: null,
    };
  }

  const textoPublicacao = overrides?.texto_publicacao || buildTextoCompiladoFerias(registros);
  const {
    nota_para_bg: _notaParaBgIgnorada,
    numero_bg: _numeroBgIgnorado,
    data_bg: _dataBgIgnorada,
    ...safeOverrides
  } = overrides || {};

  return {
    ok: true,
    erro: null,
    detalhes: compatibilidade,
    payload: {
      tipo_lote: 'ferias',
      status: 'Aguardando Publicação',
      nota_para_bg: '',
      numero_bg: '',
      data_bg: '',
      nota_conciliada_boletim: '',
      texto_publicacao: textoPublicacao,
      quantidade_itens: registros.length,
      ativo: true,
      escopo_inicial: 'ferias',
      origem: 'livro',
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
export const prepararPayloadPublicacaoCompilada = ({ registros = [], overrides = {} } = {}) => (
  buildPayloadPublicacaoCompilada(registros, overrides)
);

export {
  TIPOS_FERIAS_COMPILAVEIS,
  TIPOS_CODIGO_COMPILAVEIS,
};
