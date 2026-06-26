import { base44 } from '@/api/base44Client';

// =====================================================================
// controleProcessosService — camada de acesso do módulo Controle de Processos.
// Centraliza leitura/escrita das entidades e a regra de visibilidade por caixa.
//   - usuário comum vê apenas processos das caixas em que está inserido;
//   - quem tem visualizar_todas_caixas (ou admin) vê tudo.
// As escritas registram eventos na linha do tempo (EventoProcessual).
// =====================================================================

const { CaixaProcessual, ProcessoControle, TramiteProcessual, EventoProcessual } = base44.entities;

const nowIso = () => new Date().toISOString();

/* ----------------------------- Caixas ----------------------------- */

export async function listarCaixas() {
  return CaixaProcessual.list('-data_criacao', 500);
}

/** Caixas em que o e-mail é membro ou gestor. */
export function filtrarCaixasDoUsuario(caixas, userEmail) {
  if (!userEmail) return [];
  return (caixas || []).filter((c) =>
    (c.usuarios_ids || []).includes(userEmail) || (c.gestores_ids || []).includes(userEmail)
  );
}

export function isGestorDaCaixa(caixa, userEmail) {
  if (!caixa || !userEmail) return false;
  return (caixa.gestores_ids || []).includes(userEmail);
}

export async function criarCaixa(dados, userEmail) {
  return CaixaProcessual.create({
    ativa: true,
    criada_por: userEmail,
    data_criacao: nowIso(),
    usuarios_ids: [],
    gestores_ids: [],
    ...dados,
  });
}

export async function atualizarCaixa(id, dados) {
  return CaixaProcessual.update(id, dados);
}

/* --------------------------- Processos ---------------------------- */

export async function listarProcessos() {
  return ProcessoControle.list('-updated_date', 1000);
}

/**
 * Aplica a regra de visibilidade por caixa.
 * @param {Array} processos
 * @param {Object} opts { userEmail, podeVerTodas, caixasDoUsuario }
 */
export function filtrarProcessosVisiveis(processos, { userEmail, podeVerTodas, caixasDoUsuario }) {
  if (podeVerTodas) return processos || [];
  const caixaIds = new Set((caixasDoUsuario || []).map((c) => c.id));
  return (processos || []).filter((p) =>
    caixaIds.has(p.caixa_atual_id) || p.criado_por === userEmail || p.responsavel_id === userEmail
  );
}

export async function obterProcesso(id) {
  return ProcessoControle.get(id);
}

export async function criarProcesso(dados, userEmail) {
  const processo = await ProcessoControle.create({
    status: 'Novo',
    prioridade: 'Normal',
    arquivado: false,
    interessados_ids: [],
    criado_por: userEmail,
    ...dados,
  });
  await registrarEvento(processo.id, {
    tipo_evento: 'criacao',
    descricao: `Processo criado: ${processo.titulo}`,
    usuario_id: userEmail,
    dados_novos: dados,
  });
  return processo;
}

export async function atualizarProcesso(id, dados, userEmail, anteriores = null) {
  const atualizado = await ProcessoControle.update(id, dados);
  await registrarEvento(id, {
    tipo_evento: 'edicao',
    descricao: 'Processo atualizado',
    usuario_id: userEmail,
    dados_anteriores: anteriores,
    dados_novos: dados,
  });
  return atualizado;
}

export async function arquivarProcesso(id, userEmail) {
  const atualizado = await ProcessoControle.update(id, { arquivado: true, status: 'Arquivado' });
  await registrarEvento(id, {
    tipo_evento: 'arquivamento',
    descricao: 'Processo arquivado',
    usuario_id: userEmail,
  });
  return atualizado;
}

export async function concluirProcesso(id, userEmail) {
  const atualizado = await ProcessoControle.update(id, { status: 'Concluído' });
  await registrarEvento(id, {
    tipo_evento: 'conclusao',
    descricao: 'Processo concluído',
    usuario_id: userEmail,
  });
  return atualizado;
}

export async function excluirProcesso(id) {
  return ProcessoControle.delete(id);
}

/* --------------------------- Tramitação --------------------------- */

/**
 * Tramita um processo entre caixas: atualiza caixa_atual_id, registra
 * TramiteProcessual e EventoProcessual e altera o status quando aplicável.
 */
export async function tramitarProcesso(processo, dados, userEmail) {
  const {
    caixa_destino_id,
    destinatario_id = '',
    mensagem = '',
    acao_solicitada = '',
    prazo = '',
    urgente = false,
  } = dados;

  await TramiteProcessual.create({
    processo_id: processo.id,
    caixa_origem_id: processo.caixa_atual_id || '',
    caixa_destino_id,
    remetente_id: userEmail,
    destinatario_id,
    mensagem,
    acao_solicitada,
    prazo: prazo || undefined,
    urgente,
    status_tramite: 'Enviado',
    data_envio: nowIso(),
  });

  const novoStatus = acao_solicitada === 'Devolver com providência'
    ? 'Devolvido para ajustes'
    : 'Aguardando providência da caixa';

  await ProcessoControle.update(processo.id, {
    caixa_atual_id: caixa_destino_id,
    status: novoStatus,
    responsavel_id: destinatario_id || processo.responsavel_id || '',
    ...(prazo ? { prazo } : {}),
  });

  await registrarEvento(processo.id, {
    tipo_evento: 'tramitacao',
    descricao: `Tramitado para nova caixa${acao_solicitada ? ` — ${acao_solicitada}` : ''}`,
    usuario_id: userEmail,
    dados_novos: { caixa_destino_id, acao_solicitada, mensagem },
  });
}

export async function listarTramites(processoId) {
  return TramiteProcessual.filter({ processo_id: processoId }, '-data_envio', 200);
}

/* ----------------------------- Eventos ---------------------------- */

export async function registrarEvento(processoId, evento) {
  return EventoProcessual.create({
    processo_id: processoId,
    data_evento: nowIso(),
    ...evento,
  });
}

export async function listarEventos(processoId) {
  return EventoProcessual.filter({ processo_id: processoId }, '-data_evento', 300);
}