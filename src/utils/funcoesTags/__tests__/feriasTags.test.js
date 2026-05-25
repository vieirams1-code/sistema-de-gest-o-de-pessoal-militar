import { describe, expect, it } from 'vitest';
import {
  separarTagsFeriasPorStatus,
  validarAplicabilidadeTagFerias,
  validarDuplicidadeTagAtivaFerias,
  isTagAplicavelNoAtestado,
} from '../feriasTags';

describe('feriasTags', () => {
  it('separa vínculos por status', () => {
    const { ativas, removidas } = separarTagsFeriasPorStatus([
      { id: '1', status: 'ativa' },
      { id: '2', status: 'removida' },
    ]);

    expect(ativas).toHaveLength(1);
    expect(removidas).toHaveLength(1);
  });

  it('valida aplicabilidade de férias', () => {
    expect(validarAplicabilidadeTagFerias({ aplicabilidade: 'ferias' })).toBeNull();
    expect(validarAplicabilidadeTagFerias({ aplicabilidade: 'todos' })).toBeNull();
    expect(validarAplicabilidadeTagFerias({ aplicabilidade: 'ambos' })).toBeNull();
    expect(validarAplicabilidadeTagFerias({ aplicabilidade: 'militar' })).toBe('Esta tag não pode ser aplicada em férias.');
  });

  it('valida aplicabilidade de atestado (helper preparatório)', () => {
    expect(isTagAplicavelNoAtestado({ ativo: true, aplicabilidade: 'atestado' })).toBe(true);
    expect(isTagAplicavelNoAtestado({ ativo: true, aplicabilidade: 'todos' })).toBe(true);
    expect(isTagAplicavelNoAtestado({ ativo: true, aplicabilidade: 'ferias' })).toBe(false);
  });

  it('bloqueia duplicidade de tag ativa na mesma férias', () => {
    const erro = validarDuplicidadeTagAtivaFerias({
      vinculosAtivos: [{ tag_id: 'tag-1', status: 'ativa' }],
      tagId: 'tag-1',
    });

    expect(erro).toBe('Estas férias já possuem esta tag ativa.');
  });
});
