import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarTipoCategoria, calcularPrioridadePorPrazo } from '../centralPendencias.helpers.js';

test('normalizarTipoCategoria mapeia categorias corretamente', () => {
  // Publicações
  assert.equal(normalizarTipoCategoria('Publicação'), 'publicacoes');
  assert.equal(normalizarTipoCategoria('PUBLICA'), 'publicacoes');

  // Atestados
  assert.equal(normalizarTipoCategoria('Atestado Médico'), 'atestados');
  assert.equal(normalizarTipoCategoria('atestado'), 'atestados');

  // Férias
  assert.equal(normalizarTipoCategoria('Férias'), 'ferias');
  assert.equal(normalizarTipoCategoria('feria'), 'ferias');
  assert.equal(normalizarTipoCategoria('GOZO DE FÉRIAS'), 'ferias');

  // Comportamento
  assert.equal(normalizarTipoCategoria('Comportamento'), 'comportamento');
  assert.equal(normalizarTipoCategoria('COMPORT'), 'comportamento');

  // Legado / Duplicidade
  assert.equal(normalizarTipoCategoria('Legado'), 'legado');
  assert.equal(normalizarTipoCategoria('Duplicidade de Vínculo'), 'legado');

  // Outros / Edge cases
  assert.equal(normalizarTipoCategoria('Diversos'), 'outros');
  assert.equal(normalizarTipoCategoria(''), 'outros');
  assert.equal(normalizarTipoCategoria(null), 'outros');
  assert.equal(normalizarTipoCategoria(undefined), 'outros');
});

test('calcularPrioridadePorPrazo define prioridade corretamente', () => {
  // Critica: vencido ou status vencido
  assert.equal(calcularPrioridadePorPrazo({ vencido: true }), 'critica');
  assert.equal(calcularPrioridadePorPrazo({ status: 'Vencida' }), 'critica');
  assert.equal(calcularPrioridadePorPrazo({ status: 'VENCIDO' }), 'critica');

  // Critica: prazo <= 3 dias
  assert.equal(calcularPrioridadePorPrazo({ diasParaVencer: 0 }), 'critica');
  assert.equal(calcularPrioridadePorPrazo({ diasParaVencer: 3 }), 'critica');

  // Alta: prazo <= 15 dias
  assert.equal(calcularPrioridadePorPrazo({ diasParaVencer: 4 }), 'alta');
  assert.equal(calcularPrioridadePorPrazo({ diasParaVencer: 15 }), 'alta');

  // Alta: status aguardando
  assert.equal(calcularPrioridadePorPrazo({ status: 'Aguardando validação' }), 'alta');

  // Media: prazo <= 30 dias
  assert.equal(calcularPrioridadePorPrazo({ diasParaVencer: 16 }), 'media');
  assert.equal(calcularPrioridadePorPrazo({ diasParaVencer: 30 }), 'media');

  // Media: prazo > 30 dias ou default
  assert.equal(calcularPrioridadePorPrazo({ diasParaVencer: 31 }), 'media');
  assert.equal(calcularPrioridadePorPrazo({ diasParaVencer: null }), 'media');
  assert.equal(calcularPrioridadePorPrazo({}), 'media');
  assert.equal(calcularPrioridadePorPrazo(), 'media');
});
