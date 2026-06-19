import { aplicarTemplate, formatDateBR } from '@/components/utils/templateUtils.js';

let deps = { aplicarTemplate, formatDateBR };

/**
 * @internal
 * @testOnly
 * Injeta dependências para testes unitários.
 */
export const __setComportamentoTemplateUtilsDepsForTests = (newDeps) => {
  if (newDeps === null) {
    deps = { aplicarTemplate, formatDateBR };
  } else {
    deps = { ...deps, ...newDeps };
  }
};

export const TIPO_TEMPLATE_COMPORTAMENTO = {
  ELEVACAO: 'ELEVACAO_COMPORTAMENTO_DISCIPLINAR',
  MELHORIA_COMPORTAMENTO: 'melhoria_comportamento',
  REGISTRO_FUNCIONAL_COMPORTAMENTO: 'registro_funcional_comportamento',
};

export const TEMPLATE_PADRAO_COMPORTAMENTO_POR_TIPO = {
  [TIPO_TEMPLATE_COMPORTAMENTO.ELEVACAO]: `ELEVAÇÃO DE COMPORTAMENTO DISCIPLINAR

Fica alterado o comportamento disciplinar do militar {{posto_graduacao}} {{militar_nome}}, matrícula nº {{matricula}}, do {{quadro}}, de {{comportamento_anterior}} para {{comportamento_novo}}, a contar de {{data_alteracao}}, em razão de {{motivo_mudanca}}, conforme {{fundamento_legal}}.

Campo Grande/MS, ____ de __________ de ______.

__________________________________
Comandante`,
  [TIPO_TEMPLATE_COMPORTAMENTO.MELHORIA_COMPORTAMENTO]: `Passa a integrar o comportamento {{comportamento}}, a contar de {{data_inicio}}, o militar {{posto_graduacao}} {{nome_completo}}, matrícula {{matricula}}, conforme apuração dos assentamentos disciplinares e critérios previstos no Decreto nº 1.260, de 02 de outubro de 1981.`,
  [TIPO_TEMPLATE_COMPORTAMENTO.REGISTRO_FUNCIONAL_COMPORTAMENTO]: `Para fins de assentamento e registro funcional, fica consignado que o militar {{posto_graduacao}} {{nome_completo}}, matrícula {{matricula}}, passou a integrar o comportamento {{comportamento}} a contar de {{data_inicio}}, conforme apuração realizada com base nos assentamentos disciplinares constantes em seus registros funcionais e nos critérios previstos no Decreto nº 1.260, de 02 de outubro de 1981.`,
};

const CAMPOS_ESSENCIAIS_POR_TIPO = {
  [TIPO_TEMPLATE_COMPORTAMENTO.ELEVACAO]: [
    'militar_nome',
    'posto_graduacao',
    'matricula',
    'comportamento_anterior',
    'comportamento_novo',
    'data_alteracao',
    'motivo_mudanca',
    'fundamento_legal',
  ],
  [TIPO_TEMPLATE_COMPORTAMENTO.MELHORIA_COMPORTAMENTO]: [
    'comportamento',
    'data_inicio',
    'posto_graduacao',
    'nome_completo',
    'matricula',
  ],
  [TIPO_TEMPLATE_COMPORTAMENTO.REGISTRO_FUNCIONAL_COMPORTAMENTO]: [
    'comportamento',
    'data_inicio',
    'posto_graduacao',
    'nome_completo',
    'matricula',
  ],
};

const LABELS_CAMPOS = {
  militar_nome: 'Nome do militar',
  posto_graduacao: 'Posto/graduação',
  matricula: 'Matrícula',
  quadro: 'Quadro',
  comportamento_anterior: 'Comportamento anterior',
  comportamento_novo: 'Comportamento novo',
  data_alteracao: 'Data da alteração',
  motivo_mudanca: 'Motivo da mudança',
  fundamento_legal: 'Fundamento legal',
  comportamento: 'Comportamento',
  data_inicio: 'Data de início',
  nome_completo: 'Nome completo',
};

/** @internal */
export function normalizarDataVigencia(data) {
  if (!data) return '';
  const texto = String(data);
  return texto.length >= 10 ? texto.slice(0, 10) : texto;
}

/** @internal */
export function ehDataValida(data) {
  const normalizada = normalizarDataVigencia(data);
  if (!normalizada) return false;
  const parsed = new Date(`${normalizada}T00:00:00`);
  return !Number.isNaN(parsed.getTime());
}

/** @internal */
export function ehComportamentoValido(comportamento) {
  if (!comportamento) return false;
  return String(comportamento).trim().toUpperCase() !== 'N/D';
}

/** @internal */
export function getMomentoRegistro(evento = {}) {
  const candidatos = [
    evento?.created_date,
    evento?.updated_date,
    evento?.createdDate,
    evento?.updatedDate,
  ].filter(Boolean);

  for (const candidato of candidatos) {
    const data = new Date(candidato);
    if (!Number.isNaN(data.getTime())) return data.getTime();
  }

  return 0;
}

/** @internal */
export function ehRegistroAutomaticoIntermediario(evento = {}) {
  const origem = String(evento?.origem_tipo || '').toUpperCase();
  const motivo = String(evento?.motivo_mudanca || '').toUpperCase();
  return (
    origem.includes('AUTOMAT') ||
    origem.includes('CALCUL') ||
    origem.includes('RECALCUL') ||
    origem.includes('VERIFICACAO_DIARIA') ||
    motivo.includes('AUTOMÁTIC') ||
    motivo.includes('AUTOMATIC')
  );
}

export function sanitizarHistoricoComportamentoParaTemplate(eventos = []) {
  const ordenados = [...(Array.isArray(eventos) ? eventos : [])]
    .filter((evento) => ehDataValida(evento?.data_alteracao))
    .filter((evento) => ehComportamentoValido(evento?.comportamento_novo))
    .filter((evento) => !ehRegistroAutomaticoIntermediario(evento))
    .sort((a, b) => {
      const diffData = new Date(`${normalizarDataVigencia(a.data_alteracao)}T00:00:00`) - new Date(`${normalizarDataVigencia(b.data_alteracao)}T00:00:00`);
      if (diffData !== 0) return diffData;
      return getMomentoRegistro(a) - getMomentoRegistro(b);
    });

  const ultimoPorDia = new Map();
  for (const evento of ordenados) {
    ultimoPorDia.set(normalizarDataVigencia(evento.data_alteracao), evento);
  }
  const registrosPorDia = Array.from(ultimoPorDia.values());

  const marcosReais = [];
  for (const evento of registrosPorDia) {
    const ultimo = marcosReais[marcosReais.length - 1];
    if (ultimo?.comportamento_novo === evento.comportamento_novo) continue;
    marcosReais.push(evento);
  }

  return marcosReais;
}

export function resolverMarcoComportamento(eventos = [], marcoSelecionadoId = null) {
  const marcos = sanitizarHistoricoComportamentoParaTemplate(eventos);
  if (!marcos.length) return null;

  if (marcoSelecionadoId) {
    const selecionado = marcos.find((marco) => marco.id === marcoSelecionadoId);
    if (selecionado) return selecionado;
  }

  return marcos[marcos.length - 1];
}

/** @internal */
export function campoPreenchido(valor) {
  return !(valor === undefined || valor === null || String(valor).trim() === '' || String(valor).trim().toLowerCase() === 'não informado');
}

export function marcoEhValidoParaGeracaoRP(marco = null, tipoTemplate = TIPO_TEMPLATE_COMPORTAMENTO.ELEVACAO) {
  if (!marco) return false;
  if (!campoPreenchido(marco?.comportamento_novo)) return false;
  if (!ehDataValida(marco?.data_alteracao)) return false;

  if (!campoPreenchido(marco?.motivo_mudanca)) return false;
  if (!tipoTemplate) return false;
  return campoPreenchido(marco?.fundamento_legal);
}

export function resolverMarcoComportamentoValido(eventos = [], marcoSelecionadoId = null) {
  const marcos = sanitizarHistoricoComportamentoParaTemplate(eventos);
  if (!marcos.length) return null;

  if (marcoSelecionadoId) {
    const selecionado = marcos.find((marco) => marco.id === marcoSelecionadoId);
    if (selecionado) {
      const tipoSelecionado = escolherTipoTemplateComportamento(selecionado);
      if (marcoEhValidoParaGeracaoRP(selecionado, tipoSelecionado)) return selecionado;
    }
  }

  for (let index = marcos.length - 1; index >= 0; index -= 1) {
    const candidato = marcos[index];
    const tipoCandidato = escolherTipoTemplateComportamento(candidato);
    if (marcoEhValidoParaGeracaoRP(candidato, tipoCandidato)) return candidato;
  }

  return marcos[marcos.length - 1];
}

export function escolherTipoTemplateComportamento(marco = {}) {
  if (!marco) return TIPO_TEMPLATE_COMPORTAMENTO.ELEVACAO;
  return TIPO_TEMPLATE_COMPORTAMENTO.ELEVACAO;
}

export function montarVariaveisComportamentoTemplate(militar = {}, marco = {}, { _formatDateBR } = {}) {
  const format = _formatDateBR || formatDateBR;
  const vars = {
    militar_nome: militar?.nome_completo || militar?.nome_guerra || 'Não informado',
    posto_graduacao: militar?.posto_graduacao || 'Não informado',
    matricula: militar?.matricula || 'Não informado',
    quadro: militar?.quadro || '',
    unidade: militar?.lotacao || militar?.unidade || 'Não informado',
    comportamento_anterior: marco?.comportamento_anterior || 'Não informado',
    comportamento_novo: marco?.comportamento_novo || militar?.comportamento || 'Não informado',
    comportamento_atual: militar?.comportamento || marco?.comportamento_novo || 'Não informado',
    comportamento: marco?.comportamento_novo || marco?.comportamento || militar?.comportamento || 'Não informado',
    nome_completo: militar?.nome_completo || militar?.nome_guerra || 'Não informado',
    data_inicio: deps.formatDateBR(marco?.data_alteracao || marco?.dataInicio || marco?.data_inicio),
    data_alteracao: deps.formatDateBR(marco?.data_alteracao || marco?.dataInicio || marco?.data_inicio),
    motivo_mudanca: marco?.motivo_mudanca || 'Não informado',
    fundamento_legal: marco?.fundamento_legal || 'Não informado',
  };

  return vars;
}

/** @internal */
export function validarCamposEssenciaisComportamento(tipoTemplate, vars) {
  const camposObrigatorios = CAMPOS_ESSENCIAIS_POR_TIPO[tipoTemplate] || CAMPOS_ESSENCIAIS_POR_TIPO[TIPO_TEMPLATE_COMPORTAMENTO.ELEVACAO];
  const faltantes = camposObrigatorios.filter((campo) => {
    const valor = vars?.[campo];
    return valor === undefined || valor === null || String(valor).trim() === '' || String(valor).trim().toLowerCase() === 'não informado';
  });

  return faltantes.map((campo) => LABELS_CAMPOS[campo] || campo);
}

export function gerarTextoRPComportamento({ template, militar, marco, tipoTemplate, utils = {} }) {
  const vars = montarVariaveisComportamentoTemplate(militar, marco, { _formatDateBR: utils.formatDateBR });
  const camposEssenciaisAusentes = validarCamposEssenciaisComportamento(tipoTemplate, vars);

  if (camposEssenciaisAusentes.length > 0) {
    return {
      ok: false,
      erro: `Não foi possível gerar o texto. Campos essenciais ausentes: ${camposEssenciaisAusentes.join(', ')}.`,
    };
  }

  const apply = utils.aplicarTemplate || aplicarTemplate;
  return {
    ok: true,
    texto: deps.aplicarTemplate(template, vars),
    vars,
  };
}

export function obterTemplatePadraoComportamento(tipoTemplate) {
  return TEMPLATE_PADRAO_COMPORTAMENTO_POR_TIPO[tipoTemplate] || '';
}
