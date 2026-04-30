import { base44 } from '@/api/base44Client';

// =====================================================================
// cudEscopadoClient — Backend Hardening Lote 1
// ---------------------------------------------------------------------
// Cliente frontend para a Deno Function `cudEscopado`.
// Substitui chamadas diretas a base44.entities.X.create/update/delete
// para entidades sensíveis com validação de escopo militar no backend.
//
// Allowlist (espelha o backend):
//   - Ferias
//   - PeriodoAquisitivo
//   - Atestado
//   - RegistroLivro
//   - PublicacaoExOfficio
//
// Em caso de falha (403 fora do escopo, 400 payload inválido, etc.),
// uma exceção é lançada com mensagem amigável extraída de response.data.error.
// =====================================================================

const ENTIDADES_PERMITIDAS = new Set([
  'Ferias',
  'PeriodoAquisitivo',
  'Atestado',
  'RegistroLivro',
  'PublicacaoExOfficio',
  'CreditoExtraFerias',
]);

function assertEntidadePermitida(entityName) {
  if (!ENTIDADES_PERMITIDAS.has(entityName)) {
    throw new Error(`cudEscopado: entidade "${entityName}" não é permitida no cliente.`);
  }
}

function extrairMensagemErro(err, fallback) {
  const data = err?.response?.data || err?.data;
  if (data?.error) return data.error;
  if (typeof data === 'string' && data) return data;
  return err?.message || fallback;
}

async function invocar(payload) {
  let response;
  try {
    response = await base44.functions.invoke('cudEscopado', payload);
  } catch (err) {
    const msg = extrairMensagemErro(err, 'Falha ao executar cudEscopado.');
    const e = new Error(msg);
    e.cause = err;
    throw e;
  }

  const body = response?.data ?? response;
  if (body?.error) {
    throw new Error(body.error);
  }
  return body;
}

export async function criarEscopado(entityName, data) {
  assertEntidadePermitida(entityName);
  const resp = await invocar({ entityName, operation: 'create', data: data || {} });
  return resp?.data || resp;
}

export async function atualizarEscopado(entityName, registroId, data) {
  assertEntidadePermitida(entityName);
  if (!registroId) throw new Error('cudEscopado: registroId é obrigatório em atualizar.');
  const resp = await invocar({
    entityName,
    operation: 'update',
    registroId: String(registroId),
    data: data || {},
  });
  return resp?.data || resp;
}

export async function excluirEscopado(entityName, registroId) {
  assertEntidadePermitida(entityName);
  if (!registroId) throw new Error('cudEscopado: registroId é obrigatório em excluir.');
  const resp = await invocar({
    entityName,
    operation: 'delete',
    registroId: String(registroId),
  });
  return resp?.data || resp;
}