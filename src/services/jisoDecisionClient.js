import { base44 } from '@/api/base44Client';
import { getEffectiveEmail } from '@/services/getScopedMilitaresClient';

export async function registrarDecisaoJisoIndependente(jiso, payload = {}, options = {}) {
  if (!jiso?.id) throw new Error('JISO inválida para registro de decisão.');
  const effectiveEmail = options.effectiveEmail !== undefined
    ? options.effectiveEmail
    : getEffectiveEmail();

  const finalPayload = {
    ...options,
    ...payload,
    jiso_id: jiso.id,
    jiso_updated_date_snapshot: jiso.updated_date || '',
  };
  delete finalPayload.effectiveEmail;
  if (effectiveEmail) finalPayload.effectiveEmail = effectiveEmail;

  const response = await base44.functions.invoke('registrarDecisaoJisoIndependente', finalPayload);
  const data = response?.data ?? response ?? {};
  if (data?.error || response?.error || data?.ok === false) {
    const error = new Error(String(data?.error || response?.error?.message || 'Falha ao registrar decisão da JISO.'));
    error.code = String(data?.code || response?.error?.code || 'REGISTRAR_DECISAO_JISO_FAILED');
    error.status = Number(response?.status || response?.error?.status || 0) || null;
    error.meta = data?.meta || {};
    error.raw = { response, data };
    throw error;
  }
  return data;
}
