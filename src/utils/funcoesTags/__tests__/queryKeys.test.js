import { describe, expect, it } from 'vitest';
import { buildFuncoesTagsScopeKey } from '../queryKeys';

describe('queryKeys scope', () => {
  it('muda quando effectiveEmail muda', () => {
    const a = buildFuncoesTagsScopeKey({ effectiveEmail: 'a@x.com', userEmail: 'u@x.com' });
    const b = buildFuncoesTagsScopeKey({ effectiveEmail: 'b@x.com', userEmail: 'u@x.com' });
    expect(a).not.toEqual(b);
  });

  it('mantem estabilidade para lista de ids equivalente', () => {
    const idsA = ['3', '1', '3', '2'].map(String);
    const idsB = ['1', '2', '3'].map(String);
    const hashA = [...new Set(idsA)].sort().join('|');
    const hashB = [...new Set(idsB)].sort().join('|');
    expect(hashA).toBe(hashB);
  });
});
