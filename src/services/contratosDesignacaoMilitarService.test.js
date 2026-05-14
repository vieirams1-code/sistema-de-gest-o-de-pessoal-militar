import test from 'node:test';
import assert from 'node:assert/strict';

import { derivarDataBaseFeriasDaDataInicio, normalizarDataIsoDateOnly } from './contratosDesignacaoMilitarService.js';

test('normalizarDataIsoDateOnly converte datas visuais BR para ISO preservando dia, mês e ano', () => {
  assert.equal(normalizarDataIsoDateOnly('09/10/2017'), '2017-10-09');
  assert.equal(normalizarDataIsoDateOnly('01/01/2024'), '2024-01-01');
  assert.equal(normalizarDataIsoDateOnly('31/12/2025'), '2025-12-31');
});

test('normalizarDataIsoDateOnly preserva datas ISO date-only', () => {
  assert.equal(normalizarDataIsoDateOnly('2017-10-09'), '2017-10-09');
  assert.equal(normalizarDataIsoDateOnly('2024-01-01'), '2024-01-01');
  assert.equal(normalizarDataIsoDateOnly('2025-12-31'), '2025-12-31');
});

test('normalizarDataIsoDateOnly rejeita datas visuais BR inválidas sem converter para anos incorretos', () => {
  assert.equal(normalizarDataIsoDateOnly('31/02/2025'), '');
});

test('derivarDataBaseFeriasDaDataInicio preserva ano, mês e dia da data de início ISO', () => {
  assert.equal(derivarDataBaseFeriasDaDataInicio('2026-05-14'), '2026-05-14');
});

test('derivarDataBaseFeriasDaDataInicio não troca o ano em datas próximas ao início ou fim do ano', () => {
  assert.equal(derivarDataBaseFeriasDaDataInicio('2026-01-01'), '2026-01-01');
  assert.equal(derivarDataBaseFeriasDaDataInicio('2026-12-31'), '2026-12-31');
});
