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

test('Soldado → Cabo sugere atualizar cadastro', () => {
  const resultado = sugestao('Soldado', 'Cabo');
  assert.equal(resultado.atualizar_cadastro_militar, true);
  assert.equal(resultado.motivo_atualizacao_cadastro, 'Promoção superior ao cadastro atual.');
  assert.equal(resultado.comparacao, 'superior');
});

test('Cabo → 3º Sgt sugere atualizar cadastro', () => {
  const resultado = sugestao('Cabo', '3º Sgt');
  assert.equal(normalizarPostoGraduacao('3º Sgt'), '3º Sargento');
  assert.equal(resultado.atualizar_cadastro_militar, true);
  assert.equal(resultado.motivo_atualizacao_cadastro, 'Promoção superior ao cadastro atual.');
});

test('Subtenente → 3º Sgt sugere preservar cadastro', () => {
  const resultado = sugestao('Subtenente', '3º Sgt');
  assert.equal(resultado.atualizar_cadastro_militar, false);
  assert.equal(resultado.motivo_atualizacao_cadastro, 'Militar já possui posto superior. Cadastro preservado.');
  assert.equal(resultado.comparacao, 'inferior');
});

test('3º Sgt → 3º Sgt sugere cadastro compatível', () => {
  const resultado = sugestao('3º Sargento', '3º Sgt');
  assert.equal(resultado.atualizar_cadastro_militar, false);
  assert.equal(resultado.motivo_atualizacao_cadastro, 'Cadastro já compatível.');
  assert.equal(resultado.comparacao, 'igual');
});

test('posto desconhecido sugere revisão', () => {
  const resultado = sugestao('Praça Especial', 'Cabo');
  assert.equal(resultado.atualizar_cadastro_militar, false);
  assert.equal(resultado.motivo_atualizacao_cadastro, 'Posto/graduação não reconhecido. Revisão necessária.');
  assert.equal(resultado.comparacao, 'desconhecido');
});

test('comparadores identificam superior, inferior e igual', () => {
  assert.equal(compararPostos('Major', 'Capitão'), 1);
  assert.equal(isPostoSuperior('Major', 'Capitão'), true);
  assert.equal(isPostoInferior('Cabo', 'Subtenente'), true);
  assert.equal(isPostoIgual('Tenente Coronel', 'Tenente-Coronel'), true);
});
