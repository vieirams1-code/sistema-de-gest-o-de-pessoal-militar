import { describe, expect, it } from 'vitest';
import { getFuncaoMilitarId, getTagGrupoId, isCatalogoAtivo, isRegistroAtivo } from '../contratoCampos';

describe('contratoCampos', () => {
  it('aceita chaves legadas e atuais', () => {
    expect(getFuncaoMilitarId({ funcao_militar_id: 'f1' })).toBe('f1');
    expect(getFuncaoMilitarId({ funcao_id: 'f2' })).toBe('f2');
    expect(getTagGrupoId({ grupo_id: 'g1' })).toBe('g1');
    expect(getTagGrupoId({ tag_grupo_id: 'g2' })).toBe('g2');
  });

  it('resolve ativo em variacoes de contrato', () => {
    expect(isRegistroAtivo({ status: 'ativa' })).toBe(true);
    expect(isRegistroAtivo({ status: 'ativo' })).toBe(true);
    expect(isRegistroAtivo({ ativo: true })).toBe(true);
    expect(isRegistroAtivo({ ativa: true })).toBe(true);
    expect(isCatalogoAtivo({ status: 'ativo' })).toBe(true);
  });
});
