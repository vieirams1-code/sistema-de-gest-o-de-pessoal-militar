import test from 'node:test';
import assert from 'node:assert/strict';

import {
  __setMigracaoMilitaresClientForTests,
  corrigirLinhaPreImportacao,
  importarAnalise,
  persistirCorrecaoPreImportacaoHistorico,
  salvarAnaliseHistorico,
  carregarAnaliseHistorico,
} from '../migracaoMilitaresService.js';
import { __setMilitarIdentidadeClientForTests } from '../militarIdentidadeService.js';

function createEntity(initial = []) {
  let seq = initial.length + 1;
  const rows = [...initial];
  return {
    async list() { return [...rows]; },
    async filter(criteria = {}) {
      return rows.filter((row) => Object.entries(criteria).every(([k, v]) => row[k] === v));
    },
    async create(payload) {
      const created = { id: String(seq++), ...payload };
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

function setupClients() {
  const Militar = createEntity([]);
  const MatriculaMilitar = createEntity([]);
  const ImportacaoMilitares = createEntity([]);
  const PossivelDuplicidadeMilitar = createEntity([]);

  __setMigracaoMilitaresClientForTests({ entities: { Militar, ImportacaoMilitares } });
  __setMilitarIdentidadeClientForTests({ entities: { Militar, MatriculaMilitar, PossivelDuplicidadeMilitar } });

  return { Militar, MatriculaMilitar, ImportacaoMilitares, PossivelDuplicidadeMilitar };
}

function analiseBase() {
  return {
    arquivo: { nome: 'teste.csv', tipo: 'text/csv', hash: 'abc', data_importacao: new Date().toISOString() },
    resumo: { total_linhas: 1, total_aptas: 0, total_aptas_com_alerta: 0, total_duplicadas: 0, total_erros: 1 },
    linhas: [
      {
        linhaNumero: 2,
        original: {},
        transformado: {
          nome_completo: '',
          nome_guerra: '',
          matricula: '',
          cpf: '',
          data_inclusao: '',
          posto_graduacao: 'Soldado',
          data_nascimento: '',
        },
        status: 'ERRO',
        alertas: [],
        erros: ['Matrícula ausente. Linha bloqueada para importação.'],
      },
    ],
    versao_regra_migracao: 'v1.1.0',
  };
}

test('permite edição pré-importação dos 5 campos e reclassifica status', async () => {
  setupClients();
  const usuario = { email: 'admin@sgp' };

  const { analiseAtualizada, linhaAtualizada } = await corrigirLinhaPreImportacao({
    analise: analiseBase(),
    linhaNumero: 2,
    campos: {
      nome_completo: '  João da Silva  ',
      nome_guerra: ' Silva ',
      matricula: '123456789',
      cpf: '529.982.247-25',
      data_inclusao: '10/01/2020',
    },
    usuario,
  });

  assert.equal(linhaAtualizada.transformado.nome_completo, 'João da Silva');
  assert.equal(linhaAtualizada.transformado.nome_guerra, 'Silva');
  assert.equal(linhaAtualizada.transformado.matricula, '123.456-789');
  assert.equal(linhaAtualizada.transformado.cpf, '529.982.247-25');
  assert.equal(linhaAtualizada.transformado.data_inclusao, '2020-01-10');
  assert.equal(linhaAtualizada.status, 'APTO');
  assert.equal(analiseAtualizada.resumo.total_aptas, 1);
  assert.deepEqual(linhaAtualizada.correcao_pre_importacao.campos_alterados.sort(), ['cpf', 'data_inclusao', 'matricula', 'nome_completo', 'nome_guerra'].sort());
  assert.equal(linhaAtualizada.correcao_pre_importacao.alteracoes_detalhadas.length, 5);
});

test('aplica validações de matrícula, CPF e data de inclusão na correção', async () => {
  const { Militar } = setupClients();
  await Militar.create({ nome_completo: 'Existente', matricula: '123.456-789' });

  const { linhaAtualizada } = await corrigirLinhaPreImportacao({
    analise: analiseBase(),
    linhaNumero: 2,
    campos: {
      nome_completo: 'Teste',
      matricula: '123456789',
      cpf: '111.111.111-11',
      data_inclusao: '31/02/2020',
    },
    usuario: { email: 'admin@sgp' },
  });

  assert.equal(linhaAtualizada.status, 'ERRO');
  assert.ok(linhaAtualizada.erros.some((erro) => erro.includes('Matrícula já cadastrada')));
  assert.ok(linhaAtualizada.erros.some((erro) => erro.includes('CPF inválido')));
  assert.ok(linhaAtualizada.erros.some((erro) => erro.includes('Data de inclusão inválida')));
});

test('persiste correção no histórico e restaura após recarregar', async () => {
  const { ImportacaoMilitares } = setupClients();
  const usuario = { email: 'admin@sgp', full_name: 'Administrador' };

  const analise = analiseBase();
  const historico = await salvarAnaliseHistorico(analise, usuario);

  const { analiseAtualizada } = await corrigirLinhaPreImportacao({
    analise,
    linhaNumero: 2,
    campos: {
      nome_completo: 'Maria Souza',
      nome_guerra: 'Souza',
      matricula: '987654321',
      cpf: '52998224725',
      data_inclusao: '2021-03-20',
    },
    usuario,
  });

  await persistirCorrecaoPreImportacaoHistorico({
    historicoId: historico.id,
    analise: analiseAtualizada,
    usuario,
    linhaNumero: 2,
    alteracoes: ['nome_completo', 'matricula', 'cpf'],
  });

  const restaurado = await carregarAnaliseHistorico(historico.id);
  assert.equal(restaurado.linhas[0].transformado.nome_completo, 'Maria Souza');
  assert.match(ImportacaoMilitares._rows[0].observacoes, /Correção pré-importação linha 2/);

  await persistirCorrecaoPreImportacaoHistorico({
    historicoId: historico.id,
    analise: analiseAtualizada,
    usuario,
    linhaNumero: 2,
    alteracoes: ['nome_guerra'],
  });
  const trilhas = String(ImportacaoMilitares._rows[0].observacoes || '').split('\n').filter(Boolean);
  assert.equal(trilhas.length, 2);
});

test('importação final utiliza dados corrigidos', async () => {
  const { Militar } = setupClients();
  const usuario = { email: 'admin@sgp', full_name: 'Administrador' };

  const analise = {
    arquivo: { nome: 'corrigido.csv', tipo: 'text/csv', hash: 'hash' },
    resumo: { total_linhas: 1, total_aptas: 1, total_aptas_com_alerta: 0, total_duplicadas: 0, total_erros: 0 },
    linhas: [
      {
        linhaNumero: 2,
        status: 'APTO',
        alertas: [],
        erros: [],
        transformado: {
          nome_completo: 'Militar Corrigido',
          nome_guerra: 'Corrigido',
          matricula: '999.888-777',
          cpf: '529.982.247-25',
          data_inclusao: '2022-05-01',
          posto_graduacao: 'Soldado',
          data_nascimento: '',
        },
      },
    ],
    versao_regra_migracao: 'v1.1.0',
  };

  const historico = await salvarAnaliseHistorico(analise, usuario);
  const resultado = await importarAnalise({ analise, incluirAlertas: false, historicoId: historico.id, usuario });

  assert.equal(resultado.totalImportadas, 1);
  assert.equal(Militar._rows[0].nome_completo, 'Militar Corrigido');
  assert.equal(Militar._rows[0].cpf, '52998224725');
  assert.equal(Militar._rows[0].data_inclusao, '2022-05-01');
});
