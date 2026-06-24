import { base44 } from '@/api/base44Client';
import { getEffectiveEmail } from '@/services/getScopedMilitaresClient';

/**
 * Cancela de forma idempotente o DescontoFerias pendente vinculado a uma
 * PublicacaoExOfficio antes da exclusão da publicação pendente no painel.
 */
export async function cancelarDescontoFeriasPendente(publicacaoId) {
  if (!publicacaoId) return { ok: true, cancelado: false, motivo: 'sem_publicacao_id' };

  const effectiveEmail = getEffectiveEmail();
  const payload = {
    publicacao_id: publicacaoId,
    ...(effectiveEmail ? { effectiveEmail } : {}),
  };

  let response;
  try {
    response = await base44.functions.invoke('cancelarDescontoFeriasPendente', payload);
  } catch (err) {
    const data = err?.response?.data || err?.data;
    throw new Error(data?.error || err?.message || 'Erro ao cancelar desconto em férias pendente.');
  }

  const body = response?.data ?? response;

  if (body?.error) {
    throw new Error(body.error);
  }
  return body;
}
