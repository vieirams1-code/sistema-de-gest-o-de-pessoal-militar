// Normalizações compartilhadas pela leitura de boletins.
export function normalizarBuscaBoletim(valor = '') {
  return String(valor || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
}

export function normalizarNotaBoletim(valor = '') {
  const texto = String(valor || '');
  const contextual = texto.match(/NOTA\s*N(?:\.|[º°])?\s*[:\-]?\s*(\d{4,9})/i);
  const numeros = contextual ? [contextual[1]] : (texto.match(/\b\d{4,9}\b/g) || []);
  for (const numero of numeros) {
    const limpo = numero.replace(/^0+/, '');
    if (/^[1-9]\d{3,7}$/.test(limpo)) return limpo;
  }
  return '';
}