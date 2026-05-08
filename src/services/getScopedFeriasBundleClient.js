import { base44 } from '@/api/base44Client';
import { getEffectiveEmail } from '@/services/getScopedMilitaresClient';

export async function fetchScopedFeriasBundle(payload = {}) {
  const effectiveEmail = payload?.effectiveEmail || getEffectiveEmail();
  const finalPayload = {
    ...(payload || {}),
    ...(effectiveEmail ? { effectiveEmail } : {}),
  };

  const response = await base44.functions.invoke('getScopedFeriasBundle', finalPayload);
  const body = response?.data ?? response;

  if (body?.error) {
    const error = new Error(body.error);
    if (body?.meta?.status) error.status = body.meta.status;
    throw error;
  }

  return {
    ferias: Array.isArray(body?.ferias) ? body.ferias : [],
    registrosLivro: Array.isArray(body?.registrosLivro) ? body.registrosLivro : [],
    partialFailures: Number(body?.meta?.partialFailures || 0),
    meta: body?.meta || {},
  };
}
