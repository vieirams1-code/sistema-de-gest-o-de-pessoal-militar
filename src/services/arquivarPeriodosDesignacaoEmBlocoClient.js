import { base44 } from '@/api/base44Client';
import { getEffectiveEmail } from '@/services/getScopedMilitaresClient';

function normalizarArray(value) {
  return Array.isArray(value) ? value : [];
}

function criarErroArquivamento(body, fallback = 'Erro ao arquivar períodos da ativa.') {
  const error = new Error(body?.mensagem || body?.error || fallback);
  if (body?.meta?.status) error.status = body.meta.status;
  if (body?.code) error.code = body.code;
  error.bloqueantes = normalizarArray(body?.bloqueantes);
  error.body = body || {};
  return error;
}

export async function arquivarPeriodosDesignacaoEmBloco({ militarId, contratoDesignacaoId, confirmar = true } = {}) {
  const effectiveEmail = getEffectiveEmail();
  const payload = {
    militar_id: militarId,
    contrato_designacao_id: contratoDesignacaoId,
    confirmar,
  };
  if (effectiveEmail) payload.effectiveEmail = effectiveEmail;

  let response;
  try {
    response = await base44.functions.invoke('arquivarPeriodosDesignacaoEmBloco', payload);
  } catch (error) {
    const body = error?.response?.data || error?.data || error?.body || null;
    if (body) throw criarErroArquivamento(body, error?.message);
    throw error;
  }
  const body = response?.data ?? response ?? {};

  if (body?.error || body?.ok === false) throw criarErroArquivamento(body);

  return {
    ...body,
    resumo: body?.resumo || {},
    detalhes: normalizarArray(body?.detalhes),
  };
}
