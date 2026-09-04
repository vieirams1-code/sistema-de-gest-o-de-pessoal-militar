import { base44 } from '@/api/base44Client';
import { getEffectiveEmail } from '@/services/getScopedMilitaresClient';

async function invokeJiso(payload = {}) {
  const effectiveEmail = payload.effectiveEmail !== undefined
    ? payload.effectiveEmail
    : getEffectiveEmail();
  const finalPayload = { ...payload };
  if (effectiveEmail) finalPayload.effectiveEmail = effectiveEmail;
  else delete finalPayload.effectiveEmail;

  const response = await base44.functions.invoke('cudJiso', finalPayload);
  const data = response?.data ?? response ?? {};
  if (data?.error || response?.error) {
    const error = new Error(String(data?.error || response?.error?.message || 'Falha ao processar JISO.'));
    error.code = String(data?.code || response?.error?.code || 'CUD_JISO_FAILED');
    error.status = Number(response?.status || response?.error?.status || 0) || null;
    error.meta = data?.meta || {};
    error.raw = { response, data };
    throw error;
  }
  return data;
}

export function criarJiso(data, options = {}) {
  return invokeJiso({ ...options, operation: 'create', data });
}

export function atualizarJiso(registroId, data, options = {}) {
  return invokeJiso({ ...options, operation: 'update', registroId, data });
}
