import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveMovimentoCondicao } from '../condicaoMovimento.js';

test('resolve LTIP como saída mesmo sem condicao_movimento', () => {
  assert.equal(resolveMovimentoCondicao({ condicao: 'LTIP' }), 'saida');
});

test('resolve movimento explícito de saída para condições movimentáveis', () => {
  for (const condicao of ['Cedido', 'Adido', 'Agregado', 'À Disposição']) {
    assert.equal(resolveMovimentoCondicao({ condicao, condicao_movimento: 'saida' }), 'saida');
  }
});

test('resolve movimento explícito de entrada para condições movimentáveis', () => {
  for (const condicao of ['Cedido', 'Adido', 'Agregado', 'À Disposição']) {
    assert.equal(resolveMovimentoCondicao({ condicao, condicao_movimento: 'entrada' }), 'entrada');
  }
});

test('não classifica efetivo sem movimento explícito', () => {
  assert.equal(resolveMovimentoCondicao({ condicao: 'Efetivo' }), null);
});

test('preserva regra explícita de movimento quando informada', () => {
  assert.equal(resolveMovimentoCondicao({ condicao: 'Efetivo', condicao_movimento: 'entrada' }), 'entrada');
  assert.equal(resolveMovimentoCondicao({ condicao: 'Efetivo', condicao_movimento: 'saida' }), 'saida');
});
