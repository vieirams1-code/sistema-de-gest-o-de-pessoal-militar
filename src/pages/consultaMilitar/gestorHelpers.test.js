import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePostoGraduacao, classificarMilitar, ordenarMilitaresAntiguidade } from '../../utils/efetivo/gestorClassificacao.js';

test('resolve posto_graduacao com precedência', () => {
  assert.equal(resolvePostoGraduacao({ posto_graduacao: 'Capitão', posto_grad: 'Soldado' }), 'CAPITÃO');
});

test('classificação institucional', () => {
  assert.equal(classificarMilitar({ quadro: 'QOBM', posto_graduacao: 'Capitão' }), 'oficial');
  assert.equal(classificarMilitar({ quadro: 'QBMP-1', posto_graduacao: '3º Sargento' }), 'praca');
  assert.equal(classificarMilitar({ quadro: 'QPTBM', posto_graduacao: 'Soldado' }), 'temporario');
});

test('ordenação por antiguidade com fallback estável', () => {
  const map = new Map([['2', 1]]);
  const itens = [{ id: '1', nome: 'Bruno', matricula: '20' }, { id: '2', nome: 'Carlos', matricula: '10' }, { id: '3', nome: 'Ana', matricula: '30' }];
  assert.deepEqual(ordenarMilitaresAntiguidade(itens, map).map((m) => m.id), ['2', '3', '1']);
});
