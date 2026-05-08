import { base44 } from '@/api/base44Client';
import { getEffectiveEmail } from '@/services/getScopedMilitaresClient';

export async function fetchScopedContratosDesignacaoMilitar(payload = {}) {
  const effectiveEmail = payload.effectiveEmail !== undefined ? payload.effectiveEmail : getEffectiveEmail();
  const finalPayload = { ...(payload || {}) };

  if (effectiveEmail) finalPayload.effectiveEmail = effectiveEmail;
  else delete finalPayload.effectiveEmail;

  const response = await base44.functions.invoke('getScopedContratosDesignacaoMilitar', finalPayload);
  const body = response?.data ?? response ?? {};

  if (body?.error) {
    const error = new Error(body.error);
    if (body?.meta?.status) error.status = body.meta.status;
    throw error;
  }

  return {
    contratos: Array.isArray(body?.contratos) ? body.contratos : [],
    meta: body?.meta || {},
  };
}
