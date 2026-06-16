import { base44 } from '@/api/base44Client';
// (P0.1) Usa o helper central de impersonação (envelope com TTL) em vez de
// ler sgp_effective_user_email diretamente do sessionStorage.
import { getEffectiveEmail as getEffectiveEmailFromStorage } from '@/utils/impersonation';

export async function fetchScopedExtratoAtestados(payload = {}) {
  const effectiveEmail = payload.effectiveEmail !== undefined ? payload.effectiveEmail : getEffectiveEmailFromStorage();
  const finalPayload = { ...payload };
  if (effectiveEmail) finalPayload.effectiveEmail = effectiveEmail;
  else delete finalPayload.effectiveEmail;

  const response = await base44.functions.invoke('getScopedExtratoAtestados', finalPayload);
  const data = response?.data ?? response ?? {};
  return {
    atestados: Array.isArray(data.atestados) ? data.atestados : [],
    jisos: Array.isArray(data.jisos) ? data.jisos : [],
    encaminhamentos: Array.isArray(data.encaminhamentos) ? data.encaminhamentos : [],
    meta: data.meta || {},
  };
}