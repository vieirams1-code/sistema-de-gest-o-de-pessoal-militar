import test from 'node:test';
import assert from 'node:assert/strict';
import { adicionarAuditoriaMedalha } from '../medalhasAcessoService.js';

test('payload do reset de medalhas contém ID e auditoria correta', () => {
  const userEmail = 'auditor@sgp.mil';
  const dataRef = '01/01/2024'; // Simulado

  const m = { id: 'med-123', observacoes: 'Obs previa.' };

  const payload = {
    id: m.id,
    ...adicionarAuditoriaMedalha({
      status: 'CANCELADA',
      observacoes: `${m.observacoes ? `${m.observacoes}\n` : ''}[RESET] Indicação resetada administrativamente em ${dataRef}.`,
    }, { userEmail, acao: 'reset' }),
  };

  assert.equal(payload.id, 'med-123');
  assert.equal(payload.status, 'CANCELADA');
  assert.ok(payload.observacoes.includes('Obs previa.'));
  assert.ok(payload.observacoes.includes('[RESET]'));
  assert.equal(payload.updated_by, userEmail);
  assert.equal(payload.resetado_por, userEmail);
  assert.ok(payload.updated_at);
});

test('payload do reset sem observações prévias', () => {
  const m = { id: 'med-456', observacoes: '' };
  const dataRef = '01/01/2024';

  const payload = {
    id: m.id,
    ...adicionarAuditoriaMedalha({
      status: 'CANCELADA',
      observacoes: `[RESET] Indicação resetada administrativamente em ${dataRef}.`,
    }, { userEmail: 'test@sgp.mil', acao: 'reset' }),
  };

  assert.equal(payload.id, 'med-456');
  assert.equal(payload.observacoes, '[RESET] Indicação resetada administrativamente em 01/01/2024.');
});
