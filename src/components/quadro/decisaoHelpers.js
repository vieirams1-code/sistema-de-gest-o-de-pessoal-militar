const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null);

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
  const encaminhadoEm = firstDefined(card.encaminhado_em, card.encaminhadoEm, card.decisao_encaminhado_em) || null;
  const devolvidoEm = firstDefined(card.devolvido_em, card.devolvidoEm, card.decisao_devolvido_em) || null;
  const statusDecisao = firstDefined(card.status_decisao, card.statusDecisao, card.decisao_status) || '';

  const aguardandoFlag = toBoolean(
    firstDefined(card.aguardando_decisao, card.aguardandoDecisao, card.decisao_pendente)
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
    encaminhado_para_nome: firstDefined(card.encaminhado_para_nome, card.encaminhadoParaNome, card.decisao_encaminhado_para_nome) || '',
    encaminhado_por_nome: firstDefined(card.encaminhado_por_nome, card.encaminhadoPorNome, card.decisao_encaminhado_por_nome) || '',
    observacao_encaminhamento: firstDefined(card.observacao_encaminhamento, card.observacaoEncaminhamento, card.decisao_observacao_encaminhamento) || '',
    devolvido_por_nome: firstDefined(card.devolvido_por_nome, card.devolvidoPorNome, card.decisao_devolvido_por_nome) || '',
    observacao_devolucao: firstDefined(card.observacao_devolucao, card.observacaoDevolucao, card.decisao_observacao_devolucao) || '',
    aguardando_decisao: aguardandoFlag ?? (aguardandoPorStatus || aguardandoPorDatas),
  };
}
