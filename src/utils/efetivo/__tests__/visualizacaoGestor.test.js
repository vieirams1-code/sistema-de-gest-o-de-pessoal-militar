import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filtrarUnidadesCartoes,
  listarTagsDisponiveisGestor,
  filtrarMilitaresGestor,
} from '../visualizacaoGestor.js';

test('filtrarUnidadesCartoes filters by various fields', () => {
  const unidades = [
    { unidadeNome: 'Diretoria de Pessoal', unidadeSigla: 'DP', setorNome: 'Comando', subsetorNome: 'Gabinete' },
    { unidadeNome: 'Batalhão de Choque', unidadeSigla: 'BPChoque', setorNome: 'Operacional', subsetorNome: '1ª Cia' },
  ];

  assert.strictEqual(filtrarUnidadesCartoes(unidades, '').length, 2);
  assert.strictEqual(filtrarUnidadesCartoes(unidades, 'diretoria').length, 1);
  assert.strictEqual(filtrarUnidadesCartoes(unidades, 'DP').length, 1);
  assert.strictEqual(filtrarUnidadesCartoes(unidades, 'Choque').length, 1);
  assert.strictEqual(filtrarUnidadesCartoes(unidades, 'Operacional').length, 1);
  assert.strictEqual(filtrarUnidadesCartoes(unidades, 'Gabinete').length, 1);
  assert.strictEqual(filtrarUnidadesCartoes(unidades, 'Inexistente').length, 0);
});

test('listarTagsDisponiveisGestor aggregates and sorts tags correctly', () => {
  const militares = [
    { tags: [{ id: 'tag1', nome: 'Motorista' }, { id: 'tag2', nome: 'Socorrista' }] },
    { tags: [{ id: 'tag1', nome: 'Motorista' }] },
    { tags: [{ id: 'tag3', nome: 'Administrativo' }] },
  ];

  const tags = listarTagsDisponiveisGestor(militares);

  assert.strictEqual(tags.length, 3);
  // Sort by total DESC
  assert.strictEqual(tags[0].nome, 'Motorista');
  assert.strictEqual(tags[0].total, 2);
  // Then by name ASC
  assert.strictEqual(tags[1].nome, 'Administrativo');
  assert.strictEqual(tags[1].total, 1);
  assert.strictEqual(tags[2].nome, 'Socorrista');
  assert.strictEqual(tags[2].total, 1);
});

test('filtrarMilitaresGestor filters by search term', () => {
  const militares = [
    { nome: 'João Silva', matricula: '12345', cpf: '111.222.333-44', lotacao: 'DGP', posto_graduacao: 'Soldado' },
    { nome: 'Maria Santos', matricula: '67890', cpf: '555.666.777-88', lotacao: 'BM1', posto_graduacao: 'Cabo' },
  ];

  assert.strictEqual(filtrarMilitaresGestor(militares, '').length, 2);
  assert.strictEqual(filtrarMilitaresGestor(militares, 'João').length, 1);
  assert.strictEqual(filtrarMilitaresGestor(militares, '12345').length, 1);
  assert.strictEqual(filtrarMilitaresGestor(militares, '111.222').length, 1);
  assert.strictEqual(filtrarMilitaresGestor(militares, 'DGP').length, 1);
  assert.strictEqual(filtrarMilitaresGestor(militares, 'Soldado').length, 1);
  assert.strictEqual(filtrarMilitaresGestor(militares, 'inexistente').length, 0);
});

test('filtrarMilitaresGestor filters by tags (AND logic)', () => {
  const militares = [
    { id: 'm1', tags: [{ id: 't1', nome: 'Tag1' }, { id: 't2', nome: 'Tag2' }] },
    { id: 'm2', tags: [{ id: 't1', nome: 'Tag1' }] },
  ];

  assert.strictEqual(filtrarMilitaresGestor(militares, '', ['Tag1']).length, 2);
  assert.strictEqual(filtrarMilitaresGestor(militares, '', ['Tag1', 'Tag2']).length, 1);
  assert.strictEqual(filtrarMilitaresGestor(militares, '', ['Tag3']).length, 0);
});

test('filtrarMilitaresGestor combines search and tags', () => {
  const militares = [
    { nome: 'João', tags: [{ id: 't1', nome: 'Tag1' }] },
    { nome: 'Maria', tags: [{ id: 't1', nome: 'Tag1' }] },
  ];

  assert.strictEqual(filtrarMilitaresGestor(militares, 'João', ['Tag1']).length, 1);
  assert.strictEqual(filtrarMilitaresGestor(militares, 'Maria', ['Tag1']).length, 1);
  assert.strictEqual(filtrarMilitaresGestor(militares, 'João', ['Tag2']).length, 0);
});

test('filtrarMilitaresGestor handles normalization and case-insensitivity', () => {
  const militares = [
    { nome: 'João de Souza' },
  ];

  assert.strictEqual(filtrarMilitaresGestor(militares, 'joao').length, 1);
  assert.strictEqual(filtrarMilitaresGestor(militares, 'SOUZA').length, 1);
  assert.strictEqual(filtrarMilitaresGestor(militares, 'souza').length, 1);
});
