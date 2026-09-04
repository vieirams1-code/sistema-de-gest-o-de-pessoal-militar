import { base44 } from '@/api/base44Client';
import { getEffectiveEmail as getEffectiveEmailFromStorage } from '@/utils/impersonation';

async function invokeJisoAtestado(payload = {}) {
  const effectiveEmail = payload.effectiveEmail !== undefined
    ? payload.effectiveEmail
    : getEffectiveEmailFromStorage();
  const finalPayload = { ...payload };
  if (effectiveEmail) finalPayload.effectiveEmail = effectiveEmail;
  else delete finalPayload.effectiveEmail;

  const response = await base44.functions.invoke('cudJisoAtestado', finalPayload);
  const data = response?.data ?? response ?? {};
  if (data?.error || response?.error) {
    const error = new Error(String(data?.error || response?.error?.message || 'Falha ao processar vínculo JISO/Atestado.'));
    error.code = String(data?.code || response?.error?.code || 'CUD_JISO_ATESTADO_FAILED');
    error.status = Number(response?.status || response?.error?.status || data?.status || data?.meta?.status || 0) || null;
    error.meta = data?.meta || {};
    error.raw = { response, data };
    throw error;
  }
  return data;
}

export function vincularAtestadoJiso(data, options = {}) {
  return invokeJisoAtestado({
    ...options,
    operation: 'create',
    data,
  });
}

export function atualizarVinculoAtestadoJiso(registroId, data, options = {}) {
  return invokeJisoAtestado({
    ...options,
    operation: 'update',
    registroId,
    data,
  });
}

export function desvincularAtestadoJiso(registroId, options = {}) {
  return invokeJisoAtestado({
    ...options,
    operation: 'delete',
    registroId,
    data: {},
  });
}
