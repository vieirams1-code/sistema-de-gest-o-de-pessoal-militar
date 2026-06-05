import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getPostoGraduacaoOficial,
  normalizarPostoGraduacaoMilitar,
} from '../militarPostoGraduacao.js';

test('getPostoGraduacaoOficial handles empty or null input', () => {
  assert.strictEqual(getPostoGraduacaoOficial(), '');
  assert.strictEqual(getPostoGraduacaoOficial({}), '');
  assert.strictEqual(getPostoGraduacaoOficial(null), '');
});

test('getPostoGraduacaoOficial priority order', () => {
  assert.strictEqual(getPostoGraduacaoOficial({ posto_graduacao: '1SGT' }), '1SGT');

  assert.strictEqual(getPostoGraduacaoOficial({
    posto_graduacao: '1SGT',
    'posto_graduação': '2SGT'
  }), '1SGT');

  assert.strictEqual(getPostoGraduacaoOficial({
    'posto_graduação': '2SGT',
    posto_grad: '3SGT'
  }), '2SGT');

  assert.strictEqual(getPostoGraduacaoOficial({
    posto_grad: '3SGT',
    posto: 'Capitão'
  }), '3SGT');

  assert.strictEqual(getPostoGraduacaoOficial({
    posto: 'Capitão',
    graduacao: 'Soldado'
  }), 'Capitão');

  assert.strictEqual(getPostoGraduacaoOficial({
    graduacao: 'Soldado'
  }), 'Soldado');
});

test('getPostoGraduacaoOficial trims the result', () => {
  assert.strictEqual(getPostoGraduacaoOficial({ posto_graduacao: '  1SGT  ' }), '1SGT');
});

test('normalizarPostoGraduacaoMilitar returns original object if no rank found', () => {
  const militar = { nome: 'João' };
  const result = normalizarPostoGraduacaoMilitar(militar);
  assert.strictEqual(result, militar);
});

test('normalizarPostoGraduacaoMilitar returns original object if already normalized', () => {
  const militar = { nome: 'João', posto_graduacao: '1SGT' };
  const result = normalizarPostoGraduacaoMilitar(militar);
  assert.strictEqual(result, militar);
});

test('normalizarPostoGraduacaoMilitar normalizes from other fields', () => {
  const militar = { nome: 'João', posto: 'Capitão' };
  const result = normalizarPostoGraduacaoMilitar(militar);
  assert.notStrictEqual(result, militar);
  assert.strictEqual(result.posto_graduacao, 'Capitão');
  assert.strictEqual(result.posto, 'Capitão');
});

test('normalizarPostoGraduacaoMilitar does not trim if already present and matching trimmed', () => {
  // Testing the current behavior observed in the code
  const militar = { nome: 'João', posto_graduacao: ' 1SGT ' };
  const result = normalizarPostoGraduacaoMilitar(militar);
  assert.strictEqual(result, militar, 'Should return same object if trimmed value matches');
  assert.strictEqual(result.posto_graduacao, ' 1SGT ');
});
