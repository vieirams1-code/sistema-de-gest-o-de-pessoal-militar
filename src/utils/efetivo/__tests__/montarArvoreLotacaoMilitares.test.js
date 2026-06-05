import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizarChaveBusca } from '../montarArvoreLotacaoMilitares.js';

describe('normalizarChaveBusca', () => {
  it('deve converter para minúsculo e remover espaços nas extremidades', () => {
    assert.strictEqual(normalizarChaveBusca('  TESTE  '), 'teste');
  });

  it('deve remover acentos e diacríticos', () => {
    assert.strictEqual(normalizarChaveBusca('SÃO PAULO'), 'sao paulo');
    assert.strictEqual(normalizarChaveBusca('Conceição do Araguaia'), 'conceicao do araguaia');
    assert.strictEqual(normalizarChaveBusca('ÁÉÍÓÚ àèìòù âêîôû äëïöü ãõ ñ ç'), 'aeiou aeiou aeiou aeiou ao n c');
  });

  it('deve colapsar múltiplos espaços em um único espaço', () => {
    assert.strictEqual(normalizarChaveBusca('militar   ativo'), 'militar ativo');
    assert.strictEqual(normalizarChaveBusca('  muitos    espacos   aqui  '), 'muitos espacos aqui');
  });

  it('deve lidar com null e undefined retornando string vazia', () => {
    assert.strictEqual(normalizarChaveBusca(null), '');
    assert.strictEqual(normalizarChaveBusca(undefined), '');
  });

  it('deve lidar com strings vazias ou apenas com espaços', () => {
    assert.strictEqual(normalizarChaveBusca(''), '');
    assert.strictEqual(normalizarChaveBusca('   '), '');
  });

  it('deve converter valores não-string para string antes de normalizar', () => {
    assert.strictEqual(normalizarChaveBusca(123), '123');
    assert.strictEqual(normalizarChaveBusca(true), 'true');
  });

  it('deve manter números e caracteres especiais básicos (exceto diacríticos)', () => {
    assert.strictEqual(normalizarChaveBusca('Unidade 01 - Teste!'), 'unidade 01 - teste!');
  });
});
