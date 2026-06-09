import test from 'node:test';
import assert from 'node:assert/strict';
import {
  __setMigracaoAlteracoesLegadoClientForTests,
  __resetMigracaoAlteracoesLegadoClientForTests,
  __isLinhaImportavelForTests as isLinhaImportavel,
  analisarArquivoMigracaoAlteracoesLegado,
  STATUS_LINHA,
  DESTINO_FINAL
} from '../migracaoAlteracoesLegadoService.js';
import {
  analisarArquivoMigracaoAlteracoesLegadoSimplificado,
  STATUS_LINHA_SIMPLIFICADO
} from '../migracaoAlteracoesLegadoSimplificadoService.js';
import {
  revalidarLinhasRevisaoSimplificada
} from '../migracaoAlteracoesLegadoSimplificadoEdicao.js';

function createEntity(initial = []) {
  const rows = [...initial];
  return {
    async list() { return [...rows]; },
    async filter(criteria = {}) {
      return rows.filter((row) => Object.entries(criteria).every(([k, v]) => row[k] === v));
    },
    async create(payload) {
      const created = { id: String(rows.length + 1), ...payload };
      rows.push(created);
      return created;
    },
    async update(id, payload) {
      const idx = rows.findIndex((r) => r.id === id);
      rows[idx] = { ...rows[idx], ...payload };
      return rows[idx];
    },
    _rows: rows,
  };
}

function setupMockClient(overrides = {}) {
  const entities = {
    Militar: createEntity([]),
    PublicacaoExOfficio: createEntity([]),
    TipoPublicacaoCustom: createEntity([]),
    ImportacaoAlteracoesLegado: createEntity([]),
    ...overrides,
  };
  const client = { entities, auth: { me: async () => ({ id: 'u1' }) } };
  __setMigracaoAlteracoesLegadoClientForTests(client);
  return client;
}

test('REPRODUÇÃO: Migração padrão - linha com nota mas sem BG deve ser APTO/APTO_COM_ALERTA, não ERRO', async () => {
  const csvContent = 'Nota ID,Matrícula,Nome Completo,Matéria,Número BG,Data Publicação,Status,Conteúdo (Trecho)\n' +
    '123,M001,João Silva,ATA DE INSPEÇÃO DE SAÚDE,,,Publicado,Texto de exemplo';
  const file = {
    name: 'test.csv',
    text: async () => csvContent,
    size: csvContent.length,
    lastModified: Date.now(),
    arrayBuffer: async () => new ArrayBuffer(0),
  };

  setupMockClient({
    Militar: createEntity([{ id: 'm1', matricula: 'M001', nome_completo: 'João Silva' }]),
  });

  const analise = await analisarArquivoMigracaoAlteracoesLegado(file);
  const linha = analise.linhas[0];

  console.log('Status atual (padrão):', linha.status);
  console.log('Erros atuais (padrão):', linha.erros);

  // Correção: não deve ser ERRO, e sim APTO_COM_ALERTA
  console.log('Status pós-correção (padrão):', linha.status);
  console.log('Alertas pós-correção (padrão):', linha.alertas);

  assert.notEqual(linha.status, STATUS_LINHA.ERRO, 'Não deve ser ERRO quando houver nota');
  assert.ok(linha.alertas.includes('Nota informada. A publicação em BG ainda está pendente.'), 'Deve conter alerta de pendência');
  assert.equal(linha.transformado.status_publicacao, 'AGUARDANDO_PUBLICACAO');

  __resetMigracaoAlteracoesLegadoClientForTests();
});

test('REPRODUÇÃO: Migração simplificada - linha com nota mas sem BG deve ser pronta, não erro', async () => {
    const csvContent = 'Nota,Texto,BG,Data,Tipo Legado\n' +
      'NOTA123,Texto de exemplo,,,Férias';
    const file = {
      name: 'test.csv',
      text: async () => csvContent,
      size: csvContent.length,
      lastModified: Date.now(),
      arrayBuffer: async () => new ArrayBuffer(0),
    };

    setupMockClient();

    const analise = await analisarArquivoMigracaoAlteracoesLegadoSimplificado(file, { militarDestinoId: 'm1' });
    const linha = analise.linhas[0];

    console.log('Status atual (simplificado):', linha.status);
    console.log('Erros atuais (simplificado):', linha.erros);

    // Na simplificada, o status deve ser 'pronta' mas conter avisos?
    // Na verdade, analisarArquivoMigracaoAlteracoesLegadoSimplificado usa validarDadosLinhaSimplificado
    // Vamos ver o comportamento atual.

    __resetMigracaoAlteracoesLegadoClientForTests();
});

test('REPRODUÇÃO: Edição simplificada - revalidarLinhasRevisaoSimplificada deve permitir falta de BG se houver nota', () => {
    const linhas = [{
        linhaNumero: 2,
        numero_nota: 'NOTA123',
        numero_bg_br: '',
        data_bg_br: '',
        tipo_legado: 'Férias',
        texto_publicado: 'Texto',
        recusada: false,
        transformado: { militar_id: 'm1' }
    }];

    const validadas = revalidarLinhasRevisaoSimplificada(linhas);
    const linha = validadas[0];

    console.log('Status atual (edição):', linha.status);
    console.log('Erros atuais (edição):', linha.erros);

    assert.notEqual(linha.status, 'erro', 'Não deve ser erro quando houver nota (edição)');
    assert.ok(linha.avisos.some(a => a.includes('Nota informada. A publicação em BG ainda está pendente.')), 'Deve conter aviso institucional');
    assert.equal(linha.status_publicacao, 'AGUARDANDO_PUBLICACAO');
});
