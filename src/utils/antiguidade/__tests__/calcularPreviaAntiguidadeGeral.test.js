import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ALERTAS_PREVIA_ANTIGUIDADE_GERAL,
  PENDENCIAS_PREVIA_ANTIGUIDADE_GERAL,
  calcularPreviaAntiguidadeGeral,
} from '../calcularPreviaAntiguidadeGeral.js';

const militar = (id, overrides = {}) => ({
  id,
  nome: `Militar ${id}`,
  matricula: String(id).padStart(3, '0'),
  posto_graduacao: 'Capitão',
  quadro: 'QOBM',
  status: 'ativo',
  ...overrides,
});

const promocao = (id, militarId, overrides = {}) => ({
  id,
  militar_id: militarId,
  status_registro: 'ativo',
  posto_graduacao_novo: 'Capitão',
  quadro_novo: 'QOBM',
  data_promocao: '2020-01-01',
  antiguidade_referencia_ordem: 1,
  antiguidade_referencia_id: `ref-${id}`,
  ...overrides,
});

test('ordena dois militares do mesmo posto/quadro por data de promoção', () => {
  const resultado = calcularPreviaAntiguidadeGeral({
    militares: [militar('2'), militar('1')],
    historicoPromocoes: [
      promocao('p2', '2', { data_promocao: '2021-01-01' }),
      promocao('p1', '1', { data_promocao: '2020-01-01' }),
    ],
  });

  assert.deepEqual(resultado.itens.map((item) => item.militar_id), ['1', '2']);
});

test('ordena dois militares da mesma data por antiguidade_referencia_ordem', () => {
  const resultado = calcularPreviaAntiguidadeGeral({
    militares: [militar('1'), militar('2')],
    historicoPromocoes: [
      promocao('p1', '1', { data_promocao: '2020-01-01', antiguidade_referencia_ordem: 2 }),
      promocao('p2', '2', { data_promocao: '2020-01-01', antiguidade_referencia_ordem: 1 }),
    ],
  });

  assert.deepEqual(resultado.itens.map((item) => item.militar_id), ['2', '1']);
});

test('ignora registro previsto e gera apenas alerta informativo', () => {
  const resultado = calcularPreviaAntiguidadeGeral({
    militares: [militar('1')],
    historicoPromocoes: [
      promocao('prevista', '1', { status_registro: 'previsto', data_promocao: '2030-01-01' }),
      promocao('ativa', '1', { data_promocao: '2020-01-01' }),
    ],
  });

  assert.equal(resultado.itens[0].registroPromocaoAtualId, 'ativa');
  assert.equal(resultado.itens[0].data_promocao, '2020-01-01');
  assert.ok(resultado.itens[0].alertas.includes(ALERTAS_PREVIA_ANTIGUIDADE_GERAL.REGISTRO_PREVISTO_IGNORADO));
});

test('ignora registros cancelados e retificados no cálculo da promoção atual', () => {
  const resultado = calcularPreviaAntiguidadeGeral({
    militares: [militar('1')],
    historicoPromocoes: [
      promocao('cancelada', '1', { status_registro: 'cancelado', data_promocao: '2022-01-01' }),
      promocao('retificada', '1', { status_registro: 'retificado', data_promocao: '2021-01-01' }),
      promocao('ativa', '1', { data_promocao: '2020-01-01' }),
    ],
  });

  assert.equal(resultado.itens[0].registroPromocaoAtualId, 'ativa');
  assert.ok(resultado.itens[0].alertas.includes(ALERTAS_PREVIA_ANTIGUIDADE_GERAL.REGISTRO_CANCELADO_IGNORADO));
  assert.ok(resultado.itens[0].alertas.includes(ALERTAS_PREVIA_ANTIGUIDADE_GERAL.REGISTRO_RETIFICADO_IGNORADO));
});

test('gera pendência quando não houver promoção atual ativa', () => {
  const resultado = calcularPreviaAntiguidadeGeral({
    militares: [militar('1')],
    historicoPromocoes: [],
  });

  assert.equal(resultado.itens[0].registroPromocaoAtualId, null);
  assert.ok(resultado.itens[0].pendencias.includes(PENDENCIAS_PREVIA_ANTIGUIDADE_GERAL.SEM_PROMOCAO_ATUAL_ATIVA));
});

test('normaliza QBMPT para QPTBM', () => {
  const resultado = calcularPreviaAntiguidadeGeral({
    militares: [militar('1', { quadro: 'QBMPT', posto_graduacao: 'Soldado' })],
    historicoPromocoes: [
      promocao('ativa', '1', { posto_graduacao_novo: 'SD', quadro_novo: 'QPTBM' }),
    ],
  });

  assert.equal(resultado.itens[0].criterioOrdenacao.quadroNormalizado, 'QPTBM');
  assert.ok(resultado.itens[0].alertas.includes(ALERTAS_PREVIA_ANTIGUIDADE_GERAL.QUADRO_NORMALIZADO));
});
