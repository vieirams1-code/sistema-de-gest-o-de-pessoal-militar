import test from 'node:test';
import assert from 'node:assert/strict';

import {
  criarPayloadCreditoExtraFerias,
  calcularTotaisGozoComCreditos,
  validarCreditosSelecionadosParaGozo,
  STATUS_CREDITO_EXTRA_FERIAS,
  TIPOS_CREDITO_EXTRA_FERIAS,
  filtrarCreditosExtraFerias,
  prepararAtualizacaoCreditoExtraFerias,
  prepararCancelamentoCreditoExtraFerias,
} from '../creditoExtraFeriasRules.js';

test('cria payload de crédito extraordinário com defaults', () => {
  const payload = criarPayloadCreditoExtraFerias(
    {
      tipo_credito: TIPOS_CREDITO_EXTRA_FERIAS.DOACAO_SANGUE,
      quantidade_dias: 1,
      data_referencia: '2026-04-22',
    },
    {
      id: 'm1',
      nome_completo: 'Fulano',
      posto_grad: 'ST',
      matricula: '123',
    },
  );

  assert.equal(payload.militar_id, 'm1');
  assert.equal(payload.tipo_credito, 'DOACAO_SANGUE');
  assert.equal(payload.quantidade_dias, 1);
  assert.equal(payload.status, STATUS_CREDITO_EXTRA_FERIAS.DISPONIVEL);
});

test('calcula dias base + extras + total no gozo', () => {
  const totais = calcularTotaisGozoComCreditos({
    diasBase: 10,
    creditos: [{ quantidade_dias: 1 }, { quantidade_dias: 2 }],
  });

  assert.deepEqual(totais, {
    dias_base_gozo: 10,
    dias_extras_creditos: 3,
    dias_totais_gozo: 13,
  });
});

test('bloqueia reutilização de crédito já usado', () => {
  assert.throws(() => {
    validarCreditosSelecionadosParaGozo({
      militarId: 'm1',
      gozoFeriasId: 'g2',
      idsSelecionados: ['c1'],
      creditos: [
        {
          id: 'c1',
          militar_id: 'm1',
          status: STATUS_CREDITO_EXTRA_FERIAS.USADO,
          gozo_ferias_id: 'g1',
        },
      ],
    });
  }, /já utilizado/);
});

test('bloqueia vínculo de crédito cancelado', () => {
  assert.throws(() => {
    validarCreditosSelecionadosParaGozo({
      militarId: 'm1',
      idsSelecionados: ['c1'],
      creditos: [
        {
          id: 'c1',
          militar_id: 'm1',
          status: STATUS_CREDITO_EXTRA_FERIAS.CANCELADO,
        },
      ],
    });
  }, /cancelado/);
});

test('retorna créditos válidos para vínculo no resumo/histórico', () => {
  const selecionados = validarCreditosSelecionadosParaGozo({
    militarId: 'm1',
    gozoFeriasId: 'g1',
    idsSelecionados: ['c1'],
    creditos: [
      {
        id: 'c1',
        militar_id: 'm1',
        status: STATUS_CREDITO_EXTRA_FERIAS.DISPONIVEL,
        tipo_credito: TIPOS_CREDITO_EXTRA_FERIAS.RECOMPENSA,
        quantidade_dias: 1,
      },
    ],
  });

  assert.equal(selecionados.length, 1);
  assert.equal(selecionados[0].tipo_credito, 'RECOMPENSA');
});

test('mantém gozo_ferias_id vazio como string para evitar falha de persistência', () => {
  const payload = criarPayloadCreditoExtraFerias({
    militar_id: 'm1',
    tipo_credito: TIPOS_CREDITO_EXTRA_FERIAS.OUTRO,
    quantidade_dias: 2,
    data_referencia: '2026-04-22',
  });

  assert.equal(payload.gozo_ferias_id, '');
});

test('filtra créditos por militar, status e período', () => {
  const creditos = [
    { id: 'c1', militar_id: 'm1', status: 'DISPONIVEL', tipo_credito: 'OUTRO', data_referencia: '2026-01-10' },
    { id: 'c2', militar_id: 'm2', status: 'CANCELADO', tipo_credito: 'RECOMPENSA', data_referencia: '2026-03-10' },
    { id: 'c3', militar_id: 'm1', status: 'USADO', tipo_credito: 'RECOMPENSA', data_referencia: '2026-03-15' },
  ];

  const filtrados = filtrarCreditosExtraFerias(creditos, {
    militar_id: 'm1',
    status: 'USADO',
    data_inicio: '2026-03-01',
    data_fim: '2026-03-31',
  });

  assert.equal(filtrados.length, 1);
  assert.equal(filtrados[0].id, 'c3');
});


test('prepara atualização de crédito existente', () => {
  const atualizado = prepararAtualizacaoCreditoExtraFerias(
    { id: 'c1', quantidade_dias: 1, status: 'DISPONIVEL', gozo_ferias_id: '' },
    { quantidade_dias: 5, status: 'VINCULADO', gozo_ferias_id: 'g1' },
  );

  assert.equal(atualizado.quantidade_dias, 5);
  assert.equal(atualizado.status, 'VINCULADO');
  assert.equal(atualizado.gozo_ferias_id, 'g1');
});

test('prepara cancelamento com observação preservando histórico', () => {
  const cancelado = prepararCancelamentoCreditoExtraFerias(
    { id: 'c1', status: 'DISPONIVEL', observacoes: 'criado via teste' },
    'cancelado pelo operador',
  );

  assert.equal(cancelado.status, STATUS_CREDITO_EXTRA_FERIAS.CANCELADO);
  assert.match(cancelado.observacoes, /criado via teste/);
  assert.match(cancelado.observacoes, /cancelado pelo operador/);
});
