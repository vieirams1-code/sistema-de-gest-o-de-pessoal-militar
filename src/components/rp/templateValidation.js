import { resolverTipoFeriasCanonico } from '@/components/ferias/feriasTipoResolver';

export const TEMPLATE_BLOQUEIO_MENSAGEM =
  'Template obrigatório não encontrado para este tipo de registro. Cadastre um template antes de continuar.';

export const TIPO_REGISTRO_TEMPLATE_INTERNO = {
  SAIDA_FERIAS: 'Saída Férias',
  INTERRUPCAO_FERIAS: 'Interrupção de Férias',
  CONTINUACAO_FERIAS: 'Continuação de Férias',
  TERMINO_FERIAS: 'Retorno Férias',
};

export const ESCOPO_TEMPLATE = {
  GLOBAL: 'GLOBAL',
  SETOR: 'SETOR',
  SUBSETOR: 'SUBSETOR',
  UNIDADE: 'UNIDADE',
};

const ORDEM_PRIORIDADE_ESCOPOS = [
  ESCOPO_TEMPLATE.UNIDADE,
  ESCOPO_TEMPLATE.SUBSETOR,
  ESCOPO_TEMPLATE.SETOR,
  ESCOPO_TEMPLATE.GLOBAL,
];

export function normalizarModulo(modulo = '') {
  return String(modulo)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace('publicacao', '');
}

export function tipoExigeTemplate(tipoRegistro = '') {
  return String(tipoRegistro).trim().toLowerCase() !== 'geral';
}

function normalizeTipoRegistroKey(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function resolveTipoRegistroTemplate(tipoRegistro = '') {
  if (!tipoRegistro) return '';
  const feriasCanonico = resolverTipoFeriasCanonico(tipoRegistro);
  if (feriasCanonico) return feriasCanonico;
  return normalizeTipoRegistroKey(tipoRegistro);
}

function getModuloCanonico(modulo = '') {
  const moduloNormalizado = normalizarModulo(modulo);

  if (moduloNormalizado === 'livro') return 'Livro';
  if (moduloNormalizado === 'exofficio') return 'ExOfficio';

  return String(modulo).trim() || moduloNormalizado;
}

function normalizeScope(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return ESCOPO_TEMPLATE.GLOBAL;
  if (raw === 'SETOR') return ESCOPO_TEMPLATE.SETOR;
  if (raw === 'SUBSETOR') return ESCOPO_TEMPLATE.SUBSETOR;
  if (raw === 'UNIDADE') return ESCOPO_TEMPLATE.UNIDADE;
  return ESCOPO_TEMPLATE.GLOBAL;
}

function normalizeId(value) {
  return String(value || '').trim();
}

function extractOrgContext(context = {}) {
  return {
    setorId: normalizeId(context?.setor_id || context?.grupamento_id),
    subsetorId: normalizeId(context?.subsetor_id || context?.subgrupamento_id),
    unidadeId: normalizeId(context?.unidade_id),
  };
}

function resolveUnidadeIdFromContext(context = {}) {
  const explicitUnidade = normalizeId(context?.unidade_id);
  if (explicitUnidade) return explicitUnidade;

  const tipoSubgrupamento = String(context?.subgrupamento_tipo || context?.tipo_subgrupamento || '').toLowerCase();
  if (tipoSubgrupamento === 'unidade') {
    return normalizeId(context?.subgrupamento_id || context?.subsetor_id);
  }

  return '';
}

function templateMatchesScope(template, escopo, contexto) {
  const setorTemplate = normalizeId(template?.setor_id);
  const subsetorTemplate = normalizeId(template?.subsetor_id);
  const unidadeTemplate = normalizeId(template?.unidade_id);

  if (escopo === ESCOPO_TEMPLATE.GLOBAL) {
    return true;
  }

  if (escopo === ESCOPO_TEMPLATE.SETOR) {
    return Boolean(contexto.setorId && setorTemplate && setorTemplate === contexto.setorId);
  }

  if (escopo === ESCOPO_TEMPLATE.SUBSETOR) {
    return Boolean(
      contexto.setorId &&
      contexto.subsetorId &&
      setorTemplate &&
      subsetorTemplate &&
      setorTemplate === contexto.setorId &&
      subsetorTemplate === contexto.subsetorId
    );
  }

  if (escopo === ESCOPO_TEMPLATE.UNIDADE) {
    return Boolean(
      contexto.setorId &&
      contexto.subsetorId &&
      contexto.unidadeId &&
      setorTemplate &&
      subsetorTemplate &&
      unidadeTemplate &&
      setorTemplate === contexto.setorId &&
      subsetorTemplate === contexto.subsetorId &&
      unidadeTemplate === contexto.unidadeId
    );
  }

  return false;
}

export function getTemplateAtivoPorTipo(tipoRegistro, modulo, templates = [], contextoOrganizacional = {}) {
  if (!tipoRegistro || !modulo) return null;

  const tipoResolvido = resolveTipoRegistroTemplate(tipoRegistro);
  const moduloNormalizado = normalizarModulo(modulo);
  const contexto = {
    ...extractOrgContext(contextoOrganizacional),
    unidadeId: resolveUnidadeIdFromContext(contextoOrganizacional),
  };

  const candidatos = templates.filter((template) => {
    if (!template || template.ativo === false || !template.tipo_registro) {
      return false;
    }

    return (
      resolveTipoRegistroTemplate(template.tipo_registro) === tipoResolvido &&
      normalizarModulo(template.modulo) === moduloNormalizado
    );
  });

  for (const escopo of ORDEM_PRIORIDADE_ESCOPOS) {
    const match = candidatos.find((template) => templateMatchesScope(template, escopo, contexto));
    if (match) return match;
  }

  return null;
}

export function getConflitoTemplatePorTipo(tipoRegistro, templatesAtivos = []) {
  if (!tipoRegistro) {
    return { temConflito: false, modulos: [] };
  }

  const tipoResolvido = resolveTipoRegistroTemplate(tipoRegistro);
  const modulos = Array.from(
    new Set(
      templatesAtivos
        .filter((template) => {
          if (!template || template.ativo === false || !template.tipo_registro) {
            return false;
          }

          return resolveTipoRegistroTemplate(template.tipo_registro) === tipoResolvido;
        })
        .map((template) => getModuloCanonico(template.modulo))
        .filter(Boolean)
    )
  );

  return {
    temConflito: modulos.length > 1,
    modulos,
  };
}

export function getChaveUnicidadeTemplate(template = {}) {
  const escopo = normalizeScope(template.escopo);
  return [
    normalizarModulo(template.modulo),
    resolveTipoRegistroTemplate(template.tipo_registro),
    escopo,
    escopo === ESCOPO_TEMPLATE.SETOR || escopo === ESCOPO_TEMPLATE.SUBSETOR || escopo === ESCOPO_TEMPLATE.UNIDADE
      ? normalizeId(template.setor_id)
      : '',
    escopo === ESCOPO_TEMPLATE.SUBSETOR || escopo === ESCOPO_TEMPLATE.UNIDADE
      ? normalizeId(template.subsetor_id)
      : '',
    escopo === ESCOPO_TEMPLATE.UNIDADE
      ? normalizeId(template.unidade_id)
      : '',
    template.ativo !== false ? 'ATIVO' : 'INATIVO',
  ].join('::');
}

function getDescricaoEscopoTemplate(template = {}) {
  const escopo = normalizeScope(template.escopo);
  const setorId = normalizeId(template.setor_id);
  const subsetorId = normalizeId(template.subsetor_id);
  const unidadeId = normalizeId(template.unidade_id);

  if (escopo === ESCOPO_TEMPLATE.SETOR) {
    return `escopo Setor (${setorId || 'não informado'})`;
  }

  if (escopo === ESCOPO_TEMPLATE.SUBSETOR) {
    return `escopo Subsetor (${setorId || 'não informado'} / ${subsetorId || 'não informado'})`;
  }

  if (escopo === ESCOPO_TEMPLATE.UNIDADE) {
    return `escopo Unidade (${setorId || 'não informado'} / ${subsetorId || 'não informado'} / ${unidadeId || 'não informado'})`;
  }

  return 'escopo Global';
}

export function getConflitoUnicidadeTemplate(template = {}, templates = [], { ignoreId = null, considerarApenasAtivos = true } = {}) {
  if (!template?.modulo || !template?.tipo_registro) return null;

  const templateNormalizado = normalizarEscopoTemplate(template);
  const chaveComparacao = getChaveUnicidadeTemplate({
    ...templateNormalizado,
    ativo: considerarApenasAtivos ? true : templateNormalizado.ativo,
  });

  return (
    templates.find((item) => {
      if (!item || item.id === ignoreId) return false;
      if (considerarApenasAtivos && (templateNormalizado.ativo === false || item.ativo === false)) return false;

      const chaveItem = getChaveUnicidadeTemplate({
        ...item,
        ativo: considerarApenasAtivos ? true : item.ativo,
      });

      return chaveItem === chaveComparacao;
    }) || null
  );
}

export function getMensagemConflitoUnicidadeTemplate(template = {}, conflito = null, considerarApenasAtivos = true) {
  if (!conflito) return null;

  const escopoDescricao = getDescricaoEscopoTemplate(template);
  const sufixoAtivo = considerarApenasAtivos
    ? 'A regra de unicidade bloqueia concorrência entre templates ativos.'
    : 'A regra de unicidade bloqueia qualquer duplicidade, inclusive inativos.';

  return `Já existe template para este módulo, tipo e ${escopoDescricao}. ${sufixoAtivo}`;
}

export function validarEscopoTemplate(template = {}) {
  const escopo = normalizeScope(template.escopo);
  const setorId = normalizeId(template.setor_id);
  const subsetorId = normalizeId(template.subsetor_id);
  const unidadeId = normalizeId(template.unidade_id);

  if (escopo === ESCOPO_TEMPLATE.SETOR && !setorId) {
    return 'Selecione o setor para templates com escopo Setor.';
  }

  if (escopo === ESCOPO_TEMPLATE.SUBSETOR) {
    if (!setorId || !subsetorId) {
      return 'Selecione setor e subsetor para templates com escopo Subsetor.';
    }
  }

  if (escopo === ESCOPO_TEMPLATE.UNIDADE) {
    if (!setorId || !subsetorId || !unidadeId) {
      return 'Selecione setor, subsetor e unidade para templates com escopo Unidade.';
    }
  }

  return null;
}

export function normalizarEscopoTemplate(template = {}) {
  const escopo = normalizeScope(template.escopo);

  if (escopo === ESCOPO_TEMPLATE.GLOBAL) {
    return { ...template, escopo, setor_id: '', subsetor_id: '', unidade_id: '' };
  }

  if (escopo === ESCOPO_TEMPLATE.SETOR) {
    return { ...template, escopo, subsetor_id: '', unidade_id: '' };
  }

  if (escopo === ESCOPO_TEMPLATE.SUBSETOR) {
    return { ...template, escopo, unidade_id: '' };
  }

  return { ...template, escopo };
}
