export const STATUS_PUBLICACAO_LEGADO = Object.freeze({
  AGUARDANDO_PUBLICACAO: 'AGUARDANDO_PUBLICACAO',
  PUBLICADO: 'PUBLICADO',
});

function preenchido(valor) {
  return valor !== null && valor !== undefined && String(valor).trim() !== '';
}

/**
 * Calcula o status que a futura importação legado deverá persistir.
 * `numero_nota` é obrigatório no fluxo; o fallback mantém a linha inválida
 * no status de espera permitido até que a validação bloqueante seja corrigida.
 */
export function calcularStatusPublicacaoLegado({ numero_nota, numero_bg_br, data_bg_br } = {}) {
  if (preenchido(numero_nota) && preenchido(numero_bg_br) && preenchido(data_bg_br)) {
    return STATUS_PUBLICACAO_LEGADO.PUBLICADO;
  }
  return STATUS_PUBLICACAO_LEGADO.AGUARDANDO_PUBLICACAO;
}
