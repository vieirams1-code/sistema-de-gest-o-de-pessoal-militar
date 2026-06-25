import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularAjustesPeriodo,
  calcularSaldoLiquidoPeriodo,
  isAjusteAtivo,
  isAjustePendente,
  normalizarStatusAjuste,
} from '../calculadoraSaldoFeriasService.js';

const periodo = { id: 'p1', militar_id: 'm1', ano_referencia: '2025/2026', dias_direito: 30 };

function calcular({ ajustes = [], ferias = [] } = {}) {
  return calcularSaldoLiquidoPeriodo({ periodo, ajustes, ferias });
}

describe('calculadoraSaldoFeriasService', () => {
  it('Base 30 sem ajuste = 30', () => {
    assert.equal(calcular().saldo_liquido, 30);
  });

  it('Base 30 + crédito ativo 2 = 32', () => {
    assert.equal(calcular({ ajustes: [{ tipo: 'credito', dias: 2, status: 'ativo' }] }).saldo_liquido, 32);
  });

  it('Base 30 - débito ativo 2 = 28', () => {
    assert.equal(calcular({ ajustes: [{ tipo: 'debito', dias: 2, status: 'ativo' }] }).saldo_liquido, 28);
  });

  it('Débito pendente não altera', () => {
    assert.equal(calcular({ ajustes: [{ tipo: 'debito', dias: 2, status: 'pendente_publicacao' }] }).saldo_liquido, 30);
  });

  it('Débito cancelado não altera', () => {
    assert.equal(calcular({ ajustes: [{ tipo: 'debito', dias: 2, status: 'cancelado' }] }).saldo_liquido, 30);
  });

  it('Débito revertido não altera', () => {
    assert.equal(calcular({ ajustes: [{ tipo: 'debito', dias: 2, status: 'revertido' }] }).saldo_liquido, 30);
  });

  it('Crédito cancelado não altera', () => {
    assert.equal(calcular({ ajustes: [{ tipo: 'credito', dias: 2, status: 'cancelado' }] }).saldo_liquido, 30);
  });

  it('Férias previstas/gozadas reduzem saldo', () => {
    const resultado = calcular({
      ferias: [
        { id: 'f1', periodo_aquisitivo_id: 'p1', dias: 10, status: 'Gozada' },
        { id: 'f2', periodo_aquisitivo_id: 'p1', dias: 5, status: 'Prevista' },
      ],
    });

    assert.equal(resultado.dias_gozados_previstos, 15);
    assert.equal(resultado.saldo_liquido, 15);
  });

  it('Cálculo idempotente: executar 10 vezes retorna mesmo resultado', () => {
    const input = {
      ajustes: [
        { id: 'a1', tipo: 'credito', dias: 3, status: 'ativo' },
        { id: 'a2', tipo: 'debito', dias: 1, status: 'ativo' },
      ],
      ferias: [{ id: 'f1', periodo_aquisitivo_id: 'p1', dias: 7, status: 'Autorizada' }],
    };
    const esperado = calcular(input);

    for (let index = 0; index < 10; index += 1) {
      assert.deepEqual(calcular(input), esperado);
    }
  });

  it('calcularAjustesPeriodo totaliza ativos e conta estados sem impacto', () => {
    assert.deepEqual(calcularAjustesPeriodo([
      { tipo: 'credito', dias: 2, status: 'ativo' },
      { tipo: 'debito', dias: 1, status: 'ativo' },
      { tipo: 'debito', dias: 4, status: 'pendente_publicacao' },
      { tipo: 'credito', dias: 4, status: 'cancelado' },
      { tipo: 'credito', dias: 4, status: 'revertido' },
    ]), {
      creditos_ativos: 2,
      debitos_ativos: 1,
      ajustes_pendentes: 1,
      ajustes_cancelados: 1,
      ajustes_revertidos: 1,
    });
  });

  it('normalizadores de status e predicados preservam a regra de ativo/pendente', () => {
    assert.equal(normalizarStatusAjuste(' ATIVO '), 'ativo');
    assert.equal(normalizarStatusAjuste('desconhecido'), 'rascunho');
    assert.equal(isAjusteAtivo({ status: 'ativo' }), true);
    assert.equal(isAjustePendente({ status: 'pendente_publicacao' }), true);
  });
});
