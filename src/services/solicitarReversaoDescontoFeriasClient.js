import { base44 } from '@/api/base44Client';
import { getEffectiveEmail } from '@/services/getScopedMilitaresClient';

export async function solicitarReversaoDescontoFerias(descontoFeriasId) {
  if (!descontoFeriasId) throw new Error('desconto_ferias_id é obrigatório.');
  const effectiveEmail = getEffectiveEmail();
  const response = await base44.functions.invoke('solicitarReversaoDescontoFerias', {
    desconto_ferias_id: descontoFeriasId,
    ...(effectiveEmail ? { effectiveEmail } : {}),
  });
  const body = response?.data ?? response;
  if (body?.error) throw new Error(body.error);
  return body;
}
