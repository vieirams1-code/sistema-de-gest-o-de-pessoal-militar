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

export async function alterarEncaminhamentoAtestado(payload = {}) {
  const effectiveEmail = payload.effectiveEmail !== undefined ? payload.effectiveEmail : readEffectiveEmailFromStorage();
  const finalPayload = { ...payload };
  if (effectiveEmail) finalPayload.effectiveEmail = effectiveEmail;
  else delete finalPayload.effectiveEmail;

  const response = await base44.functions.invoke('alterarEncaminhamentoAtestado', finalPayload);
  const data = response?.data ?? response ?? {};
  if (data?.error || response?.error) {
    const error = new Error(String(data?.error || response?.error?.message || 'Falha ao alterar encaminhamento.'));
    error.code = String(data?.code || response?.error?.code || 'ALTERAR_ENCAMINHAMENTO_FAILED');
    error.status = Number(response?.status || response?.error?.status || data?.status || data?.meta?.status || 0) || null;
    error.meta = data?.meta || {};
    error.raw = { response, data };
    throw error;
  }
  return data;
}
