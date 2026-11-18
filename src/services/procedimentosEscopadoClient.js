import { base44 } from '@/api/base44Client';

// =====================================================================
// procedimentosEscopadoClient — ponte para a Deno Function
// `procedimentosEscopado`. Toda leitura/escrita do módulo Procedimentos
// Administrativos passa por aqui (RLS fechada nas entidades).
// =====================================================================

function extrairMensagemErro(err, fallback) {
  const data = err?.response?.data || err?.data;
  if (data?.error) return data.error;
  if (typeof data === 'string' && data) return data;
  return err?.message || fallback;
}

async function invocar(payload) {
  let response;
  try {
    response = await base44.functions.invoke('procedimentosEscopado', payload);
  } catch (err) {
    throw new Error(extrairMensagemErro(err, 'Falha ao executar operação de Procedimentos.'));
  }
  const body = response?.data ?? response;
  if (body?.error) throw new Error(body.error);
  return body;
}

export async function listarProcedimentosEscopado() {
  const resp = await invocar({ action: 'listar' });
  return { procedimentos: resp?.procedimentos || [], envolvidos: resp?.envolvidos || [] };
}

export async function obterProcedimentoEscopado(id) {
  const resp = await invocar({ action: 'obter', id: String(id) });
  return {
    procedimento: resp?.procedimento || null,
    envolvidos: resp?.envolvidos || [],
    prazos: resp?.prazos || [],
    publicacoes: resp?.publicacoes || [],
  };
}

export async function criarProcedimentoEscopado(data) {
  const resp = await invocar({ action: 'criar', data });
  return resp?.procedimento || null;
}

export async function atualizarProcedimentoEscopado(id, data) {
  const resp = await invocar({ action: 'atualizar', id: String(id), data });
  return resp?.procedimento || null;
}

export async function registrarPrazoProcedimentoEscopado(id, data) {
  const resp = await invocar({ action: 'registrarPrazo', id: String(id), data });
  return { procedimento: resp?.procedimento || null, prazo: resp?.prazo || null };
}

export async function excluirProcedimentoEscopado(id) {
  return invocar({ action: 'excluir', id: String(id) });
}