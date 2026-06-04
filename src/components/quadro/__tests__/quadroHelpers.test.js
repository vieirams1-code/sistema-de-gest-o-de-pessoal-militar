import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChecklistResumo } from '../quadroFormatters.js';

test('buildChecklistResumo handles empty array', () => {
  assert.strictEqual(buildChecklistResumo([]), '0/0');
});

test('buildChecklistResumo handles all completed items', () => {
  const items = [{ concluido: true }, { concluido: true }];
  assert.strictEqual(buildChecklistResumo(items), '2/2');
});

test('buildChecklistResumo handles none completed items', () => {
  const items = [{ concluido: false }, { concluido: false }];
  assert.strictEqual(buildChecklistResumo(items), '0/2');
});

test('buildChecklistResumo handles mixed completion status', () => {
  const items = [{ concluido: true }, { concluido: false }, { concluido: true }];
  assert.strictEqual(buildChecklistResumo(items), '2/3');
});

test('buildChecklistResumo handles items without concluido property', () => {
  const items = [{}, { concluido: true }];
  assert.strictEqual(buildChecklistResumo(items), '1/2');
});

test('buildChecklistResumo handles default parameter', () => {
  assert.strictEqual(buildChecklistResumo(), '0/0');
});
