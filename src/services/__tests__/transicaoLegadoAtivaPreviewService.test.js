import test from 'node:test';
import assert from 'node:assert/strict';
import { classificarPreviaLegadoAtiva } from '../transicaoLegadoAtivaPreviewService.js';

const basePeriodo = (overrides = {}) => ({
  id: overrides.id || 'p1',
  militar_id: 'm1',
  inicio_aquisitivo: '2024-01-01',
  fim_aquisitivo: '2024-12-31',
  ano_referencia: '2024/2024',
  status: 'Gozado',
  dias_saldo: 0,
  ...overrides,
});

test('seleciona candidatos por fim_aquisitivo menor que data_base', () => {
  const result = classificarPreviaLegadoAtiva({ militarId: 'm1', dataBase: '2025-01-01', periodos: [basePeriodo()] });
  assert.equal(result.candidatos.length, 1);
  assert.equal(result.ignorados.length, 0);
});

test('ignora período com fim igual à data_base', () => {
  const result = classificarPreviaLegadoAtiva({ militarId: 'm1', dataBase: '2025-01-01', periodos: [basePeriodo({ fim_aquisitivo: '2025-01-01' })] });
  assert.equal(result.candidatos.length, 0);
  assert.equal(result.ignorados[0].motivo, 'fim_aquisitivo_maior_ou_igual_data_base');
});

test('ignora período com fim maior que data_base', () => {
  const result = classificarPreviaLegadoAtiva({ militarId: 'm1', dataBase: '2025-01-01', periodos: [basePeriodo({ fim_aquisitivo: '2025-01-02' })] });
  assert.equal(result.candidatos.length, 0);
  assert.equal(result.ignorados[0].motivo, 'fim_aquisitivo_maior_ou_igual_data_base');
});

test('período já legado vai para jaMarcados', () => {
  const result = classificarPreviaLegadoAtiva({ militarId: 'm1', dataBase: '2025-01-01', periodos: [basePeriodo({ legado_ativa: true })] });
  assert.equal(result.jaMarcados.length, 1);
  assert.equal(result.ignorados[0].motivo, 'ja_marcado_legado_ativa');
});

test('período com saldo aberto gera risco', () => {
  const result = classificarPreviaLegadoAtiva({ militarId: 'm1', dataBase: '2025-01-01', periodos: [basePeriodo({ dias_saldo: 10 })] });
  assert.ok(result.candidatos[0].riscos.includes('saldo_aberto'));
  assert.equal(result.totais.com_saldo_aberto, 1);
});

test('período com férias vinculadas por id gera risco', () => {
  const result = classificarPreviaLegadoAtiva({
    militarId: 'm1',
    dataBase: '2025-01-01',
    periodos: [basePeriodo({ id: 'p-ferias' })],
    ferias: [{ id: 'f1', militar_id: 'm1', periodo_aquisitivo_id: 'p-ferias', status: 'Prevista' }],
  });
  assert.ok(result.candidatos[0].riscos.includes('ferias_vinculadas'));
  assert.ok(result.candidatos[0].riscos.includes('ferias_prevista_ou_autorizada'));
  assert.equal(result.totais.com_ferias_vinculadas, 1);
  assert.equal(result.totais.bloqueantes, 1);
});
