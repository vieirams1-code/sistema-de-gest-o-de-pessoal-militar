import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';

const fonte = await readFile(new URL('../../../base44/shared/conciliacao/identidadeMilitar.ts', import.meta.url), 'utf8');
const {
  normalizarTexto,
  extrairMatriculas,
  prepararIdentidadeMilitar,
  selecionarCitadosNoItem,
  textoDoAto,
} = await import('data:text/javascript;base64,' + Buffer.from(fonte).toString('base64'));

const EFETIVO = [
  { id: 'giane', posto: '1º Sargento', nome_guerra: 'GIANE', nome_completo: 'Giane Geller dos Santos', matricula: '124.324-021' },
  { id: 'jhonny', posto: '1º Tenente', nome_guerra: 'JHONNY', nome_completo: 'Jhonny Carlos Rodrigues', matricula: '111.222-033' },
  { id: 'wellington', posto: '1º Tenente', nome_guerra: 'WELLINGTON', nome_completo: 'Wellington Pereira Gomes', matricula: '222.333-044' },
  { id: 'marlise', posto: 'Tenente Coronel', nome_guerra: 'HELENA', nome_completo: 'Marlise Helena Ribeiro Bernardes de Barros', matricula: '100.000-011' },
].map(prepararIdentidadeMilitar);

const NOTA_GIANE = `NOTA Nº 1242232
1º SGT GIANE GELLER DOS SANTOS, matrícula 124.324-021, para gozo de férias.
MILITARES RELACIONADOS COM A NOTA: 1º SGT GIANE`;

const NOTA_JHONNY = `NOTA Nº 1242240
1º Tenente JHONNY CARLOS RODRIGUES, para responder pela função.
MILITARES RELACIONADOS COM A NOTA: 1º Tenente JHONNY`;

test('nome completo no texto identifica o militar correto (caso Giane)', () => {
  const citados = selecionarCitadosNoItem(NOTA_GIANE, EFETIVO);
  assert.deepEqual(citados.map((m) => m.id), ['giane']);
  assert.equal(citados[0].viaNome, true);
  assert.equal(citados[0].viaMatricula, true);
});

test('autoridade que aprova a nota não vira candidato', () => {
  const nota = `NOTA N. 1242232
A Comandante do 1º Grupamento, torna público que recebeu cópia do certificado
pertencente à bombeira militar abaixo relacionada: Curso a Distância, da
1ª SGT QBMP-1.a Giane Geller dos Santos, matrícula nº 124.324-021, promovido pela Rede Nacional.
Aprovado por: TC MARLISE HELENA RIBEIRO BERNARDES DE BARROS
MILITARES REL ACIONADOS COM A NOTA 1º SGT GIANE`;
  const citados = selecionarCitadosNoItem(nota, EFETIVO);
  assert.deepEqual(citados.map((m) => m.id), ['giane']);
});

test('lista de militares relacionados não identifica ninguém por si só', () => {
  const nota = `NOTA N. 1242240
Elogio ao 1º Tenente Jhonny Carlos Rodrigues pelo serviço prestado.
MILITARES RELACIONADOS COM A NOTA: 1º Tenente WELLINGTON PEREIRA GOMES`;
  assert.deepEqual(selecionarCitadosNoItem(nota, EFETIVO).map((m) => m.id), ['jhonny']);
});

test('textoDoAto corta aprovação e relacionados', () => {
  const corpo = textoDoAto('Corpo do ato. Aprovado por: TC HELENA. MILITARES RELACIONADOS COM A NOTA: X');
  assert.equal(corpo.trim(), 'Corpo do ato.');
});

test('matrícula em formatos diferentes identifica o militar', () => {
  for (const variante of ['124.324-021', '124324021', '124.324.021']) {
    const citados = selecionarCitadosNoItem(`Publicação da matrícula ${variante}.`, EFETIVO);
    assert.deepEqual(citados.map((m) => m.id), ['giane'], `falhou para ${variante}`);
  }
});

test('nome de guerra isolado não identifica ninguém', () => {
  const citados = selecionarCitadosNoItem('MILITARES RELACIONADOS COM A NOTA: 1º SGT GIANE', EFETIVO);
  assert.equal(citados.length, 0);
});

test('sobrenome isolado não identifica ninguém', () => {
  assert.equal(selecionarCitadosNoItem('O SANTOS compareceu ao expediente.', EFETIVO).length, 0);
  assert.equal(selecionarCitadosNoItem('O GOMES foi designado.', EFETIVO).length, 0);
});

test('nomes parecidos de mesmo posto não se cruzam (Jhonny x Wellington)', () => {
  const jhonny = selecionarCitadosNoItem(NOTA_JHONNY, EFETIVO).map((m) => m.id);
  assert.deepEqual(jhonny, ['jhonny']);

  const wellington = selecionarCitadosNoItem(
    'NOTA Nº 1242250 - 1º Tenente WELLINGTON PEREIRA GOMES, para responder pela função.',
    EFETIVO,
  ).map((m) => m.id);
  assert.deepEqual(wellington, ['wellington']);
});

test('nome completo fora de ordem não identifica', () => {
  assert.equal(selecionarCitadosNoItem('GIANE DOS SANTOS GELLER', EFETIVO).length, 0);
});

test('nome completo exige sequência contígua de todas as palavras', () => {
  assert.equal(selecionarCitadosNoItem('GIANE GELLER DOS SANTOS', EFETIVO).length, 1);
  assert.equal(selecionarCitadosNoItem('GIANE GELLER DOS SANTOS E OUTROS', EFETIVO).length, 1);
  assert.equal(selecionarCitadosNoItem('GIANE GELLER, DO SANTOS', EFETIVO).length, 0);
});

test('acentos e pontuação não impedem a correspondência do nome completo', () => {
  const militares = [prepararIdentidadeMilitar({
    id: 'jose', posto: 'Soldado', nome_guerra: 'JOSÉ', nome_completo: 'José Antônio Conceição', matricula: '999.888-777',
  })];
  const citados = selecionarCitadosNoItem('SD JOSE ANTONIO CONCEICAO — elogio.', militares);
  assert.deepEqual(citados.map((m) => m.id), ['jose']);
});

test('cadastro com apenas uma palavra no nome completo não identifica por nome', () => {
  const militares = [prepararIdentidadeMilitar({
    id: 'unico', posto: 'Soldado', nome_guerra: 'SILVA', nome_completo: 'Silva', matricula: '',
  })];
  assert.equal(selecionarCitadosNoItem('O SD SILVA compareceu.', militares).length, 0);
});

test('normalização e extração de matrículas', () => {
  assert.equal(normalizarTexto('  Giane  Geller-dos Santos '), 'GIANE GELLER DOS SANTOS');
  assert.deepEqual([...extrairMatriculas('mat. 124.324-021 e 12')], ['124324021']);
});