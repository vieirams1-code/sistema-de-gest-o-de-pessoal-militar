import { base44 } from '@/api/base44Client';
// (P0.1) Usa o helper central de impersonação (envelope com TTL) em vez de
// ler sgp_effective_user_email diretamente do sessionStorage.
import { getEffectiveEmail as getEffectiveEmailFromStorage } from '@/utils/impersonation';

export async function alterarEncaminhamentoAtestado(payload = {}) {
  const effectiveEmail = payload.effectiveEmail !== undefined ? payload.effectiveEmail : getEffectiveEmailFromStorage();
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