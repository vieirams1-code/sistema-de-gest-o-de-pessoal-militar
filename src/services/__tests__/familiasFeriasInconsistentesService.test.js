import { describe, it, expect } from 'vitest';
import {
  avaliarFamiliaPeriodo,
  listarFamiliasInconsistentes,
  montarMapaInconsistenciaPorPeriodo,
} from '../familiasFeriasInconsistentesService.js';

function periodo({ id = 'P1', militar_id = 'M1', dias_direito = 30, ref = '2022/2023' } = {}) {
  return { id, militar_id, dias_direito, ano_referencia: ref, periodo_aquisitivo_ref: ref };
}

function feriasFrac({ periodo_aquisitivo_id = 'P1', militar_id = 'M1', dias, status = 'Prevista', id = Math.random().toString(36) } = {}) {
  return { id, periodo_aquisitivo_id, militar_id, dias, status };
}

describe('familiasFeriasInconsistentesService', () => {
  it('Cenário 1: 15 + 30 = 45, direito 30 → inconsistente, excesso 15', () => {
    const p = periodo();
    const ferias = [feriasFrac({ dias: 15 }), feriasFrac({ dias: 30 })];
    const r = avaliarFamiliaPeriodo({ periodo: p, ajustes: [], ferias });
    expect(r.inconsistente).toBe(true);
    expect(r.soma_valida).toBe(45);
    expect(r.direito_operacional).toBe(30);
    expect(r.excesso).toBe(15);
    expect(r.quantidade_registros).toBe(2);
  });

  it('Cenário 2: 10 + 20 = 30, direito 30 → não inconsistente', () => {
    const p = periodo();
    const ferias = [feriasFrac({ dias: 10 }), feriasFrac({ dias: 20 })];
    const r = avaliarFamiliaPeriodo({ periodo: p, ajustes: [], ferias });
    expect(r.inconsistente).toBe(false);
    expect(r.soma_valida).toBe(30);
  });

  it('Cenário 3: 10 + 10 + 2 = 22, direito 22 → não inconsistente', () => {
    const p = periodo({ dias_direito: 22 });
    const ferias = [feriasFrac({ dias: 10 }), feriasFrac({ dias: 10 }), feriasFrac({ dias: 2 })];
    const r = avaliarFamiliaPeriodo({ periodo: p, ajustes: [], ferias });
    expect(r.inconsistente).toBe(false);
    expect(r.soma_valida).toBe(22);
    expect(r.direito_operacional).toBe(22);
  });

  it('Cenário 4: cancelada 30 + válida 30, direito 30 → soma válida 30, não inconsistente', () => {
    const p = periodo();
    const ferias = [
      feriasFrac({ dias: 30, status: 'Cancelada' }),
      feriasFrac({ dias: 30, status: 'Prevista' }),
    ];
    const r = avaliarFamiliaPeriodo({ periodo: p, ajustes: [], ferias });
    expect(r.soma_valida).toBe(30);
    expect(r.inconsistente).toBe(false);
  });

  it('Cenário 5: direito 32, 10 + 10 + 12 = 32 → não inconsistente', () => {
    const p = periodo({ dias_direito: 32 });
    const ferias = [feriasFrac({ dias: 10 }), feriasFrac({ dias: 10 }), feriasFrac({ dias: 12 })];
    const r = avaliarFamiliaPeriodo({ periodo: p, ajustes: [], ferias });
    expect(r.inconsistente).toBe(false);
    expect(r.direito_operacional).toBe(32);
    expect(r.soma_valida).toBe(32);
  });

  it('Cenário 6: correção 15+30 → 15+15 remove da lista', () => {
    const p = periodo();
    const antes = listarFamiliasInconsistentes({
      periodos: [p], ajustes: [], ferias: [feriasFrac({ dias: 15 }), feriasFrac({ dias: 30 })],
    });
    expect(antes).toHaveLength(1);

    const depois = listarFamiliasInconsistentes({
      periodos: [p], ajustes: [], ferias: [feriasFrac({ dias: 15 }), feriasFrac({ dias: 15 })],
    });
    expect(depois).toHaveLength(0);
  });

  it('mapa por período expõe famílias inconsistentes por id', () => {
    const p = periodo();
    const mapa = montarMapaInconsistenciaPorPeriodo({
      periodos: [p], ajustes: [], ferias: [feriasFrac({ dias: 15 }), feriasFrac({ dias: 30 })],
    });
    expect(mapa.get('id:P1')?.excesso).toBe(15);
  });
});