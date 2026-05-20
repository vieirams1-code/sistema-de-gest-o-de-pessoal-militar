import test from 'node:test';
import assert from 'node:assert/strict';

import { calcularFoiApostilada, montarPayloadOriginalApostilada } from '../apostilaUtils.js';

test('calcularFoiApostilada considera campos da original quando há vínculo ativo', () => {
  const raiz = { id: 'orig-1', foi_apostilada: true, apostilada_por_id: 'ap-1' };
  const tsesPorApostila = [{ apostila: { id: 'ap-1' }, tse: null }];
  assert.equal(calcularFoiApostilada({ raiz, apostilas: [], tsesPorApostila }), true);
});

test('calcularFoiApostilada desmarca quando apostila de referência foi tornada sem efeito', () => {
  const raiz = { id: 'orig-1', foi_apostilada: true, apostilada_por_id: 'ap-1' };
  const tsesPorApostila = [{ apostila: { id: 'ap-1' }, tse: { id: 'tse-1' } }];
  assert.equal(calcularFoiApostilada({ raiz, apostilas: [], tsesPorApostila }), false);
});

test('montarPayloadOriginalApostilada gera update esperado da publicação original', () => {
  assert.deepEqual(montarPayloadOriginalApostilada('ap-55'), {
    apostilada_por_id: 'ap-55',
    foi_apostilada: true,
  });
});
