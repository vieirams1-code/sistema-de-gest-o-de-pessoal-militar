import { base44 } from '@/api/base44Client';
import { getEffectiveEmail } from '@/services/getScopedMilitaresClient';

function normalizarArray(value) {
  return Array.isArray(value) ? value : [];
}

function criarErroAplicacao(body, fallback = 'Erro na transição Legado da Ativa.') {
  const error = new Error(body?.error || fallback);
  if (body?.meta?.status) error.status = body.meta.status;
  error.body = body || {};
  return error;
}

function normalizarRetorno(body = {}) {
  return {
    ...body,
    candidatos: normalizarArray(body?.candidatos),
    aplicados: normalizarArray(body?.aplicados),
    ignorados: normalizarArray(body?.ignorados),
    jaMarcados: normalizarArray(body?.jaMarcados),
    conflitos: normalizarArray(body?.conflitos),
    riscos: normalizarArray(body?.riscos),
    totais: body?.totais || {},
    meta: body?.meta || {},
  };
}

export async function previsualizarTransicaoLegadoAtiva({ militarId, contratoDesignacaoId } = {}) {
  const effectiveEmail = getEffectiveEmail();
  const payload = {
    militar_id: militarId,
    contrato_designacao_id: contratoDesignacaoId,
  };
  if (effectiveEmail) payload.effectiveEmail = effectiveEmail;

  const response = await base44.functions.invoke('previsualizarTransicaoLegadoAtiva', payload);
  const body = response?.data ?? response ?? {};

  if (body?.error) throw criarErroAplicacao(body, 'Erro ao carregar prévia da transição.');

  return normalizarRetorno(body);
}

export async function aplicarTransicaoLegadoAtiva({
  militarId,
  contratoDesignacaoId,
  confirmacaoTextual,
  previewHash,
} = {}) {
  const effectiveEmail = getEffectiveEmail();
  const payload = {
    militar_id: militarId,
    contrato_designacao_id: contratoDesignacaoId,
    confirmacao_textual: confirmacaoTextual,
  };
  if (previewHash) payload.preview_hash = previewHash;
  if (effectiveEmail) payload.effectiveEmail = effectiveEmail;

  const response = await base44.functions.invoke('aplicarTransicaoLegadoAtiva', payload);
  const body = response?.data ?? response ?? {};

  if (body?.error || body?.ok === false) throw criarErroAplicacao(body, 'Erro ao aplicar transição Legado da Ativa.');

  return normalizarRetorno(body);
}
