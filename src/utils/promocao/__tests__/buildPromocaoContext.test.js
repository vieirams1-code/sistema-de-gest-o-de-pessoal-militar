import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPromocaoContext } from '../buildPromocaoContext.js';

const TODAY = new Date().toISOString().slice(0, 10);
const FUTURE = '2099-01-01';

function basePromocao(overrides = {}) {
  return {
    posto_graduacao: '3º SGT',
    quadro: 'QPPM',
    status: 'rascunho',
    data_promocao: TODAY,
    ...overrides,
  };
}

test('3º Sgt rascunho: início de cadeia com edição manual e sem ordenar', () => {
  const ctx = buildPromocaoContext(basePromocao({ posto_graduacao: '3º SGT', status: 'rascunho' }));
  assert.equal(ctx.promocaoInicio, true);
  assert.equal(ctx.permiteEdicaoOrdem, true);
  assert.equal(ctx.permiteOrdenacao, false);
});

test('3º Sgt salvo/publicado: mantém início de cadeia e botão ordenar oculto', () => {
  const ctx = buildPromocaoContext(basePromocao({ posto_graduacao: '3º SGT', status: 'publicado', publicado: true }));
  assert.equal(ctx.promocaoInicio, true);
  assert.equal(ctx.permiteEdicaoOrdem, true);
  assert.equal(ctx.permiteOrdenacao, false);
  assert.equal(ctx.statusHistorico, 'publicado');
});

test('Cabo publicado: início de cadeia com ordem manual', () => {
  const ctx = buildPromocaoContext(basePromocao({ posto_graduacao: 'CB', status: 'publicado', publicado: true }));
  assert.equal(ctx.promocaoInicio, true);
  assert.equal(ctx.permiteEdicaoOrdem, true);
  assert.equal(ctx.permiteOrdenacao, false);
});

test('2º Sgt histórica: sucessiva sem edição manual e com ordenar', () => {
  const ctx = buildPromocaoContext(basePromocao({ posto_graduacao: '2º SGT', data_promocao: '2000-01-01' }));
  assert.equal(ctx.promocaoSucessiva, true);
  assert.equal(ctx.permiteEdicaoOrdem, false);
  assert.equal(ctx.permiteOrdenacao, true);
  assert.equal(ctx.statusOperacional, 'historica');
});

test('2º Sgt futura: sucessiva sem edição manual e com ordenar', () => {
  const ctx = buildPromocaoContext(basePromocao({ posto_graduacao: '2º SGT', data_promocao: FUTURE }));
  assert.equal(ctx.promocaoSucessiva, true);
  assert.equal(ctx.permiteEdicaoOrdem, false);
  assert.equal(ctx.permiteOrdenacao, true);
  assert.equal(ctx.statusOperacional, 'futura');
});

test('item cancelado reflete status histórico/operacional cancelado', () => {
  const ctx = buildPromocaoContext(basePromocao({ status: 'cancelado' }));
  assert.equal(ctx.statusHistorico, 'cancelado');
  assert.equal(ctx.statusOperacional, 'cancelado');
});

test('item publicado reflete status histórico publicado', () => {
  const ctx = buildPromocaoContext(basePromocao({ status: 'publicado', publicado: true }));
  assert.equal(ctx.statusHistorico, 'publicado');
});
