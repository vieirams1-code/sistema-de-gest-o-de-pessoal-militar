import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DOCUMENTO_MILITAR_PRINT_CONFIG_DEFAULTS,
  DOCUMENTO_MILITAR_PRINT_CONFIG_STORAGE_KEY,
  carregarDocumentoMilitarPrintConfig,
  montarDadosDocumentoMilitarPreview,
  salvarDocumentoMilitarPrintConfig,
} from './documentoMilitarPrintConfig.js';

function criarStorage() {
  const itens = new Map();
  return {
    getItem: (chave) => itens.get(chave) ?? null,
    setItem: (chave, valor) => itens.set(chave, valor),
  };
}

test('retorna defaults quando localStorage está vazio', () => {
  assert.deepEqual(carregarDocumentoMilitarPrintConfig(criarStorage()), DOCUMENTO_MILITAR_PRINT_CONFIG_DEFAULTS);
});

test('mescla configuração parcial salva com defaults', () => {
  const storage = criarStorage();
  storage.setItem(DOCUMENTO_MILITAR_PRINT_CONFIG_STORAGE_KEY, JSON.stringify({ mostrarCabecalho: false, cidadePadrao: 'Brasília' }));

  assert.deepEqual(carregarDocumentoMilitarPrintConfig(storage), {
    ...DOCUMENTO_MILITAR_PRINT_CONFIG_DEFAULTS,
    mostrarCabecalho: false,
    cidadePadrao: 'Brasília',
  });
});

test('salva e recarrega configuração local normalizada', () => {
  const storage = criarStorage();
  salvarDocumentoMilitarPrintConfig({ mostrarAssinatura: false, nomeSignatario: '  Maria da Silva  ' }, storage);

  assert.deepEqual(carregarDocumentoMilitarPrintConfig(storage), {
    ...DOCUMENTO_MILITAR_PRINT_CONFIG_DEFAULTS,
    mostrarAssinatura: false,
    nomeSignatario: 'Maria da Silva',
  });
});

test('dados do preview respeitam cabeçalho, assinatura, brasão disponível e cidade padrão', () => {
  assert.deepEqual(montarDadosDocumentoMilitarPreview({
    mostrarCabecalho: false,
    mostrarAssinatura: false,
    mostrarBrasao: true,
    cidadePadrao: 'Brasília',
  }, { brasaoSrc: '/brasao.svg' }), {
    ...DOCUMENTO_MILITAR_PRINT_CONFIG_DEFAULTS,
    mostrarCabecalho: false,
    mostrarAssinatura: false,
    cidadePadrao: 'Brasília',
    brasaoSrc: '/brasao.svg',
    localAssinatura: 'Brasília.',
  });
});
