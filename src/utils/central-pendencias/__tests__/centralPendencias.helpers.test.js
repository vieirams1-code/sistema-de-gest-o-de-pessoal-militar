import test from 'node:test';
import assert from 'node:assert/strict';
import { formatarDataSegura } from '../centralPendencias.helpers.js';

test('formatarDataSegura returns "—" for falsy values', () => {
  assert.equal(formatarDataSegura(null), '—');
  assert.equal(formatarDataSegura(undefined), '—');
  assert.equal(formatarDataSegura(''), '—');
});

test('formatarDataSegura formats valid ISO date strings correctly', () => {
  assert.equal(formatarDataSegura('2023-10-27'), '27/10/2023');
  assert.equal(formatarDataSegura('2024-01-01'), '01/01/2024');
});

test('formatarDataSegura handles full ISO strings by slicing to date-only', () => {
  assert.equal(formatarDataSegura('2023-10-27T15:30:00.000Z'), '27/10/2023');
});

test('formatarDataSegura returns "—" for invalid date strings', () => {
  assert.equal(formatarDataSegura('not-a-date'), '—');
  assert.equal(formatarDataSegura('2023-99-99'), '—');
});
