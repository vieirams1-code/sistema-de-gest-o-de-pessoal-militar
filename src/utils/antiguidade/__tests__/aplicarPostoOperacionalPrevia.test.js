import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aplicarPostoOperacionalEReordenar,
  montarMapaPostoOperacionalPorMilitar,
} from '../aplicarPostoOperacionalPrevia.js';

const part = (militar_id, tipo_curso, status = 'em_curso', extra = {}) => ({
  militar_id,
  tipo_curso,
  status,
  ...extra,
});

// Itens oficiais simulados (posicao = antiguidade oficial ascendente).
const itensOficiais = [
  { militar_id: 'sgt3', posto_graduacao: '3º Sargento', posicao: 1 },
  { militar_id: 'cb1', posto_graduacao: 'Cabo', posicao: 2 },
  { militar_id: 'cb2', posto_graduacao: 'Cabo', posicao: 3 },
  { militar_id: 'sd1', posto_graduacao: 'Soldado', posicao: 4 },
  { militar_id: 'sd2', posto_graduacao: 'Soldado', posicao: 5 },
];

test('montarMapaPostoOperacional ignora status sem posto virtual', () => {
  const mapa = montarMapaPostoOperacionalPorMilitar([
    part('a', 'CFC', 'em_curso'),
    part('b', 'CFS', 'reprovado'),
    part('c', 'CFS', 'promovido'),
  ]);
  assert.equal(mapa.get('a')?.posto_operacional, 'Aluno a Cabo');
  assert.equal(mapa.has('b'), false);
  assert.equal(mapa.has('c'), false);
});

// Teste 4 + 2 + 3: ordem operacional 3º Sgt > Aluno a Sargento > Cabo > Aluno a Cabo > Soldado
test('Prévia reordena por precedência operacional com postos virtuais', () => {
  // sd1 em CFC -> Aluno a Cabo; cb1 em CFS -> Aluno a Sargento
  const mapa = montarMapaPostoOperacionalPorMilitar([
    part('sd1', 'CFC'),
    part('cb1', 'CFS'),
  ]);
  const ordenado = aplicarPostoOperacionalEReordenar(itensOficiais, mapa);
  const ordemIds = ordenado.map((i) => i.militar_id);

  // 3º Sgt > Aluno a Sargento (cb1) > Cabo (cb2) > Aluno a Cabo (sd1) > Soldado (sd2)
  assert.deepEqual(ordemIds, ['sgt3', 'cb1', 'cb2', 'sd1', 'sd2']);
});

// Teste 2: Soldado em CFC aparece como Aluno a Cabo e acima dos Soldados
test('Soldado em CFC vira Aluno a Cabo e fica acima dos Soldados', () => {
  const mapa = montarMapaPostoOperacionalPorMilitar([part('sd1', 'CFC')]);
  const ordenado = aplicarPostoOperacionalEReordenar(itensOficiais, mapa);
  const sd1 = ordenado.find((i) => i.militar_id === 'sd1');
  const sd2 = ordenado.find((i) => i.militar_id === 'sd2');
  assert.equal(sd1.posto_operacional, 'Aluno a Cabo');
  assert.equal(sd1.possui_posto_virtual, true);
  assert.ok(sd1.posicao_operacional < sd2.posicao_operacional);
});

// Teste 3: Cabo em CFS vira Aluno a Sargento, acima dos Cabos e abaixo dos 3º Sgt
test('Cabo em CFS vira Aluno a Sargento entre Cabo e 3º Sargento', () => {
  const mapa = montarMapaPostoOperacionalPorMilitar([part('cb1', 'CFS')]);
  const ordenado = aplicarPostoOperacionalEReordenar(itensOficiais, mapa);
  const cb1 = ordenado.find((i) => i.militar_id === 'cb1'); // Aluno a Sargento
  const cb2 = ordenado.find((i) => i.militar_id === 'cb2'); // Cabo
  const sgt3 = ordenado.find((i) => i.militar_id === 'sgt3');
  assert.equal(cb1.posto_operacional, 'Aluno a Sargento');
  assert.ok(cb1.posicao_operacional > sgt3.posicao_operacional);
  assert.ok(cb1.posicao_operacional < cb2.posicao_operacional);
});

// Teste 6/7: não altera posto_graduacao oficial nem itens originais
test('Não altera itens oficiais originais (read-only)', () => {
  const original = JSON.parse(JSON.stringify(itensOficiais));
  const mapa = montarMapaPostoOperacionalPorMilitar([part('sd1', 'CFC')]);
  aplicarPostoOperacionalEReordenar(itensOficiais, mapa);
  assert.deepEqual(itensOficiais, original);
});

// Sem alunos: ordem operacional é maior -> menor preservando antiguidade oficial.
test('Sem curso ativo, ordena maior -> menor preservando antiguidade interna', () => {
  const ordenado = aplicarPostoOperacionalEReordenar(itensOficiais, new Map());
  const ordemIds = ordenado.map((i) => i.militar_id);
  assert.deepEqual(ordemIds, ['sgt3', 'cb1', 'cb2', 'sd1', 'sd2']);
});