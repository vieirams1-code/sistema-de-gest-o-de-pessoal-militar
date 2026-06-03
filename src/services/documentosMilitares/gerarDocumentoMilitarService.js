import { identificarCamposDinamicosDocumentoMilitar, substituirCamposDinamicosDocumentoMilitar } from './camposDinamicosDocumentoMilitar.js';
import { MODULO_DOCUMENTOS_MILITARES, montarVariaveisDocumentoMilitar } from './documentoMilitarVarsService.js';
import { normalizarTextoDocumentoMilitar } from './normalizarTextoDocumentoMilitar.js';
import { montarVariaveisSignatarioDocumentoMilitar } from './documentoMilitarSignatarioService.js';
import { substituirVariaveisDocumentoMilitar } from './substituirVariaveisDocumentoMilitar.js';

export const ASSINATURA_SIGNATARIO_MARKER_START = '\uE000ASSINATURA_SIGNATARIO\uE000';
export const ASSINATURA_SIGNATARIO_MARKER_END = '\uE000/ASSINATURA_SIGNATARIO\uE000';

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
  const variaveisSignatario = montarVariaveisSignatarioDocumentoMilitar(opcoesVariaveis.signatario);
  const tituloDocumento = typeof opcoesVariaveis.tituloDocumento === 'string' ? opcoesVariaveis.tituloDocumento.trim() : '';
  const variaveisDocumento = {
    ...variaveisMilitar,
    ...variaveisSignatario,
    ...(tituloDocumento ? { titulo_documento: tituloDocumento } : {}),
  };

  if (variaveisDocumento.assinatura_signatario) {
    variaveisDocumento.assinatura_signatario = [
      ASSINATURA_SIGNATARIO_MARKER_START,
      variaveisDocumento.assinatura_signatario,
      ASSINATURA_SIGNATARIO_MARKER_END,
    ].join('\n');
  }

  const textoRenderizado = substituirVariaveisDocumentoMilitar(
    templateComCamposManuais,
    somenteValoresPreenchidos(variaveisDocumento),
    { manterDesconhecidas: true }
  );

  return normalizarTextoDocumentoMilitar(textoRenderizado);
}
