import { agruparTagsPorGrupo, BULK_TAGS_MAX_MILITARES, calcularTentativasBulk, excedeLimiteMilitaresSelecionados, montarTagsPresentesNosSelecionados, resumirResultadoBulk } from '@/utils/funcoesTags/militarTagsBulk';

describe('militarTagsBulk', () => {
  it('calcula tentativas N x M', () => {
    expect(calcularTentativasBulk(4, 3)).toBe(12);
  });

  it('bloqueia seleção acima de 20 militares', () => {
    expect(excedeLimiteMilitaresSelecionados(BULK_TAGS_MAX_MILITARES + 1)).toBe(true);
    expect(excedeLimiteMilitaresSelecionados(BULK_TAGS_MAX_MILITARES)).toBe(false);
  });

  it('agrupa tags por grupo', () => {
    const grupos = [{ id: 'g1', nome: 'Operacional', emoji: '🚓', ordem: 1 }];
    const tags = [{ id: 't1', grupo_id: 'g1', nome: 'Motorista' }];
    expect(agruparTagsPorGrupo(tags, grupos)[0].nome).toBe('Operacional');
  });

  it('monta tags presentes nos selecionados', () => {
    const result = montarTagsPresentesNosSelecionados({
      selectedMilitarIds: ['m1', 'm2'],
      vinculosTagsAtivos: [{ militar_id: 'm1', tag_id: 't1' }, { militar_id: 'm2', tag_id: 't1' }],
      tagsAtivas: [{ id: 't1', nome: 'Motorista' }],
    });
    expect(result[0].presentes).toBe(2);
  });

  it('resume resultado', () => {
    expect(resumirResultadoBulk({ aplicadas: 8, duplicadas: 2, erros: 1, modo: 'apply' })).toContain('8');
  });
});
