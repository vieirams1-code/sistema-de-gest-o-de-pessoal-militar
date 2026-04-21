import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calcularBadgeVigenciaContrato,
  calcularSituacaoVinculoTemporario,
  calcularStatusContratoTemporario,
  encerrarOuExtinguirContrato,
  listarContratosAtuais,
  listarHistoricoCadeia,
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

test('encerra contrato preservando motivo e data efetiva', () => {
  const encerrado = encerrarOuExtinguirContrato({ id: 'c1', status: 'VIGENTE' }, {
    dataEfetiva: '2026-05-10',
    motivo: 'Término antecipado',
  });

  assert.equal(encerrado.status, 'ENCERRADO');
  assert.equal(encerrado.data_fim_efetiva, '2026-05-10');
  assert.equal(encerrado.motivo_encerramento, 'Término antecipado');
});

test('não permite múltiplas renovações a partir do mesmo contrato', () => {
  const resultado = prepararRenovacaoContrato({ id: 'c1' }, {
    militar_id: 'm1',
    data_inicio: '2026-06-01',
    data_fim_prevista: '2026-12-31',
  }, [
    { id: 'c2', contrato_anterior_id: 'c1' },
  ]);

  assert.equal(resultado.ok, false);
  assert.equal(resultado.code, 'RENOVACAO_DUPLICADA');
});

test('renovação cria cadeia correta e marca anterior como renovado', () => {
  const renovacao = prepararRenovacaoContrato({
    id: 'c1',
    contrato_raiz_id: 'root-1',
  }, {
    militar_id: 'm1',
    data_inicio: '2026-06-01',
    data_fim_prevista: '2026-12-31',
  }, []);

  assert.equal(renovacao.ok, true);
  assert.equal(renovacao.novoContrato.contrato_anterior_id, 'c1');
  assert.equal(renovacao.novoContrato.contrato_raiz_id, 'root-1');
  assert.equal(renovacao.contratoAnteriorAtualizado.status, 'RENOVADO');
});

test('listagem principal mostra apenas contrato atual por cadeia', () => {
  const atuais = listarContratosAtuais([
    { id: 'c1', contrato_raiz_id: 'r1', data_inicio: '2026-01-01' },
    { id: 'c2', contrato_raiz_id: 'r1', data_inicio: '2026-06-01' },
    { id: 'c3', contrato_raiz_id: 'r2', data_inicio: '2025-02-01' },
  ]);

  assert.deepEqual(atuais.map((item) => item.id), ['c2', 'c3']);
});

test('histórico exibe contratos anteriores da cadeia', () => {
  const contratos = [
    { id: 'c1', contrato_raiz_id: 'r1', data_inicio: '2025-01-01' },
    { id: 'c2', contrato_raiz_id: 'r1', data_inicio: '2026-01-01' },
    { id: 'c3', contrato_raiz_id: 'r1', data_inicio: '2026-07-01' },
  ];

  const historico = listarHistoricoCadeia(contratos, contratos[2]);
  assert.deepEqual(historico.map((item) => item.id), ['c2', 'c1']);
});

test('badge derivada mostra a vencer e expirado', () => {
  const aVencer = calcularBadgeVigenciaContrato({
    data_inicio: '2026-01-01',
    data_fim_prevista: '2026-04-25',
    status: 'VIGENTE',
  }, '2026-04-21');
  const expirado = calcularBadgeVigenciaContrato({
    data_inicio: '2025-01-01',
    data_fim_prevista: '2026-04-01',
    status: 'VIGENTE',
  }, '2026-04-21');

  assert.equal(aVencer, 'A_VENCER');
  assert.equal(expirado, 'EXPIRADO');
});

test('persistência de DOEMS no contrato não altera validação', () => {
  const resultado = validarSobreposicaoContrato({
    contrato: {
      id: 'novo',
      militar_id: 'm1',
      data_inicio: '2026-07-01',
      data_fim_prevista: '2026-08-01',
      numero_doems: '12.345',
      data_doems: '2026-07-05',
      status: 'RASCUNHO',
    },
    contratosExistentes: [],
  });

  assert.equal(resultado.ok, true);
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
  ], '2026-04-21');

  assert.equal(indicadores.aVencer60, 1);
  assert.equal(indicadores.aVencer30, 1);
  assert.equal(indicadores.expirados, 1);
});
