import test from 'node:test';
import assert from 'node:assert/strict';

import {
  __setMilitarIdentidadeClientForTests,
  adicionarNovaMatriculaMilitar,
  criarMilitarComMatricula,
  executarMergeManualMilitares,
  formatarMatriculaPadrao,
  migrarMatriculasLegadas,
  normalizarMatricula,
  resolverPendenciaPossivelDuplicidade,
  STATUS_POSSIVEL_DUPLICIDADE,
} from '../militarIdentidadeService.js';

function createEntity(initial = []) {
  let seq = 1;
  const rows = [...initial];
  return {
    async list() { return [...rows]; },
    async filter(criteria = {}) {
      return rows.filter((row) => Object.entries(criteria).every(([k, v]) => row[k] === v));
    },
    async create(payload) {
      if (rows.some((r) => r.matricula_normalizada && payload.matricula_normalizada && r.matricula_normalizada === payload.matricula_normalizada)) {
        throw new Error('unique constraint matricula_normalizada');
      }
      if (payload.is_atual === true && payload.militar_id && rows.some((r) => r.militar_id === payload.militar_id && r.is_atual === true)) {
        throw new Error('unique constraint militar_id_is_atual_true');
      }
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

function setupDefaultClient(overrides = {}) {
  const Militar = createEntity([]);
  const MatriculaMilitar = createEntity([]);
  const PossivelDuplicidadeMilitar = createEntity([]);
  const MergeMilitarLog = createEntity([]);
  const HistoricoComportamento = createEntity([]);
  const PendenciaComportamento = createEntity([]);
  const PunicaoDisciplinar = createEntity([]);

  const entities = {
    Militar,
    MatriculaMilitar,
    PossivelDuplicidadeMilitar,
    MergeMilitarLog,
    HistoricoComportamento,
    PendenciaComportamento,
    PunicaoDisciplinar,
    ...overrides,
  };

  __setMilitarIdentidadeClientForTests({ entities });
  return entities;
}

test('normaliza e formata matrícula', () => {
  assert.equal(normalizarMatricula('108.747-021'), '108747021');
  assert.equal(formatarMatriculaPadrao('108747021'), '108.747-021');
});

test('cria pendência de possível duplicidade e bloqueia cadastro manual', async () => {
  const entities = setupDefaultClient({
    Militar: createEntity([{ id: 'm1', nome_completo: 'A', matricula: '108.747-021', cpf: '12345678901', data_nascimento: '1990-01-01' }]),
    MatriculaMilitar: createEntity([{ id: 'x1', militar_id: 'm1', matricula: '108.747-021', matricula_normalizada: '108747021', is_atual: true }]),
  });

  await assert.rejects(
    () => criarMilitarComMatricula({ nome_completo: 'B', matricula: '108.747-021', cpf: '12345678901', data_nascimento: '1990-01-01' }, { origemRegistro: 'cadastro_manual', criadoPor: 'tester@sgp' }),
    /Pendência enviada para revisão humana/,
  );

  const pendencias = await entities.PossivelDuplicidadeMilitar.list();
  assert.equal(pendencias.length, 1);
  assert.equal(pendencias[0].status, STATUS_POSSIVEL_DUPLICIDADE.PENDENTE);
});

test('permite descarte de falso positivo', async () => {
  const entities = setupDefaultClient({
    PossivelDuplicidadeMilitar: createEntity([
      { id: 'p1', status: STATUS_POSSIVEL_DUPLICIDADE.PENDENTE, motivo: 'suspeita' },
    ]),
  });

  await resolverPendenciaPossivelDuplicidade({
    pendenciaId: 'p1',
    status: STATUS_POSSIVEL_DUPLICIDADE.DESCARTADO,
    resolvidoPor: 'analista@sgp',
  });

  const [pendencia] = await entities.PossivelDuplicidadeMilitar.filter({ id: 'p1' });
  assert.equal(pendencia.status, STATUS_POSSIVEL_DUPLICIDADE.DESCARTADO);
  assert.equal(pendencia.resolvido_por, 'analista@sgp');
});

test('permite histórico e garante somente uma matrícula atual', async () => {
  const entities = setupDefaultClient({
    Militar: createEntity([{ id: 'm1', nome_completo: 'A', matricula: '108.747-021' }]),
    MatriculaMilitar: createEntity([{ id: 'x1', militar_id: 'm1', matricula: '108.747-021', matricula_normalizada: '108747021', is_atual: true }]),
  });

  await adicionarNovaMatriculaMilitar({
    militarId: 'm1',
    matricula: '999.888-777',
    tipoMatricula: 'Secundária',
    motivo: 'Segunda matrícula',
    origemRegistro: 'acao_administrativa',
    dataInicio: '2025-01-01',
  });

  const todas = await entities.MatriculaMilitar.list();
  const atuais = todas.filter((m) => m.militar_id === 'm1' && m.is_atual === true);
  const antigas = todas.filter((m) => m.militar_id === 'm1' && m.is_atual === false);
  const [militarAtualizado] = await entities.Militar.filter({ id: 'm1' });

  assert.equal(atuais.length, 1);
  assert.equal(antigas.length, 1);
  assert.equal(atuais[0].origem_registro, 'acao_administrativa');
  assert.equal(militarAtualizado.matricula, '999.888-777');
});

test('merge manual bem-sucedido preserva vínculos e matrículas e grava auditoria', async () => {
  const entities = setupDefaultClient({
    Militar: createEntity([
      { id: 'm-origem', nome_completo: 'Origem', matricula: '111.111-111', status_cadastro: 'Ativo', merged_into_id: '' },
      { id: 'm-destino', nome_completo: 'Destino', matricula: '222.222-222', status_cadastro: 'Ativo', merged_into_id: '' },
    ]),
    MatriculaMilitar: createEntity([
      { id: 'mat-origem', militar_id: 'm-origem', matricula: '111.111-111', matricula_normalizada: '111111111', is_atual: true },
      { id: 'mat-destino', militar_id: 'm-destino', matricula: '222.222-222', matricula_normalizada: '222222222', is_atual: true },
    ]),
    HistoricoComportamento: createEntity([{ id: 'h1', militar_id: 'm-origem' }]),
    PendenciaComportamento: createEntity([{ id: 'p1', militar_id: 'm-origem' }]),
    PunicaoDisciplinar: createEntity([{ id: 'pd1', militar_id: 'm-origem' }]),
    PossivelDuplicidadeMilitar: createEntity([{ id: 'dup1', status: STATUS_POSSIVEL_DUPLICIDADE.PENDENTE }]),
  });

  await executarMergeManualMilitares({
    militarOrigemId: 'm-origem',
    militarDestinoId: 'm-destino',
    motivo: 'Teste de merge',
    executadoPor: 'admin@sgp',
    pendenciaId: 'dup1',
  });

  const [origem] = await entities.Militar.filter({ id: 'm-origem' });
  assert.equal(origem.status_cadastro, 'Mesclado');
  assert.equal(origem.merged_into_id, 'm-destino');

  const historicos = await entities.HistoricoComportamento.list();
  const pendencias = await entities.PendenciaComportamento.list();
  const punicoes = await entities.PunicaoDisciplinar.list();
  assert.equal(historicos[0].militar_id, 'm-destino');
  assert.equal(pendencias[0].militar_id, 'm-destino');
  assert.equal(punicoes[0].militar_id, 'm-destino');

  const matriculas = await entities.MatriculaMilitar.list();
  assert.equal(matriculas.filter((m) => m.militar_id === 'm-destino').length, 2);

  const logs = await entities.MergeMilitarLog.list();
  assert.equal(logs.length, 1);
  assert.equal(logs[0].militar_origem_id, 'm-origem');

  const [pendencia] = await entities.PossivelDuplicidadeMilitar.filter({ id: 'dup1' });
  assert.equal(pendencia.status, STATUS_POSSIVEL_DUPLICIDADE.MESCLADO);
});

test('bloqueia auto-merge do mesmo registro', async () => {
  setupDefaultClient({
    Militar: createEntity([{ id: 'm1', nome_completo: 'A', matricula: '111.111-111', merged_into_id: '' }]),
    MatriculaMilitar: createEntity([{ id: 'mat1', militar_id: 'm1', matricula: '111.111-111', matricula_normalizada: '111111111', is_atual: true }]),
  });

  await assert.rejects(
    () => executarMergeManualMilitares({ militarOrigemId: 'm1', militarDestinoId: 'm1', motivo: 'inválido', executadoPor: 'admin@sgp' }),
    /Não é permitido mesclar o mesmo militar nele próprio/,
  );
});

test('migração preserva militares e reporta conflito sem merge automático', async () => {
  setupDefaultClient({
    Militar: createEntity([
      { id: 'm1', matricula: '111.111-111', data_inclusao: '2021-01-01' },
      { id: 'm2', matricula: '111.111-111', data_inclusao: '2022-01-01' },
      { id: 'm3', matricula: '222.222-222', data_inclusao: '2023-01-01' },
    ]),
    MatriculaMilitar: createEntity([]),
  });

  const dryRun = await migrarMatriculasLegadas({ dryRun: true });
  assert.equal(dryRun.totalMilitares, 3);
  assert.equal(dryRun.criadas, 3);

  const real = await migrarMatriculasLegadas({ dryRun: false });
  assert.equal(real.criadas, 2);
  assert.equal(real.conflitos.length, 1);
});

test('concorrência simples: apenas uma criação prevalece para mesma matrícula', async () => {
  setupDefaultClient({
    Militar: createEntity([]),
    MatriculaMilitar: createEntity([]),
  });

  const payload = { nome_completo: 'Militar Teste', matricula: '333.222-111', cpf: '', data_nascimento: '' };
  const [r1, r2] = await Promise.allSettled([
    criarMilitarComMatricula(payload),
    criarMilitarComMatricula(payload),
  ]);

  const sucessos = [r1, r2].filter((r) => r.status === 'fulfilled');
  const falhas = [r1, r2].filter((r) => r.status === 'rejected');

  assert.equal(sucessos.length, 1);
  assert.equal(falhas.length, 1);
});
