import { identificarCamposDinamicosDocumentoMilitar, substituirCamposDinamicosDocumentoMilitar } from './camposDinamicosDocumentoMilitar.js';
import { MODULO_DOCUMENTOS_MILITARES, montarVariaveisDocumentoMilitar } from './documentoMilitarVarsService.js';
import { normalizarTextoDocumentoMilitar } from './normalizarTextoDocumentoMilitar.js';
import { substituirVariaveisDocumentoMilitar } from './substituirVariaveisDocumentoMilitar.js';

function somenteValoresPreenchidos(valores = {}) {
  if (!valores || typeof valores !== 'object') return {};

  return Object.fromEntries(
    Object.entries(valores).filter(([, valor]) => (
      (typeof valor === 'string' && valor.trim()) || typeof valor === 'number'
    ))
  );
}

export function filtrarTemplatesDocumentosMilitares(templates = []) {
  if (!Array.isArray(templates)) return [];

  return templates.filter((template) => template?.modulo === MODULO_DOCUMENTOS_MILITARES);
}

export function identificarCamposTemplateDocumentoMilitar(template = '') {
  return identificarCamposDinamicosDocumentoMilitar(template);
}

export function renderizarDocumentoMilitarIndividual({
  template = '',
  militar = {},
  camposManuais = {},
  opcoesVariaveis = {},
} = {}) {
  const templateComCamposManuais = substituirCamposDinamicosDocumentoMilitar(
    template,
    somenteValoresPreenchidos(camposManuais)
  );
  const variaveisMilitar = montarVariaveisDocumentoMilitar(militar, opcoesVariaveis);

  const textoRenderizado = substituirVariaveisDocumentoMilitar(
    templateComCamposManuais,
    somenteValoresPreenchidos(variaveisMilitar),
    { manterDesconhecidas: true }
  );

  return normalizarTextoDocumentoMilitar(textoRenderizado);
}
