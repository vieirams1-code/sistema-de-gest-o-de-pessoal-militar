export const STATUS_PUBLICACAO = {
  AGUARDANDO_NOTA: 'Aguardando Nota',
  AGUARDANDO_PUBLICACAO: 'Aguardando Publicação',
  PUBLICADO: 'Publicado',
};

const STATUS_VALIDOS = new Set(Object.values(STATUS_PUBLICACAO));

const TRANSICOES_VALIDAS = {
  [STATUS_PUBLICACAO.AGUARDANDO_NOTA]: new Set([
    STATUS_PUBLICACAO.AGUARDANDO_NOTA,
    STATUS_PUBLICACAO.AGUARDANDO_PUBLICACAO,
  ]),
  [STATUS_PUBLICACAO.AGUARDANDO_PUBLICACAO]: new Set([
    STATUS_PUBLICACAO.AGUARDANDO_PUBLICACAO,
    STATUS_PUBLICACAO.PUBLICADO,
  ]),
  [STATUS_PUBLICACAO.PUBLICADO]: new Set([
    STATUS_PUBLICACAO.PUBLICADO,
  ]),
};

function toText(value) {
  return String(value || '').trim();
}

export function temNotaParaBg(registro = {}) {
  return !!toText(registro.nota_para_bg);
}

export function temDadosCompletosBg(registro = {}) {
  return !!toText(registro.numero_bg) && !!toText(registro.data_bg);
}

export function calcularStatusPublicacaoRegistro(registro = {}) {
  if (temDadosCompletosBg(registro)) return STATUS_PUBLICACAO.PUBLICADO;
  if (temNotaParaBg(registro)) return STATUS_PUBLICACAO.AGUARDANDO_PUBLICACAO;
  return STATUS_PUBLICACAO.AGUARDANDO_NOTA;
}

export function normalizarStatusPublicacao(status) {
  const valor = toText(status).toLowerCase();

  if (!valor) return null;
  if (valor === 'aguardando_nota' || valor === 'aguardando nota') return STATUS_PUBLICACAO.AGUARDANDO_NOTA;
  if (valor === 'aguardando_publicacao' || valor === 'aguardando publicação') return STATUS_PUBLICACAO.AGUARDANDO_PUBLICACAO;
  if (valor === 'publicado' || valor === 'gerada') return STATUS_PUBLICACAO.PUBLICADO;

  return null;
}

export function validarTransicaoPublicacao({ statusAtual, statusDestino, registroDestino }) {
  const atualNormalizado = normalizarStatusPublicacao(statusAtual);
  const destinoNormalizado = normalizarStatusPublicacao(statusDestino);

  if (!destinoNormalizado || !STATUS_VALIDOS.has(destinoNormalizado)) {
    return { valido: false, motivo: 'Status de destino inválido para o fluxo de publicações.' };
  }

  if (destinoNormalizado === STATUS_PUBLICACAO.PUBLICADO && !temDadosCompletosBg(registroDestino)) {
    return { valido: false, motivo: 'Para marcar como Publicado, informe Número e Data do BG.' };
  }

  if (!atualNormalizado || !STATUS_VALIDOS.has(atualNormalizado)) {
    return { valido: true, statusAtual: null, statusDestino: destinoNormalizado };
  }

  const permitidos = TRANSICOES_VALIDAS[atualNormalizado] || new Set([atualNormalizado]);
  if (!permitidos.has(destinoNormalizado)) {
    return {
      valido: false,
      motivo: `Transição inválida: ${atualNormalizado} → ${destinoNormalizado}.`,
    };
  }

  return { valido: true, statusAtual: atualNormalizado, statusDestino: destinoNormalizado };
}

export function validarPayloadPublicacao({ registroAtual = {}, registroDestino = {} }) {
  const statusAtual =
    normalizarStatusPublicacao(registroAtual.status_calculado) ||
    normalizarStatusPublicacao(registroAtual.status_publicacao) ||
    normalizarStatusPublicacao(registroAtual.status);

  const statusDestino = calcularStatusPublicacaoRegistro(registroDestino);
  return validarTransicaoPublicacao({ statusAtual, statusDestino, registroDestino });
}
