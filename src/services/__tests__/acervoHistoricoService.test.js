import { test, describe } from 'node:test';
import assert from 'node:assert';

// Mock mínimo do backend oficial de upload do acervo.
const mockBase44 = {
  functions: {
    invoke: async (name, payload) => {
      if (name === 'gerirAcervoHistorico') {
        return { data: { ok: true, registro: { id: 'test_id', arquivo_url: 'https://storage/arquivo.pdf', ...payload.data } } };
      }
      return { data: { error: 'Unknown function' } };
    }
  },
  entities: {
    AcervoFuncionalHistorico: {
      filter: async (filter) => [{ id: 'test_id', militar_id: filter.militar_id, tipo_documento: 'ALTERACAO', arquivo_url: 'https://storage/arquivo.pdf' }]
    }
  }
};

async function cadastrarDocumentoHistorico({ militar_id, tipo_documento, data, file }) {
  const response = await mockBase44.functions.invoke('gerirAcervoHistorico', {
    militar_id,
    tipo_documento,
    data,
    file
  });
  const body = response?.data ?? response;
  if (body?.error) throw new Error(body.error);
  return body;
}

async function listarAcervoMilitar(militar_id) {
  return await mockBase44.entities.AcervoFuncionalHistorico.filter({
    militar_id,
    ativo: true,
    status_documento: 'ATIVO',
    arquivado: false
  }, '-data_documento');
}

function contarDocumentosAcervo(acervo = []) {
  return acervo.reduce((acc, doc) => {
    if (!doc || doc.arquivado) return acc;
    if (doc.ativo !== false && doc.status_documento === 'ATIVO') {
      if (doc.tipo_documento === 'ALTERACAO') acc.alteracoes += 1;
      if (doc.tipo_documento === 'CERTIDAO_COMPORTAMENTO') acc.certidoes += 1;
      if (doc.tipo_documento === 'DIVERSOS') acc.diversos += 1;
      acc.total += 1;
    }
    if (doc.ativo === false && !doc.arquivado) acc.lixeira += 1;
    return acc;
  }, { alteracoes: 0, certidoes: 0, diversos: 0, total: 0, lixeira: 0 });
}

describe('Acervo Historico Service', () => {
  test('cadastrarDocumentoHistorico retorna registro criado no storage oficial', async () => {
    const data = { titulo: 'Teste' };
    const result = await cadastrarDocumentoHistorico({
      militar_id: 'm1',
      tipo_documento: 'ALTERACAO',
      data,
      file: { name: 't.pdf', type: 'application/pdf', content: '...' }
    });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.registro.titulo, 'Teste');
    assert.strictEqual(result.registro.arquivo_url, 'https://storage/arquivo.pdf');
  });

  test('listarAcervoMilitar retorna lista de registros ativos', async () => {
    const result = await listarAcervoMilitar('m1');
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].militar_id, 'm1');
  });

  test('contarDocumentosAcervo consolida cobertura e lixeira', () => {
    const contadores = contarDocumentosAcervo([
      { tipo_documento: 'ALTERACAO', ativo: true, status_documento: 'ATIVO' },
      { tipo_documento: 'CERTIDAO_COMPORTAMENTO', ativo: true, status_documento: 'ATIVO' },
      { tipo_documento: 'DIVERSOS', ativo: false, status_documento: 'ATIVO' },
    ]);

    assert.deepStrictEqual(contadores, { alteracoes: 1, certidoes: 1, diversos: 0, total: 2, lixeira: 1 });
  });
});
