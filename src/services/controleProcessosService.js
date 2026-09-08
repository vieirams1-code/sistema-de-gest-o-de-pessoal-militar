import {
  listarCaixasEscopado,
  listarProcessosEscopado,
  listarTramitesProcessoEscopado,
  listarEventosProcessoEscopado,
  criarCaixaEscopado,
  editarCaixaEscopado,
  criarProcessoEscopado,
  editarProcessoEscopado,
  tramitarProcessoEscopado,
  arquivarProcessoEscopado,
  registrarDespachoEscopado,
} from '@/services/controleProcessosEscopadoClient';

// =====================================================================
// controleProcessosService — camada de acesso do módulo Controle de
// Processos. TODA escrita e a leitura escopada de caixas/processos
// passam pela Deno Function `controleProcessosEscopado` (a escrita
// direta pelo SDK é bloqueada por RLS admin-only nas entidades).
//
// Leituras de TramiteProcessual / EventoProcessual também passam pelo
// gateway: o processo é revalidado no servidor antes de liberar histórico.
// =====================================================================

/* ----------------------------- Caixas ----------------------------- */

export async function listarCaixas() {
  return listarCaixasEscopado();
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

export async function criarCaixa(dados) {
  return criarCaixaEscopado(dados);
}

export async function atualizarCaixa(id, dados) {
  return editarCaixaEscopado(id, dados);
}

/* --------------------------- Processos ---------------------------- */

export async function listarProcessos() {
  return listarProcessosEscopado();
}

/**
 * Aplica a regra de visibilidade por caixa (apenas refinamento de UI;
 * o backend já restringe a leitura ao escopo do usuário).
 */
export function filtrarProcessosVisiveis(processos, { podeVerTodas, caixasDoUsuario }) {
  if (podeVerTodas) return processos || [];
  const caixaIds = new Set((caixasDoUsuario || []).map((c) => c.id));
  return (processos || []).filter((p) => caixaIds.has(p.caixa_atual_id));
}

export async function criarProcesso(dados) {
  return criarProcessoEscopado(dados);
}

export async function atualizarProcesso(id, dados) {
  return editarProcessoEscopado(id, dados);
}

export async function arquivarProcesso(id) {
  return arquivarProcessoEscopado(id);
}

export async function concluirProcesso(id) {
  // Conclusão é uma edição de status validada no backend (participação na caixa).
  return editarProcessoEscopado(id, { status: 'Concluído' });
}

/* --------------------------- Tramitação --------------------------- */

export async function tramitarProcesso(processo, dados) {
  return tramitarProcessoEscopado(processo.id, dados);
}

export async function listarTramites(processoId) {
  return listarTramitesProcessoEscopado(processoId);
}

/* ----------------------------- Eventos ---------------------------- */

export async function registrarEvento(processoId, evento) {
  // Apenas despachos são criados pela UI; rota validada no backend.
  return registrarDespachoEscopado(processoId, evento?.descricao || '');
}

export async function listarEventos(processoId) {
  return listarEventosProcessoEscopado(processoId);
}