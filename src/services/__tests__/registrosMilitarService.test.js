import test from 'node:test';
import assert from 'node:assert/strict';

import { vinculaRegistroAoMilitar } from '../registrosMilitarMatcher.js';

test('vincula por matrícula atual derivada quando militar está enriquecido', () => {
  const registro = { militar_matricula: '222.222-222' };
  const militar = {
    id: 'm1',
    matricula: '222.222-222',
    matricula_atual: '222.222-222',
  };

  assert.equal(vinculaRegistroAoMilitar(registro, militar), true);
});

test('vincula por matrícula histórica quando registro usa matrícula antiga', () => {
  const registro = { militar_matricula: '111.111-111' };
  const militar = {
    id: 'm1',
    matricula: '222.222-222',
    matricula_atual: '222.222-222',
    matriculas_historico: [
      { matricula: '111.111-111', matricula_normalizada: '111111111' },
      { matricula: '222.222-222', matricula_normalizada: '222222222' },
    ],
  };

  assert.equal(vinculaRegistroAoMilitar(registro, militar), true);
});

test('preserva fallback legado por matrícula do campo militar_matricula', () => {
  const registro = { matricula_legado: '333.333-333' };
  const militar = {
    id: 'm3',
    militar_matricula: '333.333-333',
  };

  assert.equal(vinculaRegistroAoMilitar(registro, militar), true);
});

test('sem regressão: continua vinculando por nome quando não há matrícula', () => {
  const registro = { militar_nome: 'Fulano de Tal' };
  const militar = {
    nome_completo: 'Fulano de Tal',
  };

  assert.equal(vinculaRegistroAoMilitar(registro, militar), true);
});
