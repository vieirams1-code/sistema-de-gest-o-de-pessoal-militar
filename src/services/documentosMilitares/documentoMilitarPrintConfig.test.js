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


test('aplica defaults institucionais do cabeçalho do documento militar', () => {
  const dados = montarDadosDocumentoMilitarPreview({}, {});

  assert.equal(dados.orgaoLinha1, 'CORPO DE BOMBEIROS MILITAR DO ESTADO DE MATO GROSSO DO SUL');
  assert.equal(dados.orgaoLinha2, '1º GRUPAMENTO DE BOMBEIROS MILITAR');
  assert.equal(dados.orgaoLinha3, 'SEÇÃO DE GESTÃO DE PESSOAS');
  assert.equal(dados.tituloDocumentoPadrao, 'DOCUMENTO MILITAR');
});

test('salvamento persiste somente campos textuais/booleanos conhecidos da configuração', () => {
  const storage = criarStorage();
  salvarDocumentoMilitarPrintConfig({
    nomeSignatario: 'Ana',
    signatarioMilitar: { id: 'militar-1', nome: 'Objeto completo indevido' },
    signatarioId: 'militar-1',
  }, storage);

  const raw = JSON.parse(storage.getItem(DOCUMENTO_MILITAR_PRINT_CONFIG_STORAGE_KEY));
  assert.equal(raw.nomeSignatario, 'Ana');
  assert.equal(Object.hasOwn(raw, 'signatarioMilitar'), false);
  assert.equal(Object.hasOwn(raw, 'signatarioId'), false);
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
