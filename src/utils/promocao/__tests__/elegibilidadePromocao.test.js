import test from 'node:test';
import assert from 'node:assert/strict';

import { getPostoOrigemEsperado, isPromocaoSubtenenteParaSegundoTenenteQAOBM } from '../elegibilidadePromocao.js';

test('promoção 2º Tenente QAOBM ativa regra especial ST -> 2º Ten', () => {
  const promocao = { posto_graduacao: '2º Ten', quadro: 'QAOBM' };
  assert.equal(isPromocaoSubtenenteParaSegundoTenenteQAOBM(promocao), true);
  assert.equal(getPostoOrigemEsperado(promocao), 'Subtenente');
});

test('promoção comum 2º Sgt não usa regra especial', () => {
  const promocao = { posto_graduacao: '2º Sgt', quadro: 'QPPM' };
  assert.equal(isPromocaoSubtenenteParaSegundoTenenteQAOBM(promocao), false);
  assert.equal(getPostoOrigemEsperado(promocao), '');
});
