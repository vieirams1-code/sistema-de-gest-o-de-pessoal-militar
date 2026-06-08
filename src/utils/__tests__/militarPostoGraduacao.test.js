import assert from 'node:assert/strict';
import test from 'node:test';

import { getPostoGraduacaoOficial, normalizarPostoGraduacaoMilitar } from '../militarPostoGraduacao.js';

test('getPostoGraduacaoOficial - returns empty string for empty input', () => {
  assert.equal(getPostoGraduacaoOficial(), '');
  assert.equal(getPostoGraduacaoOficial({}), '');
  assert.equal(getPostoGraduacaoOficial(null), '');
});

test('getPostoGraduacaoOficial - picks up values from various keys', () => {
  assert.equal(getPostoGraduacaoOficial({ posto_graduacao: 'Coronel' }), 'Coronel');
  assert.equal(getPostoGraduacaoOficial({ 'posto_graduação': 'Tenente' }), 'Tenente');
  assert.equal(getPostoGraduacaoOficial({ posto_grad: 'Major' }), 'Major');
  assert.equal(getPostoGraduacaoOficial({ posto: 'Capitão' }), 'Capitão');
  assert.equal(getPostoGraduacaoOficial({ graduacao: 'Soldado' }), 'Soldado');
});

test('getPostoGraduacaoOficial - respects precedence', () => {
  const militar = {
    posto_graduacao: 'Precedence 1',
    'posto_graduação': 'Precedence 2',
    posto_grad: 'Precedence 3',
    posto: 'Precedence 4',
    graduacao: 'Precedence 5'
  };
  assert.equal(getPostoGraduacaoOficial(militar), 'Precedence 1');

  delete militar.posto_graduacao;
  assert.equal(getPostoGraduacaoOficial(militar), 'Precedence 2');

  delete militar['posto_graduação'];
  assert.equal(getPostoGraduacaoOficial(militar), 'Precedence 3');

  delete militar.posto_grad;
  assert.equal(getPostoGraduacaoOficial(militar), 'Precedence 4');

  delete militar.posto;
  assert.equal(getPostoGraduacaoOficial(militar), 'Precedence 5');
});

test('getPostoGraduacaoOficial - trims whitespace', () => {
  assert.equal(getPostoGraduacaoOficial({ posto_graduacao: '  Coronel  ' }), 'Coronel');
});

test('getPostoGraduacaoOficial - handles non-string values', () => {
  assert.equal(getPostoGraduacaoOficial({ posto: 123 }), '123');
});

test('getPostoGraduacaoOficial - falls through empty strings and falsy values', () => {
  assert.equal(getPostoGraduacaoOficial({ posto_graduacao: '', posto: 'Capitão' }), 'Capitão');
  assert.equal(getPostoGraduacaoOficial({ posto_graduacao: null, posto: 'Capitão' }), 'Capitão');
});

test('getPostoGraduacaoOficial - handles non-object inputs gracefully', () => {
  assert.equal(getPostoGraduacaoOficial('not an object'), '');
  assert.equal(getPostoGraduacaoOficial(123), '');
  assert.equal(getPostoGraduacaoOficial(true), '');
});

test('normalizarPostoGraduacaoMilitar - returns same object if no rank found', () => {
  const militar = { nome: 'João' };
  assert.deepEqual(normalizarPostoGraduacaoMilitar(militar), militar);
});

test('normalizarPostoGraduacaoMilitar - returns same object if posto_graduacao is already set and matches', () => {
  const militar = { nome: 'João', posto_graduacao: 'Coronel' };
  const resultado = normalizarPostoGraduacaoMilitar(militar);
  assert.strictEqual(resultado, militar);
});

test('normalizarPostoGraduacaoMilitar - updates object with normalized posto_graduacao', () => {
  const militar = { nome: 'João', posto: 'Tenente' };
  const resultado = normalizarPostoGraduacaoMilitar(militar);
  assert.equal(resultado.posto_graduacao, 'Tenente');
  assert.equal(resultado.nome, 'João');
  assert.equal(resultado.posto, 'Tenente');
});

test('normalizarPostoGraduacaoMilitar - handles case where posto_graduacao is present but needs trimming', () => {
  const militar = { nome: 'João', posto_graduacao: '  Coronel  ' };
  const resultado = normalizarPostoGraduacaoMilitar(militar);
  assert.equal(resultado.posto_graduacao, 'Coronel');
});
