/**
 * Distribuição de frações de férias respeitando o saldo operacional.
 *
 * NÃO é um motor de saldo. Apenas reparte um total já calculado pelo motor
 * oficial (calcularSaldoOperacionalPeriodoComTodosAjustes) entre N frações,
 * garantindo que a soma das parcelas seja SEMPRE igual ao total.
 *
 * Regra de distribuição:
 * - Frações "padrão" recebem 10 dias (bloco regulamentar).
 * - A fração escolhida (indiceDiferenca) absorve a diferença restante.
 * - Nunca gera parcela negativa; a diferença sempre fica na fração escolhida.
 */

const BLOCO_PADRAO = 10;

export function distribuirFracoesPorSaldo(total, quantidadeFracoes, indiceDiferenca = null) {
  const totalNum = Math.max(0, Number(total) || 0);
  const qtd = Math.max(1, Number(quantidadeFracoes) || 1);

  if (qtd === 1) return [totalNum];

  const idxDiff = Number.isInteger(indiceDiferenca) && indiceDiferenca >= 0 && indiceDiferenca < qtd
    ? indiceDiferenca
    : qtd - 1;

  const parcelas = new Array(qtd).fill(BLOCO_PADRAO);
  const somaPadrao = BLOCO_PADRAO * (qtd - 1);
  const restante = totalNum - somaPadrao;

  parcelas[idxDiff] = restante;

  // Se a diferença ficar negativa (total menor que o mínimo dos blocos padrão),
  // rebalanceia zerando o excedente a partir do fim, mantendo a soma exata.
  if (restante < 0) {
    let sobra = totalNum;
    for (let i = 0; i < qtd; i += 1) {
      const valor = Math.min(BLOCO_PADRAO, sobra);
      parcelas[i] = valor;
      sobra -= valor;
    }
  }

  return parcelas;
}

export function somarFracoes(fracoes = []) {
  return (fracoes || []).reduce((acc, f) => acc + (Number(f?.dias ?? f) || 0), 0);
}