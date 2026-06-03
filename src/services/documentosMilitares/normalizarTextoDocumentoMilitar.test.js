import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DOCUMENTO_MILITAR_ZERO_WIDTH_SPACE,
  normalizarTextoDocumentoMilitar,
} from './normalizarTextoDocumentoMilitar.js';

test('normaliza quebras de linha excessivas sem criar páginas artificiais', () => {
  const resultado = normalizarTextoDocumentoMilitar('Linha 1\r\n\r\n   \n\nLinha 2   ');

  assert.equal(resultado, 'Linha 1\n\nLinha 2');
});

test('trata palavra gigante sem espaços com pontos de quebra invisíveis', () => {
  const palavraGigante = 'A'.repeat(200);
  const resultado = normalizarTextoDocumentoMilitar(palavraGigante);

  assert.ok(resultado.includes(DOCUMENTO_MILITAR_ZERO_WIDTH_SPACE));
  assert.equal(resultado.replaceAll(DOCUMENTO_MILITAR_ZERO_WIDTH_SPACE, ''), palavraGigante);
  assert.equal(resultado.includes('\n'), false);
});

test('mantém textos curtos sem inserir quebras invisíveis', () => {
  assert.equal(normalizarTextoDocumentoMilitar('Texto curto com espaços.'), 'Texto curto com espaços.');
});
