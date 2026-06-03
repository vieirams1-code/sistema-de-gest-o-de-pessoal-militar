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

test('defaults do papel timbrado incluem 5 linhas institucionais', () => {
  const dados = montarDadosDocumentoMilitarPreview({}, {});

  assert.deepEqual(dados.linhasInstitucionais, [
    'ESTADO DE MATO GROSSO DO SUL',
    'SECRETARIA DE ESTADO DE JUSTIÇA E SEGURANÇA PÚBLICA',
    'CORPO DE BOMBEIROS MILITAR',
    'COMANDO METROPOLITANO DE BOMBEIROS',
    '1º GRUPAMENTO DE BOMBEIROS MILITAR',
  ]);
  assert.equal(dados.orgaoLinha4, 'COMANDO METROPOLITANO DE BOMBEIROS');
  assert.equal(dados.orgaoLinha5, '1º GRUPAMENTO DE BOMBEIROS MILITAR');
  assert.equal(dados.tituloDocumentoPadrao, 'DOCUMENTO MILITAR');
});

test('configurações antigas com apenas 3 linhas continuam compatíveis', () => {
  const storage = criarStorage();
  storage.setItem(DOCUMENTO_MILITAR_PRINT_CONFIG_STORAGE_KEY, JSON.stringify({
    orgaoLinha1: 'Linha antiga 1',
    orgaoLinha2: 'Linha antiga 2',
    orgaoLinha3: 'Linha antiga 3',
  }));

  const config = carregarDocumentoMilitarPrintConfig(storage);
  const dados = montarDadosDocumentoMilitarPreview(config);

  assert.equal(dados.orgaoLinha1, 'Linha antiga 1');
  assert.equal(dados.orgaoLinha2, 'Linha antiga 2');
  assert.equal(dados.orgaoLinha3, 'Linha antiga 3');
  assert.equal(dados.orgaoLinha4, DOCUMENTO_MILITAR_PRINT_CONFIG_DEFAULTS.orgaoLinha4);
  assert.equal(dados.orgaoLinha5, DOCUMENTO_MILITAR_PRINT_CONFIG_DEFAULTS.orgaoLinha5);
  assert.equal(dados.mostrarRodape, true);
});

test('imagemCabecalhoSrc vazia não quebra preview', () => {
  const dados = montarDadosDocumentoMilitarPreview({ imagemCabecalhoSrc: '' });

  assert.equal(dados.imagemCabecalhoSrc, '');
  assert.deepEqual(dados.linhasInstitucionais, DOCUMENTO_MILITAR_PRINT_CONFIG_DEFAULTS
    ? [
      DOCUMENTO_MILITAR_PRINT_CONFIG_DEFAULTS.orgaoLinha1,
      DOCUMENTO_MILITAR_PRINT_CONFIG_DEFAULTS.orgaoLinha2,
      DOCUMENTO_MILITAR_PRINT_CONFIG_DEFAULTS.orgaoLinha3,
      DOCUMENTO_MILITAR_PRINT_CONFIG_DEFAULTS.orgaoLinha4,
      DOCUMENTO_MILITAR_PRINT_CONFIG_DEFAULTS.orgaoLinha5,
    ]
    : []);
});

test('imagemCabecalhoSrc preenchida aparece nos dados do preview', () => {
  const dados = montarDadosDocumentoMilitarPreview({ imagemCabecalhoSrc: ' https://example.com/logo.png ' });

  assert.equal(dados.imagemCabecalhoSrc, 'https://example.com/logo.png');
});

test('mostrarRodape controla renderização lógica do rodapé', () => {
  const comRodape = montarDadosDocumentoMilitarPreview({ mostrarRodape: true, rodapeLinha1: 'Unidade', rodapeLinha2: 'Endereço' });
  const semRodape = montarDadosDocumentoMilitarPreview({ mostrarRodape: false, rodapeLinha1: 'Unidade', rodapeLinha2: 'Endereço' });

  assert.deepEqual(comRodape.rodapeLinhas, ['Unidade', 'Endereço']);
  assert.deepEqual(semRodape.rodapeLinhas, []);
});

test('tituloDocumento usa valor do modal quando preenchido', () => {
  const dados = montarDadosDocumentoMilitarPreview({ tituloDocumentoPadrao: 'DOCUMENTO MILITAR' }, { tituloDocumento: ' TERMO DE COMPROMISSO ' });

  assert.equal(dados.tituloDocumento, 'TERMO DE COMPROMISSO');
});

test('tituloDocumento vazio usa tituloDocumentoPadrao', () => {
  const dados = montarDadosDocumentoMilitarPreview({ tituloDocumentoPadrao: 'PORTARIA' }, { tituloDocumento: '   ' });

  assert.equal(dados.tituloDocumento, 'PORTARIA');
});

test('salvamento persiste somente campos textuais/booleanos conhecidos da configuração', () => {
  const storage = criarStorage();
  salvarDocumentoMilitarPrintConfig({
    nomeSignatario: 'Ana',
    imagemCabecalhoSrc: 'data:image/png;base64,abc',
    mostrarRodape: false,
    signatarioMilitar: { id: 'militar-1', nome: 'Objeto completo indevido' },
    signatarioId: 'militar-1',
  }, storage);

  const raw = JSON.parse(storage.getItem(DOCUMENTO_MILITAR_PRINT_CONFIG_STORAGE_KEY));
  assert.equal(raw.nomeSignatario, 'Ana');
  assert.equal(raw.imagemCabecalhoSrc, 'data:image/png;base64,abc');
  assert.equal(raw.mostrarRodape, false);
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
    imagemCabecalhoSrc: '/brasao.svg',
    linhasInstitucionais: [
      DOCUMENTO_MILITAR_PRINT_CONFIG_DEFAULTS.orgaoLinha1,
      DOCUMENTO_MILITAR_PRINT_CONFIG_DEFAULTS.orgaoLinha2,
      DOCUMENTO_MILITAR_PRINT_CONFIG_DEFAULTS.orgaoLinha3,
      DOCUMENTO_MILITAR_PRINT_CONFIG_DEFAULTS.orgaoLinha4,
      DOCUMENTO_MILITAR_PRINT_CONFIG_DEFAULTS.orgaoLinha5,
    ],
    tituloDocumento: 'DOCUMENTO MILITAR',
    rodapeLinhas: [
      DOCUMENTO_MILITAR_PRINT_CONFIG_DEFAULTS.rodapeLinha1,
      DOCUMENTO_MILITAR_PRINT_CONFIG_DEFAULTS.rodapeLinha2,
    ],
    localAssinatura: 'Brasília.',
  });
});
