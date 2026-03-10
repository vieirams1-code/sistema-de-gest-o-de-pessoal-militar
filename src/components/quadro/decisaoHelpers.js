const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null);
const firstNonEmptyString = (...values) => {
  const value = values.find((item) => typeof item === 'string' && item.trim() !== '');
  return value ?? '';
};

const toBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'sim', 'yes'].includes(normalized)) return true;
    if (['false', '0', 'nao', 'não', 'no'].includes(normalized)) return false;
  }
  return undefined;
};

export function normalizeCardDecisao(card = {}) {
  const encaminhadoEm = firstDefined(card.decisao_encaminhado_em, card.encaminhado_em, card.encaminhadoEm) || null;
  const devolvidoEm = firstDefined(card.decisao_devolvido_em, card.devolvido_em, card.devolvidoEm) || null;
  const statusDecisao = firstNonEmptyString(card.decisao_status, card.status_decisao, card.statusDecisao);

  const aguardandoFlag = toBoolean(
    firstDefined(card.decisao_pendente, card.aguardando_decisao, card.aguardandoDecisao)
  );

  const aguardandoPorStatus = statusDecisao.trim().toLowerCase() === 'aguardando decisão';
  const aguardandoPorDatas = Boolean(
    encaminhadoEm && (!devolvidoEm || new Date(devolvidoEm).getTime() < new Date(encaminhadoEm).getTime())
  );

  return {
    ...card,
    encaminhado_em: encaminhadoEm,
    devolvido_em: devolvidoEm,
    status_decisao: statusDecisao,
    encaminhado_para_nome: firstNonEmptyString(card.decisao_encaminhado_para_nome, card.encaminhado_para_nome, card.encaminhadoParaNome),
    encaminhado_por_nome: firstNonEmptyString(card.decisao_encaminhado_por_nome, card.encaminhado_por_nome, card.encaminhadoPorNome),
    observacao_encaminhamento: firstNonEmptyString(card.decisao_observacao_encaminhamento, card.observacao_encaminhamento, card.observacaoEncaminhamento),
    devolvido_por_nome: firstNonEmptyString(card.decisao_devolvido_por_nome, card.devolvido_por_nome, card.devolvidoPorNome),
    observacao_devolucao: firstNonEmptyString(card.decisao_observacao_devolucao, card.observacao_devolucao, card.observacaoDevolucao),
    aguardando_decisao: aguardandoFlag ?? (aguardandoPorStatus || aguardandoPorDatas),
  };
}
