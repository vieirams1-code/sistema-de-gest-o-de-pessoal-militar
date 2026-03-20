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

const STATUS_PUBLICADOS = new Set(['publicado', 'gerada', 'gerado']);

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
  return Boolean(registro?.ferias_id || registro?.vinculos?.ferias?.id);
}

function isTipoFeriasCompilavel(registro = {}) {
  const tipoLabel = registro?.tipo_registro || registro?.tipo_label || registro?.tipo;
  const tipoCodigo = registro?.tipo_codigo || toCodigo(tipoLabel);
  return TIPOS_FERIAS_COMPILAVEIS.has(tipoLabel) || TIPOS_CODIGO_COMPILAVEIS.has(tipoCodigo);
}

function isPublicado(registro = {}) {
  const statusCodigo = toCodigo(registro?.status_codigo || registro?.status || registro?.status_calculado);
  return Boolean(
    (registro?.numero_bg && registro?.data_bg) ||
    STATUS_PUBLICADOS.has(statusCodigo),
  );
}

function hasInconsistencia(registro = {}) {
  return Boolean(
    registro?.inconsistencia ||
    registro?.inconsistencia_contrato ||
    registro?.motivo_inconsistencia ||
    registro?.inconsistencia_motivo_curto ||
    toCodigo(registro?.status_codigo || registro?.status || registro?.status_calculado) === 'inconsistente',
  );
}

export function isRegistroEmLoteCompilado(registro = {}) {
  return Boolean(registro?.publicacao_compilada_id || registro?.compilado_em_lote);
}

export function isRegistroElegivelParaPublicacaoCompiladaFerias(registro = {}) {
  return (
    detectarOrigemLivro(registro) &&
    isFeriasOperacional(registro) &&
    isTipoFeriasCompilavel(registro) &&
    !registro?.numero_bg &&
    !registro?.data_bg &&
    !isPublicado(registro) &&
    !hasInconsistencia(registro) &&
    !isRegistroEmLoteCompilado(registro)
  );
}

export function validarCompatibilidadeBasicaPublicacaoCompilada(registros = []) {
  const lista = registros.filter(Boolean);

  if (!lista.length) {
    return {
      compativel: false,
      motivo: 'Nenhum registro informado para o lote compilado.',
    };
  }

  const inelegivel = lista.find((registro) => !isRegistroElegivelParaPublicacaoCompiladaFerias(registro));
  if (inelegivel) {
    return {
      compativel: false,
      motivo: 'Um ou mais registros não atendem às regras iniciais de compilação de férias.',
      registro_id: inelegivel.id,
    };
  }

  const escopos = new Set(lista.map((registro) => registro?.origem_tipo || 'livro'));
  if (escopos.size > 1) {
    return {
      compativel: false,
      motivo: 'O lote deve conter registros da mesma origem funcional.',
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

export function prepararPayloadPublicacaoCompilada({
  registros = [],
  notaParaBg = '',
  textoPublicacao = '',
  origem = 'livro',
  overrides = {},
} = {}) {
  const compatibilidade = validarCompatibilidadeBasicaPublicacaoCompilada(registros);

  if (!compatibilidade.compativel) {
    return {
      ok: false,
      erro: compatibilidade.motivo,
      detalhes: compatibilidade,
      payload: null,
    };
  }

  return {
    ok: true,
    erro: null,
    detalhes: compatibilidade,
    payload: {
      tipo_lote: 'ferias',
      status: notaParaBg ? 'Aguardando Publicação' : 'Aguardando Nota',
      nota_para_bg: notaParaBg || '',
      numero_bg: '',
      data_bg: '',
      nota_conciliada_boletim: '',
      texto_publicacao: textoPublicacao || '',
      quantidade_itens: registros.length,
      ativo: true,
      escopo_inicial: 'ferias',
      origem,
      ...overrides,
    },
  };
}

export {
  TIPOS_FERIAS_COMPILAVEIS,
  TIPOS_CODIGO_COMPILAVEIS,
};
