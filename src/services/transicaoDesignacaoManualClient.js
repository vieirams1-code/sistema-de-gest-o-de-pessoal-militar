import { base44 } from '@/api/base44Client';
import { getEffectiveEmail } from '@/services/getScopedMilitaresClient';

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
  payload.decisoes_por_periodo = payload.acoes;
  payload.motivos = payload.acoes.reduce((acc, acao) => {
    if (acao?.periodo_id && acao?.motivo) acc[acao.periodo_id] = acao.motivo;
    return acc;
  }, {});
  if (effectiveEmail) payload.effectiveEmail = effectiveEmail;

  const response = await base44.functions.invoke('aplicarTransicaoDesignacaoManual', payload);
  const body = response?.data ?? response ?? {};

  if (body?.error || body?.ok === false) throw criarErroAplicacao(body);

  return normalizarRetorno(body);
}
