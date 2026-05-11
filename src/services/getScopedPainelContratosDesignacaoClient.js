import { base44 } from '@/api/base44Client';
import { getEffectiveEmail } from '@/services/getScopedMilitaresClient';

export async function fetchScopedPainelContratosDesignacao(payload = {}) {
  const effectiveEmail = payload.effectiveEmail !== undefined ? payload.effectiveEmail : getEffectiveEmail();
  const finalPayload = { ...(payload || {}) };

  if (effectiveEmail) finalPayload.effectiveEmail = effectiveEmail;
  else delete finalPayload.effectiveEmail;

  const response = await base44.functions.invoke('getScopedPainelContratosDesignacao', finalPayload);
  const body = response?.data ?? response ?? {};

  if (body?.error) {
    const error = new Error(body.error);
    if (body?.meta?.status) error.status = body.meta.status;
    throw error;
  }

  return {
    contratos: Array.isArray(body?.contratos) ? body.contratos : [],
    militares: Array.isArray(body?.militares) ? body.militares : [],
    matriculasMilitar: Array.isArray(body?.matriculasMilitar) ? body.matriculasMilitar : [],
    legadoAtivaPorContrato: body?.legadoAtivaPorContrato && typeof body.legadoAtivaPorContrato === 'object' ? body.legadoAtivaPorContrato : {},
    counters: body?.counters && typeof body.counters === 'object' ? body.counters : {},
    meta: body?.meta && typeof body.meta === 'object' ? body.meta : {},
  };
}
