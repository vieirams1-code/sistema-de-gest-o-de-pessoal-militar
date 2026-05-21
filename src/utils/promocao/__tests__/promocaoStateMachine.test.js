import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canEditarOrdem,
  canExcluirDefinitivo,
  canRemoverDaTurma,
  canReverterItem,
} from '../promocaoStateMachine.js';

test('rascunho com item não publicado permite remover', () => {
  assert.equal(canRemoverDaTurma({ status: 'ativo', publicado: false }, { promocao: { status: 'rascunho' }, itens: [] }), true);
});

test('item publicado bloqueia remover', () => {
  assert.equal(canRemoverDaTurma({ status: 'publicado', publicado: true }, { promocao: { status: 'rascunho' }, itens: [] }), false);
});

test('item publicado permite reverter', () => {
  assert.equal(canReverterItem({ status: 'publicado', publicado: true }, { isAdmin: true }), true);
});

test('item cancelado permite exclusão definitiva', () => {
  assert.equal(canExcluirDefinitivo({ status: 'cancelado', publicado: false }, { isAdmin: true }), true);
});

test('item retificado/cancelado não permite edição de ordem', () => {
  const contexto = { promocaoContext: { permiteEdicaoOrdem: true } };
  assert.equal(canEditarOrdem({ status: 'retificado', publicado: false }, contexto), false);
  assert.equal(canEditarOrdem({ status: 'cancelado', publicado: false }, contexto), false);
});

test('3º Sgt em rascunho mantém ordem editável', () => {
  const contexto = {
    promocao: { posto_graduacao: '3º SGT', status: 'rascunho' },
    promocaoContext: { permiteEdicaoOrdem: true, promocaoSucessiva: false, promocaoInicio: true },
  };
  assert.equal(canEditarOrdem({ status: 'ativo', publicado: false }, contexto), true);
});

test('2º Sgt sucessiva mantém ordem manual bloqueada', () => {
  const contexto = {
    promocao: { posto_graduacao: '2º SGT', status: 'rascunho' },
    promocaoContext: { permiteEdicaoOrdem: false, promocaoSucessiva: true },
  };
  assert.equal(canEditarOrdem({ status: 'ativo', publicado: false }, contexto), false);
});

test('promoção inicial não permite editar ordem em item publicado ou com histórico V2 ativo', () => {
  const contexto = {
    promocaoContext: { permiteEdicaoOrdem: true, promocaoInicio: true, promocaoSucessiva: false },
  };
  assert.equal(canEditarOrdem({ status: 'publicado', publicado: true }, contexto), false);
  assert.equal(canEditarOrdem({ status: 'elegivel', publicado: false, historico_promocao_v2_id: 'h1' }, contexto), false);
});

test('promoção inicial mantém edição para status elegível/rascunho/selecionado', () => {
  const contexto = {
    promocaoContext: { permiteEdicaoOrdem: true, promocaoInicio: true, promocaoSucessiva: false },
  };
  assert.equal(canEditarOrdem({ status: 'elegivel', publicado: false }, contexto), true);
  assert.equal(canEditarOrdem({ status: 'rascunho', publicado: false }, contexto), true);
  assert.equal(canEditarOrdem({ status: 'selecionado', publicado: false }, contexto), true);
});
