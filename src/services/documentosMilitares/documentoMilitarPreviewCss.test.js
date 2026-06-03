import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const cssUrl = new URL('../../components/documentosMilitares/documento-militar-preview.css', import.meta.url);
const previewUrl = new URL('../../components/documentosMilitares/DocumentoMilitarPreview.jsx', import.meta.url);
const printRootUrl = new URL('../../components/documentosMilitares/DocumentoMilitarPrintRoot.jsx', import.meta.url);
const modalUrl = new URL('../../components/documentosMilitares/GerarDocumentoMilitarModal.jsx', import.meta.url);

test('CSS não usa position fixed na prévia/impressão', async () => {
  const css = await readFile(cssUrl, 'utf8');

  assert.doesNotMatch(css, /position:\s*fixed/);
});

test('CSS contém regras para evitar fragmentação do cabeçalho, título e assinatura', async () => {
  const css = await readFile(cssUrl, 'utf8');

  assert.match(css, /\.documento-militar-cabecalho\s*{[^}]*break-inside:\s*avoid;/);
  assert.match(css, /\.documento-militar-titulo\s*{[^}]*break-inside:\s*avoid;/);
  assert.match(css, /\.documento-militar-assinatura\s*{[^}]*break-inside:\s*avoid;/);
});

test('DocumentoMilitarPreview gera apenas uma área imprimível', async () => {
  const preview = await readFile(previewUrl, 'utf8');
  const ocorrenciasArea = preview.match(/documento-militar-print-area/g) || [];

  assert.equal(ocorrenciasArea.length, 1);
  assert.match(preview, /<article className="documento-militar-print-area documento-militar-a4"/);
});

test('Modal possui prévia visual em tela E root de impressão separados', async () => {
  const modal = await readFile(modalUrl, 'utf8');

  // Prévia visual na tela
  assert.match(modal, /documento-militar-screen-preview/);
  // Root de impressão isolado, renderizado fora do dialog (irmão do modal)
  assert.match(modal, /<DocumentoMilitarPrintRoot\b/);
  // Import do componente isolado
  assert.match(modal, /import DocumentoMilitarPrintRoot/);
});

test('Root de impressão fica oculto em tela', async () => {
  const css = await readFile(cssUrl, 'utf8');

  assert.match(css, /\.documento-militar-print-root\s*{[^}]*display:\s*none;/);
});

test('Root de impressão fica visível no print e prévia visual é ocultada', async () => {
  const css = await readFile(cssUrl, 'utf8');

  // No modo print, a prévia visual e wrappers do modal são escondidos
  assert.match(
    css,
    /body\.documento-militar-printing[^{]*\.documento-militar-screen-preview[\s\S]*?display:\s*none\s*!important;/,
  );
  // O root de impressão fica visível e como bloco
  assert.match(
    css,
    /body\.documento-militar-printing\s+\.documento-militar-print-root\s*{[^}]*display:\s*block\s*!important;/,
  );
  assert.match(
    css,
    /body\.documento-militar-printing\s+\.documento-militar-print-root[\s\S]*?visibility:\s*visible\s*!important;/,
  );
});

test('Root de impressão contém exatamente uma área imprimível', async () => {
  const printRoot = await readFile(printRootUrl, 'utf8');

  const ocorrenciasPreview = printRoot.match(/<DocumentoMilitarPreview\b/g) || [];
  assert.equal(ocorrenciasPreview.length, 1);
});

test('CSS do root de impressão não depende de modal/grid/flex', async () => {
  const css = await readFile(cssUrl, 'utf8');

  // O bloco do root no print não pode declarar grid/flex
  const blocoMatch = css.match(/body\.documento-militar-printing\s+\.documento-militar-print-root\s*{[^}]*}/);
  assert.ok(blocoMatch, 'bloco CSS do print-root deveria existir');
  const bloco = blocoMatch[0];
  assert.doesNotMatch(bloco, /display:\s*grid/);
  assert.doesNotMatch(bloco, /display:\s*flex/);
  assert.doesNotMatch(bloco, /grid-template/);
  assert.doesNotMatch(bloco, /position:\s*fixed/);
});

test('Documento curto não tem regra estrutural que force quebra antes do corpo', async () => {
  const css = await readFile(cssUrl, 'utf8');

  // .documento-militar-a4 não pode ter min-height fixa (forçaria altura do A4 inteiro)
  assert.doesNotMatch(css, /\.documento-militar-a4\s*{[^}]*min-height:/);
  // O print-area no modo print precisa permitir break-before/after auto
  assert.match(
    css,
    /body\.documento-militar-printing\s+\.documento-militar-print-root\s+\.documento-militar-print-area\s*{[^}]*break-before:\s*auto\s*!important;/,
  );
  assert.match(
    css,
    /body\.documento-militar-printing\s+\.documento-militar-print-root\s+\.documento-militar-print-area\s*{[^}]*break-after:\s*auto\s*!important;/,
  );
  assert.match(
    css,
    /body\.documento-militar-printing\s+\.documento-militar-print-root\s+\.documento-militar-print-area\s*{[^}]*min-height:\s*0\s*!important;/,
  );
});

test('Impressão usa A4 real sem depender da prévia de tela', async () => {
  const css = await readFile(cssUrl, 'utf8');

  assert.match(css, /--documento-militar-page-width:\s*210mm;/);
  assert.match(css, /@page\s*{[^}]*size:\s*A4 portrait;[^}]*margin:\s*0;/);
});

test('Não usa position: fixed em nenhum lugar do CSS', async () => {
  const css = await readFile(cssUrl, 'utf8');

  assert.doesNotMatch(css, /position:\s*fixed/);
});