import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularDiasDireitoAposReversao,
  deveAplicarReversaoDesconto,
  feriasBloqueiaReversao,
  publicacaoEstaPublicada,
} from '../descontoFeriasReversaoUtils.js';

test('reversão é idempotente quando desconto já foi revertido', () => {
  assert.equal(deveAplicarReversaoDesconto({ status: 'revertido', saldo_aplicado: false }), false);
  assert.equal(deveAplicarReversaoDesconto({ status: 'ativo', saldo_aplicado: false }), false);
  assert.equal(deveAplicarReversaoDesconto({ status: 'ativo', saldo_aplicado: true }), true);
});

test('cálculo de restituição soma os dias somente no caminho aplicável', () => {
  assert.deepEqual(calcularDiasDireitoAposReversao({ dias_direito: 22 }, { dias: 8 }), { atual: 22, dias: 8, novo: 30 });
});

test('publicação publicada aceita status Publicado ou BG/data completos', () => {
  assert.equal(publicacaoEstaPublicada({ status: 'Publicado' }), true);
  assert.equal(publicacaoEstaPublicada({ numero_bg: '123', data_bg: '2026-06-25' }), true);
  assert.equal(publicacaoEstaPublicada({ numero_bg: '123' }), false);
});

test('status encerrados de férias bloqueiam reversão', () => {
  assert.equal(feriasBloqueiaReversao({ status: 'Gozada' }), true);
  assert.equal(feriasBloqueiaReversao({ status: 'Autorizada' }), false);
});
