import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const read = (path) => readFile(new URL(`../../../${path}`, import.meta.url), 'utf8');


async function loadLivroRegistrosMapper(t) {
  const server = await createServer({
    configFile: false,
    server: { middlewareMode: true },
    appType: 'custom',
    resolve: {
      alias: {
        '@': resolve('src'),
      },
    },
    optimizeDeps: {
      noDiscovery: true,
    },
  });

  t.after(async () => {
    await server.close();
  });

  return server.ssrLoadModule('/src/components/livro/livroRegistrosMapper.js');
}

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


test('Presenter preserva ferias_id e periodo_aquisitivo_id top-level mesmo sem Ferias na carga inicial', async (t) => {
  const { mapLivroRegistrosPresenter } = await loadLivroRegistrosMapper(t);

  const contrato = mapLivroRegistrosPresenter({
    registros: [
      {
        id: 'registro-livro-1',
        tipo_registro: 'Saída de Férias',
        ferias_id: 'ferias-123',
        periodo_aquisitivo_id: 'periodo-2026',
        militar_id: 'militar-1',
        data_inicio: '2026-01-10',
        dias: 10,
      },
    ],
    militares: [],
    ferias: [],
    periodos: [],
  });

  const [registroFinal] = contrato.registros_livro;

  assert.equal(registroFinal.ferias_id, 'ferias-123');
  assert.equal(registroFinal.periodo_aquisitivo_id, 'periodo-2026');
  assert.equal(registroFinal.vinculos.ferias, null);
  assert.equal(registroFinal.vinculos.periodo, null);
});

test('Presenter mantém compatibilidade com vinculos.ferias quando Ferias segue carregada', async (t) => {
  const { mapLivroRegistrosPresenter } = await loadLivroRegistrosMapper(t);

  const contrato = mapLivroRegistrosPresenter({
    registros: [
      {
        id: 'registro-livro-2',
        tipo_registro: 'Retorno de Férias',
        ferias_id: 'ferias-456',
        militar_id: 'militar-1',
        data_inicio: '2026-02-20',
      },
    ],
    militares: [],
    ferias: [
      {
        id: 'ferias-456',
        dias: 15,
        periodo_aquisitivo_id: 'periodo-via-ferias',
      },
    ],
    periodos: [
      {
        id: 'periodo-via-ferias',
        ano_referencia: '2026',
      },
    ],
  });

  const [registroFinal] = contrato.registros_livro;

  assert.equal(registroFinal.ferias_id, 'ferias-456');
  assert.equal(registroFinal.periodo_aquisitivo_id, 'periodo-via-ferias');
  assert.equal(registroFinal.vinculos.ferias.id, 'ferias-456');
  assert.equal(registroFinal.vinculos.periodo.id, 'periodo-via-ferias');
});

test('Publicações normaliza Livro priorizando ferias_id e periodo_aquisitivo_id top-level', async () => {
  const source = await read('pages/Publicacoes.jsx');

  assert.match(source, /ferias_id:\s*origemTipo === 'livro' \? \(registro\.ferias_id \|\| registro\?\.vinculos\?\.ferias\?\.id\)/);
  assert.match(source, /periodo_aquisitivo_id:\s*origemTipo === 'livro' \? \(registro\.periodo_aquisitivo_id \|\| registro\?\.vinculos\?\.periodo\?\.id\)/);
});
