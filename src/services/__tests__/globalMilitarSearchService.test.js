import assert from 'node:assert/strict';
import test from 'node:test';

import {
  construirAtalhosMilitar,
  filtrarMilitaresGlobal,
  filtrarMilitaresPorEscopo,
} from '../globalMilitarSearchService.js';

const militaresMock = [
  {
    id: 'm1',
    nome_completo: 'João da Silva',
    nome_guerra: 'Silva',
    matricula: '12345',
    matricula_atual: '12345',
    cpf: '11122233344',
    posto_graduacao: 'Capitão',
  },
  {
    id: 'm2',
    nome_completo: 'Carlos Souza',
    nome_guerra: 'Souza',
    matricula: '998877',
    matricula_atual: '998877',
    cpf: '55566677788',
    posto_graduacao: 'Soldado',
  },
];

test('busca global encontra militar por nome', () => {
  const resultados = filtrarMilitaresGlobal(militaresMock, 'joão', { limit: 10 });
  assert.equal(resultados.length, 1);
  assert.equal(resultados[0].id, 'm1');
});

test('busca global encontra militar por matrícula', () => {
  const resultados = filtrarMilitaresGlobal(militaresMock, '998877', { limit: 10 });
  assert.equal(resultados.length, 1);
  assert.equal(resultados[0].id, 'm2');
});

test('busca global encontra militar por CPF', () => {
  const resultados = filtrarMilitaresGlobal(militaresMock, '11122233344', { limit: 10 });
  assert.equal(resultados.length, 1);
  assert.equal(resultados[0].id, 'm1');
});

test('atalhos respeitam permissões', () => {
  const permissoes = new Set(['visualizar_militares', 'visualizar_medalhas']);
  const atalhos = construirAtalhosMilitar({
    militarId: 'm1',
    canAccessAction: (acao) => permissoes.has(acao),
  });

  assert.deepEqual(
    atalhos.map((item) => item.key),
    ['perfil', 'medalhas'],
  );
});

test('escopo restrito exclui militar fora do escopo permitido', () => {
  const scoped = filtrarMilitaresPorEscopo(militaresMock, {
    hasAccess: (militar) => militar.id === 'm2',
    hasSelfAccess: () => false,
  });

  assert.equal(scoped.length, 1);
  assert.equal(scoped[0].id, 'm2');
});
