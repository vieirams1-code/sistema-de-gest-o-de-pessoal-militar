import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isAtestadoAcompanhamento,
  normalizeDadosAcompanhamentoAtestado,
} from './atestadoAcompanhamentoForm.js';

test('campo de nome do dependente só deve aparecer quando acompanhado é estritamente true', () => {
  assert.equal(isAtestadoAcompanhamento(false), false);
  assert.equal(isAtestadoAcompanhamento(undefined), false);
  assert.equal(isAtestadoAcompanhamento('true'), false);
  assert.equal(isAtestadoAcompanhamento(true), true);
});

test('nome e parentesco do acompanhado persistem no atestado de acompanhamento', () => {
  const atestado = normalizeDadosAcompanhamentoAtestado({
    acompanhado: true,
    acompanhado_nome: 'Maria da Silva',
    grau_parentesco: 'Filho(a)',
  });

  assert.equal(atestado.acompanhado_nome, 'Maria da Silva');
  assert.equal(atestado.grau_parentesco, 'Filho(a)');
});

test('nome e parentesco são limpos quando deixa de ser atestado de acompanhamento', () => {
  const atestado = normalizeDadosAcompanhamentoAtestado({
    acompanhado: false,
    acompanhado_nome: 'Maria da Silva',
    grau_parentesco: 'Filho(a)',
  });

  assert.equal(atestado.acompanhado_nome, '');
  assert.equal(atestado.grau_parentesco, '');
});
