import { base44 } from '@/api/base44Client';
import { getEffectiveEmail as readEffectiveEmailFromStorage } from '@/utils/impersonation';

export async function fetchScopedAtestadosBundle(payload = {}) {
  const effectiveEmail = payload.effectiveEmail !== undefined ? payload.effectiveEmail : readEffectiveEmailFromStorage();
  const finalPayload = { ...payload };
  if (effectiveEmail) finalPayload.effectiveEmail = effectiveEmail;
  else delete finalPayload.effectiveEmail;

  const response = await base44.functions.invoke('getScopedAtestadosBundle', finalPayload);
  const data = response?.data ?? response ?? {};
  return {
    atestados: Array.isArray(data.atestados) ? data.atestados : [],
    jisos: Array.isArray(data.jisos) ? data.jisos : [],
    meta: data.meta || {},
  };
}