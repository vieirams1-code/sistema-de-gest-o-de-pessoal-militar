import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compararSaldoPeriodo } from '../diagnosticoSaldoFeriasService.js';

const periodo = { id: 'p1', militar_id: 'm1', ano_referencia: '2025/2026', dias_direito: 30, dias_saldo: 30 };

describe('diagnosticoSaldoFeriasService', () => {
  it('retorna modelo oficial atual sem alterar o saldo do sistema', () => {
    const resultado = compararSaldoPeriodo({
      periodo: { ...periodo, dias_base: 30, dias_previstos: 4, dias_gozados: 6, dias_saldo: 20 },
      ajustes: [],
      ferias: [],
    });

    assert.deepEqual(resultado.modelo_oficial_atual, {
      saldo_atual_sistema: 20,
      base_atual: 30,
      previstos: 4,
      gozados: 6,
    });
    assert.equal(resultado.saldo_atual_sistema, 20);
  });

  it('usa somente AjusteSaldoFerias reais no modelo operacional', () => {
    const resultado = compararSaldoPeriodo({
      periodo: { ...periodo, dias_saldo: 32 },
      ajustes: [
        { id: 'a1', periodo_aquisitivo_id: 'p1', tipo: 'credito', dias: 5, status: 'ativo' },
        { id: 'a2', periodo_aquisitivo_id: 'p1', tipo: 'debito', dias: 3, status: 'ativo' },
      ],
      ferias: [],
    });

    assert.equal(resultado.modelo_operacional.saldo, 32);
    assert.equal(resultado.diferenca_oficial_vs_operacional, 0);
  });

  it('desconta férias previstas e gozadas pelo serviço operacional', () => {
    const resultado = compararSaldoPeriodo({
      periodo: { ...periodo, dias_saldo: 21 },
      ajustes: [{ id: 'a1', periodo_aquisitivo_id: 'p1', tipo: 'credito', dias: 1, status: 'ativo' }],
      ferias: [
        { id: 'f1', militar_id: 'm1', periodo_aquisitivo_id: 'p1', status: 'Gozada', dias: 6 },
        { id: 'f2', militar_id: 'm1', periodo_aquisitivo_id: 'p1', status: 'Prevista', dias: 4 },
      ],
    });

    assert.equal(resultado.modelo_operacional.saldo, 21);
    assert.equal(resultado.modelo_operacional.gozados_previstos, 10);
    assert.equal(resultado.diferenca, 0);
  });
});
