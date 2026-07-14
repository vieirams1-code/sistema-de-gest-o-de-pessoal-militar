/**
 * Distribuição de frações de férias respeitando o saldo operacional.
 *
 * NÃO é um motor de saldo. Apenas reparte um total já calculado pelo motor
 * oficial (calcularSaldoOperacionalPeriodoComTodosAjustes) entre N frações,
 * garantindo que a soma das parcelas seja SEMPRE igual ao total.
 *
 * Regra histórica/operacional:
 * - 1 fração: integral (todo o saldo).
 * - 2+ frações: divide o total o mais igualmente possível (ex.: 30 → 15+15,
 *   30 → 10+10+10). A fração escolhida (indiceDiferenca) absorve o resto da
 *   divisão inteira, quando houver.
 * - Nunca gera parcela negativa nem zero forçado se o total permitir.
 * - A soma das parcelas é SEMPRE exatamente igual ao total.
 */

export function distribuirFracoesPorSaldo(total, quantidadeFracoes, indiceDiferenca = null) {
  const totalNum = Math.max(0, Math.round(Number(total) || 0));
  const qtd = Math.max(1, Number(quantidadeFracoes) || 1);

  if (qtd === 1) return [totalNum];

  const idxDiff = Number.isInteger(indiceDiferenca) && indiceDiferenca >= 0 && indiceDiferenca < qtd
    ? indiceDiferenca
    : qtd - 1;

  // Divisão o mais igual possível: cada parcela recebe o piso (total / qtd) e
  // o resto da divisão inteira vai para a fração escolhida. Ex.: 30/2 = 15+15;
  // 22/2 = 11+11; 30/3 = 10+10+10; 22/3 = 7+7+8 (resto na fração escolhida).
  const base = Math.floor(totalNum / qtd);
  const resto = totalNum - base * qtd;

  const parcelas = new Array(qtd).fill(base);
  parcelas[idxDiff] += resto;

  return parcelas;
}

export function somarFracoes(fracoes = []) {
  return (fracoes || []).reduce((acc, f) => acc + (Number(f?.dias ?? f) || 0), 0);
}