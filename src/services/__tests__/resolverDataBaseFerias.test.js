import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CODIGOS_BLOQUEIO_DATA_BASE_FERIAS,
  ORIGENS_DATA_BASE_FERIAS,
  resolverDataBaseFerias,
} from '../resolverDataBaseFerias.js';

const SHAPE_KEYS = [
  'dataBase',
  'origem',
  'contratoId',
  'bloqueado',
  'codigoBloqueio',
  'mensagem',
  'warnings',
];

function militar(overrides = {}) {
  return {
    id: 'militar-1',
    data_inclusao: '2024-01-15',
    ...overrides,
  };
}

function contrato(overrides = {}) {
  return {
    id: 'contrato-1',
    militar_id: 'militar-1',
    status_contrato: 'ativo',
    data_inicio_contrato: '2025-02-01',
    data_inclusao_para_ferias: '2025-02-01',
    ...overrides,
  };
}

function assertShape(resultado) {
  assert.deepEqual(Object.keys(resultado), SHAPE_KEYS);
  assert.equal(typeof resultado.bloqueado, 'boolean');
  assert.equal(Array.isArray(resultado.warnings), true);
  assert.equal(typeof resultado.mensagem, 'string');
}

test('sem contrato ativo usa militar.data_inclusao', () => {
  const resultado = resolverDataBaseFerias({ militar: militar() });

  assert.equal(resultado.dataBase, '2024-01-15');
  assert.equal(resultado.origem, ORIGENS_DATA_BASE_FERIAS.MILITAR_DATA_INCLUSAO);
  assert.equal(resultado.contratoId, null);
  assert.equal(resultado.bloqueado, false);
  assertShape(resultado);
});

test('sem contrato ativo e sem data_inclusao bloqueia', () => {
  const resultado = resolverDataBaseFerias({ militar: militar({ data_inclusao: '' }) });

  assert.equal(resultado.bloqueado, true);
  assert.equal(resultado.codigoBloqueio, CODIGOS_BLOQUEIO_DATA_BASE_FERIAS.MILITAR_SEM_DATA_INCLUSAO);
  assertShape(resultado);
});

test('um contrato ativo válido usa data_inclusao_para_ferias', () => {
  const resultado = resolverDataBaseFerias({
    militar: militar(),
    contratosDesignacao: [contrato({ data_inclusao_para_ferias: '03/02/2025' })],
  });

  assert.equal(resultado.dataBase, '2025-02-03');
  assert.equal(resultado.origem, ORIGENS_DATA_BASE_FERIAS.CONTRATO_DESIGNACAO);
  assert.equal(resultado.contratoId, 'contrato-1');
  assert.equal(resultado.bloqueado, false);
  assertShape(resultado);
});

test('contrato ativo sem data-base bloqueia', () => {
  const resultado = resolverDataBaseFerias({
    militar: militar(),
    contratosDesignacao: [contrato({ data_inclusao_para_ferias: '' })],
  });

  assert.equal(resultado.bloqueado, true);
  assert.equal(resultado.codigoBloqueio, CODIGOS_BLOQUEIO_DATA_BASE_FERIAS.CONTRATO_ATIVO_SEM_DATA_BASE);
  assertShape(resultado);
});

test('dois contratos ativos bloqueiam', () => {
  const resultado = resolverDataBaseFerias({
    militar: militar(),
    contratosDesignacao: [contrato({ id: 'a' }), contrato({ id: 'b' })],
  });

  assert.equal(resultado.bloqueado, true);
  assert.equal(resultado.codigoBloqueio, CODIGOS_BLOQUEIO_DATA_BASE_FERIAS.CONTRATO_ATIVO_DUPLICADO);
  assertShape(resultado);
});

test('contrato encerrado é ignorado', () => {
  const resultado = resolverDataBaseFerias({
    militar: militar(),
    contratosDesignacao: [contrato({ status_contrato: 'encerrado', data_inclusao_para_ferias: '2025-02-01' })],
  });

  assert.equal(resultado.dataBase, '2024-01-15');
  assert.equal(resultado.origem, ORIGENS_DATA_BASE_FERIAS.MILITAR_DATA_INCLUSAO);
  assertShape(resultado);
});

test('contrato cancelado é ignorado', () => {
  const resultado = resolverDataBaseFerias({
    militar: militar(),
    contratosDesignacao: [contrato({ status_contrato: 'cancelado', data_inclusao_para_ferias: '2025-02-01' })],
  });

  assert.equal(resultado.dataBase, '2024-01-15');
  assert.equal(resultado.origem, ORIGENS_DATA_BASE_FERIAS.MILITAR_DATA_INCLUSAO);
  assertShape(resultado);
});

test('data inválida do militar bloqueia', () => {
  const resultado = resolverDataBaseFerias({ militar: militar({ data_inclusao: '2026-02-31' }) });

  assert.equal(resultado.bloqueado, true);
  assert.equal(resultado.codigoBloqueio, CODIGOS_BLOQUEIO_DATA_BASE_FERIAS.DATA_BASE_FERIAS_INVALIDA);
  assertShape(resultado);
});

test('data inválida do contrato bloqueia', () => {
  const resultado = resolverDataBaseFerias({
    militar: militar(),
    contratosDesignacao: [contrato({ data_inclusao_para_ferias: '31/02/2026' })],
  });

  assert.equal(resultado.bloqueado, true);
  assert.equal(resultado.codigoBloqueio, CODIGOS_BLOQUEIO_DATA_BASE_FERIAS.DATA_BASE_FERIAS_INVALIDA);
  assertShape(resultado);
});

test('data-base do contrato anterior ao início bloqueia por padrão', () => {
  const resultado = resolverDataBaseFerias({
    militar: militar(),
    contratosDesignacao: [contrato({ data_inicio_contrato: '2025-02-10', data_inclusao_para_ferias: '2025-02-09' })],
  });

  assert.equal(resultado.bloqueado, true);
  assert.equal(
    resultado.codigoBloqueio,
    CODIGOS_BLOQUEIO_DATA_BASE_FERIAS.DATA_BASE_CONTRATO_ANTERIOR_INICIO_CONTRATO,
  );
  assertShape(resultado);
});

test('data-base anterior ao início vira warning se option false', () => {
  const resultado = resolverDataBaseFerias({
    militar: militar(),
    contratosDesignacao: [contrato({ data_inicio_contrato: '2025-02-10', data_inclusao_para_ferias: '2025-02-09' })],
    options: { bloquearDataContratoAnteriorAoInicio: false },
  });

  assert.equal(resultado.bloqueado, false);
  assert.equal(resultado.dataBase, '2025-02-09');
  assert.deepEqual(resultado.warnings, [
    CODIGOS_BLOQUEIO_DATA_BASE_FERIAS.DATA_BASE_CONTRATO_ANTERIOR_INICIO_CONTRATO,
  ]);
  assertShape(resultado);
});

test('status alias Ativa e active são tratados como ativo', () => {
  const resultadoAtiva = resolverDataBaseFerias({
    militar: militar(),
    contratosDesignacao: [contrato({ status_contrato: 'Ativa', data_inclusao_para_ferias: '2025-03-01' })],
  });
  const resultadoActive = resolverDataBaseFerias({
    militar: militar(),
    contratosDesignacao: [contrato({ status_contrato: 'active', data_inclusao_para_ferias: '2025-04-01' })],
  });

  assert.equal(resultadoAtiva.dataBase, '2025-03-01');
  assert.equal(resultadoActive.dataBase, '2025-04-01');
  assertShape(resultadoAtiva);
  assertShape(resultadoActive);
});

test('contratosDesignacao null não quebra', () => {
  const resultado = resolverDataBaseFerias({ militar: militar(), contratosDesignacao: null });

  assert.equal(resultado.dataBase, '2024-01-15');
  assert.equal(resultado.bloqueado, false);
  assertShape(resultado);
});

test('contrato de outro militar é ignorado com warning', () => {
  const resultado = resolverDataBaseFerias({
    militar: militar(),
    contratosDesignacao: [contrato({ id: 'outro', militar_id: 'militar-2', data_inclusao_para_ferias: '2025-05-01' })],
  });

  assert.equal(resultado.dataBase, '2024-01-15');
  assert.deepEqual(resultado.warnings, ['CONTRATO_DE_OUTRO_MILITAR_IGNORADO:outro']);
  assertShape(resultado);
});

test('retorno sempre possui shape completo em bloqueios e sucesso', () => {
  const sucesso = resolverDataBaseFerias({ militar: militar() });
  const bloqueio = resolverDataBaseFerias({ militar: militar({ data_inclusao: null }) });

  assertShape(sucesso);
  assertShape(bloqueio);
});
