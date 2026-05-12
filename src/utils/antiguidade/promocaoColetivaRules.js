export const PROMOCAO_COLETIVA_RULES_VERSION = 'promocao-coletiva-d7.1';

export const TIPOS_PROMOCAO_COLETIVA = [
  { value: 'antiguidade', label: 'Antiguidade' },
  { value: 'merecimento', label: 'Merecimento' },
  { value: 'classificacao_curso', label: 'Classificação em curso' },
  { value: 'misto', label: 'Misto' },
  { value: 'outro', label: 'Outro' },
];

export const MODOS_RECLASSIFICACAO_PROMOCAO_COLETIVA = [
  { value: 'preserva_antiguidade_anterior', label: 'Preserva antiguidade anterior' },
  { value: 'reclassifica_por_curso_boletim', label: 'Reclassifica por curso/boletim' },
  { value: 'manual_justificado', label: 'Manual justificado' },
];

export const CRITERIOS_INDIVIDUAIS_PROMOCAO_COLETIVA = [
  { value: 'antiguidade', label: 'Antiguidade' },
  { value: 'merecimento', label: 'Merecimento' },
  { value: 'classificacao_curso', label: 'Classificação em curso' },
  { value: 'outro', label: 'Outro' },
];

export const STATUS_PROMOCAO_COLETIVA = {
  RASCUNHO: 'rascunho',
  CONFERIDA: 'conferida',
  APLICADA: 'aplicada',
  APLICADA_COM_FALHAS: 'aplicada_com_falhas',
  CANCELADA: 'cancelada',
};

export const STATUS_ITEM_PROMOCAO_COLETIVA = {
  RASCUNHO: 'rascunho',
  PENDENTE_DADOS: 'pendente_dados',
  CALCULADO: 'calculado',
  CONFERIDO: 'conferido',
  APLICADO: 'aplicado',
  ERRO: 'erro',
  CANCELADO: 'cancelado',
};

export const RECLASSIFICADORAS_INICIAIS_PROMOCAO_COLETIVA = [
  'Soldado',
  'Cabo',
  '3º Sargento',
  'Aspirante',
  '2º Tenente oriundo de Subtenente/carreira de praças',
];

export const OBSERVACAO_RECLASSIFICACAO_PROMOCAO_COLETIVA =
  '2º Tenente vindo de Aspirante/carreira de oficiais preserva a antiguidade de Aspirante.';

const hasText = (value) => String(value || '').trim().length > 0;
const hasPositiveNumber = (value) => Number(value || 0) > 0;

export function buildPromocaoColetivaConferenciaIssues(ato, itens = []) {
  const issues = [];

  if (!hasText(ato?.data_promocao)) issues.push('Ato sem data de promoção.');
  if (!hasText(ato?.posto_graduacao_destino)) issues.push('Ato sem posto/graduação de destino.');
  if (!hasText(ato?.quadro_destino)) issues.push('Ato sem quadro de destino.');
  if (!hasText(ato?.boletim_referencia) && !hasText(ato?.ato_referencia)) {
    issues.push('Informe boletim de referência ou ato de referência.');
  }
  if (!Array.isArray(itens) || itens.length === 0) issues.push('Ato sem itens vinculados.');

  const militarIds = new Map();
  const posicoes = new Map();

  itens.forEach((item, index) => {
    const prefix = `Item ${index + 1}`;
    if (!hasText(item?.militar_id)) issues.push(`${prefix} sem militar vinculado.`);
    if (hasText(item?.militar_id)) {
      const current = militarIds.get(item.militar_id) || 0;
      militarIds.set(item.militar_id, current + 1);
    }
    if (!hasText(item?.posto_graduacao_anterior) || !hasText(item?.quadro_anterior)) {
      issues.push(`${prefix} sem posto/quadro anterior.`);
    }
    if (!hasText(item?.posto_graduacao_novo) || !hasText(item?.quadro_novo)) {
      issues.push(`${prefix} sem posto/quadro novo.`);
    }
    if (
      ato?.modo_reclassificacao === 'reclassifica_por_curso_boletim'
      && !hasPositiveNumber(item?.ordem_informada_curso)
      && !hasPositiveNumber(item?.ordem_boletim)
    ) {
      issues.push(`${prefix} sem ordem de curso ou ordem de boletim para reclassificação.`);
    }
    if (hasPositiveNumber(item?.posicao_final)) {
      const key = String(Number(item.posicao_final));
      const current = posicoes.get(key) || 0;
      posicoes.set(key, current + 1);
    }
    if (item?.ajuste_manual === true && !hasText(item?.motivo_ajuste)) {
      issues.push(`${prefix} com ajuste manual sem motivo.`);
    }
  });

  militarIds.forEach((count) => {
    if (count > 1) issues.push('Há militar duplicado no mesmo ato.');
  });
  posicoes.forEach((count, posicao) => {
    if (count > 1) issues.push(`Posição final duplicada: ${posicao}.`);
  });

  return issues;
}

export function buildPromocaoColetivaHashConferencia(ato, itens = []) {
  const payload = JSON.stringify({
    ato: {
      data_promocao: ato?.data_promocao || '',
      boletim_referencia: ato?.boletim_referencia || '',
      ato_referencia: ato?.ato_referencia || '',
      posto_graduacao_destino: ato?.posto_graduacao_destino || '',
      quadro_destino: ato?.quadro_destino || '',
      modo_reclassificacao: ato?.modo_reclassificacao || '',
    },
    itens: itens.map((item) => ({
      militar_id: item.militar_id || '',
      posto_graduacao_anterior: item.posto_graduacao_anterior || '',
      quadro_anterior: item.quadro_anterior || '',
      posto_graduacao_novo: item.posto_graduacao_novo || '',
      quadro_novo: item.quadro_novo || '',
      posicao_final: Number(item.posicao_final || 0),
    })),
  });

  let hash = 0;
  for (let i = 0; i < payload.length; i += 1) {
    hash = ((hash << 5) - hash + payload.charCodeAt(i)) | 0;
  }
  return `d7.1-${Math.abs(hash)}`;
}
