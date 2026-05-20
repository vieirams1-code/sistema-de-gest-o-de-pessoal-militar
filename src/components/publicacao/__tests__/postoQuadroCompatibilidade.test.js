import test from 'node:test';
import assert from 'node:assert/strict';
import { getQuadrosCompativeis, isPostoPraca, isQuadroCompativel } from '../../../utils/postoQuadroCompatibilidade.js';

test('Subtenente é tratado como praça', () => {
  assert.equal(isPostoPraca('Subtenente'), true);
});

test('Subtenente aceita quadros de praça esperados', () => {
  const quadrosCompativeis = getQuadrosCompativeis('Subtenente');
  assert.deepEqual(
    quadrosCompativeis.filter((quadro) => ['QBMP-1.a', 'QBMP-1.b', 'QBMP-2', 'QPTBM'].includes(quadro)),
    ['QBMP-1.a', 'QBMP-1.b', 'QBMP-2', 'QPTBM'],
  );
});

test('ST + QBMP-1.b é compatível', () => {
  assert.equal(isQuadroCompativel('Subtenente', 'QBMP-1.b'), true);
});

test('ST + QBMP-1.B é compatível após normalização', () => {
  assert.equal(isQuadroCompativel('Subtenente', 'QBMP-1.B'), true);
});

test('ST + QPTBM é compatível', () => {
  assert.equal(isQuadroCompativel('Subtenente', 'QPTBM'), true);
});

test('ST + QOBM é incompatível', () => {
  assert.equal(isQuadroCompativel('Subtenente', 'QOBM'), false);
});
