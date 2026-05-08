import { base44 } from '@/api/base44Client';
import { getEffectiveEmail } from '@/services/getScopedMilitaresClient';

export async function fetchScopedPeriodosAquisitivosBundle(payload = {}) {
  const effectiveEmail = getEffectiveEmail();
  const finalPayload = {
    ...(payload || {}),
    ...(effectiveEmail ? { effectiveEmail } : {}),
  };

  const response = await base44.functions.invoke('getScopedPeriodosAquisitivosBundle', finalPayload);
  const body = response?.data ?? response;

  if (body?.error) {
    const error = new Error(body.error);
    if (body?.meta?.status) error.status = body.meta.status;
    throw error;
  }

  return {
    periodosAquisitivos: Array.isArray(body?.periodosAquisitivos) ? body.periodosAquisitivos : [],
    militares: Array.isArray(body?.militares) ? body.militares : [],
    matriculasMilitar: Array.isArray(body?.matriculasMilitar) ? body.matriculasMilitar : [],
    ferias: Array.isArray(body?.ferias) ? body.ferias : [],
    registrosLivro: Array.isArray(body?.registrosLivro) ? body.registrosLivro : [],
    contratosDesignacaoMilitar: Array.isArray(body?.contratosDesignacaoMilitar) ? body.contratosDesignacaoMilitar : [],
    counters: body?.counters || { total: 0, disponiveis: 0, vencendo90d: 0, vencidos: 0 },
    partialFailures: Number(body?.meta?.partialFailures || 0),
    meta: body?.meta || {},
  };
}
