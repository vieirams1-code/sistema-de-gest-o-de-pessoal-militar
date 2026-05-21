import test from 'node:test';
import assert from 'node:assert/strict';
import { montarDivergenciasPromocao, construirPayloadSincronizacaoPromocao } from '../saneamentoPromocaoDivergencia.js';

const militarBase = { id: 'm1', posto_graduacao: 'Subtenente', quadro: 'QPPM' };

test('militar alinhado não aparece na lista', () => {
  const out = montarDivergenciasPromocao({ militares: [militarBase], historicos: [{ id: 'h1', militar_id: 'm1', status_registro: 'ativo', posto_graduacao_novo: 'Subtenente', quadro_novo: 'QPPM', data_promocao: '2025-01-01' }] });
  assert.equal(out.length, 0);
});

test('militar divergente aparece', () => {
  const out = montarDivergenciasPromocao({ militares: [militarBase], historicos: [{ id: 'h1', militar_id: 'm1', status_registro: 'ativo', posto_graduacao_novo: '1º Sargento', quadro_novo: 'QPPM', data_promocao: '2025-01-01' }] });
  assert.equal(out.length, 1);
});

test('histórico cancelado/retificado é ignorado', () => {
  const out = montarDivergenciasPromocao({ militares: [militarBase], historicos: [{ id: 'h1', militar_id: 'm1', status_registro: 'retificado', posto_graduacao_novo: '1º Sargento', quadro_novo: 'QPPM', data_promocao: '2025-01-01' }] });
  assert.equal(out.length, 0);
});

test('histórico ativo mais recente vence', () => {
  const out = montarDivergenciasPromocao({ militares: [militarBase], historicos: [
    { id: 'h1', militar_id: 'm1', status_registro: 'ativo', posto_graduacao_novo: '1º Sargento', quadro_novo: 'QPPM', data_promocao: '2024-01-01' },
    { id: 'h2', militar_id: 'm1', status_registro: 'ativo', posto_graduacao_novo: 'Subtenente', quadro_novo: 'QOA', data_promocao: '2025-01-01' },
  ] });
  assert.equal(out[0].historico_id, 'h2');
});

test('sync gera payload somente com posto_graduacao e quadro', () => {
  const payload = construirPayloadSincronizacaoPromocao({ posto_graduacao_novo: 'Subtenente', quadro_novo: 'QPPM', outro: 'x' });
  assert.deepEqual(payload, { posto_graduacao: 'Subtenente', quadro: 'QPPM' });
  assert.equal(Object.keys(payload).length, 2);
});
