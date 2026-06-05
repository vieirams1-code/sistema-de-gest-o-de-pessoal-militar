import test from 'node:test';
import assert from 'node:assert/strict';

import { calcularResumoTags } from '../montarArvoreLotacaoMilitares.js';

test('calcularResumoTags lida com entradas nulas ou vazias', () => {
  assert.deepEqual(calcularResumoTags(null), []);
  assert.deepEqual(calcularResumoTags(undefined), []);
  assert.deepEqual(calcularResumoTags([]), []);
});

test('calcularResumoTags agrupa e conta tags de múltiplos militares', () => {
  const militares = [
    { tags: ['Tag A', 'Tag B'] },
    { marcadores: ['Tag A', 'Tag C'] },
    { funcoes: ['Tag B'] },
  ];

  const resultado = calcularResumoTags(militares);

  // Esperado: Tag A (2), Tag B (2), Tag C (1)
  // Ordenação: total desc, nome asc
  assert.equal(resultado.length, 3);

  assert.equal(resultado[0].nome, 'Tag A');
  assert.equal(resultado[0].total, 2);

  assert.equal(resultado[1].nome, 'Tag B');
  assert.equal(resultado[1].total, 2);

  assert.equal(resultado[2].nome, 'Tag C');
  assert.equal(resultado[2].total, 1);
});

test('calcularResumoTags normaliza nomes de tags (acentos e caixa)', () => {
  const militares = [
    { tags: ['AÇÃO', 'acao'] },
    { tags: ['Ação'] },
  ];

  const resultado = calcularResumoTags(militares);

  // normalizarChaveBusca deve transformar tudo em 'acao'
  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].id, 'acao');
  assert.equal(resultado[0].total, 2); // 2 militares têm a tag 'acao' (um deles tem duplicado internamente mas normalizarTagsMilitar deduplica)
});

test('calcularResumoTags suporta diversos formatos de fontes de tags', () => {
  const militares = [
    {
      tags: ['String Tag'],
      marcadores: [{ nome: 'Object Tag', cor: 'blue' }],
      funcoes: 'CSV Tag 1, CSV Tag 2',
      metadata: { tags: { 'Boolean Tag': true } }
    }
  ];

  const resultado = calcularResumoTags(militares);

  const nomes = resultado.map(r => r.nome).sort();
  assert.deepEqual(nomes, ['Boolean Tag', 'CSV Tag 1', 'CSV Tag 2', 'Object Tag', 'String Tag']);
});

test('calcularResumoTags ordena por total decrescente e depois por nome crescente', () => {
  const militares = [
    { tags: ['B', 'A', 'C'] },
    { tags: ['B', 'A'] },
    { tags: ['B'] },
  ];

  const resultado = calcularResumoTags(militares);

  // B (3), A (2), C (1)
  assert.equal(resultado[0].nome, 'B');
  assert.equal(resultado[1].nome, 'A');
  assert.equal(resultado[2].nome, 'C');
});

test('calcularResumoTags lida com empate no total usando ordem alfabética', () => {
  const militares = [
    { tags: ['Z', 'B', 'A'] },
  ];

  const resultado = calcularResumoTags(militares);

  // Todos com total 1
  assert.equal(resultado[0].nome, 'A');
  assert.equal(resultado[1].nome, 'B');
  assert.equal(resultado[2].nome, 'Z');
});
