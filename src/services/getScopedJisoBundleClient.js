import { base44 } from '@/api/base44Client';
import { getEffectiveEmail } from '@/services/getScopedMilitaresClient';

export async function fetchScopedJisoBundle(payload = {}) {
  const effectiveEmail = payload.effectiveEmail !== undefined
    ? payload.effectiveEmail
    : getEffectiveEmail();
  const finalPayload = { ...payload };
  if (effectiveEmail) finalPayload.effectiveEmail = effectiveEmail;
  else delete finalPayload.effectiveEmail;

  const response = await base44.functions.invoke('getScopedJisoBundle', finalPayload);
  const data = response?.data ?? response ?? {};
  if (data?.error || response?.error) {
    const error = new Error(String(data?.error || response?.error?.message || 'Falha ao carregar JISOs.'));
    error.code = String(data?.code || response?.error?.code || 'GET_SCOPED_JISO_BUNDLE_FAILED');
    error.status = Number(response?.status || response?.error?.status || 0) || null;
    error.raw = { response, data };
    throw error;
  }

  return {
    jisos: Array.isArray(data?.jisos) ? data.jisos : [],
    vinculos: Array.isArray(data?.vinculos) ? data.vinculos : [],
    atestados: Array.isArray(data?.atestados) ? data.atestados : [],
    militares: Array.isArray(data?.militares) ? data.militares : [],
    meta: data?.meta || {},
  };
}
