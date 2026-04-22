import test from 'node:test';
import assert from 'node:assert/strict';

import {
  criarPayloadCreditoExtraFerias,
  calcularTotaisGozoComCreditos,
  validarCreditosSelecionadosParaGozo,
  STATUS_CREDITO_EXTRA_FERIAS,
  TIPOS_CREDITO_EXTRA_FERIAS,
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
