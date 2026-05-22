import { describe, expect, it } from 'vitest';
import { construirDecoracaoInstitucionalPorMilitar, ordenarComDestaqueInstitucional } from '../destaqueInstitucionalEfetivo';

describe('destaqueInstitucionalEfetivo', () => {
  it('atribui rank por função institucional e mantém ordenação estável entre demais', () => {
    const militares = [
      { id: 'm3', nome: 'Terceiro' },
      { id: 'm1', nome: 'Primeiro' },
      { id: 'm2', nome: 'Segundo' },
      { id: 'm4', nome: 'Quarto' },
    ];

    const funcoesInstitucionais = [
      { id: 'f2', institucional_chave: 'subcomandante', nome: 'Subcomandante', prioridade_lista: 2, emoji: '🔰', cor: '#2563EB' },
      { id: 'f1', institucional_chave: 'comandante', nome: 'Comandante', prioridade_lista: 1, emoji: '🛡️', cor: '#1D4ED8' },
    ];

    const vinculosAtivos = [
      { militar_id: 'm2', funcao_id: 'f2', status: 'ativa' },
      { militar_id: 'm1', funcao_id: 'f1', status: 'ativa' },
    ];

    const decoracao = construirDecoracaoInstitucionalPorMilitar({ militares, funcoesInstitucionais, vinculosAtivos });

    expect(decoracao.get('m1').sort_rank_funcional).toBe(1);
    expect(decoracao.get('m2').sort_rank_funcional).toBe(2);
    expect(decoracao.get('m3').sort_rank_funcional).toBe(100);

    const ordenados = ordenarComDestaqueInstitucional(militares, decoracao);
    expect(ordenados.map((m) => m.id)).toEqual(['m1', 'm2', 'm3', 'm4']);
  });
});
