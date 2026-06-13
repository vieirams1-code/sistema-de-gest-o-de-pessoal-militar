import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolverStatusMilitarComCurso,
  getPostoExibicaoMilitar,
  compararPorPostoVirtual,
  ALUNO_CABO,
  ALUNO_SARGENTO,
} from '../militarStatusVirtual.js';

const soldado = { id: 'm1', posto_graduacao: 'Soldado', quadro: 'QPTBM' };
const cabo = { id: 'm2', posto_graduacao: 'Cabo', quadro: 'QPTBM' };

const part = (tipo_curso, status, extra = {}) => ({ id: 'p1', curso_id: 'c1', tipo_curso, status, ...extra });

// 1
test('Soldado em CFC em_curso retorna Aluno a Cabo', () => {
  const r = resolverStatusMilitarComCurso(soldado, [part('CFC', 'em_curso')]);
  assert.equal(r.posto_exibicao, ALUNO_CABO);
  assert.equal(r.possui_posto_virtual, true);
  assert.equal(r.motivo_exibicao, 'CFC ativo');
});

// 2
test('Soldado em CFC aguardando_nova_etapa retorna Aluno a Cabo', () => {
  const r = resolverStatusMilitarComCurso(soldado, [part('CFC', 'aguardando_nova_etapa')]);
  assert.equal(r.posto_exibicao, ALUNO_CABO);
});

// 3
test('Soldado em CFC reprovado retorna Soldado', () => {
  const r = resolverStatusMilitarComCurso(soldado, [part('CFC', 'reprovado')]);
  assert.equal(r.posto_exibicao, 'Soldado');
  assert.equal(r.possui_posto_virtual, false);
});

// 4
test('Cabo em CFS em_curso retorna Aluno a Sargento', () => {
  const r = resolverStatusMilitarComCurso(cabo, [part('CFS', 'em_curso')]);
  assert.equal(r.posto_exibicao, ALUNO_SARGENTO);
});

// 5
test('Cabo em CFS aguardando_nova_etapa retorna Aluno a Sargento', () => {
  const r = resolverStatusMilitarComCurso(cabo, [part('CFS', 'aguardando_nova_etapa')]);
  assert.equal(r.posto_exibicao, ALUNO_SARGENTO);
});

// 6
test('Cabo em CFS desligado retorna Cabo', () => {
  const r = resolverStatusMilitarComCurso(cabo, [part('CFS', 'desligado')]);
  assert.equal(r.posto_exibicao, 'Cabo');
  assert.equal(r.possui_posto_virtual, false);
});

// 7
test('Militar sem curso retorna posto real', () => {
  const r = resolverStatusMilitarComCurso(soldado, []);
  assert.equal(r.posto_exibicao, 'Soldado');
  assert.equal(getPostoExibicaoMilitar(soldado, null), 'Soldado');
});

// 8
test('Aluno a Cabo ordena acima de Soldado e abaixo de Cabo', () => {
  const itens = [
    { posto_exibicao: 'Cabo' },
    { posto_exibicao: ALUNO_CABO },
    { posto_exibicao: 'Soldado' },
  ];
  const ordenado = [...itens].sort(compararPorPostoVirtual).map((i) => i.posto_exibicao);
  assert.deepEqual(ordenado, ['Soldado', ALUNO_CABO, 'Cabo']);
});

// 9
test('Aluno a Sargento ordena acima de Cabo e abaixo de 3º Sargento', () => {
  const itens = [
    { posto_exibicao: '3º Sargento' },
    { posto_exibicao: ALUNO_SARGENTO },
    { posto_exibicao: 'Cabo' },
  ];
  const ordenado = [...itens].sort(compararPorPostoVirtual).map((i) => i.posto_exibicao);
  assert.deepEqual(ordenado, ['Cabo', ALUNO_SARGENTO, '3º Sargento']);
});

// 10
test('Alunos do mesmo curso são ordenados por antiguidade', () => {
  const itens = [
    { posto_exibicao: ALUNO_CABO, snapshot_antiguidade: 3 },
    { posto_exibicao: ALUNO_CABO, snapshot_antiguidade: 1 },
    { posto_exibicao: ALUNO_CABO, snapshot_antiguidade: 2 },
  ];
  const ordenado = [...itens].sort(compararPorPostoVirtual).map((i) => i.snapshot_antiguidade);
  assert.deepEqual(ordenado, [1, 2, 3]);
});

// 10b — desempate por ordem_antiguidade_origem quando snapshot ausente
test('Desempate usa ordem_antiguidade_origem quando snapshot ausente', () => {
  const itens = [
    { posto_exibicao: ALUNO_SARGENTO, ordem_antiguidade_origem: 5 },
    { posto_exibicao: ALUNO_SARGENTO, ordem_antiguidade_origem: 2 },
  ];
  const ordenado = [...itens].sort(compararPorPostoVirtual).map((i) => i.ordem_antiguidade_origem);
  assert.deepEqual(ordenado, [2, 5]);
});

// 11
test('Militar.posto_graduacao não é alterado pelo serviço', () => {
  const militar = { id: 'mx', posto_graduacao: 'Soldado', quadro: 'QPTBM' };
  resolverStatusMilitarComCurso(militar, [part('CFC', 'em_curso')]);
  assert.equal(militar.posto_graduacao, 'Soldado');
  assert.equal(militar.quadro, 'QPTBM');
});