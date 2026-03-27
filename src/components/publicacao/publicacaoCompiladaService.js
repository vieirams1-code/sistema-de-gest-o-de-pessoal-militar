import { formatDateBR } from '@/components/utils/templateUtils';
import { RP_TIPO_LABELS } from '@/components/rp/rpTiposConfig';

export const PUBLICACAO_COMPILADA_FERIAS_TIPO = 'Publicação Compilada - Férias';
export const PUBLICACAO_COMPILADA_FERIAS_CODIGO = 'publicacao_compilada_ferias';
export const PUBLICACAO_COMPILADA_DISCIPLINAR_TIPO = 'Publicação Compilada - Disciplinar';
export const PUBLICACAO_COMPILADA_DISCIPLINAR_CODIGO = 'publicacao_compilada_disciplinar';

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

const TIPOS_DISCIPLINARES_COMPILAVEIS = new Set([
  'ALTERACAO_COMPORTAMENTO_DISCIPLINAR',
  'IMPLANTACAO_COMPORTAMENTO_DISCIPLINAR',
  'MELHORIA_COMPORTAMENTO_DISCIPLINAR',
  'MARCO_INICIAL_COMPORTAMENTO_DISCIPLINAR',
]);

const TIPOS_CODIGO_DISCIPLINAR_COMPILAVEIS = new Set([
  'alteracao_comportamento_disciplinar',
  'implantacao_comportamento_disciplinar',
  'melhoria_comportamento_disciplinar',
  'marco_inicial_comportamento_disciplinar',
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

function isTipoDisciplinarCompilavel(registro = {}) {
  const tipoRaw = registro?.tipo_codigo || registro?.tipo_registro || registro?.tipo_label || registro?.tipo;
  const tipoCodigo = toCodigo(tipoRaw);
  const tipoCanonicoUpper = String(tipoRaw || '').trim().toUpperCase();
  const tipoLabelAmigavel = RP_TIPO_LABELS[tipoRaw] || RP_TIPO_LABELS[tipoCanonicoUpper] || '';
  const tipoLabelCodigo = toCodigo(tipoLabelAmigavel);

  return (
    TIPOS_DISCIPLINARES_COMPILAVEIS.has(tipoCanonicoUpper) ||
    TIPOS_CODIGO_DISCIPLINAR_COMPILAVEIS.has(tipoCodigo) ||
    TIPOS_CODIGO_DISCIPLINAR_COMPILAVEIS.has(tipoLabelCodigo)
  );
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

function getFirstFilled(...values) {
  const value = values.find((item) => item !== null && item !== undefined && String(item).trim() !== '');
  return value ?? '';
}

function buildTextoItemCompiladoFerias(registro = {}, index = 0) {
  const ordem = registro?.publicacao_compilada_ordem ?? (index + 1);
  const nome = getFirstFilled(registro?.militar_nome, registro?.nome, 'Militar não identificado');
  const postoGraduacao = getFirstFilled(registro?.militar_posto_graduacao, registro?.militar_posto, registro?.posto_graduacao, registro?.posto);
  const matricula = getFirstFilled(registro?.militar_matricula, registro?.matricula, '—');
  const tipo = getFirstFilled(registro?.tipo_registro, registro?.tipo_label, registro?.tipo, 'Registro');
  const periodoAquisitivo = getFirstFilled(
    registro?.periodo_aquisitivo,
    registro?.vinculos?.periodo?.label,
    registro?.vinculos_contrato?.periodo?.label,
    registro?.periodo_aquisitivo_ref,
  );
  const dataInicio = formatDate(getFirstFilled(registro?.data_inicio, registro?.data_inicio_iso, registro?.data_registro));
  const dataFim = formatDate(getFirstFilled(registro?.data_fim, registro?.data_termino));
  const dataTermino = formatDate(getFirstFilled(registro?.data_termino, registro?.data_fim));
  const dataRetorno = formatDate(registro?.data_retorno);
  const dias = getFirstFilled(registro?.dias);
  const periodo = getPeriodoDescricao({
    ...registro,
    periodo_aquisitivo: periodoAquisitivo || registro?.periodo_aquisitivo,
    data_inicio: registro?.data_inicio || registro?.data_inicio_iso || registro?.data_registro,
    data_termino: registro?.data_termino || registro?.data_fim,
  }) || '';

  const identificacao = [postoGraduacao, nome].filter(Boolean).join(' ').trim();
  const detalhes = [
    `Matrícula: ${matricula}`,
    `Tipo: ${tipo}`,
  ];

  if (periodo) detalhes.push(periodo);
  if (!periodo && periodoAquisitivo) detalhes.push(`Período aquisitivo: ${periodoAquisitivo}`);
  if (!periodo && dataInicio) detalhes.push(`Início: ${dataInicio}`);
  if (!periodo && dataTermino) detalhes.push(`Término: ${dataTermino}`);
  if (!periodo && dataFim) detalhes.push(`Fim: ${dataFim}`);
  if (!periodo && dataRetorno) detalhes.push(`Retorno: ${dataRetorno}`);
  if (!periodo && dias) detalhes.push(`Dias: ${dias}`);

  return `${ordem}. ${identificacao || nome} - ${detalhes.filter(Boolean).join(' | ')}`;
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
  return getMotivoInelegibilidadeCompilacaoFerias(registro) === null;
}

export function getMotivoInelegibilidadeCompilacaoFerias(registro = {}) {
  const statusCodigo = getStatusCodigoNormalizado(registro);
  const publicacaoCompiladaId = hasPublicacaoCompiladaId(registro);
  const compiladoEmLote = isCompiladoEmLoteTrue(registro);

  if (!detectarOrigemLivro(registro)) {
    return 'Registro fora do módulo Livro.';
  }

  if (!isFeriasOperacional(registro)) {
    return 'Registro sem vínculo operacional de férias.';
  }

  if (!isTipoFeriasCompilavel(registro)) {
    return 'Tipo não elegível para compilação mínima de férias';
  }

  if (!STATUS_COMPATIVEIS.has(statusCodigo)) {
    return 'Status não elegível para compilação mínima de férias.';
  }

  if (registro?.numero_bg || registro?.data_bg || isPublicado(registro)) {
    return 'Registro já publicado em BG.';
  }

  if (hasInconsistencia(registro)) {
    return 'Registro inconsistente e bloqueado para compilação.';
  }

  if (publicacaoCompiladaId || compiladoEmLote) {
    return 'Registro já vinculado a lote compilado.';
  }

  return null;
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

export function isRegistroElegivelParaCompilacaoDisciplinar(registro = {}) {
  return getMotivoInelegibilidadeCompilacaoDisciplinar(registro) === null;
}

export function getMotivoInelegibilidadeCompilacaoDisciplinar(registro = {}) {
  const statusCodigo = getStatusCodigoNormalizado(registro);
  const publicacaoCompiladaId = hasPublicacaoCompiladaId(registro);
  const compiladoEmLote = isCompiladoEmLoteTrue(registro);

  if (!detectarOrigemLivro(registro)) {
    return 'Registro fora do fluxo de Publicações/RP.';
  }

  if (!isTipoDisciplinarCompilavel(registro)) {
    return 'Tipo não elegível para compilação disciplinar.';
  }

  if (!STATUS_COMPATIVEIS.has(statusCodigo)) {
    return 'Status não elegível para compilação disciplinar.';
  }

  if (registro?.numero_bg || registro?.data_bg || isPublicado(registro)) {
    return 'Registro já publicado em BG.';
  }

  if (hasInconsistencia(registro)) {
    return 'Registro inconsistente e bloqueado para compilação.';
  }

  if (publicacaoCompiladaId || compiladoEmLote) {
    return 'Registro já vinculado a lote compilado.';
  }

  return null;
}

export function validarCompatibilidadeLoteDisciplinar(registros = []) {
  const lista = registros.filter(Boolean);

  if (lista.length < 2) {
    return {
      compativel: false,
      motivo: 'Selecione pelo menos 2 registros elegíveis para montar o lote disciplinar.',
    };
  }

  const inelegivel = lista.find((registro) => !isRegistroElegivelParaCompilacaoDisciplinar(registro));
  if (inelegivel) {
    return {
      compativel: false,
      motivo: 'Um ou mais registros não atendem às regras de compilação disciplinar.',
      registro_id: inelegivel.id,
    };
  }

  const origens = new Set(lista.map((registro) => registro?.origem_tipo || 'livro'));
  if (origens.size > 1 || !origens.has('livro')) {
    return {
      compativel: false,
      motivo: 'O lote compilado disciplinar aceita somente registros do módulo Livro.',
    };
  }

  return {
    compativel: true,
    motivo: null,
    quantidade_itens: lista.length,
    escopo_inicial: 'disciplinar',
    tipo_lote: 'disciplinar',
  };
}

export function buildItensTextoCompiladoFerias(registros = []) {
  const lista = registros
    .filter(Boolean)
    .slice()
    .sort((a, b) => (a?.publicacao_compilada_ordem ?? Number.MAX_SAFE_INTEGER) - (b?.publicacao_compilada_ordem ?? Number.MAX_SAFE_INTEGER));

  return lista.map((registro, index) => buildTextoItemCompiladoFerias(registro, index));
}

export function buildVarsPublicacaoCompiladaFerias(registros = []) {
  const lista = registros.filter(Boolean);
  const itens = buildItensTextoCompiladoFerias(lista);

  return {
    quantidade_itens: String(lista.length),
    data_geracao: formatDateBR(new Date().toISOString().slice(0, 10)),
    itens,
  };
}

export function buildPreviewRegistrosCompiladoFerias() {
  return [
    {
      publicacao_compilada_ordem: 1,
      militar_nome: 'João da Silva',
      militar_nome_institucional: 'Cap QOBM João da Silva',
      militar_posto_graduacao: 'Cap',
      militar_quadro: 'QOBM',
      militar_matricula: '123456',
      tipo_registro: 'Saída Férias',
      grupo_display: 'Férias',
      periodo_aquisitivo: '01/09/2024 a 31/08/2025',
      data_registro: '2026-03-21',
      data_inicio: '2026-04-01',
      data_termino: '2026-04-30',
      data_retorno: '2026-05-01',
      dias: 30,
      lotacao: '1º GBM',
      subunidade: 'Comando',
      cargo: 'Chefe de Seção',
    },
    {
      publicacao_compilada_ordem: 2,
      militar_nome: 'Maria Souza',
      militar_nome_institucional: '1º Sgt QOBM Maria Souza',
      militar_posto_graduacao: '1º Sgt',
      militar_quadro: 'QOBM',
      militar_matricula: '654321',
      tipo_registro: 'Retorno Férias',
      grupo_display: 'Férias',
      periodo_aquisitivo: '01/02/2024 a 31/01/2025',
      data_registro: '2026-03-22',
      data_inicio: '2026-03-01',
      data_termino: '2026-03-30',
      data_retorno: '2026-03-31',
      dias: 30,
      lotacao: '2º GBM',
      subunidade: 'Operações',
      cargo: 'Adjunta',
    },
    {
      publicacao_compilada_ordem: 3,
      militar_nome: 'Pedro Santos',
      militar_nome_institucional: 'Cb QOBM Pedro Santos',
      militar_posto_graduacao: 'Cb',
      militar_quadro: 'QOBM',
      militar_matricula: '987654',
      tipo_registro: 'Interrupção de Férias',
      grupo_display: 'Férias',
      periodo_aquisitivo: '01/06/2024 a 31/05/2025',
      data_registro: '2026-03-23',
      data_inicio: '2026-03-10',
      data_termino: '2026-04-08',
      data_retorno: '2026-04-09',
      dias: 20,
      lotacao: '3º GBM',
      subunidade: 'Administração',
      cargo: 'Auxiliar',
    },
  ];
}

export function renderPublicacaoCompiladaFerias({ registros = [] } = {}) {
  const lista = registros.filter(Boolean);
  if (!lista.length) return '';

  const vars = buildVarsPublicacaoCompiladaFerias(lista);

  return [
    'PUBLICAÇÃO COMPILADA DE FÉRIAS',
    '',
    `Quantidade de itens: ${vars.quantidade_itens}`,
    `Data de geração: ${vars.data_geracao}`,
    '',
    ...vars.itens,
  ].join('\n');
}

export function buildTextoCompiladoFerias(registros = []) {
  return renderPublicacaoCompiladaFerias({ registros });
}

export function renderPublicacaoCompiladaDisciplinar({ registros = [] } = {}) {
  const lista = registros.filter(Boolean);
  if (!lista.length) return '';

  const vars = buildVarsPublicacaoCompiladaFerias(lista);

  return [
    'PUBLICAÇÃO COMPILADA DISCIPLINAR',
    '',
    `Quantidade de itens: ${vars.quantidade_itens}`,
    `Data de geração: ${vars.data_geracao}`,
    '',
    ...vars.itens,
  ].join('\n');
}

export function buildTextoCompiladoDisciplinar(registros = []) {
  return renderPublicacaoCompiladaDisciplinar({ registros });
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

  const textoPublicacao = overrides?.texto_publicacao ?? buildTextoCompiladoFerias(registros);
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
      registros_ids: registros.map((registro) => registro?.id).filter(Boolean),
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

export function buildPayloadPublicacaoCompiladaDisciplinar(registros = [], overrides = {}) {
  const compatibilidade = validarCompatibilidadeLoteDisciplinar(registros);

  if (!compatibilidade.compativel) {
    return {
      ok: false,
      erro: compatibilidade.motivo,
      detalhes: compatibilidade,
      payload: null,
    };
  }

  const textoPublicacao = overrides?.texto_publicacao ?? buildTextoCompiladoDisciplinar(registros);
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
      tipo_lote: 'disciplinar',
      status: 'Aguardando Nota',
      nota_conciliada_boletim: '',
      quantidade_itens: registros.length,
      ativo: true,
      escopo_inicial: 'disciplinar',
      origem: 'livro',
      registros_ids: registros.map((registro) => registro?.id).filter(Boolean),
      tipo_registro: PUBLICACAO_COMPILADA_DISCIPLINAR_TIPO,
      tipo_codigo: PUBLICACAO_COMPILADA_DISCIPLINAR_CODIGO,
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
export { TIPOS_FERIAS_COMPILAVEIS, TIPOS_CODIGO_COMPILAVEIS, TIPOS_DISCIPLINARES_COMPILAVEIS, TIPOS_CODIGO_DISCIPLINAR_COMPILAVEIS };
