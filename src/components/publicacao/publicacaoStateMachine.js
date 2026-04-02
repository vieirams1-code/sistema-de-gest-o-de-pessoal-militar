export const STATUS_PUBLICACAO = {
  AGUARDANDO_NOTA: 'Aguardando Nota',
  AGUARDANDO_PUBLICACAO: 'Aguardando Publicação',
  PUBLICADO: 'Publicado',
};

export const EVENTO_AUDITORIA_PUBLICACAO = {
  CRIACAO: 'criacao_publicacao',
  EDICAO: 'edicao_publicacao',
  MUDANCA_STATUS: 'mudanca_status',
  INFORMAR_BG: 'informar_bg',
  EXCLUSAO: 'exclusao_publicacao',
  BLOQUEIO: 'bloqueio_operacional',
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

function limparObjeto(obj = {}) {
  return Object.fromEntries(Object.entries(obj).filter(([, valor]) => valor !== undefined));
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

export function validarTransicaoPublicacao({
  statusAtual,
  statusDestino,
  registroDestino,
  permitirReversaoPublicado = false,
}) {
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
  const reversaoPublicadoPermitida =
    permitirReversaoPublicado &&
    atualNormalizado === STATUS_PUBLICACAO.PUBLICADO &&
    (destinoNormalizado === STATUS_PUBLICACAO.AGUARDANDO_PUBLICACAO || destinoNormalizado === STATUS_PUBLICACAO.AGUARDANDO_NOTA);

  if (!permitidos.has(destinoNormalizado) && !reversaoPublicadoPermitida) {
    return {
      valido: false,
      motivo: `Transição inválida: ${atualNormalizado} → ${destinoNormalizado}.`,
    };
  }

  return { valido: true, statusAtual: atualNormalizado, statusDestino: destinoNormalizado };
}

export function validarPayloadPublicacao({
  registroAtual = {},
  registroDestino = {},
  permitirReversaoPublicado = false,
}) {
  const statusAtual =
    normalizarStatusPublicacao(registroAtual.status_calculado) ||
    normalizarStatusPublicacao(registroAtual.status_publicacao) ||
    normalizarStatusPublicacao(registroAtual.status);

  const statusDestino = calcularStatusPublicacaoRegistro(registroDestino);
  return validarTransicaoPublicacao({
    statusAtual,
    statusDestino,
    registroDestino,
    permitirReversaoPublicado,
  });
}

export function extrairSnapshotPublicacao(registro = {}) {
  return limparObjeto({
    nota_para_bg: toText(registro.nota_para_bg),
    numero_bg: toText(registro.numero_bg),
    data_bg: toText(registro.data_bg),
    status_calculado: normalizarStatusPublicacao(registro.status_calculado) || calcularStatusPublicacaoRegistro(registro),
  });
}

export function criarEventoAuditoriaPublicacao({
  registro = {},
  evento,
  usuario,
  resumo,
  estadoAnterior = null,
  estadoNovo = null,
  antes = null,
  depois = null,
  metadata = {},
}) {
  return limparObjeto({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    evento,
    acao: evento,
    timestamp: new Date().toISOString(),
    publicacao: limparObjeto({
      id: registro.id || registro.publicacao_id || null,
      origem_tipo: registro.origem_tipo || null,
      militar_id: registro.militar_id || null,
      tipo: registro.tipo_registro || registro.tipo || null,
    }),
    usuario: limparObjeto({
      id: usuario?.id || null,
      email: toText(usuario?.email),
      nome: toText(usuario?.full_name || usuario?.name || usuario?.nome),
    }),
    estado_anterior: estadoAnterior,
    estado_novo: estadoNovo,
    resumo: toText(resumo),
    antes: antes ? limparObjeto(antes) : null,
    depois: depois ? limparObjeto(depois) : null,
    metadata: limparObjeto(metadata),
  });
}

export function anexarEventoAuditoriaPublicacao(registro = {}, evento = null) {
  const historicoAtual = Array.isArray(registro.historico_publicacao) ? registro.historico_publicacao : [];
  if (!evento) return historicoAtual;
  return [...historicoAtual, evento];
}
