import test from 'node:test';
import assert from 'node:assert/strict';

import {
  aplicarRenovacaoContrato,
  calcularStatusContratoTemporario,
  criarHistoricoContrato,
  encerrarContratoTemporario,
  montarCardsContratosTemporarios,
  obterUltimoBoletim,
  validarContratoAtivoUnico,
} from '../vinculosTemporariosService.js';

test('criação de contrato calcula status vigente', () => {
  const status = calcularStatusContratoTemporario({
    data_inicio: '2026-01-01',
    data_fim_atual: '2026-12-31',
  }, '2026-04-21');

  assert.equal(status, 'VIGENTE');
});

test('bloqueia segundo contrato ativo para o mesmo militar', () => {
  const resultado = validarContratoAtivoUnico({
    contrato: {
      id: 'novo',
      militar_id: 'm1',
      data_inicio: '2026-02-01',
      data_fim_atual: '2026-10-01',
    },
    contratosExistentes: [
      {
        id: 'existente',
        militar_id: 'm1',
        data_inicio: '2026-01-01',
        data_fim_atual: '2026-11-01',
      },
    ],
    today: '2026-04-21',
  });

  assert.equal(resultado.ok, false);
  assert.equal(resultado.code, 'CONTRATO_ATIVO_EXISTENTE');
});

test('renovação atualiza o mesmo contrato e retorna histórico de renovação', () => {
  const { contratoAtualizado, historico } = aplicarRenovacaoContrato({
    id: 'c1',
    data_fim_atual: '2026-06-30',
  }, {
    dataRegistro: '2026-06-15',
    boletim: 'BG 123',
    detalhes: 'Prorrogação de 6 meses',
    novaDataFim: '2026-12-31',
  });

  assert.equal(contratoAtualizado.data_fim_atual, '2026-12-31');
  assert.equal(historico.tipo_registro, 'RENOVACAO');
  assert.equal(historico.data_fim_anterior, '2026-06-30');
  assert.equal(historico.data_fim_nova, '2026-12-31');
});

test('registro de boletim gera payload de histórico simples', () => {
  const historico = criarHistoricoContrato({
    tipoRegistro: 'BOLETIM',
    dataRegistro: '2026-04-21',
    boletim: 'BG 777',
    detalhes: 'Publicação de ajuste.',
  });

  assert.equal(historico.tipo_registro, 'BOLETIM');
  assert.equal(historico.boletim, 'BG 777');
});

test('encerramento altera status e gera histórico de encerramento', () => {
  const { contratoAtualizado, historico } = encerrarContratoTemporario({
    id: 'c1',
    data_fim_atual: '2026-12-31',
  }, {
    dataRegistro: '2026-08-01',
    boletim: 'BG 900',
    detalhes: 'Encerrado por término de prazo.',
  });

  assert.equal(contratoAtualizado.status, 'ENCERRADO');
  assert.equal(historico.tipo_registro, 'ENCERRAMENTO');
  assert.equal(historico.data_fim_anterior, '2026-12-31');
});

test('listagem em cards agrega status, militar e último boletim', () => {
  const cards = montarCardsContratosTemporarios({
    contratos: [{ id: 'c1', militar_id: 'm1', tipo_vinculo: 'DESIGNADO', data_fim_atual: '2026-12-31' }],
    militares: [{ id: 'm1', nome_completo: 'Militar Teste', matricula_atual: '12345' }],
    historicos: [
      { id: 'h1', contrato_temporario_id: 'c1', data_registro: '2026-01-01', boletim: 'BG 001' },
      { id: 'h2', contrato_temporario_id: 'c1', data_registro: '2026-02-01', boletim: 'BG 002' },
    ],
    today: '2026-04-21',
  });

  assert.equal(cards.length, 1);
  assert.equal(cards[0].militar_nome, 'Militar Teste');
  assert.equal(cards[0].ultimo_boletim, 'BG 002');
});

test('obtém último boletim corretamente', () => {
  const ultimo = obterUltimoBoletim([
    { data_registro: '2026-01-01', boletim: 'BG 001' },
    { data_registro: '2026-01-08', boletim: 'BG 003' },
  ]);

  assert.equal(ultimo, 'BG 003');
});
