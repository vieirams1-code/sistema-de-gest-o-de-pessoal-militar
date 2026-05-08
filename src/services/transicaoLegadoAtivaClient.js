import { base44 } from '@/api/base44Client';
import { getEffectiveEmail } from '@/services/getScopedMilitaresClient';

function normalizarArray(value) {
  return Array.isArray(value) ? value : [];
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

  if (body?.error) {
    const error = new Error(body.error);
    if (body?.meta?.status) error.status = body.meta.status;
    throw error;
  }

  return {
    ...body,
    candidatos: normalizarArray(body?.candidatos),
    ignorados: normalizarArray(body?.ignorados),
    jaMarcados: normalizarArray(body?.jaMarcados),
    riscos: normalizarArray(body?.riscos),
    totais: body?.totais || {},
    meta: body?.meta || {},
  };
}
