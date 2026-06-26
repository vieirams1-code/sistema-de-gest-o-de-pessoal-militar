import { base44 as defaultBase44 } from '@/api/base44Client';

// =====================================================================
// controleProcessosEscopadoClient — ponte para a Deno Function
// `controleProcessosEscopado`. Toda escrita e leitura escopada do
// módulo Controle de Processos passa por aqui (a escrita direta pelo
// SDK é bloqueada por RLS admin-only nas entidades).
// =====================================================================

let client = defaultBase44;

function extrairMensagemErro(err, fallback) {
  const data = err?.response?.data || err?.data;
  if (data?.error) return data.error;
  if (typeof data === 'string' && data) return data;
  return err?.message || fallback;
}

async function invocar(payload) {
  let response;
  try {
    response = await client.functions.invoke('controleProcessosEscopado', payload);
  } catch (err) {
    const e = new Error(extrairMensagemErro(err, 'Falha ao executar operação de Controle de Processos.'));
    e.cause = err;
    throw e;
  }
  const body = response?.data ?? response;
  if (body?.error) throw new Error(body.error);
  return body;
}

export async function listarCaixasEscopado() {
  const resp = await invocar({ action: 'listarCaixasProcessuaisEscopado' });
  return resp?.caixas || [];
}

export async function listarProcessosEscopado() {
  const resp = await invocar({ action: 'listarProcessosControleEscopado' });
  return resp?.processos || [];
}

export async function criarCaixaEscopado(data) {
  const resp = await invocar({ action: 'criarCaixaProcessual', data });
  return resp?.caixa;
}

export async function editarCaixaEscopado(id, data) {
  const resp = await invocar({ action: 'editarCaixaProcessual', id: String(id), data });
  return resp?.caixa;
}

export async function criarProcessoEscopado(data) {
  const resp = await invocar({ action: 'criarProcessoControle', data });
  return resp?.processo;
}

export async function editarProcessoEscopado(id, data) {
  const resp = await invocar({ action: 'editarProcessoControle', id: String(id), data });
  return resp?.processo;
}

export async function tramitarProcessoEscopado(id, data) {
  const resp = await invocar({ action: 'tramitarProcessoControle', id: String(id), data });
  return resp?.processo;
}

export async function arquivarProcessoEscopado(id) {
  const resp = await invocar({ action: 'arquivarProcessoControle', id: String(id) });
  return resp?.processo;
}

export async function registrarDespachoEscopado(id, texto) {
  const resp = await invocar({ action: 'registrarDespachoProcesso', id: String(id), data: { texto } });
  return resp?.evento;
}