import { base44 } from '@/api/base44Client';
import { getEffectiveEmail } from '@/services/getScopedMilitaresClient';

/**
 * Cliente da ativação do Desconto em Férias (Fase 2).
 * Quando uma PublicacaoExOfficio do tipo "Dispensa com Desconto em Férias"
 * passa a Publicado, aciona a aplicação idempotente do abatimento no
 * PeriodoAquisitivo vinculado.
 *
 * Seguro de chamar para qualquer publicação: o backend ignora silenciosamente
 * (aplicado=false) quando não é o tipo aplicável ou as condições não estão satisfeitas.
 */
export async function ativarDescontoFeriasPublicado(publicacaoId) {
  if (!publicacaoId) return { ok: true, aplicado: false, motivo: 'sem_publicacao_id' };

  const effectiveEmail = getEffectiveEmail();
  const payload = {
    publicacao_id: publicacaoId,
    ...(effectiveEmail ? { effectiveEmail } : {}),
  };

  const response = await base44.functions.invoke('ativarDescontoFeriasPublicado', payload);
  const body = response?.data ?? response;

  if (body?.error) {
    throw new Error(body.error);
  }
  return body;
}