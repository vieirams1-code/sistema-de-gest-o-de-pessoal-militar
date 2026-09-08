import test from 'node:test';
import assert from 'node:assert/strict';

import {
  __setMilitarIdentidadeClientForTests,
  adicionarNovaMatriculaMilitar,
  atualizarMilitarSemTrocarMatricula,
  carregarMilitarParaEdicao,
  criarMilitarComMatricula,
  executarMergeManualMilitares,
  formatarMatriculaPadrao,
  listarPendenciasPossivelDuplicidade,
  localizarDuplicidadeForte,
  migrarMatriculasLegadas,
  normalizarMatricula,
  resolverPendenciaPossivelDuplicidade,
  validarMatriculaDisponivel,
  STATUS_POSSIVEL_DUPLICIDADE,
} from '../militarIdentidadeService.js';

function setupGateway(resolver = ({ action, payload }) => ({ action, payload })) {
  const calls = [];
  __setMilitarIdentidadeClientForTests({
    functions: {
      async invoke(name, body) {
        calls.push({ name, body });
        return { data: { result: resolver(body) } };
      },
    },
  });
  return calls;
}

test('normaliza e formata matrícula localmente sem tocar no backend', () => {
  assert.equal(normalizarMatricula('108.747-021'), '108747021');
  assert.equal(formatarMatriculaPadrao('108747021'), '108.747-021');
});

test('criar militar usa somente militarIdentidadeGateway', async () => {
  const calls = setupGateway(() => ({ id: 'm1' }));
  const result = await criarMilitarComMatricula({ nome_completo: 'Teste', matricula: '108.747-021' }, { origemRegistro: 'cadastro_manual' });
  assert.equal(result.id, 'm1');
  assert.deepEqual(calls[0], {
    name: 'militarIdentidadeGateway',
    body: { action: 'CREATE_MILITAR', payload: { data: { nome_completo: 'Teste', matricula: '108.747-021' }, origemRegistro: 'cadastro_manual' } },
  });
});

test('editar militar usa ação independente de criação', async () => {
  const calls = setupGateway(() => ({ id: 'm1' }));
  await atualizarMilitarSemTrocarMatricula('m1', { nome_guerra: 'ALFA' });
  assert.equal(calls[0].body.action, 'UPDATE_MILITAR');
  assert.equal(calls[0].body.payload.militarId, 'm1');
});

test('carregar edição usa endpoint dedicado server-side', async () => {
  const calls = setupGateway(() => ({ militar: { id: 'm1' }, matriculas: [{ id: 'mat1' }] }));
  const data = await carregarMilitarParaEdicao('m1');
  assert.equal(data.militar.id, 'm1');
  assert.equal(data.matriculas.length, 1);
  assert.equal(calls[0].body.action, 'GET_MILITAR_FOR_EDIT');
});

test('nova matrícula é escrita apenas pelo gateway', async () => {
  const calls = setupGateway(() => ({ id: 'mat2' }));
  await adicionarNovaMatriculaMilitar({ militarId: 'm1', matricula: '999.888-777', dataInicio: '2025-01-01' });
  assert.equal(calls[0].body.action, 'ADD_MATRICULA');
  assert.equal(calls[0].body.payload.militarId, 'm1');
});

test('fila de duplicidades e merge usam ações administrativas próprias', async () => {
  const calls = setupGateway(({ action }) => action === 'LIST_DUPLICATES' ? [{ id: 'p1' }] : ({ ok: true }));
  const pendencias = await listarPendenciasPossivelDuplicidade({ status: STATUS_POSSIVEL_DUPLICIDADE.PENDENTE });
  assert.equal(pendencias.length, 1);
  await resolverPendenciaPossivelDuplicidade({ pendenciaId: 'p1', status: STATUS_POSSIVEL_DUPLICIDADE.DESCARTADO });
  await executarMergeManualMilitares({ militarOrigemId: 'm1', militarDestinoId: 'm2', pendenciaId: 'p1', motivo: 'teste' });
  assert.deepEqual(calls.map((c) => c.body.action), ['LIST_DUPLICATES', 'RESOLVE_DUPLICATE', 'MERGE']);
});

test('valida matrícula e duplicidade sem leitura direta de entidades', async () => {
  const calls = setupGateway(({ action }) => action === 'VALIDATE_MATRICULA' ? '108747021' : ({ id: 'm2' }));
  assert.equal(await validarMatriculaDisponivel('108.747-021'), '108747021');
  const dup = await localizarDuplicidadeForte({ cpf: '12345678901', nomeCanonico: 'Teste', dataNascimento: '1990-01-01' });
  assert.equal(dup.id, 'm2');
  assert.deepEqual(calls.map((c) => c.body.action), ['VALIDATE_MATRICULA', 'FIND_DUPLICATE']);
});

test('migração de matrículas legadas também passa pelo gateway', async () => {
  const calls = setupGateway(() => ({ totalMilitares: 3, criadas: 2, conflitos: [] }));
  const result = await migrarMatriculasLegadas({ dryRun: false });
  assert.equal(result.criadas, 2);
  assert.equal(calls[0].body.action, 'MIGRATE_LEGACY_MATRICULAS');
  assert.equal(calls[0].body.payload.dryRun, false);
});

test('erro retornado pelo gateway é propagado com mensagem funcional', async () => {
  __setMilitarIdentidadeClientForTests({
    functions: {
      async invoke() {
        return { data: { error: 'Sem permissão para editar militares.' } };
      },
    },
  });
  await assert.rejects(() => atualizarMilitarSemTrocarMatricula('m1', {}), /Sem permissão para editar militares/);
});
