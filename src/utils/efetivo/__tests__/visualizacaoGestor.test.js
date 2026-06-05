import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filtrarUnidadesCartoes,
  listarTagsDisponiveisGestor,
  filtrarMilitaresGestor,
} from '../visualizacaoGestor.js';

test('filtrarUnidadesCartoes deve filtrar unidades por texto', () => {
  const unidades = [
    { unidadeNome: 'Diretoria de Pessoal', unidadeSigla: 'DP', setorNome: 'Gabinete', subsetorNome: 'Secretaria' },
    { unidadeNome: '1º Batalhão de Bombeiros', unidadeSigla: '1º BBM', setorNome: 'Operacional', subsetorNome: '1ª Cia' },
  ];

  // Filtro por nome da unidade
  assert.equal(filtrarUnidadesCartoes(unidades, 'Diretoria').length, 1);
  assert.equal(filtrarUnidadesCartoes(unidades, 'Diretoria')[0].unidadeSigla, 'DP');

  // Filtro por sigla
  assert.equal(filtrarUnidadesCartoes(unidades, '1º BBM').length, 1);

  // Filtro por setor
  assert.equal(filtrarUnidadesCartoes(unidades, 'Gabinete').length, 1);

  // Filtro por subsetor
  assert.equal(filtrarUnidadesCartoes(unidades, '1ª Cia').length, 1);

  // Sem busca deve retornar tudo
  assert.equal(filtrarUnidadesCartoes(unidades, '').length, 2);
  assert.equal(filtrarUnidadesCartoes(unidades, null).length, 2);

  // Case insensitive
  assert.equal(filtrarUnidadesCartoes(unidades, 'diretoria').length, 1);
});

test('listarTagsDisponiveisGestor deve listar e contar tags corretamente', () => {
  const militares = [
    { nome: 'Militar 1', tags: ['Motorista', 'Socorrista'] },
    { nome: 'Militar 2', tags: ['Motorista', 'Mergulhador'] },
    { nome: 'Militar 3', tags: ['Socorrista'] },
  ];

  const tags = listarTagsDisponiveisGestor(militares);

  assert.equal(tags.length, 3);

  const motorista = tags.find(t => t.nome === 'Motorista');
  assert.equal(motorista.total, 2);

  const socorrista = tags.find(t => t.nome === 'Socorrista');
  assert.equal(socorrista.total, 2);

  const mergulhador = tags.find(t => t.nome === 'Mergulhador');
  assert.equal(mergulhador.total, 1);
});

test('listarTagsDisponiveisGestor deve lidar com diversos formatos de tags', () => {
  const militares = [
    { tags: ['Tag A', 'Tag B'] }, // Array de strings
    { marcadores: [{ nome: 'Tag A' }, { label: 'Tag C' }] }, // Objetos
    { tags_militar: 'Tag B; Tag D' }, // String separada por ponto e vírgula
    { funcoes: { 'Tag E': true, 'Tag F': 0, 'Tag G': 'true' } }, // Objeto com chaves
  ];

  const tags = listarTagsDisponiveisGestor(militares);
  const nomes = tags.map(t => t.nome).sort();

  // Tag A: 2, Tag B: 2, Tag C: 1, Tag D: 1, Tag E: 1, Tag G: 1
  // Tag F deve ser ignorada pois o valor é 0 (falsy)
  assert.ok(nomes.includes('Tag A'));
  assert.ok(nomes.includes('Tag B'));
  assert.ok(nomes.includes('Tag C'));
  assert.ok(nomes.includes('Tag D'));
  assert.ok(nomes.includes('Tag E'));
  assert.ok(nomes.includes('Tag G'));
  assert.ok(!nomes.includes('Tag F'));

  assert.equal(tags.find(t => t.nome === 'Tag A').total, 2);
  assert.equal(tags.find(t => t.nome === 'Tag B').total, 2);
});

test('listarTagsDisponiveisGestor deve ordenar por total descendente e nome ascendente', () => {
  const militaresReais = [
    { tags: ['A', 'B', 'C'] },
    { tags: ['A', 'B'] },
    { tags: ['A'] },
    { tags: ['D'] },
    { tags: ['E'] },
  ];
  // A=3, B=2, C=1, D=1, E=1
  // Ordem esperada: A (3), B (2), C (1), D (1), E (1)

  const tags = listarTagsDisponiveisGestor(militaresReais);

  assert.equal(tags[0].nome, 'A');
  assert.equal(tags[1].nome, 'B');
  assert.equal(tags[2].nome, 'C');
  assert.equal(tags[3].nome, 'D');
  assert.equal(tags[4].nome, 'E');

  // Testando empate no total, deve ir por ordem alfabética
  const militaresEmpate = [
    { tags: ['Beta'] },
    { tags: ['Alfa'] },
  ];
  const tagsEmpate = listarTagsDisponiveisGestor(militaresEmpate);
  assert.equal(tagsEmpate[0].nome, 'Alfa');
  assert.equal(tagsEmpate[1].nome, 'Beta');
});

test('filtrarMilitaresGestor deve filtrar por texto e tags', () => {
  const militares = [
    { nome: 'JOAO SILVA', matricula: '123', tags: ['Motorista'] },
    { nome: 'MARIA SANTOS', matricula: '456', tags: ['Motorista', 'Socorrista'] },
    { nome: 'PEDRO OLIVEIRA', matricula: '789', tags: ['Socorrista'] },
  ];

  // Filtro por nome
  assert.equal(filtrarMilitaresGestor(militares, 'JOAO').length, 1);
  assert.equal(filtrarMilitaresGestor(militares, 'JOAO')[0].nome, 'JOAO SILVA');

  // Filtro por matrícula
  assert.equal(filtrarMilitaresGestor(militares, '456').length, 1);
  assert.equal(filtrarMilitaresGestor(militares, '456')[0].nome, 'MARIA SANTOS');

  // Filtro por tag única
  assert.equal(filtrarMilitaresGestor(militares, '', ['Motorista']).length, 2);

  // Filtro por múltiplas tags (AND)
  assert.equal(filtrarMilitaresGestor(militares, '', ['Motorista', 'Socorrista']).length, 1);
  assert.equal(filtrarMilitaresGestor(militares, '', ['Motorista', 'Socorrista'])[0].nome, 'MARIA SANTOS');

  // Filtro por texto e tag
  assert.equal(filtrarMilitaresGestor(militares, 'MARIA', ['Motorista']).length, 1);
  assert.equal(filtrarMilitaresGestor(militares, 'JOAO', ['Socorrista']).length, 0);
});

test('listarTagsDisponiveisGestor deve lidar com militares sem tags ou lista vazia', () => {
  assert.deepEqual(listarTagsDisponiveisGestor([]), []);
  assert.deepEqual(listarTagsDisponiveisGestor(null), []);
  assert.deepEqual(listarTagsDisponiveisGestor([{ nome: 'Sem tags' }]), []);
});
