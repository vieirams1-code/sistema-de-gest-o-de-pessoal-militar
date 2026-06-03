import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const HELPERS_DOCUMENTOS_MILITARES = [
  'camposDinamicosDocumentoMilitar.js',
  'documentoMilitarPrintConfig.js',
  'documentoMilitarTemplateService.js',
  'documentoMilitarVarsService.js',
  'gerarDocumentoMilitarService.js',
  'substituirVariaveisDocumentoMilitar.js',
];

test('helpers de documentos militares permanecem isolados de entidades remotas e Militar.list()', async () => {
  const conteudos = await Promise.all(HELPERS_DOCUMENTOS_MILITARES.map((arquivo) => readFile(new URL(arquivo, import.meta.url), 'utf8')));

  conteudos.forEach((conteudo) => {
    assert.doesNotMatch(conteudo, /base44|entities\//);
    assert.doesNotMatch(conteudo, /Militar\s*\.\s*list\s*\(/);
  });
});

const militaresPageUrl = new URL('../../pages/Militares.jsx', import.meta.url);
const verMilitarPageUrl = new URL('../../pages/VerMilitar.jsx', import.meta.url);

test('Efetivo adiciona ação de Gerar Documento com guarda de seleção única', async () => {
  const source = await readFile(militaresPageUrl, 'utf8');

  assert.match(source, /Gerar Documento/);
  assert.match(source, /handleGerarDocumentoSelecionado/);
  assert.match(source, /selectedMilitarIds\.size === 0/);
  assert.match(source, /Neste momento, selecione apenas 1 militar\. A geração em lote será implementada posteriormente\./);
  assert.doesNotMatch(source, /Militar\.list\(/);
});

test('VerMilitar não renderiza painéis de Tags e Funções Militar na ficha', async () => {
  const source = await readFile(verMilitarPageUrl, 'utf8');

  assert.doesNotMatch(source, /<FuncoesMilitarSection/);
  assert.doesNotMatch(source, /<TagsMilitarSection/);
  assert.doesNotMatch(source, /Funções e Tags/);
});
