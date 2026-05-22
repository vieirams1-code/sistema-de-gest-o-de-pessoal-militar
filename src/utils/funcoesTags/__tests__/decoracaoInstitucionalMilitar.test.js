import { describe, expect, it } from 'vitest';
import {
  montarDecoracoesInstitucionaisPorMilitar,
  getDecoracaoInstitucionalMilitar,
  getBadgeInstitucionalProps,
} from '../decoracaoInstitucionalMilitar';

describe('decoracaoInstitucionalMilitar', () => {
  it('monta a decoracao com prioridade institucional por militar', () => {
    const militares = [{ id: 'm1' }];
    const funcoesInstitucionais = [
      { id: 'f1', institucional_chave: 'comandante', nome: 'Comandante', prioridade_lista: 1, emoji: '🛡️', cor: '#1D4ED8' },
      { id: 'f2', institucional_chave: 'subcomandante', nome: 'Subcomandante', prioridade_lista: 2, emoji: '🔰', cor: '#2563EB' },
    ];
    const vinculosAtivos = [
      { militar_id: 'm1', funcao_id: 'f2' },
      { militar_id: 'm1', funcao_id: 'f1' },
    ];

    const mapa = montarDecoracoesInstitucionaisPorMilitar({ militares, funcoesInstitucionais, vinculosAtivos });
    const decoracao = getDecoracaoInstitucionalMilitar(mapa, 'm1');

    expect(decoracao.funcaoInstitucional.nome).toBe('Comandante');
    expect(decoracao.sort_rank_funcional).toBe(1);
  });

  it('retorna fallback visual no badge quando faltam campos', () => {
    const badge = getBadgeInstitucionalProps({ nome: null, cor: null, emoji: null });
    expect(badge).toEqual({
      chave: '',
      nome: 'Função institucional',
      emoji: '🏷️',
      cor: '#64748B',
    });
  });
});
