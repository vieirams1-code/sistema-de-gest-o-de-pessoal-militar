import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canonicalDateToBR,
  normalizeLegacyDateToCanonical,
} from '../dateNormalization.js';

test('normalizeLegacyDateToCanonical normaliza datas legadas para yyyy-mm-dd', () => {
  assert.equal(normalizeLegacyDateToCanonical('21/04/2015'), '2015-04-21');
  assert.equal(normalizeLegacyDateToCanonical('2015-04-21'), '2015-04-21');
  assert.equal(normalizeLegacyDateToCanonical('2020-03-10T12:45:00.000Z'), '2020-03-10');
});

test('canonicalDateToBR sempre exibe em dd/mm/aaaa', () => {
  assert.equal(canonicalDateToBR('2015-04-21'), '21/04/2015');
});

test('normalizeLegacyDateToCanonical rejeita data absurda ou inválida', () => {
  assert.equal(normalizeLegacyDateToCanonical('56771-03-27'), '');
  assert.equal(normalizeLegacyDateToCanonical('31/02/2024'), '');
});
