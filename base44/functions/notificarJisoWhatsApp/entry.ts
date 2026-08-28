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
    const {
      militar_id,
      data_jiso,
      hora_jiso,
      local_jiso,
      secao_jiso,
      finalidade_jiso,
      dias_atestado,
    } = payload;

    if (!militar_id) {
      return jsonResponse({ success: false, error: 'militar_id obrigatório' }, 400);
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

    const dataFormatada = data_jiso ? new Date(data_jiso + 'T12:00:00Z').toLocaleDateString('pt-BR') : 'A definir';
    const horaFormatada = hora_jiso || 'Conforme escala da Junta';
    const localFormatado = local_jiso || 'Junta Médica';
    const secaoFormatada = secao_jiso || 'JISO';
    const finalidadeFormatada = finalidade_jiso || 'Inspeção de Saúde';
    
    let atestadoInfo = '';
    if (dias_atestado) {
      atestadoInfo = '\n📄 *Atestado:* Referente a afastamento de ' + dias_atestado + ' dia(s)';
    }

    const postoGraduacao = militar.posto_graduacao || '';
    const nomeIdentificacao = militar.nome_guerra || militar.nome_completo || '';

    const text = '🚨 *COMUNICADO OFICIAL — CBMMS*\n*Junta de Inspeção de Saúde Ordinária (JISO)*\n\nPrezado(a) *' + postoGraduacao + ' ' + nomeIdentificacao + '*,\n\nInformamos que foi agendada sua apresentação perante a Junta Médica:\n\n📅 *Data:* ' + dataFormatada + '\n⏰ *Horário:* ' + horaFormatada + '\n📍 *Local:* ' + localFormatado + '\n🩺 *Seção:* ' + secaoFormatada + '\n📋 *Finalidade:* ' + finalidadeFormatada + atestadoInfo + '\n\n⚠️ *Orientações:*\n• Comparecer com 15 minutos de antecedência.\n• Portar documento de identificação oficial com foto e cópia do atestado/laudos médicos pertinentes.\n• Em caso de impossibilidade de locomoção, comunicar o setor de saúde da sua unidade imediatamente.\n\n_Mensagem automática. Por favor, não responda._';

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