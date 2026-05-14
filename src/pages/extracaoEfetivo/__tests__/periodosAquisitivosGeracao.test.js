import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calcularPeriodosAquisitivosParaGeracao,
  periodoAquisitivoJaExiste,
} from '../../../services/periodosAquisitivosGeracao.js';

const refs = (periodos) => periodos.map((periodo) => periodo.ano_referencia);

test('data-base antiga gera apenas períodos ainda úteis e um futuro', () => {
  const periodos = calcularPeriodosAquisitivosParaGeracao({
    dataBase: '2017-10-09',
    hoje: '2026-05-14',
  });

  assert.deepEqual(refs(periodos), ['2023/2024', '2024/2025', '2025/2026', '2026/2027']);
  assert.equal(periodos.length, 4);
  assert.equal(periodos.at(-1).inicio_aquisitivo, '2026-10-09');
});

test('data-base recente gera período atual e um futuro', () => {
  const periodos = calcularPeriodosAquisitivosParaGeracao({
    dataBase: '2026-01-10',
    hoje: '2026-05-14',
  });

  assert.deepEqual(refs(periodos), ['2026/2027', '2027/2028']);
  assert.equal(periodos[0].inicio_aquisitivo, '2026-01-10');
  assert.equal(periodos[1].inicio_aquisitivo, '2027-01-10');
});

test('checagem de duplicidade considera período existente do mesmo militar por início ou referência', () => {
  const periodosExistentes = [
    { militar_id: 'm1', inicio_aquisitivo: '2026-01-10', ano_referencia: '2026/2027' },
    { militar_id: 'm2', inicio_aquisitivo: '2026-01-10', ano_referencia: '2026/2027' },
  ];

  assert.equal(periodoAquisitivoJaExiste({
    periodosExistentes,
    militarId: 'm1',
    inicioAquisitivo: '2026-01-10',
    anoReferencia: '2026/2027',
  }), true);
  assert.equal(periodoAquisitivoJaExiste({
    periodosExistentes,
    militarId: 'm1',
    inicioAquisitivo: '2027-01-10',
    anoReferencia: '2027/2028',
  }), false);
});
