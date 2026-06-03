import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const cssUrl = new URL('../../components/documentosMilitares/documento-militar-preview.css', import.meta.url);
const previewUrl = new URL('../../components/documentosMilitares/DocumentoMilitarPreview.jsx', import.meta.url);
const printRootUrl = new URL('../../components/documentosMilitares/DocumentoMilitarPrintRoot.jsx', import.meta.url);
const modalUrl = new URL('../../components/documentosMilitares/GerarDocumentoMilitarModal.jsx', import.meta.url);

function blocoPrint(css) {
  const inicio = css.indexOf('@media print');
  assert.notEqual(inicio, -1, 'CSS deve possuir @media print');
  return css.slice(inicio);
}

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

test('DocumentoMilitarPreview separa variante visual e variante de impressão', async () => {
  const preview = await readFile(previewUrl, 'utf8');

  assert.match(preview, /variant = 'screen'/);
  assert.match(preview, /documento-militar-screen-document/);
  assert.match(preview, /documento-militar-print-document/);
  assert.match(preview, /aria-label=\{isPrint \? 'Documento militar para impressão' : 'Prévia do documento militar'\}/);
});

test('Modal possui prévia visual em tela e documento de impressão separados', async () => {
  const modal = await readFile(modalUrl, 'utf8');

  assert.match(modal, /documento-militar-screen-only/);
  assert.match(modal, /documento-militar-print-only-document/);
  assert.match(modal, /variant="screen"/);
  assert.match(modal, /variant="print"/);
  assert.doesNotMatch(modal, /<DocumentoMilitarPrintRoot\b/);
});

test('Versão de impressão fica oculta em tela', async () => {
  const css = await readFile(cssUrl, 'utf8');

  assert.match(css, /@media screen[\s\S]*\.documento-militar-print-only-document\s*{[\s\S]*display:\s*none !important;/);
});

test('No print, a prévia visual é ocultada e só o documento dedicado fica visível', async () => {
  const css = await readFile(cssUrl, 'utf8');
  const print = blocoPrint(css);

  assert.match(print, /body \*\s*{[\s\S]*visibility:\s*hidden !important;/);
  assert.match(print, /\.documento-militar-print-only-document,\s*\.documento-militar-print-only-document \*\s*{[\s\S]*visibility:\s*visible !important;/);
  assert.match(print, /\.documento-militar-screen-only[\s\S]*display:\s*none !important;/);
  assert.match(print, /\.documento-militar-screen-document[\s\S]*display:\s*none !important;/);
});

test('Root compatível contém exatamente uma prévia de impressão', async () => {
  const printRoot = await readFile(printRootUrl, 'utf8');

  const ocorrenciasPreview = printRoot.match(/<DocumentoMilitarPreview\b/g) || [];
  assert.equal(ocorrenciasPreview.length, 1);
  assert.match(printRoot, /documento-militar-print-only-document/);
  assert.match(printRoot, /variant="print"/);
  assert.doesNotMatch(printRoot, /documento-militar-print-root/);
});

test('CSS de impressão não depende de modal/grid/flex no documento dedicado', async () => {
  const css = await readFile(cssUrl, 'utf8');
  const blocoMatch = blocoPrint(css).match(/\.documento-militar-print-only-document\s*{[^}]*}/);

  assert.ok(blocoMatch, 'bloco CSS do print-only-document deveria existir');
  const bloco = blocoMatch[0];
  assert.match(bloco, /display:\s*block\s*!important;/);
  assert.doesNotMatch(bloco, /display:\s*grid/);
  assert.doesNotMatch(bloco, /display:\s*flex/);
  assert.doesNotMatch(bloco, /grid-template/);
  assert.doesNotMatch(bloco, /position:\s*fixed/);
});

test('Documento curto não tem regra estrutural que force quebra antes do corpo', async () => {
  const css = await readFile(cssUrl, 'utf8');
  const print = blocoPrint(css);

  assert.doesNotMatch(css, /\.documento-militar-a4\s*{[^}]*min-height:/);
  assert.doesNotMatch(print, /\.documento-militar-corpo[\s\S]*break-before:\s*page/i);
  assert.doesNotMatch(print, /\.documento-militar-corpo[\s\S]*page-break-before:\s*always/i);
  assert.doesNotMatch(print, /page-break-(before|after):\s*(always|left|right|page)/i);
});

test('Impressão usa A4 com margem de página, sem largura A4 fixa no print', async () => {
  const css = await readFile(cssUrl, 'utf8');
  const print = blocoPrint(css);

  assert.match(css, /--documento-militar-page-width:\s*210mm;/);
  assert.match(print, /@page\s*{[^}]*size:\s*A4 portrait;[^}]*margin:\s*12mm 16mm;/);
  assert.doesNotMatch(print, /width:\s*210mm/i);
  assert.doesNotMatch(print, /min-height:\s*297mm/i);
});

test('Não usa position: fixed em nenhum lugar do CSS', async () => {
  const css = await readFile(cssUrl, 'utf8');

  assert.doesNotMatch(css, /position:\s*fixed/);
});
