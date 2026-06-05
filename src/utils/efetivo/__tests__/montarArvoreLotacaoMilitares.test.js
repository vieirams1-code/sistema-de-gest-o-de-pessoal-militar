import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizarTagsMilitar, normalizarChaveBusca } from '../montarArvoreLotacaoMilitares.js';

test('normalizarChaveBusca deve normalizar strings corretamente', () => {
  assert.equal(normalizarChaveBusca('  AçãO   Teste  '), 'acao teste');
  assert.equal(normalizarChaveBusca(null), '');
  assert.equal(normalizarChaveBusca(undefined), '');
  assert.equal(normalizarChaveBusca(123), '123');
});

test('normalizarTagsMilitar deve lidar com militar nulo ou indefinido', () => {
  assert.deepEqual(normalizarTagsMilitar(null), []);
  assert.deepEqual(normalizarTagsMilitar(undefined), []);
  assert.deepEqual(normalizarTagsMilitar({}), []);
});

test('normalizarTagsMilitar deve extrair tags de diferentes campos', () => {
  const militar = {
    tags: ['tag1'],
    marcadores: ['tag2'],
    tags_operacionais: 'tag3;tag4',
    metadata: {
      tags: ['tag5']
    }
  };
  const resultado = normalizarTagsMilitar(militar);
  const nomes = resultado.map(t => t.nome);

  assert.ok(nomes.includes('tag1'));
  assert.ok(nomes.includes('tag2'));
  assert.ok(nomes.includes('tag3'));
  assert.ok(nomes.includes('tag4'));
  assert.ok(nomes.includes('tag5'));
});

test('normalizarTagsMilitar deve lidar com strings delimitadas', () => {
  const militar = {
    tags_militar: 'Férias; Licença, Especial | Urgente'
  };
  const resultado = normalizarTagsMilitar(militar);

  assert.equal(resultado.length, 4);
  assert.equal(resultado[0].nome, 'Férias');
  assert.equal(resultado[1].nome, 'Licença');
  assert.equal(resultado[2].nome, 'Especial');
  assert.equal(resultado[3].nome, 'Urgente');
});

test('normalizarTagsMilitar deve lidar com arrays de objetos', () => {
  const militar = {
    tags: [
      { nome: 'Tag Objeto', cor: 'blue' },
      { label: 'Tag Label', color: 'red' },
      { titulo: 'Tag Titulo', backgroundColor: 'green' },
      { tag: 'Tag CampoTag', id: 'id-custom' }
    ]
  };
  const resultado = normalizarTagsMilitar(militar);

  assert.equal(resultado.length, 4);

  assert.deepEqual(resultado[0], { id: 'tag objeto', nome: 'Tag Objeto', cor: 'blue' });
  assert.deepEqual(resultado[1], { id: 'tag label', nome: 'Tag Label', cor: 'red' });
  assert.deepEqual(resultado[2], { id: 'tag titulo', nome: 'Tag Titulo', cor: 'green' });
  assert.deepEqual(resultado[3], { id: 'id-custom', nome: 'Tag CampoTag', cor: undefined });
});

test('normalizarTagsMilitar deve lidar com objetos de flags (legacy markers)', () => {
  const militar = {
    tags: {
      'Motorista': true,
      'Socorrista': 'true',
      'Ativo': 1,
      'Inativo': false,
      'Outro': 0
    }
  };
  const resultado = normalizarTagsMilitar(militar);
  const nomes = resultado.map(t => t.nome);

  assert.equal(resultado.length, 3);
  assert.ok(nomes.includes('Motorista'));
  assert.ok(nomes.includes('Socorrista'));
  assert.ok(nomes.includes('Ativo'));
  assert.ok(!nomes.includes('Inativo'));
  assert.ok(!nomes.includes('Outro'));
});

test('normalizarTagsMilitar deve realizar deduplicação baseada na chave normalizada', () => {
  const militar = {
    tags: ['TAG1', 'tag1', '  Tag1  '],
    marcadores: [{ nome: 'tág1' }]
  };
  const resultado = normalizarTagsMilitar(militar);

  // Todas normalizam para 'tag1'
  assert.equal(resultado.length, 1);
  // Mantém o primeiro encontrado (TAG1)
  assert.equal(resultado[0].nome, 'TAG1');
});

test('normalizarTagsMilitar deve priorizar campos de identificação em objetos', () => {
  const militar = {
    tags: [
      { nome: 'Minha Tag', id: 'id-1' },
      { nome: 'Outra Tag', tag_id: 'id-2' },
      { nome: 'Mais uma', codigo: 'cod-3' }
    ]
  };
  const resultado = normalizarTagsMilitar(militar);

  assert.equal(resultado[0].id, 'id-1');
  assert.equal(resultado[1].id, 'id-2');
  assert.equal(resultado[2].id, 'cod-3');
});
