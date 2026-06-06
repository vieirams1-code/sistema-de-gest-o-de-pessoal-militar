import test from 'node:test';
import assert from 'node:assert/strict';
import { getDocumentosUnificados } from '../militarDocumentosService.js';

test('getDocumentosUnificados - mapeia todas as fontes corretamente', () => {
  const params = {
    publicacoes: [{ data_publicacao: '2023-01-01', tipo: 'Nota BGO', conteudo: 'Conteudo Pub' }],
    registrosLivro: [{ data_publicacao: '2023-01-02', tipo_registro: 'Elogio', conteudo: 'Conteudo Livro' }],
    atestados: [{ data_inicio: '2023-01-03', tipo_afastamento: 'LTS', dias: 5, cid_10: 'Z00' }],
    ferias: [{ data_inicio: '2023-01-04', dias: 30, periodo_aquisitivo_ref: '2022/2023' }],
    promocoes: [{ data_promocao: '2023-01-05', posto_graduacao_novo: 'Cabo', quadro_novo: 'QPPM', boletim_referencia: 'BG 001' }],
    medalhas: [{ data_concessao: '2023-01-06', tipo_medalha_nome: 'Medalha X', status: 'Concedida' }]
  };

  const docs = getDocumentosUnificados(params);

  assert.equal(docs.length, 6);

  assert.deepEqual(docs[0], {
    data: '2023-01-06',
    tipo: 'Medalha',
    titulo: 'Medalha X',
    origem: 'Condecoração',
    referencia: 'Status: Concedida'
  });

  assert.deepEqual(docs[1], {
    data: '2023-01-05',
    tipo: 'Promoção',
    titulo: 'Cabo QPPM',
    origem: 'Carreira',
    referencia: 'Boletim: BG 001'
  });

  assert.deepEqual(docs[2], {
    data: '2023-01-04',
    tipo: 'Férias',
    titulo: 'Gozo de Férias',
    origem: 'Férias',
    referencia: '30 dias ref. ao período 2022/2023'
  });

  assert.deepEqual(docs[3], {
    data: '2023-01-03',
    tipo: 'Atestado',
    titulo: 'LTS',
    origem: 'Saúde',
    referencia: '5 dias - CID: Z00'
  });

  assert.deepEqual(docs[4], {
    data: '2023-01-02',
    tipo: 'Registro de Livro',
    titulo: 'Elogio',
    origem: 'Registro de Livro',
    referencia: 'Conteudo Livro'
  });

  assert.deepEqual(docs[5], {
    data: '2023-01-01',
    tipo: 'Publicação',
    titulo: 'Nota BGO',
    origem: 'Publicação Ex Officio',
    referencia: 'Conteudo Pub'
  });
});

test('getDocumentosUnificados - aplica filtro de tipo', () => {
  const params = {
    publicacoes: [{ data_publicacao: '2023-01-01', tipo: 'Nota' }],
    atestados: [{ data_inicio: '2023-01-02', tipo_afastamento: 'LTS' }],
    filtros: { tipo: 'Atestado' }
  };

  const docs = getDocumentosUnificados(params);

  assert.equal(docs.length, 1);
  assert.equal(docs[0].tipo, 'Atestado');
});

test('getDocumentosUnificados - aplica filtro de período', () => {
  const params = {
    publicacoes: [
      { data_publicacao: '2023-01-01', tipo: 'Antigo' },
      { data_publicacao: '2023-02-01', tipo: 'Dentro' },
      { data_publicacao: '2023-03-01', tipo: 'Novo' }
    ],
    filtros: {
      dataInicio: '2023-01-15',
      dataFim: '2023-02-15'
    }
  };

  const docs = getDocumentosUnificados(params);

  assert.equal(docs.length, 1);
  assert.equal(docs[0].titulo, 'Dentro');
});

test('getDocumentosUnificados - ordena decrescente por data', () => {
  const params = {
    publicacoes: [
      { data_publicacao: '2023-01-01', tipo: 'Velho' },
      { data_publicacao: '2023-03-01', tipo: 'Novo' },
      { data_publicacao: '2023-02-01', tipo: 'Meio' }
    ]
  };

  const docs = getDocumentosUnificados(params);

  assert.equal(docs[0].titulo, 'Novo');
  assert.equal(docs[1].titulo, 'Meio');
  assert.equal(docs[2].titulo, 'Velho');
});

test('getDocumentosUnificados - remove duplicados', () => {
  const item = { data_publicacao: '2023-01-01', tipo: 'Nota' };
  const params = {
    publicacoes: [item, item],
    registrosLivro: []
  };

  const docs = getDocumentosUnificados(params);

  assert.equal(docs.length, 1);
});

test('getDocumentosUnificados - lida com entradas vazias ou nulas', () => {
  assert.deepEqual(getDocumentosUnificados({}), []);
  assert.deepEqual(getDocumentosUnificados(null), []);
  assert.deepEqual(getDocumentosUnificados(), []);
});
