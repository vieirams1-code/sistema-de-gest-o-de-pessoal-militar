export const APLICABILIDADE_TAG_MILITAR = new Set(['militar', 'ambos']);

const normalizarTexto = (valor) => String(valor || '').trim().toLowerCase();

export function separarTagsPorStatus(vinculos = []) {
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

export function validarAplicabilidadeTagMilitar(tag) {
  if (!tag) return 'Selecione uma tag válida.';
  if (!APLICABILIDADE_TAG_MILITAR.has(normalizarTexto(tag.aplicabilidade))) {
    return 'Esta tag não pode ser aplicada em militares.';
  }
  return null;
}

export function validarDuplicidadeTagAtiva({ vinculosAtivos = [], tagId }) {
  const existe = vinculosAtivos.some((vinculo) => normalizarTexto(vinculo.status) === 'ativa' && vinculo.tag_id === tagId);
  return existe ? 'Este militar já possui esta tag ativa.' : null;
}
