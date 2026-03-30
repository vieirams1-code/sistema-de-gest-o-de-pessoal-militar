const POSTO_GRADUACAO_PRIORIDADE = {
  Coronel: 1,
  'Tenente-Coronel': 2,
  'Tenente Coronel': 2,
  Major: 3,
  'Capitão': 4,
  '1º Tenente': 5,
  '2º Tenente': 6,
  Aspirante: 7,
  Subtenente: 8,
  '1º Sargento': 9,
  '2º Sargento': 10,
  '3º Sargento': 11,
  Cabo: 12,
  Soldado: 13,
};

// Ordem padrão pode ser sobrescrita por configuração de cada corporação.
const QUADRO_PRIORIDADE_PADRAO = {
  // Oficiais
  QOBM: 1,
  QAOBM: 2,
  QOEBM: 3,
  QOSAU: 4,
  // Praças
  'QBMP-1.a': 5,
  'QBMP-1.b': 6,
  'QBMP-2': 7,
  QBMPT: 8,
};

function toPriority(value, prioridades, fallback = Number.MAX_SAFE_INTEGER) {
  if (!value) return fallback;
  if (Object.prototype.hasOwnProperty.call(prioridades, value)) {
    return prioridades[value];
  }
  return fallback;
}

function toDateValue(dateStr) {
  if (!dateStr) return Number.MAX_SAFE_INTEGER;
  const timestamp = new Date(dateStr).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
}

function toInheritedAntiguidadeValue(militar = {}) {
  const candidatos = [
    militar.antiguidade_referencia_ordem,
    militar.antiguidade_herdada_ordem,
    militar.antiguidade_posto_anterior,
    militar.antiguidade_anterior,
  ];

  for (const valor of candidatos) {
    const numero = Number(valor);
    if (Number.isFinite(numero)) return numero;
  }

  return Number.MAX_SAFE_INTEGER;
}

/**
 * Compara dois militares por antiguidade, nesta ordem:
 * 1) Posto/Graduação
 * 2) Quadro
 * 3) Data de promoção atual
 * 4) Antiguidade herdada do posto/graduação anterior
 */
export function compareAntiguidadeMilitar(a = {}, b = {}, options = {}) {
  const quadroPrioridade = options.quadroPrioridade || QUADRO_PRIORIDADE_PADRAO;

  const postoA = toPriority(a.posto_graduacao, POSTO_GRADUACAO_PRIORIDADE);
  const postoB = toPriority(b.posto_graduacao, POSTO_GRADUACAO_PRIORIDADE);
  if (postoA !== postoB) return postoA - postoB;

  const quadroA = toPriority(a.quadro, quadroPrioridade);
  const quadroB = toPriority(b.quadro, quadroPrioridade);
  if (quadroA !== quadroB) return quadroA - quadroB;

  const dataPromocaoA = toDateValue(a.data_promocao_atual);
  const dataPromocaoB = toDateValue(b.data_promocao_atual);
  if (dataPromocaoA !== dataPromocaoB) return dataPromocaoA - dataPromocaoB;

  const herdadaA = toInheritedAntiguidadeValue(a);
  const herdadaB = toInheritedAntiguidadeValue(b);
  if (herdadaA !== herdadaB) return herdadaA - herdadaB;

  return (a.nome_completo || '').localeCompare(b.nome_completo || '', 'pt-BR');
}

export function ordenarMilitaresPorAntiguidade(militares = [], options = {}) {
  return [...militares].sort((a, b) => compareAntiguidadeMilitar(a, b, options));
}

export const ANTIGUIDADE_FIELDS_MINIMOS = {
  posto_graduacao: 'Posto/graduação atual do militar.',
  quadro: 'Quadro atual usado como segundo critério de desempate.',
  data_promocao_atual: 'Data da promoção para o posto/graduação atual.',
  antiguidade_referencia_ordem: 'Ordem herdada do posto/graduação anterior (quanto menor, mais antigo).',
  antiguidade_referencia_id: 'Identificador da referência utilizada para herdar a antiguidade.',
};
