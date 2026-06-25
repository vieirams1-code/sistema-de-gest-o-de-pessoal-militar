import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  compararSaldoPeriodo,
  converterRegistrosLegadosEmAjustesVirtuais,
} from '../diagnosticoSaldoFeriasService.js';

const periodo = { id: 'p1', militar_id: 'm1', ano_referencia: '2025/2026', dias_direito: 30, dias_saldo: 30 };

describe('diagnosticoSaldoFeriasService', () => {
  it('saldo atual igual derivado', () => {
    const resultado = compararSaldoPeriodo({ periodo, ajustes: [], ferias: [] });

    assert.equal(resultado.saldo_atual_sistema, 30);
    assert.equal(resultado.saldo_derivado, 30);
    assert.equal(resultado.diferenca, 0);
    assert.deepEqual(resultado.inconsistencias, []);
  });

  it('saldo atual diferente derivado', () => {
    const resultado = compararSaldoPeriodo({
      periodo: { ...periodo, dias_saldo: 28 },
      ajustes: [{ periodo_aquisitivo_id: 'p1', tipo: 'credito', dias: 2, status: 'ativo' }],
      ferias: [],
    });

    assert.equal(resultado.saldo_atual_sistema, 28);
    assert.equal(resultado.saldo_derivado, 32);
    assert.equal(resultado.diferenca, 4);
    assert.deepEqual(resultado.inconsistencias, ['saldo_atual_diferente_do_derivado']);
  });

  it('desconto ativo vira débito virtual', () => {
    const ajustesVirtuais = converterRegistrosLegadosEmAjustesVirtuais({
      descontos: [{ id: 'd1', periodo_aquisitivo_id: 'p1', status: 'ativo', saldo_aplicado: true, dias: 3 }],
    });
    const resultado = compararSaldoPeriodo({ periodo, ajustes: ajustesVirtuais, ferias: [] });

    assert.equal(ajustesVirtuais[0].tipo, 'debito');
    assert.equal(resultado.debitos_ativos, 3);
    assert.equal(resultado.saldo_derivado, 27);
  });

  it('desconto pendente não entra', () => {
    const ajustesVirtuais = converterRegistrosLegadosEmAjustesVirtuais({
      descontos: [{ id: 'd1', periodo_aquisitivo_id: 'p1', status: 'pendente_publicacao', saldo_aplicado: true, dias: 3 }],
    });
    const resultado = compararSaldoPeriodo({ periodo, ajustes: ajustesVirtuais, ferias: [] });

    assert.equal(ajustesVirtuais.length, 0);
    assert.equal(resultado.debitos_ativos, 0);
    assert.equal(resultado.saldo_derivado, 30);
  });

  it('crédito ativo vira crédito virtual', () => {
    const ajustesVirtuais = converterRegistrosLegadosEmAjustesVirtuais({
      creditosExtraordinarios: [{ id: 'c1', periodo_aquisitivo_id: 'p1', status: 'DISPONIVEL', quantidade_dias: 5 }],
    });
    const resultado = compararSaldoPeriodo({ periodo, ajustes: ajustesVirtuais, ferias: [] });

    assert.equal(ajustesVirtuais[0].tipo, 'credito');
    assert.equal(resultado.creditos_ativos, 5);
    assert.equal(resultado.saldo_derivado, 35);
  });
});
