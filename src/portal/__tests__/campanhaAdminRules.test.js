import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarNomeCampanha, validarProrrogacaoCampanha } from '../../../base44/shared/ferias/campanhaAdminRules.js';

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
