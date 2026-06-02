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
