import { describe, expect, it } from 'vitest';
import { separarTagsPorStatus, validarAplicabilidadeTagMilitar, validarDuplicidadeTagAtiva } from '../militarTags';

describe('separarTagsPorStatus', () => {
  it('separa tags ativas e removidas', () => {
    const { ativas, removidas } = separarTagsPorStatus([
      { id: '1', status: 'ativa' },
      { id: '2', status: 'removida' },
      { id: '3', status: 'ATIVA' }
    ]);

    expect(ativas).toHaveLength(2);
    expect(removidas).toHaveLength(1);
  });
});

describe('validarAplicabilidadeTagMilitar', () => {
  it('bloqueia tags de férias', () => {
    const mensagem = validarAplicabilidadeTagMilitar({ aplicabilidade: 'ferias' });
    expect(mensagem).toBe('Esta tag não pode ser aplicada em militares.');
  });

  it('permite tag militar', () => {
    const mensagem = validarAplicabilidadeTagMilitar({ aplicabilidade: 'militar' });
    expect(mensagem).toBeNull();
  });
});

describe('validarDuplicidadeTagAtiva', () => {
  it('bloqueia duplicidade de tag ativa', () => {
    const mensagem = validarDuplicidadeTagAtiva({
      vinculosAtivos: [{ tag_id: 'tag-1', status: 'ativa' }],
      tagId: 'tag-1'
    });

    expect(mensagem).toBe('Este militar já possui esta tag ativa.');
  });
});
