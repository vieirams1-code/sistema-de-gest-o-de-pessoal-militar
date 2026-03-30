export const TEMPLATE_BLOQUEIO_MENSAGEM =
  'Template obrigatório não encontrado para este tipo de registro. Cadastre um template antes de continuar.';

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

  const tipoNormalizado = String(tipoRegistro).trim().toLowerCase();
  const modulos = Array.from(
    new Set(
      templatesAtivos
        .filter((template) => {
          if (!template || template.ativo === false || !template.tipo_registro) {
            return false;
          }

          return String(template.tipo_registro).trim().toLowerCase() === tipoNormalizado;
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

  const tipoNormalizado = String(tipoRegistro).trim().toLowerCase();
  const moduloNormalizado = normalizarModulo(modulo);

  return (
    templates.find((template) => {
      if (!template || template.ativo === false || !template.tipo_registro) {
        return false;
      }

      return (
        String(template.tipo_registro).trim().toLowerCase() === tipoNormalizado &&
        normalizarModulo(template.modulo) === moduloNormalizado
      );
    }) || null
  );
}
