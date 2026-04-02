export const TEMPLATE_BLOQUEIO_MENSAGEM =
  'Template obrigatório não encontrado para este tipo de registro. Cadastre um template antes de continuar.';

export const TIPO_REGISTRO_TEMPLATE_INTERNO = {
  SAIDA_FERIAS: 'SAIDA_FERIAS',
  INTERRUPCAO_FERIAS: 'INTERRUPCAO_FERIAS',
  CONTINUACAO_FERIAS: 'CONTINUACAO_FERIAS',
  TERMINO_FERIAS: 'TERMINO_FERIAS',
};

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

const TIPO_REGISTRO_TEMPLATE_ALIASES = {
  [TIPO_REGISTRO_TEMPLATE_INTERNO.SAIDA_FERIAS]: [
    'SAIDA_FERIAS',
    'saida_ferias',
    'Início de Férias',
    'Saída Férias',
  ],
  [TIPO_REGISTRO_TEMPLATE_INTERNO.INTERRUPCAO_FERIAS]: [
    'INTERRUPCAO_FERIAS',
    'interrupcao_ferias',
    'Interrupção de Férias',
  ],
  [TIPO_REGISTRO_TEMPLATE_INTERNO.CONTINUACAO_FERIAS]: [
    'CONTINUACAO_FERIAS',
    'continuacao_ferias',
    'Continuação',
    'Nova Saída',
    'Nova Saída / Retomada',
    'Retomada',
  ],
  [TIPO_REGISTRO_TEMPLATE_INTERNO.TERMINO_FERIAS]: [
    'TERMINO_FERIAS',
    'termino_ferias',
    'Término',
    'Retorno de Férias',
    'Retorno Férias',
  ],
};

const MAPA_ALIAS_TIPO_REGISTRO_TEMPLATE = Object.entries(TIPO_REGISTRO_TEMPLATE_ALIASES).reduce(
  (acc, [tipoInterno, aliases]) => {
    aliases.forEach((alias) => {
      acc.set(normalizeTipoRegistroKey(alias), tipoInterno);
    });
    return acc;
  },
  new Map()
);

export function resolveTipoRegistroTemplate(tipoRegistro = '') {
  if (!tipoRegistro) return '';
  const tipoNormalizado = normalizeTipoRegistroKey(tipoRegistro);
  return MAPA_ALIAS_TIPO_REGISTRO_TEMPLATE.get(tipoNormalizado) || String(tipoRegistro).trim();
}

function getModuloCanonico(modulo = '') {
  const moduloNormalizado = normalizarModulo(modulo);

  if (moduloNormalizado === 'livro') return 'Livro';
  if (moduloNormalizado === 'exofficio') return 'ExOfficio';

  return String(modulo).trim() || moduloNormalizado;
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

export function getTemplateAtivoPorTipo(tipoRegistro, modulo, templates = []) {
  if (!tipoRegistro || !modulo) return null;

  const tipoResolvido = resolveTipoRegistroTemplate(tipoRegistro);
  const moduloNormalizado = normalizarModulo(modulo);

  return (
    templates.find((template) => {
      if (!template || template.ativo === false || !template.tipo_registro) {
        return false;
      }

      return (
        resolveTipoRegistroTemplate(template.tipo_registro) === tipoResolvido &&
        normalizarModulo(template.modulo) === moduloNormalizado
      );
    }) || null
  );
}
