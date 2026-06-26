import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calcularSaldoOperacionalPeriodo } from '../saldoFeriasOperacionalService.js';

const periodo = { id: 'p1', militar_id: 'm1', ano_referencia: '2025/2026', dias_direito: 30 };

describe('calcularSaldoOperacionalPeriodo', () => {
  it('período base 30 sem ajuste => direito líquido 30', () => {
    const saldo = calcularSaldoOperacionalPeriodo({ periodo, ajustes: [], ferias: [] });
    assert.equal(saldo.direito_liquido, 30);
    assert.equal(saldo.saldo_restante, 30);
  });

  it('crédito ativo +2 => direito líquido 32', () => {
    const saldo = calcularSaldoOperacionalPeriodo({ periodo, ajustes: [{ tipo: 'credito', dias: 2, status: 'ativo' }], ferias: [] });
    assert.equal(saldo.direito_liquido, 32);
  });

  it('débito ativo -2 => direito líquido 28', () => {
    const saldo = calcularSaldoOperacionalPeriodo({ periodo, ajustes: [{ tipo: 'debito', dias: 2, status: 'ativo' }], ferias: [] });
    assert.equal(saldo.direito_liquido, 28);
  });

  it('crédito cancelado não entra', () => {
    const saldo = calcularSaldoOperacionalPeriodo({ periodo, ajustes: [{ tipo: 'credito', dias: 2, status: 'cancelado' }], ferias: [] });
    assert.equal(saldo.direito_liquido, 30);
  });

  it('criação de férias usa 32 quando há crédito +2 e bloqueia acima do saldo restante', () => {
    const saldo = calcularSaldoOperacionalPeriodo({ periodo, ajustes: [{ tipo: 'credito', dias: 2, status: 'ativo' }], ferias: [] });
    assert.equal(saldo.direito_liquido, 32);
    assert.equal(32 <= saldo.saldo_restante, true);
    assert.equal(33 > saldo.saldo_restante, true);
  });
});
