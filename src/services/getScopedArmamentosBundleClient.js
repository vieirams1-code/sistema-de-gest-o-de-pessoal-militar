import { base44 } from '@/api/base44Client';
import { getEffectiveEmail } from '@/services/getScopedMilitaresClient';
export async function fetchScopedArmamentosBundle(payload = {}) {
  const effectiveEmail = payload.effectiveEmail !== undefined ? payload.effectiveEmail : getEffectiveEmail();
  const finalPayload = { ...payload };
  if (effectiveEmail) finalPayload.effectiveEmail = effectiveEmail; else delete finalPayload.effectiveEmail;
  const response = await base44.functions.invoke('getScopedArmamentosBundle', finalPayload);
  const data = response?.data ?? response ?? {};
  return { armamentos: Array.isArray(data.armamentos) ? data.armamentos : [], meta: data.meta || {} };
}
