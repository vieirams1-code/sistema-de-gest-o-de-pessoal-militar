import { describe, expect, it } from 'vitest';
import { filtrarMilitaresPorFuncoesETags } from '../filtrosEfetivo';

const militares = [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }];
const vinculosFuncoesAtivos = [
  { militar_id: 'm1', funcao_id: 'f1', status: 'ativa' },
  { militar_id: 'm2', funcao_id: 'f2', status: 'ativa' },
];
const vinculosTagsAtivos = [
  { militar_id: 'm1', tag_id: 't1', status: 'ativa' },
  { militar_id: 'm2', tag_id: 't2', status: 'ativa' },
];
const tagsAtivas = [
  { id: 't1', grupo_id: 'g1' },
  { id: 't2', grupo_id: 'g2' },
];

describe('filtrarMilitaresPorFuncoesETags', () => {
  it('filtra por uma função', () => {
    const ids = filtrarMilitaresPorFuncoesETags({ militares, filtros: { funcoesIds: ['f1'] }, vinculosFuncoesAtivos }).map((m) => m.id);
    expect(ids).toEqual(['m1']);
  });

  it('filtra por múltiplas funções com OR interno', () => {
    const ids = filtrarMilitaresPorFuncoesETags({ militares, filtros: { funcoesIds: ['f1', 'f2'] }, vinculosFuncoesAtivos }).map((m) => m.id);
    expect(ids).toEqual(['m1', 'm2']);
  });

  it('filtra por tag', () => {
    const ids = filtrarMilitaresPorFuncoesETags({ militares, filtros: { tagsIds: ['t2'] }, vinculosTagsAtivos }).map((m) => m.id);
    expect(ids).toEqual(['m2']);
  });

  it('filtra por grupo', () => {
    const ids = filtrarMilitaresPorFuncoesETags({ militares, filtros: { gruposIds: ['g1'] }, vinculosTagsAtivos, tagsAtivas }).map((m) => m.id);
    expect(ids).toEqual(['m1']);
  });

  it('combina função + tag com AND', () => {
    const ids = filtrarMilitaresPorFuncoesETags({
      militares,
      filtros: { funcoesIds: ['f1'], tagsIds: ['t1', 't2'] },
      vinculosFuncoesAtivos,
      vinculosTagsAtivos,
    }).map((m) => m.id);
    expect(ids).toEqual(['m1']);
  });

  it('militar sem vínculo não aparece com filtro ativo', () => {
    const ids = filtrarMilitaresPorFuncoesETags({ militares, filtros: { tagsIds: ['t1'] }, vinculosTagsAtivos }).map((m) => m.id);
    expect(ids).not.toContain('m3');
  });

  it('sem filtros retorna todos', () => {
    const ids = filtrarMilitaresPorFuncoesETags({ militares }).map((m) => m.id);
    expect(ids).toEqual(['m1', 'm2', 'm3']);
  });
});
