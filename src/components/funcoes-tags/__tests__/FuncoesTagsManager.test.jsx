import { describe, expect, it } from 'vitest';
import { APLICABILIDADES } from '../FuncoesTagsManager';

describe('FuncoesTagsManager - catálogo de aplicabilidade', () => {
  it('exibe opção Todos no catálogo', () => {
    const valores = APLICABILIDADES.map((item) => item.value);
    const labels = APLICABILIDADES.map((item) => item.label);

    expect(valores).toContain('todos');
    expect(labels).toContain('Todos');
  });
});
