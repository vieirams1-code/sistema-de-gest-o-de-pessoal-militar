import { describe, it, expect } from 'vitest';
import { distribuirFracoesPorSaldo, somarFracoes } from '../distribuicaoFracoesFerias';

describe('distribuirFracoesPorSaldo — padrão histórico 15+15', () => {
  it('Teste 5: novo fracionamento comum com direito 30 → 15 + 15', () => {
    const parcelas = distribuirFracoesPorSaldo(30, 2);
    expect(parcelas).toEqual([15, 15]);
    expect(somarFracoes(parcelas)).toBe(30);
  });

  it('30 em 3 frações → 10 + 10 + 10', () => {
    const parcelas = distribuirFracoesPorSaldo(30, 3);
    expect(parcelas).toEqual([10, 10, 10]);
    expect(somarFracoes(parcelas)).toBe(30);
  });

  it('1 fração integral recebe todo o saldo', () => {
    expect(distribuirFracoesPorSaldo(30, 1)).toEqual([30]);
    expect(distribuirFracoesPorSaldo(22, 1)).toEqual([22]);
  });

  it('Teste 4: saldo operacional 22 em 2 frações → 11 + 11, nunca força 15 + 15', () => {
    const parcelas = distribuirFracoesPorSaldo(22, 2);
    expect(somarFracoes(parcelas)).toBe(22);
    expect(parcelas.some((p) => p <= 0)).toBe(false);
    expect(parcelas).not.toEqual([15, 15]);
  });

  it('saldo 22 em 3 frações → soma exata 22, sem parcela negativa (resto na fração escolhida)', () => {
    const parcelas = distribuirFracoesPorSaldo(22, 3, 2);
    expect(somarFracoes(parcelas)).toBe(22);
    expect(parcelas.some((p) => p <= 0)).toBe(false);
    expect(parcelas[2]).toBeGreaterThanOrEqual(parcelas[0]);
  });

  it('a fração escolhida (indiceDiferenca) absorve o resto da divisão', () => {
    // 31 / 2 = 15 + 16, resto na fração escolhida
    expect(distribuirFracoesPorSaldo(31, 2, 0)).toEqual([16, 15]);
    expect(distribuirFracoesPorSaldo(31, 2, 1)).toEqual([15, 16]);
  });
});