/**
 * Helper local de normalização textual e numérica para busca global de militares.
 * Processa acentos, espaços múltiplos e mascara numérica.
 */

/**
 * Normaliza texto: remove acentos, converte para minúsculas, trim e espaços múltiplos.
 * @param {string|null|undefined} valor
 * @returns {string} Texto normalizado (lowercase, sem acentos, sem espaços extras)
 */
export function normalizarTextoBusca(valor) {
  if (valor == null) return '';
  return String(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Remove tudo que não for dígito.
 * @param {string|null|undefined} valor
 * @returns {string} Apenas dígitos
 */
export function somenteDigitos(valor) {
  if (valor == null) return '';
  return String(valor).replace(/\D/g, '');
}
