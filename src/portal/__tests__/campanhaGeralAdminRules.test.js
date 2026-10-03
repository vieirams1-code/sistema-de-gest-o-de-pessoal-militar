import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import { validarNomeCampanhaGeral, validarProrrogacaoCampanhaGeral } from '../../../base44/shared/portal/campanhaGeralAdminRules.js';

const source = readFileSync(new URL('../../../base44/functions/portal_servicos/entry.ts', import.meta.url), 'utf8');
const codigo = transformSync(source.replace(/^import[\s\S]*?;\n/gm, ''), { loader: 'ts', format: 'cjs' }).code;
function endpoint({ role = 'admin', actions = {}, tipo = 'FORMULARIO_DINAMICO', status = 'Encerrada', plano = '' } = {}) {
  let handler;
  let campanha = { id: 'camp', tipo, titulo: 'Antigo', status, plano_ferias_institucional_id: plano, data_fim_militar: '2026-10-01', config_formulario: '{"campos":[]}', escopo_grupos_ids: ['grupo'] };
  const writes = [];
  const auditorias = [];
  const sdk = {
    auth: { me: async () => ({ role, email: 'admin@example.com' }) },
    functions: { invoke: async () => ({ data: { actions } }) },
    asServiceRole: { entities: {
      CampanhaPortal: { get: async () => campanha, update: async (id, patch) => { writes.push(patch); campanha = { ...campanha, ...patch }; return campanha; } },
    } },
  };
  new Function('Deno', 'createClientFromRequest', 'generateCorrelationId', 'validarNomeCampanhaGeral', 'validarProrrogacaoCampanhaGeral', 'registrarAuditoriaPortal', 'extractClientIp', 'extractUserAgent', 'module', 'exports', codigo)(
    { serve: (h) => { handler = h; } }, () => sdk, () => 'test', validarNomeCampanhaGeral, validarProrrogacaoCampanhaGeral,
    async (client, data) => { auditorias.push(data); }, () => 'test-ip', () => 'test-agent', { exports: {} }, {},
  );
  return { writes, auditorias, call: async (body) => handler(new Request('https://example.com', { method: 'POST', body: JSON.stringify({ campanha_id: 'camp', ...body }) })) };
}
test('renomeia somente título, sem alterar formulário, prazo ou escopo', async () => {
  const api = endpoint();
  const res = await api.call({ acao: 'CAMPANHA_RENOMEAR', titulo: 'Novo nome', campanha_payload: { config_formulario: 'malicioso' } });
  assert.equal(res.status, 200);
  assert.deepEqual(api.writes, [{ titulo: 'Novo nome' }]);
  const data = await res.json();
  assert.equal(data.campanha.config_formulario, '{"campos":[]}');
  assert.deepEqual(data.campanha.escopo_grupos_ids, ['grupo']);
  assert.equal(api.auditorias.length, 1);
});
test('prorroga campanhas abertas e encerradas e conserva prazo original', async () => {
  for (const status of ['Aberta_Coleta', 'Encerrada']) {
    const api = endpoint({ status });
    const res = await api.call({ acao: 'CAMPANHA_PRORROGAR', nova_data_fim_militar: '2099-11-05', justificativa: 'Prazo complementar' });
    assert.equal(res.status, 200);
    assert.equal(api.writes[0].status, 'Aberta_Coleta');
    assert.equal(api.writes[0].data_fim_militar_original, '2026-10-01');
    assert.equal(api.writes[0].quantidade_prorrogacoes, 1);
    assert.equal(api.auditorias.length, 1);
  }
});
test('as duas ações recusam campanhas de férias e campanhas vinculadas a plano', async () => {
  for (const opts of [{ tipo: 'PLANO_FERIAS' }, { plano: 'plano' }]) {
    for (const acao of ['CAMPANHA_RENOMEAR', 'CAMPANHA_PRORROGAR']) {
      const api = endpoint(opts);
      assert.equal((await api.call({ acao, titulo: 'Novo', nova_data_fim_militar: '2099-11-05', justificativa: 'Complementar' })).status, 403);
      assert.equal(api.writes.length, 0);
    }
  }
});
test('endpoint valida nome e prazo antes de escrever', async () => {
  const api = endpoint();
  assert.equal((await api.call({ acao: 'CAMPANHA_RENOMEAR', titulo: '  ' })).status, 400);
  assert.equal((await api.call({ acao: 'CAMPANHA_PRORROGAR', nova_data_fim_militar: '2099-02-30', justificativa: 'Complementar' })).status, 400);
  assert.equal(api.writes.length, 0);
});
test('exige permissão Admin e edição cumulativamente', async () => {
  for (const actions of [{ editar_campanhas: true }, { admin_campanhas: true }, {}]) {
    for (const acao of ['CAMPANHA_RENOMEAR', 'CAMPANHA_PRORROGAR']) {
      const api = endpoint({ role: 'user', actions });
      assert.equal((await api.call({ acao, titulo: 'Novo' })).status, 403);
      assert.equal(api.writes.length, 0);
    }
  }
  const api = endpoint({ role: 'user', actions: { editar_campanhas: true, admin_campanhas: true } });
  assert.equal((await api.call({ acao: 'CAMPANHA_RENOMEAR', titulo: 'Novo' })).status, 200);
});
test('recusa redução, datas passadas, estados protegidos e justificativa ausente', () => {
  const agora = Date.parse('2026-10-03T18:00:00Z');
  const campanha = { status: 'Aberta_Coleta', data_fim_militar: '2026-10-31' };
  const payload = { nova_data_fim_militar: '2026-11-05', justificativa: 'Complementar' };
  assert.throws(() => validarProrrogacaoCampanhaGeral(campanha, { ...payload, nova_data_fim_militar: '2026-10-31' }, agora), /posterior/);
  assert.throws(() => validarProrrogacaoCampanhaGeral(campanha, { ...payload, nova_data_fim_militar: '2026-10-02' }, agora), /passado/);
  assert.throws(() => validarProrrogacaoCampanhaGeral(campanha, { ...payload, justificativa: ' ' }, agora), /justificativa/);
  for (const status of ['Arquivada', 'Desativada', 'Rascunho', 'Homologada']) assert.throws(() => validarProrrogacaoCampanhaGeral({ ...campanha, status }, payload, agora), /abertas ou encerradas/);
});
