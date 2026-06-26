import { base44 } from '@/api/base44Client';
import {
  listarCaixasEscopado,
  listarProcessosEscopado,
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
// Os reads de TramiteProcessual / EventoProcessual de um processo
// específico continuam diretos pelo SDK (RLS read = true), pois são
// detalhes carregados sob demanda no modal.
// =====================================================================

const { TramiteProcessual, EventoProcessual } = base44.entities;

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
  return TramiteProcessual.filter({ processo_id: processoId }, '-data_envio', 200);
}

/* ----------------------------- Eventos ---------------------------- */

export async function registrarEvento(processoId, evento) {
  // Apenas despachos são criados pela UI; rota validada no backend.
  return registrarDespachoEscopado(processoId, evento?.descricao || '');
}

export async function listarEventos(processoId) {
  return EventoProcessual.filter({ processo_id: processoId }, '-data_evento', 300);
}