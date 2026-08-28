import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { evolutionWhatsAppProvider } from '../../shared/portal/otp/providers/evolutionWhatsAppProvider.ts';

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
  });
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const payload = await req.json();
    const { militar_id, mensagem } = payload;

    if (!militar_id) {
      return jsonResponse({ success: false, error: 'militar_id obrigatório' }, 400);
    }

    const text = String(mensagem || '').trim();
    if (!text) {
      return jsonResponse({
        success: false,
        error: 'mensagem obrigatória: revise e confirme a notificação antes do envio.'
      }, 400);
    }

    const militarResult = await base44.asServiceRole.entities.Militar.filter({ id: militar_id });
    if (!militarResult || militarResult.length === 0) {
      return jsonResponse({ success: false, error: 'Militar não encontrado' }, 404);
    }
    const militar = militarResult[0];

    const rawTelefone = militar.whatsapp || militar.telefone_celular || militar.telefone || militar.celular;
    if (!rawTelefone) {
      return jsonResponse({ success: false, error: 'Militar não possui telefone cadastrado' });
    }

    const dispatchRes = await evolutionWhatsAppProvider.sendTextMessage(
      { to: rawTelefone, text },
      base44.asServiceRole
    );

    if (dispatchRes.success) {
      return jsonResponse({ success: true, message: 'Notificação enviada com sucesso.', telefone: rawTelefone });
    } else {
      return jsonResponse({ success: false, error: dispatchRes.error || 'Falha ao enviar WhatsApp', telefone: rawTelefone });
    }
  } catch (error: any) {
    console.error('[notificarJisoWhatsApp] Erro interno:', error);
    return jsonResponse({ success: false, error: 'Erro interno ao processar notificação', details: error.message }, 500);
  }
});