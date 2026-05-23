import { getFeriasTagTagId, isRegistroAtivo } from './contratoCampos';

export const APLICABILIDADE_TAG_FERIAS = new Set(['', 'ferias', 'ambos']);

const normalizarTexto = (valor) => String(valor || '').trim().toLowerCase();

export function separarTagsFeriasPorStatus(vinculos = []) {
  const ativas = [];
  const removidas = [];

  vinculos.forEach((vinculo) => {
    if (normalizarTexto(vinculo.status) === 'ativa') {
      ativas.push(vinculo);
      return;
    }
    removidas.push(vinculo);
  });

  return { ativas, removidas };
}

export function validarAplicabilidadeTagFerias(tag) {
  if (!tag) return 'Selecione uma tag válida.';
  if (!APLICABILIDADE_TAG_FERIAS.has(normalizarTexto(tag.aplicabilidade))) {
    return 'Esta tag não pode ser aplicada em férias.';
  }
  return null;
}

export function isTagAplicavelEmFerias(tag) {
  return isRegistroAtivo(tag) && !validarAplicabilidadeTagFerias(tag);
}

export function validarDuplicidadeTagAtivaFerias({ vinculosAtivos = [], tagId }) {
  const alvo = String(tagId || '');
  const existe = vinculosAtivos.some((vinculo) => normalizarTexto(vinculo.status) === 'ativa' && String(getFeriasTagTagId(vinculo) || '') === alvo);
  return existe ? 'Estas férias já possuem esta tag ativa.' : null;
}
