import { base44 } from '@/api/base44Client';
import { getEffectiveEmail } from '@/services/getScopedMilitaresClient';

export async function cancelarAjusteSaldoFerias(payload = {}) {
  const effectiveEmail = getEffectiveEmail();
  const finalPayload = {
    ...(payload || {}),
    ...(effectiveEmail ? { effectiveEmail } : {}),
  };

  const response = await base44.functions.invoke('cancelarAjusteSaldoFerias', finalPayload);
  const body = response?.data ?? response;
  if (body?.error) throw new Error(body.error);
  return body?.ajusteSaldoFerias || body?.data || body;
}
