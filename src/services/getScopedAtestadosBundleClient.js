import { base44 } from '@/api/base44Client';

const EFFECTIVE_EMAIL_STORAGE_KEY = 'sgp_effective_user_email';

function readEffectiveEmailFromStorage() {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(EFFECTIVE_EMAIL_STORAGE_KEY);
    const trimmed = (raw || '').trim();
    return trimmed ? trimmed.toLowerCase() : null;
  } catch (_e) {
    return null;
  }
}

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
