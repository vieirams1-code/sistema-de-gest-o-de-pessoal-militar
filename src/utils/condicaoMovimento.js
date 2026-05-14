function normalizarTexto(valor) {
  return String(valor || '').trim();
}

/**
 * @param {unknown} valor
 * @returns {'entrada' | 'saida' | null}
 */
function normalizarMovimento(valor) {
  const movimento = normalizarTexto(valor).toLowerCase();
  if (movimento === 'entrada' || movimento === 'saida') return movimento;
  return null;
}

/**
 * Resolve o movimento operacional da condição do militar.
 *
 * A mesma regra deve ser usada tanto pela renderização da badge quanto pelos
 * filtros da listagem, evitando divergências para condições com movimento
 * implícito, como LTIP.
 *
 * @param {object} militar
 * @returns {'entrada' | 'saida' | null}
 */
export function resolveMovimentoCondicao(militar = {}) {
  const condicao = normalizarTexto(militar?.condicao);

  if (condicao === 'LTIP') return 'saida';

  return normalizarMovimento(militar?.condicao_movimento);
}
