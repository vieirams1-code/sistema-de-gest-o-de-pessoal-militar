import { base44 } from '@/api/base44Client';
import { getEffectiveEmail } from '@/services/getScopedMilitaresClient';
export async function fetchScopedMedalhasBundle(payload = {}) {
  const effectiveEmail = payload.effectiveEmail !== undefined ? payload.effectiveEmail : getEffectiveEmail();
  const finalPayload = { ...payload };
  if (effectiveEmail) finalPayload.effectiveEmail = effectiveEmail; else delete finalPayload.effectiveEmail;
  const response = await base44.functions.invoke('getScopedMedalhasBundle', finalPayload);
  const data = response?.data ?? response ?? {};
  return { medalhas: Array.isArray(data.medalhas) ? data.medalhas : [], militares: Array.isArray(data.militares) ? data.militares : [], tiposMedalha: Array.isArray(data.tiposMedalha) ? data.tiposMedalha : [], meta: data.meta || {} };
}
