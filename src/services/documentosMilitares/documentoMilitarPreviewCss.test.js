import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const cssUrl = new URL('../../components/documentosMilitares/documento-militar-preview.css', import.meta.url);
const previewUrl = new URL('../../components/documentosMilitares/DocumentoMilitarPreview.jsx', import.meta.url);

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

test('impressão continua limitada a uma única área .documento-militar-print-area', async () => {
  const preview = await readFile(previewUrl, 'utf8');
  const ocorrenciasArea = preview.match(/documento-militar-print-area/g) || [];

  assert.equal(ocorrenciasArea.length, 1);
});
