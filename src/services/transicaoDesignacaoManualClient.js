import { createClient } from '@base44/sdk';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { getEffectiveEmail } from '@/services/getScopedMilitaresClient';

const FUNCTION_NAME = 'aplicarTransicaoDesignacaoManual';

function getStatus(error) {
  return error?.status || error?.response?.status || error?.originalError?.response?.status || error?.data?.meta?.status || 0;
}

function criarClientSemVersaoFunctions() {
  const { appId, serverUrl, token } = appParams;
  return createClient({ appId, serverUrl, token, requiresAuth: false });
}

async function invokeAplicacaoManual(payload) {
  try {
    return await base44.functions.invoke(FUNCTION_NAME, payload);
  } catch (error) {
    if (getStatus(error) !== 404 || !appParams.functionsVersion) throw error;
    const base44SemVersao = criarClientSemVersaoFunctions();
    return base44SemVersao.functions.invoke(FUNCTION_NAME, payload);
  }
}

function normalizarArray(value) {
  return Array.isArray(value) ? value : [];
}

function criarErroAplicacao(body, fallback = 'Erro ao aplicar transição manual de designação.') {
  const error = new Error(body?.error || fallback);
  if (body?.meta?.status) error.status = body.meta.status;
  error.body = body || {};
  return error;
}

function normalizarRetorno(body = {}) {
  return {
    ...body,
    ok: body?.ok === true,
    modo: body?.modo || 'apply_manual',
    lote: body?.lote || null,
    operacoes: normalizarArray(body?.operacoes),
    totais: body?.totais || {},
    meta: body?.meta || {},
  };
}

export async function aplicarTransicaoDesignacaoManual({
  militarId,
  contratoDesignacaoId,
  contratoId,
  previewHash,
  idempotencyKey,
  confirmacaoTextual,
  acoes,
} = {}) {
  const effectiveEmail = getEffectiveEmail();
  const payload = {
    militar_id: militarId,
    contrato_designacao_id: contratoDesignacaoId,
    contrato_id: contratoId || contratoDesignacaoId,
    preview_hash: previewHash,
    idempotency_key: idempotencyKey,
    confirmacao_textual: confirmacaoTextual,
    acoes: Array.isArray(acoes) ? acoes : [],
  };
  payload.decisoes = payload.acoes;
  payload.decisoes_por_periodo = payload.acoes;
  payload.motivos = payload.acoes.reduce((acc, acao) => {
    if (acao?.periodo_id && acao?.motivo) acc[acao.periodo_id] = acao.motivo;
    return acc;
  }, {});
  if (effectiveEmail) payload.effectiveEmail = effectiveEmail;

  const response = await invokeAplicacaoManual(payload);
  const body = response?.data ?? response ?? {};

  if (body?.error || body?.ok === false) throw criarErroAplicacao(body);

  return normalizarRetorno(body);
}
