import test from 'node:test';
import assert from 'node:assert/strict';
import { abreviarPostoGraduacao, montarLinhaAssinatura } from './postoGraduacao.js';

test('abreviarPostoGraduacao - abreviações básicas', () => {
  assert.strictEqual(abreviarPostoGraduacao('Coronel'), 'CEL');
  assert.strictEqual(abreviarPostoGraduacao('Major'), 'MAJ');
  assert.strictEqual(abreviarPostoGraduacao('Capitão'), 'CAP');
  assert.strictEqual(abreviarPostoGraduacao('Subtenente'), 'ST');
  assert.strictEqual(abreviarPostoGraduacao('Cabo'), 'CB');
  assert.strictEqual(abreviarPostoGraduacao('Soldado'), 'SD');
});

test('abreviarPostoGraduacao - abreviações compostas mapeadas', () => {
  assert.strictEqual(abreviarPostoGraduacao('1 Tenente'), '1° TEN');
  assert.strictEqual(abreviarPostoGraduacao('2 Tenente'), '2° TEN');
  assert.strictEqual(abreviarPostoGraduacao('1 Sargento'), '1° SGT');
});

test('abreviarPostoGraduacao - abreviações compostas dinâmicas (regex)', () => {
  assert.strictEqual(abreviarPostoGraduacao('4 Tenente'), '4° TEN');
  assert.strictEqual(abreviarPostoGraduacao('5 Sargento'), '5° SGT');
});

test('abreviarPostoGraduacao - normalização de entrada', () => {
  assert.strictEqual(abreviarPostoGraduacao('  coronel  '), 'CEL');
  assert.strictEqual(abreviarPostoGraduacao('CAPITÃO'), 'CAP');
  assert.strictEqual(abreviarPostoGraduacao('1º Tenente'), '1° TEN');
  assert.strictEqual(abreviarPostoGraduacao('2° Sargento'), '2° SGT');
  assert.strictEqual(abreviarPostoGraduacao('Tenente   Coronel'), 'TC');
});

test('abreviarPostoGraduacao - casos de borda e fallback', () => {
  assert.strictEqual(abreviarPostoGraduacao(''), '');
  assert.strictEqual(abreviarPostoGraduacao(null), '');
  assert.strictEqual(abreviarPostoGraduacao(undefined), '');
  assert.strictEqual(abreviarPostoGraduacao('Posto Desconhecido'), 'POSTO DESCONHECIDO');
});

test('montarLinhaAssinatura - composição completa', () => {
  const nome = 'Gabriel Mendes';
  const posto = '1 Tenente';
  const quadro = 'QOBM';

  // \u00A0 é o espaço não-quebrável usado entre o posto e o quadro
  const resultado = montarLinhaAssinatura(nome, posto, quadro);
  assert.strictEqual(resultado, 'Gabriel Mendes - 1° TEN\u00A0QOBM');
});

test('montarLinhaAssinatura - sem quadro', () => {
  const resultado = montarLinhaAssinatura('Gabriel Mendes', 'Major', '');
  assert.strictEqual(resultado, 'Gabriel Mendes - MAJ');
});

test('montarLinhaAssinatura - sem posto', () => {
  const resultado = montarLinhaAssinatura('Gabriel Mendes', '', 'QOBM');
  assert.strictEqual(resultado, 'Gabriel Mendes - QOBM');
});

test('montarLinhaAssinatura - apenas nome', () => {
  const resultado = montarLinhaAssinatura('Gabriel Mendes', '', '');
  assert.strictEqual(resultado, 'Gabriel Mendes');
});
