import test from 'node:test';
import assert from 'node:assert/strict';

import {
  compararPostos,
  getSugestaoAtualizacaoCadastro,
  isPostoIgual,
  isPostoInferior,
  isPostoSuperior,
  normalizarPostoGraduacao,
} from '../postoGraduacaoHierarquia.js';

function sugestao(postoAtual, postoNovo) {
  return getSugestaoAtualizacaoCadastro({
    militar: { posto_graduacao: postoAtual },
    promocao: { posto_graduacao: postoNovo },
  });
}

test('promoção inferior retorna histórica, não atualiza e não bloqueia', () => {
  const resultado = sugestao('1º Sargento', '3º Sgt');
  assert.equal(resultado.tipo, 'historica');
  assert.equal(resultado.atualizar, false);
  assert.equal(resultado.titulo, 'Promoção histórica');
  assert.equal(resultado.mensagem, 'Não altera o cadastro atual.');
  assert.equal(resultado.bloqueiaSalvar, false);
});

test('promoção igual retorna atual, não atualiza e não bloqueia', () => {
  const resultado = sugestao('3º Sargento', '3º Sgt');
  assert.equal(resultado.tipo, 'atual');
  assert.equal(resultado.atualizar, false);
  assert.equal(resultado.titulo, 'Promoção atual');
  assert.equal(resultado.mensagem, 'Cadastro já compatível.');
  assert.equal(resultado.bloqueiaSalvar, false);
});

test('promoção imediatamente superior atualiza cadastro e não bloqueia', () => {
  const resultado = sugestao('Cabo', '3º Sgt');
  assert.equal(normalizarPostoGraduacao('3º Sgt'), '3º Sargento');
  assert.equal(resultado.tipo, 'imediatamente_superior');
  assert.equal(resultado.atualizar, true);
  assert.equal(resultado.titulo, 'Cadastro será atualizado');
  assert.equal(resultado.mensagem, 'Promoção imediatamente superior ao cadastro atual.');
  assert.equal(resultado.bloqueiaSalvar, false);
});


test('2º Tenente para 1º Tenente é imediatamente superior em todas as nomenclaturas usuais', () => {
  const postosAtuais = ['2º Ten', '2º Tenente', 'Segundo Tenente', '2° Ten', '2o Ten BM'];
  const postosNovos = ['1º Ten', '1º Tenente', 'Primeiro Tenente', '1° Ten', '1o Ten BM'];

  for (const postoAtual of postosAtuais) {
    assert.equal(normalizarPostoGraduacao(postoAtual), '2º Tenente');
  }
  for (const postoNovo of postosNovos) {
    assert.equal(normalizarPostoGraduacao(postoNovo), '1º Tenente');
  }

  for (const postoAtual of postosAtuais) {
    for (const postoNovo of postosNovos) {
      const resultado = sugestao(postoAtual, postoNovo);
      assert.equal(resultado.tipo, 'imediatamente_superior', `${postoAtual} -> ${postoNovo}`);
      assert.equal(resultado.titulo, 'Cadastro será atualizado');
      assert.equal(resultado.bloqueiaSalvar, false);
    }
  }
});


test('runtime de Tenentes aceita origem e destino em formato completo, abreviado e por extenso', () => {
  const casos = [
    ['2º Tenente', '1º Tenente'],
    ['2º Ten', '1º Ten'],
    ['Segundo Tenente', 'Primeiro Tenente'],
  ];

  for (const [postoAtual, postoNovo] of casos) {
    const resultado = sugestao(postoAtual, postoNovo);
    assert.equal(resultado.tipo, 'imediatamente_superior', `${postoAtual} -> ${postoNovo}`);
    assert.equal(resultado.titulo, 'Cadastro será atualizado');
    assert.equal(resultado.atualizar, true);
    assert.equal(resultado.bloqueiaSalvar, false);
  }
});

test('runtime de Tenentes ignora quadro anexado ao texto exibido pela UI', () => {
  const resultado = sugestao('2º Tenente • QOBM', '1º Tenente • QOBM');

  assert.equal(normalizarPostoGraduacao('2º Tenente • QOBM'), '2º Tenente');
  assert.equal(normalizarPostoGraduacao('1º Tenente • QOBM'), '1º Tenente');
  assert.equal(resultado.tipo, 'imediatamente_superior');
  assert.equal(resultado.bloqueiaSalvar, false);
});

test('promoção duas ou mais acima retorna incompatível e bloqueia', () => {
  const resultado = sugestao('Soldado', '3º Sgt');
  assert.equal(resultado.tipo, 'incompativel');
  assert.equal(resultado.atualizar, false);
  assert.equal(resultado.titulo, 'Promoção incompatível');
  assert.equal(resultado.mensagem, 'Está duas ou mais graduações acima do cadastro atual.');
  assert.equal(resultado.bloqueiaSalvar, true);
});


test('bloqueia somente quando promoção está duas ou mais posições acima ou há posto desconhecido', () => {
  assert.equal(sugestao('2º Tenente', '1º Tenente').bloqueiaSalvar, false);
  assert.equal(sugestao('2º Tenente', 'Capitão').bloqueiaSalvar, true);
  assert.equal(sugestao('Posto inexistente', '1º Tenente').bloqueiaSalvar, true);
});

test('posto desconhecido retorna revisão e bloqueia', () => {
  const resultado = sugestao('Praça Especial', 'Cabo');
  assert.equal(resultado.tipo, 'revisao');
  assert.equal(resultado.atualizar, false);
  assert.equal(resultado.titulo, 'Revisar cadastro');
  assert.equal(resultado.mensagem, 'Posto/graduação não reconhecido.');
  assert.equal(resultado.bloqueiaSalvar, true);
});

test('comparadores identificam superior, inferior e igual', () => {
  assert.equal(compararPostos('Major', 'Capitão'), 1);
  assert.equal(isPostoSuperior('Major', 'Capitão'), true);
  assert.equal(isPostoInferior('Cabo', 'Subtenente'), true);
  assert.equal(isPostoIgual('Tenente Coronel', 'Tenente-Coronel'), true);
});
