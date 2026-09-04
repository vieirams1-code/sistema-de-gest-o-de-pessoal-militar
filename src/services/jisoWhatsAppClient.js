import { base44 } from '@/api/base44Client';
import { getEffectiveEmail } from '@/services/getScopedMilitaresClient';

async function invokeJisoWhatsApp(payload = {}) {
  const effectiveEmail = payload.effectiveEmail !== undefined
    ? payload.effectiveEmail
    : getEffectiveEmail();
  const finalPayload = { ...payload };
  if (effectiveEmail) finalPayload.effectiveEmail = effectiveEmail;
  else delete finalPayload.effectiveEmail;

  const response = await base44.functions.invoke('notificarJisoIndependenteWhatsAppTemplate', finalPayload);
  const data = response?.data ?? response ?? {};
  if (data?.error || response?.error || data?.success === false) {
    const error = new Error(String(data?.error || response?.error?.message || 'Falha ao processar convocação JISO.'));
    error.code = String(data?.code || response?.error?.code || 'JISO_WHATSAPP_FAILED');
    error.status = Number(response?.status || response?.error?.status || 0) || null;
    error.data = data;
    error.raw = { response, data };
    throw error;
  }
  return data;
}

export function previewConvocacaoJisoWhatsApp(jisoId, options = {}) {
  return invokeJisoWhatsApp({
    ...options,
    action: 'preview',
    jiso_id: jisoId,
  });
}

export function enviarConvocacaoJisoWhatsApp(jisoId, preview, mensagemFinal, options = {}) {
  return invokeJisoWhatsApp({
    ...options,
    action: 'send',
    jiso_id: jisoId,
    mensagem_final: mensagemFinal,
    template_id: preview?.template_id,
    template_hash: preview?.template_hash,
    data_jiso_snapshot: preview?.data_jiso_snapshot,
    hora_jiso_snapshot: preview?.hora_jiso_snapshot,
    local_jiso_snapshot: preview?.local_jiso_snapshot,
    finalidade_jiso_snapshot: preview?.finalidade_jiso_snapshot,
  });
}
