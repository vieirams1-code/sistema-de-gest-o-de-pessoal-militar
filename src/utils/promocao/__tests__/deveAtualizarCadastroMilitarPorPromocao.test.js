import test from 'node:test';
import assert from 'node:assert/strict';

import { deveAtualizarCadastroMilitarPorPromocao } from '../deveAtualizarCadastroMilitarPorPromocao.js';

const base = {
  promocao: { id: 'p1', status: 'publicada', posto_graduacao: 'Capitão', quadro: 'QOPM' },
  item: { id: 'pm1', status: 'publicado', publicado: true, resultado_aplicacao_cadastro: 'imediatamente_superior' },
  historico: { id: 'h1', status_registro: 'ativo' },
  contextoPublicacao: { publicacaoConcluida: true, promocaoId: 'p1', itemId: 'pm1' },
};

test('publicação válida atualiza Militar', () => {
  assert.equal(deveAtualizarCadastroMilitarPorPromocao(base), true);
});

test('promoção em rascunho não atualiza Militar', () => {
  assert.equal(deveAtualizarCadastroMilitarPorPromocao({ ...base, promocao: { ...base.promocao, status: 'rascunho' } }), false);
});

test('PromocaoMilitar salvo/alterado não atualiza Militar', () => {
  assert.equal(deveAtualizarCadastroMilitarPorPromocao({ ...base, item: { ...base.item, status: 'elegivel', publicado: false } }), false);
});

test('histórico V2 sem status ativo não atualiza Militar', () => {
  assert.equal(deveAtualizarCadastroMilitarPorPromocao({ ...base, historico: { id: 'h1', status_registro: 'cancelado' } }), false);
});

test('regra diferente de imediatamente_superior não atualiza Militar', () => {
  assert.equal(deveAtualizarCadastroMilitarPorPromocao({ ...base, item: { ...base.item, resultado_aplicacao_cadastro: 'revisao' } }), false);
});

test('contexto divergente bloqueia atualização de Militar', () => {
  assert.equal(deveAtualizarCadastroMilitarPorPromocao({ ...base, contextoPublicacao: { ...base.contextoPublicacao, itemId: 'outro' } }), false);
});
