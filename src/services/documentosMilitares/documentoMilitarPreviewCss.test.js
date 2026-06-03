import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const cssUrl = new URL('../../components/documentosMilitares/documento-militar-preview.css', import.meta.url);
const previewUrl = new URL('../../components/documentosMilitares/DocumentoMilitarPreview.jsx', import.meta.url);
const modalUrl = new URL('../../components/documentosMilitares/GerarDocumentoMilitarModal.jsx', import.meta.url);

test('CSS não usa position fixed na prévia de impressão', async () => {
  const css = await readFile(cssUrl, 'utf8');

  assert.doesNotMatch(css, /position:\s*fixed;/);
  assert.doesNotMatch(css, /\.documento-militar-print-area\s*{[^}]*position:/);
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

test('modal renderiza apenas uma instância visível de DocumentoMilitarPreview e uma área de impressão', async () => {
  const modal = await readFile(modalUrl, 'utf8');
  const importacaoPreview = modal.match(/import DocumentoMilitarPreview/g) || [];
  const rendersPreview = modal.match(/<DocumentoMilitarPreview\b/g) || [];
  const areasDiretas = modal.match(/documento-militar-print-area/g) || [];

  assert.equal(importacaoPreview.length, 1);
  assert.equal(rendersPreview.length, 1);
  assert.equal(areasDiretas.length, 0);
});

test('configuração de cabeçalho não gera segunda área imprimível', async () => {
  const modal = await readFile(modalUrl, 'utf8');
  const preview = await readFile(previewUrl, 'utf8');

  assert.match(modal, /documento-militar-no-print mb-4[\s\S]*Configuração local da impressão/);
  assert.equal((preview.match(/<header className="documento-militar-cabecalho">/g) || []).length, 1);
  assert.equal((preview.match(/documento-militar-print-area/g) || []).length, 1);
});

test('impressão não possui cabeçalho isolado fora da área imprimível', async () => {
  const preview = await readFile(previewUrl, 'utf8');
  const modal = await readFile(modalUrl, 'utf8');

  assert.doesNotMatch(modal, /ESTADO DE MATO GROSSO DO SUL/);
  assert.match(preview, /<article className="documento-militar-print-area documento-militar-a4"[\s\S]*<header className="documento-militar-cabecalho">[\s\S]*<section className="documento-militar-corpo">/);
});

test('documento de uma página não gera duplicação estrutural por wrappers de impressão', async () => {
  const css = await readFile(cssUrl, 'utf8');
  const modal = await readFile(modalUrl, 'utf8');

  assert.match(modal, /documento-militar-print-shell/);
  assert.match(modal, /documento-militar-printing/);
  assert.doesNotMatch(css, /body\.documento-militar-printing > \*:not\([^)]*\)\s*{[^}]*display:\s*none !important;/);
  assert.match(css, /body\.documento-militar-printing \*\s*{[^}]*visibility:\s*hidden !important;/);
  assert.match(css, /body\.documento-militar-printing \.documento-militar-no-print\s*{[^}]*display:\s*none !important;[^}]*visibility:\s*hidden !important;/);
  assert.match(css, /body\.documento-militar-printing \.documento-militar-modal-print-root,[\s\S]*visibility:\s*visible !important;[\s\S]*position:\s*static !important;[\s\S]*display:\s*block !important;[\s\S]*overflow:\s*visible !important;/);
  assert.match(css, /body\.documento-militar-printing \.documento-militar-print-area,[\s\S]*body\.documento-militar-printing \.documento-militar-print-area \*\s*{[^}]*visibility:\s*visible !important;[^}]*overflow:\s*visible !important;/);
  assert.match(css, /body\.documento-militar-printing \.documento-militar-print-area\s*{[^}]*min-height:\s*0 !important;[^}]*break-before:\s*auto !important;[^}]*break-after:\s*auto !important;/);
});

test('impressão usa A4 real sem depender da prévia de tela', async () => {
  const css = await readFile(cssUrl, 'utf8');

  assert.match(css, /--documento-militar-page-width:\s*210mm;/);
  assert.match(css, /--documento-militar-page-height:\s*297mm;/);
  assert.match(css, /@page\s*{[^}]*size:\s*A4 portrait;[^}]*margin:\s*0;/);
  assert.match(css, /html,[\s\S]*body\s*{[^}]*width:\s*var\(--documento-militar-page-width\) !important;/);
  assert.match(css, /body\.documento-militar-printing \.documento-militar-print-area\s*{[^}]*width:\s*var\(--documento-militar-page-width\) !important;/);
  assert.doesNotMatch(css, /@media print[\s\S]*position:\s*fixed/);
});
