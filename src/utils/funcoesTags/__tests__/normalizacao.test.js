import { describe, expect, it } from 'vitest';
import { normalizarAplicabilidade } from '../normalizacao';

describe('normalizarAplicabilidade', () => {
  it("normaliza 'ambos' para 'todos'", () => {
    expect(normalizarAplicabilidade('ambos')).toBe('todos');
  });

  it("normaliza undefined para 'todos'", () => {
    expect(normalizarAplicabilidade(undefined)).toBe('todos');
  });
});
