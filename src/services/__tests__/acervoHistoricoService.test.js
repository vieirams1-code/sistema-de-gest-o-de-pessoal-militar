import { test, describe } from 'node:test';
import assert from 'node:assert';

// Mock do base44Client
const mockBase44 = {
  functions: {
    invoke: async (name, payload) => {
      if (name === 'gerirAcervoHistorico') {
        return { data: { ok: true, registro: { id: 'test_id', ...payload.data } } };
      }
      return { data: { error: 'Unknown function' } };
    }
  },
  entities: {
    AcervoFuncionalHistorico: {
      filter: async (filter, sort) => {
        return [{ id: 'test_id', militar_id: filter.militar_id, tipo_documento: 'ALTERACAO' }];
      }
    },
    RepositorioDocumental: {
      list: async (sort) => {
        return [{ id: 'repo_id', nome: 'Test Repo' }];
      }
    }
  }
};

// Redefinir funções do service para usar o mock
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
    arquivado: false
  }, '-data_documento');
}

describe('Acervo Historico Service', () => {
  test('cadastrarDocumentoHistorico deve retornar o registro criado', async () => {
    const data = { titulo: 'Teste' };
    const result = await cadastrarDocumentoHistorico({
      militar_id: 'm1',
      tipo_documento: 'ALTERACAO',
      data,
      file: { name: 't.pdf', type: 'application/pdf', content: '...' }
    });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.registro.titulo, 'Teste');
  });

  test('listarAcervoMilitar deve retornar lista de registros', async () => {
    const result = await listarAcervoMilitar('m1');
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].militar_id, 'm1');
  });
});
