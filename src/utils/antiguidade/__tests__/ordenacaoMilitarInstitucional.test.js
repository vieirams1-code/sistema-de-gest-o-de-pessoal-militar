import { describe, expect, it } from 'vitest';
import { ordenarMilitaresPorAntiguidadeInstitucional } from '../ordenacaoMilitarInstitucional.js';

describe('ordenarMilitaresPorAntiguidadeInstitucional', () => {
  it('ordena 2 TENENTE QOBM antes de QAOBM conforme ordem institucional de quadros', () => {
    const militares = [
      { id: '2', nome: 'Carlos QAOBM', posto_graduacao: '2º Tenente', quadro: 'QAOBM', antiguidade_referencia_ordem: 10 },
      { id: '1', nome: 'Edson Vieira', posto_graduacao: '2º Tenente', quadro: 'QOBM', antiguidade_referencia_ordem: 20 },
    ];

    const resultado = ordenarMilitaresPorAntiguidadeInstitucional(militares);
    expect(resultado.map((m) => m.id)).toEqual(['1', '2']);
  });

  it('mantém fallback estável por nome/matrícula/id quando dados de antiguidade são ausentes', () => {
    const militares = [
      { id: '20', nome: 'Helena', posto_graduacao: '2º Tenente', quadro: 'QOBM' },
      { id: '10', nome: 'Edson', posto_graduacao: '2º Tenente', quadro: 'QOBM' },
    ];

    const resultado = ordenarMilitaresPorAntiguidadeInstitucional(militares);
    expect(resultado.map((m) => m.nome)).toEqual(['Edson', 'Helena']);
  });
});
