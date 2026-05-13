import { base44 } from '@/api/base44Client';
import { getEffectiveEmail } from '@/services/getScopedMilitaresClient';

const FUNCTION_NAME = 'aplicarTransicaoDesignacaoManual';
const USED_FALLBACK = false;

function isDevRuntime() {
  return Boolean(import.meta?.env?.DEV);
}

function getStatus(error) {
  return error?.status || error?.response?.status || error?.originalError?.response?.status || error?.data?.meta?.status || error?.response?.data?.meta?.status || 0;
}

function getErrorPayload(error) {
  return error?.response?.data || error?.data || error?.body || null;
}

function logFunctionCall(error = null) {
  if (!isDevRuntime()) return;
  const status = getStatus(error);
  const payload = getErrorPayload(error);
  console.debug('[transicaoDesignacaoManualClient] Base44 function invoke', {
    functionName: FUNCTION_NAME,
    usedFallback: USED_FALLBACK,
    status: status || undefined,
    error: payload?.error || payload || error?.message || null,
  });
}

async function invokeAplicacaoManual(payload) {
  logFunctionCall();
  try {
    return await base44.functions.invoke(FUNCTION_NAME, payload);
  } catch (error) {
    logFunctionCall(error);
    const status = getStatus(error);
    const body = getErrorPayload(error);
    const message = body?.error || error?.message || 'Erro ao invocar função Base44.';
    const wrapped = Object.assign(
      new Error(
        status === 404
          ? `${FUNCTION_NAME}: endpoint não encontrado no runtime Base44 atual (404). Publique/deploy a função Base44 no mesmo runtime/versionamento usado pela aplicação. Erro original: ${message}`
          : message,
      ),
      { status: status || undefined, body: body || undefined, cause: error },
    );
    throw wrapped;
  }
}

function normalizarArray(value) {
  return Array.isArray(value) ? value : [];
}

function criarErroAplicacao(body, fallback = 'Erro ao aplicar transição manual de designação.') {
  return Object.assign(new Error(body?.error || fallback), {
    status: body?.meta?.status || undefined,
    body: body || {},
  });
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

/** @param {any} [params] */
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

  if (body?.error || body?.ok === false) {
    const error = criarErroAplicacao(body);
    logFunctionCall(error);
    throw error;
  }

  return normalizarRetorno(body);
}
