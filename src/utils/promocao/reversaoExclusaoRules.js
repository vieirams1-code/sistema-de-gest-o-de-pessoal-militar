function normalizar(valor) {
  return String(valor || '').trim().toLowerCase();
}

function texto(valor) {
  return String(valor || '').trim();
}

function mesmoTexto(a, b) {
  return normalizar(a) === normalizar(b);
}

export function deveRollbackCadastroMilitarPorReversao({ historico, militar } = {}) {
  if (!historico?.id || !militar?.id) return false;
  return (
    mesmoTexto(militar?.posto_graduacao, historico?.posto_graduacao_novo)
    && mesmoTexto(militar?.quadro, historico?.quadro_novo)
  );
}

export function podeReverterPublicacaoPromocao({ promocao, item, historico, militar, motivo } = {}) {
  if (!promocao?.id) return { permitido: false, motivo: 'Promoção não carregada.', codigo: 'PROMOCAO_AUSENTE' };
  if (!item?.id) return { permitido: false, motivo: 'Item da promoção não carregado.', codigo: 'ITEM_AUSENTE' };
  if (!item?.publicado || normalizar(item?.status) !== 'publicado') {
    return { permitido: false, motivo: 'Item ainda não está publicado.', codigo: 'ITEM_NAO_PUBLICADO' };
  }
  if (!texto(item?.historico_promocao_v2_id)) {
    return { permitido: false, motivo: 'Item publicado sem histórico vinculado.', codigo: 'SEM_HISTORICO_VINCULADO' };
  }
  if (!historico?.id) {
    return { permitido: false, motivo: 'Sem histórico vinculado para reversão.', codigo: 'SEM_HISTORICO_VINCULADO' };
  }
  if (!texto(motivo)) return { permitido: false, motivo: 'Motivo da reversão é obrigatório.', codigo: 'MOTIVO_AUSENTE' };

  if ((item?.atualizar_cadastro_militar || normalizar(item?.resultado_aplicacao_cadastro) === 'imediatamente_superior')
    && militar?.id
    && !deveRollbackCadastroMilitarPorReversao({ historico, militar })) {
    return { permitido: false, motivo: 'Cadastro atual divergente do efeito da promoção; rollback seguro bloqueado.', codigo: 'CADASTRO_DIVERGENTE' };
  }

  return { permitido: true, codigo: 'OK' };
}

export function podeExcluirDefinitivamentePromocaoMilitar({ item, historico } = {}) {
  if (!item?.id) return { permitido: false, motivo: 'Item da promoção não encontrado.', codigo: 'ITEM_AUSENTE' };
  const status = normalizar(item?.status);
  const nuncaPublicado = item?.publicado === false;
  const canceladoOuRevertido = status === 'cancelado' || status === 'retificado' || status === 'revertido';
  if (!(nuncaPublicado || canceladoOuRevertido)) {
    return { permitido: false, motivo: 'Item ainda publicado; exclusão definitiva não permitida.', codigo: 'ITEM_AINDA_PUBLICADO' };
  }

  if (historico?.id && normalizar(historico?.status_registro) === 'ativo') {
    return { permitido: false, motivo: 'Histórico ainda ativo; exclua/cancele o histórico antes da exclusão definitiva.', codigo: 'HISTORICO_ATIVO' };
  }

  return { permitido: true, codigo: 'OK' };
}

