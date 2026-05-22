import { describe, expect, it } from 'vitest';

import { enriquecerMilitaresComFuncoesETags } from '../enriquecimentoMilitarFuncoesTags';
import { filtrarMilitaresPorFuncoesETags } from '../filtrosEfetivo';

describe('enriquecimentoMilitarFuncoesTags', () => {
  it('monta função principal explícita, fallback por prioridade e concatenações', () => {
    const militares = [{ id: 'm1' }, { id: 'm2' }];
    const funcoesAtivas = [
      { id: 'f1', nome: 'Comandante', prioridade_lista: 20 },
      { id: 'f2', nome: 'Subcomandante', prioridade_lista: 10 },
      { id: 'f3', nome: 'Chefe', prioridade_lista: 5 },
    ];
    const vinculosFuncoesAtivos = [
      { militar_id: 'm1', funcao_militar_id: 'f1', status: 'ativa', principal: true },
      { militar_id: 'm1', funcao_id: 'f2', status: 'ativa' },
      { militar_id: 'm2', funcao_id: 'f2', status: 'ativa' },
      { militar_id: 'm2', funcao_id: 'f3', status: 'ativa' },
    ];
    const gruposTagsAtivos = [{ id: 'g1', nome: 'Restrições' }, { id: 'g2', nome: 'Destaques' }];
    const tagsAtivas = [
      { id: 't1', nome: 'Restrição A', tag_grupo_id: 'g1', aplicabilidade: 'militar', ordem_lista: 2 },
      { id: 't2', nome: 'Restrição B', grupo_id: 'g1', aplicabilidade: 'ambos', ordem_lista: 1 },
      { id: 't3', nome: 'Condecorado', grupo_id: 'g2', aplicabilidade: 'militar', ordem_lista: 1 },
      { id: 't4', nome: 'Somente férias', grupo_id: 'g2', aplicabilidade: 'ferias', ordem_lista: 1 },
    ];
    const vinculosTagsAtivos = [
      { militar_id: 'm1', tag_id: 't1', status: 'ativa' },
      { militar_id: 'm1', tag_id: 't2', status: 'ativa' },
      { militar_id: 'm1', tag_id: 't3', status: 'ativa' },
      { militar_id: 'm1', tag_id: 't4', status: 'ativa' },
    ];

    const result = enriquecerMilitaresComFuncoesETags({ militares, funcoesAtivas, vinculosFuncoesAtivos, gruposTagsAtivos, tagsAtivas, vinculosTagsAtivos });

    expect(result[0].funcao_principal).toBe('Comandante');
    expect(result[0].funcoes).toBe('Subcomandante | Comandante');
    expect(result[1].funcao_principal).toBe('Chefe');
    expect(result[0].tags).toBe('Condecorado | Restrição B | Restrição A');
    expect(result[0].grupos_tags).toBe('Destaques | Restrições');
  });

  it('filtra com OR intra-categoria e AND entre categorias', () => {
    const militares = [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }];
    const vinculosFuncoesAtivos = [
      { militar_id: 'm1', funcao_id: 'f1', status: 'ativa' },
      { militar_id: 'm2', funcao_id: 'f2', status: 'ativa' },
      { militar_id: 'm3', funcao_id: 'f1', status: 'ativa' },
    ];
    const vinculosTagsAtivos = [
      { militar_id: 'm1', tag_id: 't1', status: 'ativa' },
      { militar_id: 'm2', tag_id: 't1', status: 'ativa' },
      { militar_id: 'm3', tag_id: 't2', status: 'ativa' },
    ];
    const tagsAtivas = [
      { id: 't1', grupo_id: 'g1' },
      { id: 't2', grupo_id: 'g2' },
    ];

    const filtrados = filtrarMilitaresPorFuncoesETags({
      militares,
      filtros: { funcoesIds: ['f1', 'f2'], tagsIds: ['t1'], gruposIds: ['g1'] },
      vinculosFuncoesAtivos,
      vinculosTagsAtivos,
      tagsAtivas,
    });

    expect(filtrados.map((m) => m.id)).toEqual(['m1', 'm2']);
  });
});
