import { base44 } from '../api/base44Client.js';
import { getEffectiveEmail } from './getScopedMilitaresClient.js';

export async function fetchScopedPublicacoesBundle(payload = {}) {
  const effectiveEmail = payload?.effectiveEmail !== undefined ? payload.effectiveEmail : getEffectiveEmail();
  const finalPayload = { ...(payload || {}) };
  if (effectiveEmail) finalPayload.effectiveEmail = effectiveEmail;
  else delete finalPayload.effectiveEmail;

  const response = await base44.functions.invoke('getScopedPublicacoesBundle', finalPayload);
  const body = response?.data ?? response ?? {};
  if (body?.error) {
    const error = new Error(body.error);
    if (body?.meta?.status) error.status = body.meta.status;
    throw error;
  }

  return {
    registrosLivro: Array.isArray(body?.registrosLivro) ? body.registrosLivro : [],
    publicacoesExOfficio: Array.isArray(body?.publicacoesExOfficio) ? body.publicacoesExOfficio : [],
    militares: Array.isArray(body?.militares) ? body.militares : [],
    meta: body?.meta || {},
  };
}
