import { base44 } from '@/api/base44Client';
import { getEffectiveEmail } from '@/services/getScopedMilitaresClient';

/**
 * Cliente do gateway de criação de Desconto em Férias (Fase 1).
 * Cria de forma atômica a PublicacaoExOfficio interna + o DescontoFerias vinculado.
 */
export async function criarDescontoFeriasGateway(payload = {}) {
  const effectiveEmail = getEffectiveEmail();
  const finalPayload = {
    ...(payload || {}),
    ...(effectiveEmail ? { effectiveEmail } : {}),
  };

  const response = await base44.functions.invoke('criarDescontoFeriasGateway', finalPayload);
  const body = response?.data ?? response;

  if (body?.error) {
    throw new Error(body.error);
  }
  return body;
}