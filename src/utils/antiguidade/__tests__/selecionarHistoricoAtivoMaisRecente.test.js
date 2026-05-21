import test from 'node:test';
import assert from 'node:assert/strict';
import { selecionarHistoricoAtivoMaisRecente } from '../selecionarHistoricoAtivoMaisRecente.js';

test('ignora históricos cancelados/retificados e pega ativo mais recente', () => {
  const historico = selecionarHistoricoAtivoMaisRecente([
    { id: '1', status_registro: 'retificado', data_promocao: '2025-01-01' },
    { id: '2', status_registro: 'ativo', data_promocao: '2025-01-01', data_publicacao: '2025-01-02' },
    { id: '3', status_registro: 'ativo', data_promocao: '2025-01-01', data_publicacao: '2025-01-03' },
  ]);
  assert.equal(historico.id, '3');
});

test('desempata por created_at e id DESC', () => {
  const historico = selecionarHistoricoAtivoMaisRecente([
    { id: '10', status_registro: 'ativo', data_promocao: '2025-01-01', data_publicacao: '2025-01-03', created_at: '2025-01-03T10:00:00Z' },
    { id: '11', status_registro: 'ativo', data_promocao: '2025-01-01', data_publicacao: '2025-01-03', created_at: '2025-01-03T10:00:00Z' },
  ]);
  assert.equal(historico.id, '11');
});
