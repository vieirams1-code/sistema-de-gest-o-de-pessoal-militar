import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const cssUrl = new URL('../../components/documentosMilitares/documento-militar-preview.css', import.meta.url);

test('área de impressão permite paginação sem fixar conteúdo nas páginas seguintes', async () => {
  const css = await readFile(cssUrl, 'utf8');
  const blocoImpressao = css.match(/@media print\s*{([\s\S]*)}\s*$/)?.[1] || '';

  assert.doesNotMatch(blocoImpressao, /position:\s*fixed;/);
  assert.doesNotMatch(blocoImpressao, /\.documento-militar-print-area\s*{[^}]*position:/);
});

test('cabeçalho e assinatura não são fragmentados entre páginas', async () => {
  const css = await readFile(cssUrl, 'utf8');

  assert.match(css, /\.documento-militar-cabecalho\s*{[^}]*break-inside:\s*avoid;/);
  assert.match(css, /\.documento-militar-assinatura\s*{[^}]*break-inside:\s*avoid;/);
});
