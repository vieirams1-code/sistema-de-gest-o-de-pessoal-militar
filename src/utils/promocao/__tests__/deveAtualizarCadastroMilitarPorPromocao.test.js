import test from 'node:test';
import assert from 'node:assert/strict';

import { deveAtualizarCadastroMilitarPorPromocao } from '../deveAtualizarCadastroMilitarPorPromocao.js';

const base = {
  promocao: { id: 'p1', status: 'publicada', posto_graduacao: 'Capitão', quadro: 'QOPM' },
  item: { id: 'pm1', status: 'publicado', publicado: true, resultado_aplicacao_cadastro: 'revisao' },
  historico: { id: 'h1', status_registro: 'ativo', posto_graduacao_novo: 'Capitão', quadro_novo: 'QOPM' },
  contextoPublicacao: { publicacaoConcluida: true, promocaoId: 'p1', itemId: 'pm1' },
};

test('publicação válida atualiza Militar', () => {
  assert.deepEqual(deveAtualizarCadastroMilitarPorPromocao(base), { permitido: true, motivo: 'permitido' });
});

test('promoção em rascunho não atualiza Militar', () => {
  assert.deepEqual(deveAtualizarCadastroMilitarPorPromocao({ ...base, promocao: { ...base.promocao, status: 'rascunho' } }), { permitido: false, motivo: 'nao_publicado' });
});

test('PromocaoMilitar salvo/alterado não atualiza Militar', () => {
  assert.deepEqual(deveAtualizarCadastroMilitarPorPromocao({ ...base, item: { ...base.item, status: 'elegivel', publicado: false } }), { permitido: false, motivo: 'estado_invalido' });
});

test('histórico V2 sem status ativo não atualiza Militar', () => {
  assert.deepEqual(deveAtualizarCadastroMilitarPorPromocao({ ...base, historico: { id: 'h1', status_registro: 'cancelado' } }), { permitido: false, motivo: 'sem_historico_ativo' });
});

test('histórico ativo sem posto/quadro novo válido não atualiza Militar', () => {
  assert.deepEqual(deveAtualizarCadastroMilitarPorPromocao({ ...base, historico: { ...base.historico, posto_graduacao_novo: '' } }), { permitido: false, motivo: 'historico_invalido' });
});

test('contexto divergente bloqueia atualização de Militar', () => {
  assert.deepEqual(deveAtualizarCadastroMilitarPorPromocao({ ...base, contextoPublicacao: { ...base.contextoPublicacao, itemId: 'outro' } }), { permitido: false, motivo: 'contexto_invalido' });
});
