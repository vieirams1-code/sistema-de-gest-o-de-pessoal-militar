import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { evolutionWhatsAppProvider } from '../../shared/portal/otp/providers/evolutionWhatsAppProvider.ts';

const FUNCTION_VERSION = 'jiso-template-v2-2026-08-29';

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify({ function_version: FUNCTION_VERSION, ...data }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  try {
    const authUser = await base44.auth.me();
    if (!authUser?.email) {
      return jsonResponse({ success: false, error: 'Usuário não autenticado' }, 401);
    }

    const payload = await req.json();
    const atestadoId = String(payload?.atestado_id || '').trim();
    const militarId = String(payload?.militar_id || '').trim();
    const text = String(payload?.mensagem_final || '').trim();

    if (!atestadoId) {
      return jsonResponse({ success: false, error: 'atestado_id obrigatório' }, 400);
    }
    if (!militarId) {
      return jsonResponse({ success: false, error: 'militar_id obrigatório' }, 400);
    }
    if (!text) {
      return jsonResponse({
        success: false,
        error: 'mensagem_final obrigatória: a função não possui mensagem padrão nem fallback.',
      }, 400);
    }

    const atestados = await base44.asServiceRole.entities.Atestado.filter({ id: atestadoId });
    const atestado = atestados?.[0];
    if (!atestado) {
      return jsonResponse({ success: false, error: 'Atestado não encontrado' }, 404);
    }
    if (String(atestado.militar_id || '') !== militarId) {
      return jsonResponse({ success: false, error: 'O atestado informado não pertence ao militar selecionado.' }, 400);
    }

    const militares = await base44.asServiceRole.entities.Militar.filter({ id: militarId });
    const militar = militares?.[0];
    if (!militar) {
      return jsonResponse({ success: false, error: 'Militar não encontrado' }, 404);
    }

    const rawTelefone = militar.whatsapp || militar.telefone_celular || militar.telefone || militar.celular;
    if (!rawTelefone) {
      return jsonResponse({ success: false, error: 'Militar não possui telefone cadastrado' }, 400);
    }

    // Esta função é deliberadamente separada do fluxo legado de JISO.
    // O provedor recebe exatamente o texto confirmado na prévia do template.
    const dispatchRes = await evolutionWhatsAppProvider.sendTextMessage(
      { to: rawTelefone, text },
      base44.asServiceRole,
    );

    if (!dispatchRes.success) {
      return jsonResponse({
        success: false,
        error: dispatchRes.error || 'Falha ao enviar WhatsApp',
        telefone: rawTelefone,
      }, 502);
    }

    const enviadoEm = new Date().toISOString();
    await base44.asServiceRole.entities.Atestado.update(atestadoId, {
      jiso_whatsapp_status: 'enviado',
      jiso_whatsapp_enviado_em: enviadoEm,
      jiso_whatsapp_enviado_por: authUser.email,
      jiso_whatsapp_mensagem: text,
      jiso_whatsapp_data_agendada_snapshot: atestado.data_jiso_agendada || '',
      jiso_whatsapp_hora_agendada_snapshot: atestado.hora_jiso_agendada || '',
    });

    return jsonResponse({
      success: true,
      tracking_saved: true,
      enviado_em: enviadoEm,
      enviado_por: authUser.email,
      data_jiso_snapshot: atestado.data_jiso_agendada || '',
      hora_jiso_snapshot: atestado.hora_jiso_agendada || '',
      message: 'Notificação enviada exatamente a partir da prévia e registrada no atestado.',
      telefone: rawTelefone,
    });
  } catch (error: any) {
    console.error('[notificarJisoWhatsAppTemplate] Erro interno:', error);
    return jsonResponse({
      success: false,
      error: 'Erro interno ao processar notificação',
      details: error?.message || String(error),
    }, 500);
  }
});
