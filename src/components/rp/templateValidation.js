import { resolverTipoFeriasCanonico } from '@/components/ferias/feriasTipoResolver';

export const TEMPLATE_BLOQUEIO_MENSAGEM =
  'Template obrigatório não encontrado para este tipo de registro. Cadastre um template antes de continuar.';

export const TIPO_REGISTRO_TEMPLATE_INTERNO = {
  SAIDA_FERIAS: 'Saída Férias',
  INTERRUPCAO_FERIAS: 'Interrupção de Férias',
  CONTINUACAO_FERIAS: 'Continuação de Férias',
  TERMINO_FERIAS: 'Retorno Férias',
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
