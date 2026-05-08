import test from 'node:test';
import assert from 'node:assert/strict';

import {
  compareDateOnly,
  isBeforeDateOnly,
  isValidDateOnly,
  normalizeDateOnly,
  parseDateOnlyStrict,
} from '../dateOnlyService.js';

test('parseDateOnlyStrict aceita yyyy-MM-dd válido e retorna Date local à meia-noite', () => {
  const data = parseDateOnlyStrict('2024-11-21');

  assert.ok(data instanceof Date);
  assert.equal(data.getFullYear(), 2024);
  assert.equal(data.getMonth(), 10);
  assert.equal(data.getDate(), 21);
  assert.equal(data.getHours(), 0);
  assert.equal(data.getMinutes(), 0);
  assert.equal(data.getSeconds(), 0);
  assert.equal(data.getMilliseconds(), 0);
});

test('parseDateOnlyStrict aceita dd/MM/yyyy válido', () => {
  const data = parseDateOnlyStrict('21/11/2024');

  assert.ok(data instanceof Date);
  assert.equal(data.getFullYear(), 2024);
  assert.equal(data.getMonth(), 10);
  assert.equal(data.getDate(), 21);
});

test('parseDateOnlyStrict rejeita vazio, null e undefined', () => {
  assert.equal(parseDateOnlyStrict(''), null);
  assert.equal(parseDateOnlyStrict('   '), null);
  assert.equal(parseDateOnlyStrict(null), null);
  assert.equal(parseDateOnlyStrict(undefined), null);
});

test('isValidDateOnly rejeita datas inválidas sem normalização silenciosa', () => {
  assert.equal(isValidDateOnly('2026-02-31'), false);
  assert.equal(isValidDateOnly('31/02/2026'), false);
  assert.equal(isValidDateOnly('2026-13-01'), false);
  assert.equal(isValidDateOnly('2026-01-00'), false);
  assert.equal(isValidDateOnly('00/01/2026'), false);
});

test('normalizeDateOnly converte dd/MM/yyyy para yyyy-MM-dd', () => {
  assert.equal(normalizeDateOnly('21/11/2024'), '2024-11-21');
});

test('normalizeDateOnly preserva yyyy-MM-dd válido', () => {
  assert.equal(normalizeDateOnly('2024-11-21'), '2024-11-21');
});

test('normalizeDateOnly retorna null para entrada inválida', () => {
  assert.equal(normalizeDateOnly('2026-02-31'), null);
});

test('compareDateOnly compara datas civis normalizadas', () => {
  assert.equal(compareDateOnly('2024-11-20', '21/11/2024'), -1);
  assert.equal(compareDateOnly('21/11/2024', '2024-11-21'), 0);
  assert.equal(compareDateOnly('2024-11-22', '21/11/2024'), 1);
  assert.equal(compareDateOnly('2024-11-22', '31/02/2026'), null);
});

test('isBeforeDateOnly retorna true apenas quando a primeira data é anterior', () => {
  assert.equal(isBeforeDateOnly('2024-11-20', '2024-11-21'), true);
  assert.equal(isBeforeDateOnly('2024-11-21', '2024-11-21'), false);
  assert.equal(isBeforeDateOnly('2024-11-22', '2024-11-21'), false);
  assert.equal(isBeforeDateOnly('31/02/2026', '2024-11-21'), false);
});
