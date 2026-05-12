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

test('agrupa QBMP-1.a e QBMP-1.b no mesmo grupo e índice de antiguidade', () => {
  const resultado = calcularPreviaAntiguidadeGeral({
    militares: [
      militar('1', { posto_graduacao: 'Soldado', quadro: 'QBMP-1.a' }),
      militar('2', { posto_graduacao: 'Soldado', quadro: 'QBMP-1.b' }),
    ],
    historicoPromocoes: [
      promocao('p1', '1', { posto_graduacao_novo: 'Soldado', quadro_novo: 'QBMP-1.a' }),
      promocao('p2', '2', { posto_graduacao_novo: 'Soldado', quadro_novo: 'QBMP-1.b' }),
    ],
  });

  const [primeiro, segundo] = resultado.itens;
  assert.equal(primeiro.criterioOrdenacao.grupoAntiguidadeQuadro, 'QBMP');
  assert.equal(segundo.criterioOrdenacao.grupoAntiguidadeQuadro, 'QBMP');
  assert.equal(primeiro.criterioOrdenacao.quadroIndice, segundo.criterioOrdenacao.quadroIndice);
});

test('agrupa QBMP-1.a e QBMP-2 no mesmo grupo e índice de antiguidade', () => {
  const resultado = calcularPreviaAntiguidadeGeral({
    militares: [
      militar('1', { posto_graduacao: 'Soldado', quadro: 'QBMP-1.a' }),
      militar('2', { posto_graduacao: 'Soldado', quadro: 'QBMP-2' }),
    ],
    historicoPromocoes: [
      promocao('p1', '1', { posto_graduacao_novo: 'Soldado', quadro_novo: 'QBMP-1.a' }),
      promocao('p2', '2', { posto_graduacao_novo: 'Soldado', quadro_novo: 'QBMP-2' }),
    ],
  });

  const [primeiro, segundo] = resultado.itens;
  assert.equal(primeiro.criterioOrdenacao.grupoAntiguidadeQuadro, 'QBMP');
  assert.equal(segundo.criterioOrdenacao.grupoAntiguidadeQuadro, 'QBMP');
  assert.equal(primeiro.criterioOrdenacao.quadroIndice, segundo.criterioOrdenacao.quadroIndice);
});

test('ordena militares do mesmo posto e grupo QBMP por data antes do quadro original', () => {
  const resultado = calcularPreviaAntiguidadeGeral({
    militares: [
      militar('1', { posto_graduacao: 'Soldado', quadro: 'QBMP-1.a' }),
      militar('2', { posto_graduacao: 'Soldado', quadro: 'QBMP-2' }),
    ],
    historicoPromocoes: [
      promocao('p1', '1', { posto_graduacao_novo: 'Soldado', quadro_novo: 'QBMP-1.a', data_promocao: '2021-01-01' }),
      promocao('p2', '2', { posto_graduacao_novo: 'Soldado', quadro_novo: 'QBMP-2', data_promocao: '2020-01-01' }),
    ],
  });

  assert.deepEqual(resultado.itens.map((item) => item.militar_id), ['2', '1']);
});

test('ordena militares do mesmo posto, grupo QBMP e data por ordem antes do quadro original', () => {
  const resultado = calcularPreviaAntiguidadeGeral({
    militares: [
      militar('1', { posto_graduacao: 'Soldado', quadro: 'QBMP-1.a' }),
      militar('2', { posto_graduacao: 'Soldado', quadro: 'QBMP-2' }),
    ],
    historicoPromocoes: [
      promocao('p1', '1', {
        posto_graduacao_novo: 'Soldado',
        quadro_novo: 'QBMP-1.a',
        data_promocao: '2020-01-01',
        antiguidade_referencia_ordem: 2,
      }),
      promocao('p2', '2', {
        posto_graduacao_novo: 'Soldado',
        quadro_novo: 'QBMP-2',
        data_promocao: '2020-01-01',
        antiguidade_referencia_ordem: 1,
      }),
    ],
  });

  assert.deepEqual(resultado.itens.map((item) => item.militar_id), ['2', '1']);
});

test('preserva item.quadro original e expõe critério de antiguidade auditável', () => {
  const resultado = calcularPreviaAntiguidadeGeral({
    militares: [militar('1', { posto_graduacao: 'Soldado', quadro: 'QBMP-1.a' })],
    historicoPromocoes: [
      promocao('p1', '1', { posto_graduacao_novo: 'Soldado', quadro_novo: 'QBMP-1.a' }),
    ],
  });

  const item = resultado.itens[0];
  assert.equal(item.quadro, 'QBMP-1.a');
  assert.equal(item.criterioOrdenacao.quadroOriginal, 'QBMP-1.a');
  assert.equal(item.criterioOrdenacao.quadroNormalizado, 'QBMP-1.A');
  assert.equal(item.criterioOrdenacao.grupoAntiguidadeQuadro, 'QBMP');
  assert.equal(item.criterioOrdenacao.quadroIndice, 4);
  assert.equal(item.criterioOrdenacao.quadroConhecidoNaAntiguidade, true);
  assert.equal(item.criterioOrdenacao.quadroFoiAgrupadoParaAntiguidade, true);
  assert.equal(item.criterioOrdenacao.quadroFoiNormalizadoParaAntiguidade, false);
});

test('quadro fora dos grupos de antiguidade gera alerta e mantém item no retorno com índice infinito', () => {
  const resultado = calcularPreviaAntiguidadeGeral({
    militares: [militar('1', { quadro: 'QUADRO-X' })],
    historicoPromocoes: [
      promocao('p1', '1', { quadro_novo: 'QUADRO-X' }),
    ],
  });

  const item = resultado.itens[0];
  assert.equal(item.militar_id, '1');
  assert.equal(item.criterioOrdenacao.quadroIndice, Number.POSITIVE_INFINITY);
  assert.ok(item.alertas.includes(ALERTAS_PREVIA_ANTIGUIDADE_GERAL.QUADRO_FORA_DOS_GRUPOS_ANTIGUIDADE));
  assert.ok(item.pendencias.includes(PENDENCIAS_PREVIA_ANTIGUIDADE_GERAL.QUADRO_FORA_DA_ORDEM));
});

const ordemQuadrosInvertida = [
  { nome_grupo: 'QAOBM', indice: 0, membros_reais: ['QAOBM'], ativo: true },
  { nome_grupo: 'QOBM', indice: 1, membros_reais: ['QOBM'], ativo: true },
  { nome_grupo: 'QPTBM', indice: 2, membros_reais: ['QPTBM', 'QBMPT'], ativo: true },
];

test('sem config mantém fallback estático de precedência entre quadros', () => {
  const resultado = calcularPreviaAntiguidadeGeral({
    militares: [
      militar('qaobm', { quadro: 'QAOBM' }),
      militar('qobm', { quadro: 'QOBM' }),
    ],
    historicoPromocoes: [
      promocao('p-qaobm', 'qaobm', { quadro_novo: 'QAOBM' }),
      promocao('p-qobm', 'qobm', { quadro_novo: 'QOBM' }),
    ],
  });

  assert.deepEqual(resultado.itens.map((item) => item.militar_id), ['qobm', 'qaobm']);
  assert.deepEqual(resultado.itens.map((item) => item.criterioOrdenacao.quadroIndice), [0, 1]);
});

test('config.ordemQuadrosAntiguidade injetada altera precedência entre dois quadros', () => {
  const resultado = calcularPreviaAntiguidadeGeral({
    militares: [
      militar('qaobm', { quadro: 'QAOBM' }),
      militar('qobm', { quadro: 'QOBM' }),
    ],
    historicoPromocoes: [
      promocao('p-qaobm', 'qaobm', { quadro_novo: 'QAOBM' }),
      promocao('p-qobm', 'qobm', { quadro_novo: 'QOBM' }),
    ],
    config: { ordemQuadrosAntiguidade: ordemQuadrosInvertida },
  });

  assert.deepEqual(resultado.itens.map((item) => item.militar_id), ['qaobm', 'qobm']);
  assert.deepEqual(resultado.itens.map((item) => item.criterioOrdenacao.quadroIndice), [0, 1]);
});

test('config inválida retorna ao fallback estático', () => {
  const resultado = calcularPreviaAntiguidadeGeral({
    militares: [
      militar('qaobm', { quadro: 'QAOBM' }),
      militar('qobm', { quadro: 'QOBM' }),
    ],
    historicoPromocoes: [
      promocao('p-qaobm', 'qaobm', { quadro_novo: 'QAOBM' }),
      promocao('p-qobm', 'qobm', { quadro_novo: 'QOBM' }),
    ],
    config: { ordem_quadros: 'estrutura inválida' },
  });

  assert.deepEqual(resultado.itens.map((item) => item.militar_id), ['qobm', 'qaobm']);
  assert.deepEqual(resultado.itens.map((item) => item.criterioOrdenacao.quadroIndice), [0, 1]);
});

test('grupos inativos e membros vazios são ignorados na ordem injetada', () => {
  const resultado = calcularPreviaAntiguidadeGeral({
    militares: [
      militar('qaobm', { quadro: 'QAOBM' }),
      militar('qobm', { quadro: 'QOBM' }),
    ],
    historicoPromocoes: [
      promocao('p-qaobm', 'qaobm', { quadro_novo: 'QAOBM' }),
      promocao('p-qobm', 'qobm', { quadro_novo: 'QOBM' }),
    ],
    config: {
      ordemQuadrosAntiguidade: [
        { nome_grupo: 'QAOBM', indice: 0, membros_reais: ['QAOBM'], ativo: false },
        { nome_grupo: 'VAZIO', indice: 1, membros_reais: ['', null, undefined], ativo: true },
        { nome_grupo: 'QOBM', indice: 2, membros: ['QOBM'], ativo: true },
      ],
    },
  });

  assert.deepEqual(resultado.itens.map((item) => item.militar_id), ['qobm', 'qaobm']);
  assert.equal(resultado.itens[0].criterioOrdenacao.quadroIndice, 2);
  assert.equal(resultado.itens[1].criterioOrdenacao.quadroIndice, Number.POSITIVE_INFINITY);
  assert.ok(resultado.itens[1].pendencias.includes(PENDENCIAS_PREVIA_ANTIGUIDADE_GERAL.QUADRO_FORA_DA_ORDEM));
});

test('aliases e quadros legados continuam tratados na ordem injetada', () => {
  const resultado = calcularPreviaAntiguidadeGeral({
    militares: [militar('qbmpt', { quadro: 'QBMPT', posto_graduacao: 'Soldado' })],
    historicoPromocoes: [
      promocao('p-qbmpt', 'qbmpt', { posto_graduacao_novo: 'SD', quadro_novo: 'QPTBM' }),
    ],
    config: { ordemQuadrosAntiguidade: ordemQuadrosInvertida },
  });

  const item = resultado.itens[0];
  assert.equal(item.criterioOrdenacao.quadroNormalizado, 'QPTBM');
  assert.equal(item.criterioOrdenacao.grupoAntiguidadeQuadro, 'QPTBM');
  assert.equal(item.criterioOrdenacao.quadroIndice, 2);
  assert.ok(item.alertas.includes(ALERTAS_PREVIA_ANTIGUIDADE_GERAL.QUADRO_NORMALIZADO));
});
