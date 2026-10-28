import test from 'node:test';
import assert from 'node:assert/strict';
import { extrairNotasDasPaginas } from './extrairNotasTexto.js';

test('lê nota de múltiplas páginas, com número, texto e página inicial', () => {
  const r = extrairNotasDasPaginas([
    { pagina: 1, texto: 'BOLETIM GERAL\nNOTA Nº 001234\nDesignação do militar Alfa\nContinua a matéria' },
    { pagina: 2, texto: 'com detalhes complementares, término da publicação.\nNOTA Nº 5678\nElogio ao militar Beta' },
  ]);
  assert.equal(r.notas.length, 2);
  assert.equal(r.notas[0].nota, '1234');
  assert.equal(r.notas[0].pagina, 1);
  assert.deepEqual(r.notas[0].paginas, [1,2]);
  assert.match(r.notas[0].contexto, /detalhes complementares/);
  assert.equal(r.notas[1].nota, '5678');
  assert.equal(r.notas[1].pagina, 2);
});

test('indica páginas digitalizadas sem texto extraível', () => {
  const r = extrairNotasDasPaginas([{ pagina: 1, texto: '' }, { pagina: 2, texto: 'NOTA N° 2345\nConteúdo' }]);
  assert.deepEqual(r.paginasSemTexto, [1]);
  assert.equal(r.notas.length, 1);
});

test('não trata texto sem nota como conferência negativa', () => {
  const r = extrairNotasDasPaginas([{ pagina: 1, texto: 'Portaria sem cabeçalho de nota' }]);
  assert.equal(r.notas.length, 0);
  assert.equal(r.totalPaginas, 1);
});
