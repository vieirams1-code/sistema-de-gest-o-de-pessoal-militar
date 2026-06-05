import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularPrioridadePorPrazo, diferencaDias } from '../centralPendencias.helpers.js';

test('calcularPrioridadePorPrazo - prioridade crítica', () => {
  // Vencido explicitamente
  assert.equal(calcularPrioridadePorPrazo({ vencido: true }), 'critica');

  // Status contém 'vencid'
  assert.equal(calcularPrioridadePorPrazo({ status: 'Vencido' }), 'critica');
  assert.equal(calcularPrioridadePorPrazo({ status: 'vencida' }), 'critica');

  // diasParaVencer <= 3
  assert.equal(calcularPrioridadePorPrazo({ diasParaVencer: 3 }), 'critica');
  assert.equal(calcularPrioridadePorPrazo({ diasParaVencer: 0 }), 'critica');
  assert.equal(calcularPrioridadePorPrazo({ diasParaVencer: -1 }), 'critica');
});

test('calcularPrioridadePorPrazo - prioridade alta', () => {
  // 3 < diasParaVencer <= 15
  assert.equal(calcularPrioridadePorPrazo({ diasParaVencer: 4 }), 'alta');
  assert.equal(calcularPrioridadePorPrazo({ diasParaVencer: 15 }), 'alta');

  // Status contém 'aguardando'
  assert.equal(calcularPrioridadePorPrazo({ status: 'Aguardando validação' }), 'alta');
});

test('calcularPrioridadePorPrazo - prioridade média', () => {
  // 15 < diasParaVencer <= 30
  assert.equal(calcularPrioridadePorPrazo({ diasParaVencer: 16 }), 'media');
  assert.equal(calcularPrioridadePorPrazo({ diasParaVencer: 30 }), 'media');

  // diasParaVencer > 30 ou null
  assert.equal(calcularPrioridadePorPrazo({ diasParaVencer: 31 }), 'media');
  assert.equal(calcularPrioridadePorPrazo({ diasParaVencer: null }), 'media');
  assert.equal(calcularPrioridadePorPrazo({}), 'media');
});

test('diferencaDias - cálculos básicos', () => {
  const base = new Date('2024-03-20T12:00:00');

  // Mesmo dia
  assert.equal(diferencaDias('2024-03-20', base), 0);

  // Futuro
  assert.equal(diferencaDias('2024-03-21', base), 1);
  assert.equal(diferencaDias('2024-03-30', base), 10);

  // Passado
  assert.equal(diferencaDias('2024-03-19', base), -1);
  assert.equal(diferencaDias('2024-03-10', base), -10);
});

test('diferencaDias - casos de borda e erros', () => {
  assert.equal(diferencaDias(null), null);
  assert.equal(diferencaDias(''), null);
  assert.equal(diferencaDias('data-invalida'), null);
});
