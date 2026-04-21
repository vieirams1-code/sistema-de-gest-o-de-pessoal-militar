import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calcularSituacaoVinculoTemporario,
  calcularStatusContratoTemporario,
  encerrarOuExtinguirContrato,
  prepararRenovacaoContrato,
  resumirIndicadoresContratosTemporarios,
  validarSobreposicaoContrato,
} from '../vinculosTemporariosService.js';

test('cria status básico de contrato temporário vigente', () => {
  const status = calcularStatusContratoTemporario({
    data_inicio: '2026-01-01',
    data_fim_prevista: '2026-12-31',
    status: 'RASCUNHO',
  }, '2026-04-21');

  assert.equal(status, 'VIGENTE');
});

test('bloqueia sobreposição inconsistente de contrato ativo', () => {
  const resultado = validarSobreposicaoContrato({
    contrato: {
      id: 'novo',
      militar_id: 'm1',
      data_inicio: '2026-04-01',
      data_fim_prevista: '2026-10-01',
      status: 'VIGENTE',
    },
    contratosExistentes: [
      {
        id: 'existente',
        militar_id: 'm1',
        data_inicio: '2026-01-01',
        data_fim_prevista: '2026-06-01',
        status: 'VIGENTE',
      },
    ],
    today: '2026-04-21',
  });

  assert.equal(resultado.ok, false);
  assert.equal(resultado.code, 'CONTRATO_SOBREPOSTO');
});

test('encerra/extingue contrato preservando motivo e data efetiva', () => {
  const encerrado = encerrarOuExtinguirContrato({ id: 'c1', status: 'VIGENTE' }, {
    dataEfetiva: '2026-05-10',
    motivo: 'Término antecipado',
    tipo: 'EXTINTO',
  });

  assert.equal(encerrado.status, 'EXTINTO');
  assert.equal(encerrado.data_fim_efetiva, '2026-05-10');
  assert.equal(encerrado.motivo_encerramento, 'Término antecipado');
});

test('renovação cria novo payload encadeado sem sobrescrever anterior', () => {
  const renovacao = prepararRenovacaoContrato({
    id: 'c1',
    contrato_raiz_id: 'c0',
    data_inicio: '2025-01-01',
  }, {
    militar_id: 'm1',
    data_inicio: '2026-01-01',
    data_fim_prevista: '2026-12-31',
    status: 'RASCUNHO',
  });

  assert.equal(renovacao.contrato_anterior_id, 'c1');
  assert.equal(renovacao.contrato_raiz_id, 'c0');
  assert.equal(renovacao.origem_registro, 'RENOVACAO');
});

test('calcula situação derivada do vínculo temporário', () => {
  assert.equal(calcularSituacaoVinculoTemporario(null), 'SEM_VIGENTE');

  const situacao = calcularSituacaoVinculoTemporario({
    data_inicio: '2026-01-01',
    data_fim_prevista: '2026-04-25',
    status: 'VIGENTE',
  });

  assert.equal(situacao, 'A_VENCER');
});

test('gera indicadores básicos de listagem/dashboard', () => {
  const indicadores = resumirIndicadoresContratosTemporarios([
    { data_inicio: '2026-01-01', data_fim_prevista: '2026-05-01', status: 'VIGENTE' },
    { data_inicio: '2025-01-01', data_fim_prevista: '2026-04-01', status: 'VIGENTE' },
    { data_inicio: '2026-01-01', data_fim_prevista: '2026-12-01', status: 'AGUARDANDO_PUBLICACAO' },
  ], '2026-04-21');

  assert.equal(indicadores.aVencer60, 1);
  assert.equal(indicadores.aVencer30, 1);
  assert.equal(indicadores.expirados, 1);
  assert.equal(indicadores.aguardandoPublicacao, 1);
});
