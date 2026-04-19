import test from 'node:test';
import assert from 'node:assert/strict';

import {
  __setMilitarIdentidadeClientForTests,
  adicionarNovaMatriculaMilitar,
  criarMilitarComMatricula,
  formatarMatriculaPadrao,
  migrarMatriculasLegadas,
  normalizarMatricula,
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

test('normaliza e formata matrícula', () => {
  assert.equal(normalizarMatricula('108.747-021'), '108747021');
  assert.equal(formatarMatriculaPadrao('108747021'), '108.747-021');
});

test('bloqueia criação com matrícula já existente', async () => {
  const Militar = createEntity([{ id: 'm1', nome_completo: 'A', matricula: '108.747-021', cpf: '', data_nascimento: '' }]);
  const MatriculaMilitar = createEntity([{ id: 'x1', militar_id: 'm1', matricula: '108.747-021', matricula_normalizada: '108747021', is_atual: true }]);
  __setMilitarIdentidadeClientForTests({ entities: { Militar, MatriculaMilitar } });

  await assert.rejects(
    () => criarMilitarComMatricula({ nome_completo: 'B', matricula: '108.747-021', cpf: '', data_nascimento: '' }),
    /Matrícula já cadastrada/,
  );
});

test('permite histórico e garante somente uma matrícula atual', async () => {
  const Militar = createEntity([{ id: 'm1', nome_completo: 'A', matricula: '108.747-021' }]);
  const MatriculaMilitar = createEntity([{ id: 'x1', militar_id: 'm1', matricula: '108.747-021', matricula_normalizada: '108747021', is_atual: true }]);
  __setMilitarIdentidadeClientForTests({ entities: { Militar, MatriculaMilitar } });

  await adicionarNovaMatriculaMilitar({ militarId: 'm1', matricula: '999.888-777', motivo: 'Segunda matrícula' });

  const todas = await MatriculaMilitar.list();
  const atuais = todas.filter((m) => m.militar_id === 'm1' && m.is_atual === true);
  const antigas = todas.filter((m) => m.militar_id === 'm1' && m.is_atual === false);

  assert.equal(atuais.length, 1);
  assert.equal(antigas.length, 1);
});

test('migração preserva militares e reporta conflito sem merge automático', async () => {
  const Militar = createEntity([
    { id: 'm1', matricula: '111.111-111', data_inclusao: '2021-01-01' },
    { id: 'm2', matricula: '111.111-111', data_inclusao: '2022-01-01' },
    { id: 'm3', matricula: '222.222-222', data_inclusao: '2023-01-01' },
  ]);
  const MatriculaMilitar = createEntity([]);
  __setMilitarIdentidadeClientForTests({ entities: { Militar, MatriculaMilitar } });

  const dryRun = await migrarMatriculasLegadas({ dryRun: true });
  assert.equal(dryRun.totalMilitares, 3);
  assert.equal(dryRun.criadas, 3);

  const real = await migrarMatriculasLegadas({ dryRun: false });
  assert.equal(real.criadas, 2);
  assert.equal(real.conflitos.length, 1);
});


test('concorrência simples: apenas uma criação prevalece para mesma matrícula', async () => {
  const Militar = createEntity([]);
  const MatriculaMilitar = createEntity([]);
  __setMilitarIdentidadeClientForTests({ entities: { Militar, MatriculaMilitar } });

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
