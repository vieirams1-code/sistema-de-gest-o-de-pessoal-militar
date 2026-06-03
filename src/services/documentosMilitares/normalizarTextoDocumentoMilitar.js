const DEFAULT_MAX_WORD_LENGTH = 80;
const DEFAULT_CHUNK_SIZE = 40;
const ZERO_WIDTH_SPACE = '\u200B';

function normalizarQuebrasDeLinha(texto) {
  return texto
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((linha) => linha.replace(/[\t ]+$/g, ''))
    .join('\n')
    .replace(/(?:[\t ]*\n){3,}/g, '\n\n');
}

function quebrarPalavraLonga(palavra, chunkSize) {
  const partes = [];

  for (let index = 0; index < palavra.length; index += chunkSize) {
    partes.push(palavra.slice(index, index + chunkSize));
  }

  return partes.join(ZERO_WIDTH_SPACE);
}

export function normalizarTextoDocumentoMilitar(texto = '', { maxWordLength = DEFAULT_MAX_WORD_LENGTH, chunkSize = DEFAULT_CHUNK_SIZE } = {}) {
  if (typeof texto !== 'string') return '';

  const tamanhoMaximo = Number.isFinite(maxWordLength) && maxWordLength > 0 ? maxWordLength : DEFAULT_MAX_WORD_LENGTH;
  const tamanhoBloco = Number.isFinite(chunkSize) && chunkSize > 0 ? chunkSize : DEFAULT_CHUNK_SIZE;
  const textoComQuebrasNormalizadas = normalizarQuebrasDeLinha(texto);

  return textoComQuebrasNormalizadas.replace(/\S+/g, (palavra) => {
    if (palavra.length <= tamanhoMaximo || palavra.includes(ZERO_WIDTH_SPACE)) {
      return palavra;
    }

    return quebrarPalavraLonga(palavra, tamanhoBloco);
  });
}

export { ZERO_WIDTH_SPACE as DOCUMENTO_MILITAR_ZERO_WIDTH_SPACE };
