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
    const authUser = await base44.auth.me();
    if (!authUser?.email) {
      return jsonResponse({ success: false, error: 'Usuário não autenticado' }, 401);
    }

    const payload = await req.json();
    const { atestado_id, militar_id, mensagem_final } = payload;

    if (!atestado_id) {
      return jsonResponse({ success: false, error: 'atestado_id obrigatório' }, 400);
    }
    if (!militar_id) {
      return jsonResponse({ success: false, error: 'militar_id obrigatório' }, 400);
    }

    // Não existe fallback ou texto padrão neste endpoint. A única mensagem
    // permitida é exatamente aquela revisada/confirmada na prévia do card.
    const text = String(mensagem_final || '').trim();
    if (!text) {
      return jsonResponse({
        success: false,
        error: 'mensagem_final obrigatória: revise e confirme a notificação antes do envio.'
      }, 400);
    }

    const atestadoResult = await base44.asServiceRole.entities.Atestado.filter({ id: atestado_id });
    if (!atestadoResult || atestadoResult.length === 0) {
      return jsonResponse({ success: false, error: 'Atestado não encontrado' }, 404);
    }
    const atestado = atestadoResult[0];
    if (atestado.militar_id !== militar_id) {
      return jsonResponse({ success: false, error: 'O atestado informado não pertence ao militar selecionado.' }, 400);
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
      const enviadoEm = new Date().toISOString();
      try {
        await base44.asServiceRole.entities.Atestado.update(atestado_id, {
          jiso_whatsapp_status: 'enviado',
          jiso_whatsapp_enviado_em: enviadoEm,
          jiso_whatsapp_enviado_por: authUser.email,
          jiso_whatsapp_mensagem: text,
          jiso_whatsapp_data_agendada_snapshot: atestado.data_jiso_agendada || '',
          jiso_whatsapp_hora_agendada_snapshot: atestado.hora_jiso_agendada || '',
        });
      } catch (trackingError: any) {
        console.error('[notificarJisoWhatsApp] Mensagem enviada, mas falhou o registro no Atestado:', trackingError);
        return jsonResponse({
          success: true,
          tracking_saved: false,
          message: 'Notificação enviada, mas o comprovante não pôde ser gravado no atestado.',
          telefone: rawTelefone,
        });
      }

      return jsonResponse({
        success: true,
        tracking_saved: true,
        enviado_em: enviadoEm,
        message: 'Notificação enviada com sucesso e registrada no atestado.',
        telefone: rawTelefone,
      });
    } else {
      return jsonResponse({ success: false, error: dispatchRes.error || 'Falha ao enviar WhatsApp', telefone: rawTelefone });
    }
  } catch (error: any) {
    console.error('[notificarJisoWhatsApp] Erro interno:', error);
    return jsonResponse({ success: false, error: 'Erro interno ao processar notificação', details: error.message }, 500);
  }
});