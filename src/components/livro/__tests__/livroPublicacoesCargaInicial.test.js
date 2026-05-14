import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../../../${path}`, import.meta.url), 'utf8');

function extractFunctionBody(source, functionName) {
  const signature = `export async function ${functionName}`;
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `função ${functionName} deve existir`);

  const bodyStart = source.indexOf(') {', start) + 2;
  assert.notEqual(bodyStart, 1, `função ${functionName} deve ter corpo`);

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) return source.slice(bodyStart, index + 1);
  }

  assert.fail(`não foi possível extrair corpo de ${functionName}`);
}

test('Publicações não carrega PeriodoAquisitivo na carga inicial do Livro', async () => {
  const source = await read('components/livro/livroService.js');
  const getLivroRegistrosContrato = extractFunctionBody(source, 'getLivroRegistrosContrato');

  assert.ok(!getLivroRegistrosContrato.includes('PeriodoAquisitivo.list('));
  assert.ok(!getLivroRegistrosContrato.includes('PeriodoAquisitivo.filter({ militar_id'));
  assert.match(getLivroRegistrosContrato, /periodos:\s*\[\]/);
});

test('Presenter de Publicações tolera contrato inicial sem lista válida de períodos', async () => {
  const source = await read('components/livro/livroRegistrosMapper.js');

  assert.match(source, /const periodosLista = Array\.isArray\(periodos\) \? periodos : \[\];/);
  assert.match(source, /const periodoById = new Map\(periodosLista\.map/);
});
