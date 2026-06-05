import test from 'node:test';
import assert from 'node:assert/strict';

import {
  filtrarUnidadesCartoes,
  listarTagsDisponiveisGestor,
  filtrarMilitaresGestor,
} from '../efetivo/visualizacaoGestor.js';

test('filtrarUnidadesCartoes deve retornar todas as unidades se busca for vazia', () => {
  const unidades = [
    { unidadeNome: 'Unidade A', unidadeSigla: 'UA' },
    { unidadeNome: 'Unidade B', unidadeSigla: 'UB' },
  ];
  assert.deepEqual(filtrarUnidadesCartoes(unidades, ''), unidades);
  assert.deepEqual(filtrarUnidadesCartoes(unidades, null), unidades);
});

test('filtrarUnidadesCartoes deve filtrar por nome, sigla, setor ou subsetor', () => {
  const unidades = [
    { unidadeNome: 'Primeira Unidade', unidadeSigla: 'PU', setorNome: 'Setor X', subsetorNome: 'Sub Alpha' },
    { unidadeNome: 'Segunda Unidade', unidadeSigla: 'SU', setorNome: 'Setor Y', subsetorNome: 'Sub Beta' },
  ];

  assert.equal(filtrarUnidadesCartoes(unidades, 'primeira').length, 1);
  assert.equal(filtrarUnidadesCartoes(unidades, 'PU').length, 1);
  assert.equal(filtrarUnidadesCartoes(unidades, 'Setor Y').length, 1);
  assert.equal(filtrarUnidadesCartoes(unidades, 'Sub Alpha').length, 1);
  assert.equal(filtrarUnidadesCartoes(unidades, 'Inexistente').length, 0);
});

test('filtrarUnidadesCartoes deve ser case-insensitive', () => {
  const unidades = [{ unidadeNome: 'Unidade Alpha' }];
  assert.equal(filtrarUnidadesCartoes(unidades, 'ALPHA').length, 1);
  assert.equal(filtrarUnidadesCartoes(unidades, 'alpha').length, 1);
});

test('listarTagsDisponiveisGestor deve retornar lista vazia para entrada vazia', () => {
  assert.deepEqual(listarTagsDisponiveisGestor([]), []);
  assert.deepEqual(listarTagsDisponiveisGestor(null), []);
});

test('listarTagsDisponiveisGestor deve contar e ordenar tags corretamente', () => {
  const militares = [
    { tags: ['Tag A', 'Tag B'] },
    { tags: ['Tag A', 'Tag C'] },
    { tags: ['Tag A'] },
  ];

  const resultado = listarTagsDisponiveisGestor(militares);

  // Tag A aparece 3 vezes, B e C aparecem 1 vez cada.
  // Ordem esperada: Tag A (3), Tag B (1), Tag C (1) -> B vem antes de C alfabeticamente
  assert.equal(resultado.length, 3);
  assert.equal(resultado[0].nome, 'Tag A');
  assert.equal(resultado[0].total, 3);
  assert.equal(resultado[1].nome, 'Tag B');
  assert.equal(resultado[1].total, 1);
  assert.equal(resultado[2].nome, 'Tag C');
  assert.equal(resultado[2].total, 1);
});

test('listarTagsDisponiveisGestor deve ordenar alfabeticamente usando locale pt-BR para empates', () => {
  const militares = [
    { tags: ['Zebra'] },
    { tags: ['Água'] },
    { tags: ['Abacaxi'] },
  ];

  const resultado = listarTagsDisponiveisGestor(militares);

  // Todos tem total = 1.
  // Ordem alfabética pt-BR: Abacaxi, Água, Zebra
  assert.equal(resultado[0].nome, 'Abacaxi');
  assert.equal(resultado[1].nome, 'Água');
  assert.equal(resultado[2].nome, 'Zebra');
});

test('listarTagsDisponiveisGestor deve lidar com tags em formato de objeto', () => {
  const militares = [
    { tags: [{ id: 't1', nome: 'Tag Objeto' }] },
  ];
  const resultado = listarTagsDisponiveisGestor(militares);
  assert.equal(resultado[0].nome, 'Tag Objeto');
  assert.equal(resultado[0].total, 1);
});

test('filtrarMilitaresGestor deve filtrar por termo de busca', () => {
  const militares = [
    { nome: 'João Silva', matricula: '123' },
    { nome: 'Maria Souza', matricula: '456' },
  ];

  assert.equal(filtrarMilitaresGestor(militares, 'joao').length, 1);
  assert.equal(filtrarMilitaresGestor(militares, '456').length, 1);
  assert.equal(filtrarMilitaresGestor(militares, 'Silva').length, 1);
  assert.equal(filtrarMilitaresGestor(militares, 'Inexistente').length, 0);
});

test('filtrarMilitaresGestor deve filtrar por tags selecionadas', () => {
  const militares = [
    { nome: 'M1', tags: ['Tag1', 'Tag2'] },
    { nome: 'M2', tags: ['Tag1'] },
    { nome: 'M3', tags: ['Tag2'] },
  ];

  assert.equal(filtrarMilitaresGestor(militares, '', ['Tag1']).length, 2); // M1, M2
  assert.equal(filtrarMilitaresGestor(militares, '', ['Tag1', 'Tag2']).length, 1); // Apenas M1
  assert.equal(filtrarMilitaresGestor(militares, '', ['Tag3']).length, 0);
});

test('filtrarMilitaresGestor deve combinar busca e tags', () => {
  const militares = [
    { nome: 'João Silva', tags: ['Tag1'] },
    { nome: 'João Souza', tags: ['Tag2'] },
  ];

  assert.equal(filtrarMilitaresGestor(militares, 'João', ['Tag1']).length, 1);
  assert.deepEqual(filtrarMilitaresGestor(militares, 'João', ['Tag1'])[0].nome, 'João Silva');
});
