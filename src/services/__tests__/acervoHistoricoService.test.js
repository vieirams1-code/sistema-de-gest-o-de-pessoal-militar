import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  criarMensagemErroAcervo,
  getOpcoesToastErroAcervo,
  montarMensagemArquivoDuplicado,
  TOAST_DUPLICIDADE_ACERVO_DURATION,
} from '../acervoHistoricoErrors.js';

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


describe('Tratamento de duplicidade do acervo histórico', () => {
  test('formata duplicidade de Certidão de Comportamento', () => {
    assert.strictEqual(
      montarMensagemArquivoDuplicado({ tipo_documento: 'CERTIDAO_COMPORTAMENTO', data_documento: '2000-01-01' }),
      'Arquivo já cadastrado como Certidão de Comportamento em 01/01/2000.'
    );
  });

  test('formata duplicidade de Alteração', () => {
    assert.strictEqual(
      montarMensagemArquivoDuplicado({ tipo_documento: 'ALTERACAO', periodo_inicial: '2020-01-01', periodo_final: '2020-12-31' }),
      'Arquivo já cadastrado como Alteração referente ao período de 01/01/2020 a 31/12/2020.'
    );
  });

  test('formata duplicidade de Diversos', () => {
    assert.strictEqual(
      montarMensagemArquivoDuplicado({ tipo_documento: 'DIVERSOS', titulo: 'Portaria interna' }),
      'Arquivo já cadastrado como Diversos: Portaria interna.'
    );
  });

  test('usa mensagem segura para 409 genérico desconhecido', () => {
    assert.strictEqual(
      criarMensagemErroAcervo({ status: 409, message: 'Request failed with status code 409' }),
      'Não foi possível salvar o documento por conflito de dados. Verifique se o arquivo já está cadastrado.'
    );
  });

  test('usa mensagem base quando documento_existente está ausente', () => {
    assert.strictEqual(
      criarMensagemErroAcervo({ status: 409, code: 'ARQUIVO_DUPLICADO', message: 'Este arquivo já foi cadastrado para este militar.' }),
      'Este arquivo já foi cadastrado para este militar.'
    );
  });
});


describe('Toast de duplicidade do acervo histórico', () => {
  test('dobra o tempo de exibição apenas para ARQUIVO_DUPLICADO', () => {
    assert.deepStrictEqual(
      getOpcoesToastErroAcervo({ status: 409, code: 'ARQUIVO_DUPLICADO' }),
      { duration: TOAST_DUPLICIDADE_ACERVO_DURATION }
    );
    assert.strictEqual(TOAST_DUPLICIDADE_ACERVO_DURATION, 8000);
  });

  test('mantém demais erros sem duração customizada', () => {
    assert.deepStrictEqual(getOpcoesToastErroAcervo({ status: 409 }), {});
    assert.deepStrictEqual(getOpcoesToastErroAcervo(new Error('Falha')), {});
  });
});
