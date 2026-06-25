import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  compararSaldoPeriodo,
  converterRegistrosLegadosEmAjustesVirtuais,
} from '../diagnosticoSaldoFeriasService.js';

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

  it('sem AjusteSaldoFerias reais: ajustes_puro fica diferente do legado virtualizado', () => {
    const resultado = compararSaldoPeriodo({
      periodo: { ...periodo, dias_saldo: 32 },
      ajustes: [],
      ferias: [],
      creditosExtraordinarios: [{ id: 'c1', periodo_aquisitivo_id: 'p1', status: 'DISPONIVEL', quantidade_dias: 5 }],
      descontos: [{ id: 'd1', periodo_aquisitivo_id: 'p1', status: 'ativo', saldo_aplicado: true, dias: 3 }],
    });

    assert.equal(resultado.modelo_derivado_legado.saldo, 32);
    assert.equal(resultado.modelo_ajustes_puro.saldo, 30);
    assert.equal(resultado.diferenca_legado_vs_ajustes_puro, -2);
  });

  it('com AjusteSaldoFerias equivalente: ajustes_puro fica igual ao legado virtualizado', () => {
    const resultado = compararSaldoPeriodo({
      periodo: { ...periodo, dias_saldo: 32 },
      ajustes: [
        { id: 'a1', periodo_aquisitivo_id: 'p1', tipo: 'credito', dias: 5, status: 'ativo' },
        { id: 'a2', periodo_aquisitivo_id: 'p1', tipo: 'debito', dias: 3, status: 'ativo' },
      ],
      ferias: [],
      creditosExtraordinarios: [{ id: 'c1', periodo_aquisitivo_id: 'p1', status: 'DISPONIVEL', quantidade_dias: 5 }],
      descontos: [{ id: 'd1', periodo_aquisitivo_id: 'p1', status: 'ativo', saldo_aplicado: true, dias: 3 }],
    });

    assert.equal(resultado.modelo_derivado_legado.saldo, 32);
    assert.equal(resultado.modelo_ajustes_puro.saldo, 32);
    assert.equal(resultado.diferenca_legado_vs_ajustes_puro, 0);
  });

  it('calcula diferenças entre oficial, legado e ajustes_puro corretamente', () => {
    const resultado = compararSaldoPeriodo({
      periodo: { ...periodo, dias_saldo: 29 },
      ajustes: [{ id: 'a1', periodo_aquisitivo_id: 'p1', tipo: 'credito', dias: 1, status: 'ativo' }],
      ferias: [],
      creditosExtraordinarios: [{ id: 'c1', periodo_aquisitivo_id: 'p1', status: 'DISPONIVEL', quantidade_dias: 4 }],
      descontos: [{ id: 'd1', periodo_aquisitivo_id: 'p1', status: 'ativo', saldo_aplicado: true, dias: 2 }],
    });

    assert.equal(resultado.modelo_oficial_atual.saldo_atual_sistema, 29);
    assert.equal(resultado.modelo_derivado_legado.saldo, 32);
    assert.equal(resultado.modelo_ajustes_puro.saldo, 31);
    assert.equal(resultado.diferenca_oficial_vs_legado, 3);
    assert.equal(resultado.diferenca_oficial_vs_ajustes_puro, 2);
    assert.equal(resultado.diferenca_legado_vs_ajustes_puro, -1);
  });

  it('desconto ativo vira débito virtual', () => {
    const ajustesVirtuais = converterRegistrosLegadosEmAjustesVirtuais({
      descontos: [{ id: 'd1', periodo_aquisitivo_id: 'p1', status: 'ativo', saldo_aplicado: true, dias: 3 }],
    });
    const resultado = compararSaldoPeriodo({ periodo: { ...periodo, dias_saldo: 27 }, descontos: [{ id: 'd1', periodo_aquisitivo_id: 'p1', status: 'ativo', saldo_aplicado: true, dias: 3 }] });

    assert.equal(ajustesVirtuais[0].tipo, 'debito');
    assert.equal(resultado.modelo_derivado_legado.debitos_ativos, 3);
    assert.equal(resultado.modelo_derivado_legado.saldo, 27);
  });

  it('desconto pendente não entra no legado virtualizado', () => {
    const ajustesVirtuais = converterRegistrosLegadosEmAjustesVirtuais({
      descontos: [{ id: 'd1', periodo_aquisitivo_id: 'p1', status: 'pendente_publicacao', saldo_aplicado: true, dias: 3 }],
    });
    const resultado = compararSaldoPeriodo({ periodo, descontos: [{ id: 'd1', periodo_aquisitivo_id: 'p1', status: 'pendente_publicacao', saldo_aplicado: true, dias: 3 }] });

    assert.equal(ajustesVirtuais.length, 0);
    assert.equal(resultado.modelo_derivado_legado.debitos_ativos, 0);
    assert.equal(resultado.modelo_derivado_legado.saldo, 30);
  });
});
