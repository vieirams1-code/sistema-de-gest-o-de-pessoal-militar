import { base44 } from '@/api/base44Client';
import { getEffectiveEmail } from '@/services/getScopedMilitaresClient';

export async function ativarReversaoDescontoFeriasPublicado(publicacaoId) {
  if (!publicacaoId) return { ok: true, aplicado: false, motivo: 'sem_publicacao_id' };
  const effectiveEmail = getEffectiveEmail();
  const response = await base44.functions.invoke('ativarReversaoDescontoFeriasPublicado', {
    publicacao_id: publicacaoId,
    ...(effectiveEmail ? { effectiveEmail } : {}),
  });
  const body = response?.data ?? response;
  if (body?.error) throw new Error(body.error);
  return body;
}
