import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarNomeCampanha, validarProrrogacaoCampanha } from '../../../base44/shared/ferias/campanhaAdminRules.js';

import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

const original = readFileSync(new URL('../../../base44/functions/portal_servicos/entry.ts', import.meta.url), 'utf8');
const codigo = transformSync(original.replace(/^import[\s\S]*?;\n/gm, ''), { loader: 'ts', format: 'cjs' }).code;
function endpoint(role = 'admin', actions = {}) {
  let handler;
  let campanha = { id: 'camp', tipo: 'PLANO_FERIAS', titulo: 'Antigo', status: 'Encerrada', plano_ferias_institucional_id: 'plano', data_fim_militar: '2026-10-01', hora_fim_militar: '23:59' };
  const writes = [];
  const auditorias = [];
  const sdk = {
    auth: { me: async () => ({ role, email: 'admin@example.com', full_name: 'Admin' }) },
    functions: { invoke: async () => ({ data: { actions } }) },
    asServiceRole: { entities: {
      CampanhaPortal: { get: async () => campanha, update: async (id, patch) => { writes.push(patch); campanha = { ...campanha, ...patch }; return campanha; } },
      PlanoFeriasInstitucional: { get: async () => ({ id: 'plano', status: 'ATIVO' }) },
      AuditoriaFerias: { create: async (dados) => { auditorias.push(dados); } },
    } },
  };
  new Function('Deno', 'createClientFromRequest', 'generateCorrelationId', 'validarNomeCampanha', 'validarProrrogacaoCampanha', 'module', 'exports', codigo)(
    { serve: (h) => { handler = h; } }, () => sdk, () => 'test', validarNomeCampanha, validarProrrogacaoCampanha, { exports: {} }, {},
  );
  return { writes, auditorias, call: async (body) => handler(new Request('https://example.com', { method: 'POST', body: JSON.stringify({ campanha_id: 'camp', ...body }) })) };
}
test('endpoint renomeia campanha encerrada sem alterar prazo/status e audita', async () => {
  const api = endpoint();
  const res = await api.call({ acao: 'PLANO_CAMPANHA_RENOMEAR', titulo: 'Novo nome' });
  assert.equal(res.status, 200);
  assert.deepEqual(api.writes, [{ titulo: 'Novo nome' }]);
  assert.equal(api.auditorias.length, 1);
});
test('endpoint reabre campanha, preserva prazo original e não altera entidades de respostas', async () => {
  const api = endpoint();
  const res = await api.call({ acao: 'PLANO_CAMPANHA_PRORROGAR', nova_data_fim_militar: '2099-11-05', nova_hora_fim_militar: '18:00', justificativa: 'Prazo complementar' });
  assert.equal(res.status, 200);
  assert.equal(api.writes[0].status, 'Aberta_Coleta');
  assert.equal(api.writes[0].data_fim_militar_original, '2026-10-01');
  assert.equal(api.writes[0].quantidade_prorrogacoes, 1);
  assert.equal(api.auditorias.length, 1);
});
test('endpoint devolve erro de validação sem escrever', async () => {
  const api = endpoint();
  const res = await api.call({ acao: 'PLANO_CAMPANHA_RENOMEAR', titulo: '  ' });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /nome/);
  assert.equal(api.writes.length, 0);
});
test('endpoint exige acesso ao módulo e permissão Admin cumulativamente', async () => {
  for (const actions of [{ visualizar_planos_ferias: true }, { admin_campanhas_ferias: true }, {}]) {
    for (const acao of ['PLANO_CAMPANHA_RENOMEAR', 'PLANO_CAMPANHA_PRORROGAR']) {
      const api = endpoint('user', actions);
      assert.equal((await api.call({ acao, titulo: 'Novo' })).status, 403);
      assert.equal(api.writes.length, 0);
    }
  }
  const api = endpoint('user', { visualizar_planos_ferias: true, admin_campanhas_ferias: true });
  assert.equal((await api.call({ acao: 'PLANO_CAMPANHA_RENOMEAR', titulo: 'Novo' })).status, 200);
});

const agora = Date.parse('2026-10-03T18:00:00Z');
const campanha = { status: 'Aberta_Coleta', data_fim_militar: '2026-10-31', hora_fim_militar: '23:59' };
const payload = { nova_data_fim_militar: '2026-11-05', nova_hora_fim_militar: '18:00', justificativa: 'Prazo complementar' };
test('aceita extensão de campanha aberta e encerrada', () => {
  for (const status of ['Aberta_Coleta', 'Encerrada']) assert.equal(validarProrrogacaoCampanha({ ...campanha, status }, payload, agora).novaDataFim, '2026-11-05');
});
test('não reduz nem mantém prazo, inclusive com hora ausente', () => {
  for (const hora of ['18:00', '23:59']) assert.throws(() => validarProrrogacaoCampanha({ ...campanha, hora_fim_militar: '' }, { ...payload, nova_data_fim_militar: '2026-10-31', nova_hora_fim_militar: hora }, agora), /posterior/);
});
test('permite prorrogar apenas a hora no mesmo dia', () => {
  assert.equal(validarProrrogacaoCampanha({ ...campanha, hora_fim_militar: '12:00' }, { ...payload, nova_data_fim_militar: '2026-10-31' }, agora).novaHoraFim, '18:00');
});
test('bloqueia arquivadas, desativadas e estados de aprovação', () => {
  for (const status of ['Arquivada', 'Desativada', 'Em_Aprovacao']) assert.throws(() => validarProrrogacaoCampanha({ ...campanha, status }, payload, agora), /abertas ou encerradas/);
});
test('rejeita calendário e horário inválidos', () => {
  for (const [data, hora] of [['2027-02-30', '12:00'], ['2026-13-01', '12:00'], ['2026-11-05', '24:00'], ['2026-11-05', '12:60']]) {
    assert.throws(() => validarProrrogacaoCampanha(campanha, { ...payload, nova_data_fim_militar: data, nova_hora_fim_militar: hora }, agora), /válidas/);
  }
});
test('considera UTC-4 ao rejeitar prazo passado', () => {
  assert.throws(() => validarProrrogacaoCampanha({ ...campanha, data_fim_militar: '2026-10-01' }, { ...payload, nova_data_fim_militar: '2026-10-03', nova_hora_fim_militar: '13:59' }, agora), /futuro/);
});
test('exige justificativa e nome não vazio', () => {
  assert.throws(() => validarProrrogacaoCampanha(campanha, { ...payload, justificativa: '  ' }, agora), /justificativa/);
  assert.throws(() => validarNomeCampanha('   '), /nome/);
  assert.equal(validarNomeCampanha('  Férias 2027  '), 'Férias 2027');
});
