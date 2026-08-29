import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { evolutionWhatsAppProvider } from '../../shared/portal/otp/providers/evolutionWhatsAppProvider.ts';

const FUNCTION_VERSION = 'jiso-template-v3-2026-08-29';
const MODULO_TEMPLATE = 'WhatsApp Notificações';
const TIPO_TEMPLATE = 'Notificação de JISO WA';

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify({ function_version: FUNCTION_VERSION, ...data }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function normalizeText(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeScope(value: unknown) {
  const raw = normalizeText(value).toUpperCase();
  if (raw === 'SETOR' || raw === 'SUBSETOR' || raw === 'UNIDADE') return raw;
  return 'GLOBAL';
}

function normalizeTipo(value: unknown) {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeModulo(value: unknown) {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace('publicacao', '');
}

function formatDateBR(value: unknown) {
  const raw = normalizeText(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return raw;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function montarPostoNome(militar: any, atestado: any) {
  const posto = normalizeText(militar?.posto_graduacao || atestado?.militar_posto);
  const quadro = normalizeText(militar?.quadro || militar?.quadro_bombeiro_militar || militar?.qbmp);
  return [posto, quadro].filter(Boolean).join(' ');
}

function aplicarTemplate(template: string, vars: Record<string, string>) {
  return String(template || '').replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    const value = vars[key];
    return value === undefined || value === null ? `{{${key}}}` : String(value);
  });
}

function getContextoMilitar(militar: any) {
  const setorId = normalizeText(militar?.setor_id || militar?.grupamento_id);
  const subsetorId = normalizeText(militar?.subsetor_id || militar?.subgrupamento_id);
  const tipoSubgrupamento = normalizeText(militar?.subgrupamento_tipo || militar?.tipo_subgrupamento).toLowerCase();
  const unidadeId = normalizeText(
    militar?.unidade_id || (tipoSubgrupamento === 'unidade' ? militar?.subgrupamento_id : '')
  );
  return { setorId, subsetorId, unidadeId };
}

function templateMatchesScope(template: any, contexto: ReturnType<typeof getContextoMilitar>) {
  const escopo = normalizeScope(template?.escopo);
  const setorTemplate = normalizeText(template?.setor_id);
  const subsetorTemplate = normalizeText(template?.subsetor_id);
  const unidadeTemplate = normalizeText(template?.unidade_id);

  if (escopo === 'GLOBAL') return true;
  if (escopo === 'SETOR') {
    return Boolean(contexto.setorId && setorTemplate === contexto.setorId);
  }
  if (escopo === 'SUBSETOR') {
    return Boolean(
      contexto.setorId && contexto.subsetorId &&
      setorTemplate === contexto.setorId && subsetorTemplate === contexto.subsetorId
    );
  }
  if (escopo === 'UNIDADE') {
    return Boolean(
      contexto.setorId && contexto.subsetorId && contexto.unidadeId &&
      setorTemplate === contexto.setorId &&
      subsetorTemplate === contexto.subsetorId &&
      unidadeTemplate === contexto.unidadeId
    );
  }
  return false;
}

function selecionarTemplate(templates: any[], militar: any) {
  const tipoAlvo = normalizeTipo(TIPO_TEMPLATE);
  const moduloAlvo = normalizeModulo(MODULO_TEMPLATE);
  const contexto = getContextoMilitar(militar);
  const candidatos = (templates || []).filter((template) => (
    template &&
    template.ativo !== false &&
    normalizeTipo(template.tipo_registro) === tipoAlvo &&
    normalizeModulo(template.modulo) === moduloAlvo
  ));

  for (const escopo of ['UNIDADE', 'SUBSETOR', 'SETOR', 'GLOBAL']) {
    const encontrado = candidatos.find((template) => (
      normalizeScope(template.escopo) === escopo && templateMatchesScope(template, contexto)
    ));
    if (encontrado) return encontrado;
  }
  return null;
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
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
    const action = normalizeText(payload?.action || 'preview').toLowerCase();
    const atestadoId = normalizeText(payload?.atestado_id);
    const militarId = normalizeText(payload?.militar_id);

    if (!atestadoId) return jsonResponse({ success: false, error: 'atestado_id obrigatório' }, 400);
    if (!militarId) return jsonResponse({ success: false, error: 'militar_id obrigatório' }, 400);

    const atestados = await base44.asServiceRole.entities.Atestado.filter({ id: atestadoId });
    const atestado = atestados?.[0];
    if (!atestado) return jsonResponse({ success: false, error: 'Atestado não encontrado' }, 404);
    if (normalizeText(atestado.militar_id) !== militarId) {
      return jsonResponse({ success: false, error: 'O atestado informado não pertence ao militar selecionado.' }, 400);
    }

    const militares = await base44.asServiceRole.entities.Militar.filter({ id: militarId });
    const militar = militares?.[0];
    if (!militar) return jsonResponse({ success: false, error: 'Militar não encontrado' }, 404);

    const templates = await base44.asServiceRole.entities.TemplateTexto.filter({
      modulo: MODULO_TEMPLATE,
      tipo_registro: TIPO_TEMPLATE,
    });
    const template = selecionarTemplate(templates || [], militar);
    if (!template?.template) {
      return jsonResponse({
        success: false,
        error: `Template ativo "${TIPO_TEMPLATE}" não encontrado para o escopo deste militar.`,
      }, 422);
    }

    const dataJiso = normalizeText(payload?.data_jiso || atestado.data_jiso_agendada);
    const horaJiso = normalizeText(payload?.hora_jiso || atestado.hora_jiso_agendada);
    if (!dataJiso || !horaJiso) {
      return jsonResponse({ success: false, error: 'Data e horário da JISO são obrigatórios.' }, 422);
    }

    const vars = {
      posto_nome: montarPostoNome(militar, atestado),
      posto_graduacao: normalizeText(militar?.posto_graduacao || atestado.militar_posto),
      nome_completo: normalizeText(militar?.nome_completo || atestado.militar_nome),
      nome_guerra: normalizeText(militar?.nome_guerra || militar?.nome_completo || atestado.militar_nome),
      matricula: normalizeText(militar?.matricula_atual || militar?.matricula || atestado.militar_matricula),
      data_jiso: formatDateBR(dataJiso),
      hora_jiso: horaJiso,
      dias_atestado: normalizeText(atestado.dias),
      tipo_afastamento: normalizeText(atestado.tipo_afastamento),
      data_inicio: formatDateBR(atestado.data_inicio),
      data_termino: formatDateBR(atestado.data_termino),
    };

    const renderedText = aplicarTemplate(template.template, vars).trim();
    const variaveisPendentes = renderedText.match(/\{\{[^}]+\}\}/g) || [];
    if (!renderedText || variaveisPendentes.length > 0) {
      return jsonResponse({
        success: false,
        error: variaveisPendentes.length > 0
          ? `Template possui variáveis sem valor: ${[...new Set(variaveisPendentes)].join(', ')}`
          : 'O template resultou em mensagem vazia.',
      }, 422);
    }

    const templateHash = await sha256(String(template.template || ''));

    if (action === 'preview') {
      return jsonResponse({
        success: true,
        preview: true,
        mensagem: renderedText,
        template_id: template.id,
        template_nome: template.nome || template.tipo_registro,
        template_updated_date: template.updated_date || '',
        template_hash: templateHash,
        data_jiso_snapshot: dataJiso,
        hora_jiso_snapshot: horaJiso,
      });
    }

    if (action !== 'send') {
      return jsonResponse({ success: false, error: 'Ação inválida.' }, 400);
    }

    const mensagemFinal = normalizeText(payload?.mensagem_final);
    if (!mensagemFinal) {
      return jsonResponse({ success: false, error: 'mensagem_final obrigatória.' }, 400);
    }

    if (normalizeText(payload?.template_id) !== normalizeText(template.id)) {
      return jsonResponse({ success: false, error: 'O template ativo mudou após a prévia. Gere uma nova prévia antes de enviar.' }, 409);
    }
    if (normalizeText(payload?.template_hash) !== templateHash) {
      return jsonResponse({ success: false, error: 'O conteúdo do template foi alterado após a prévia. Gere uma nova prévia antes de enviar.' }, 409);
    }
    if (normalizeText(payload?.data_jiso_snapshot) !== normalizeText(atestado.data_jiso_agendada) ||
        normalizeText(payload?.hora_jiso_snapshot) !== normalizeText(atestado.hora_jiso_agendada)) {
      return jsonResponse({ success: false, error: 'A data ou o horário da JISO mudou após a prévia. Gere uma nova prévia antes de enviar.' }, 409);
    }

    const rawTelefone = militar.whatsapp || militar.telefone_celular || militar.telefone || militar.celular;
    if (!rawTelefone) {
      return jsonResponse({ success: false, error: 'Militar não possui telefone cadastrado' }, 400);
    }

    const dispatchRes = await evolutionWhatsAppProvider.sendTextMessage(
      { to: rawTelefone, text: mensagemFinal },
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
    try {
      await base44.asServiceRole.entities.Atestado.update(atestadoId, {
        jiso_whatsapp_status: 'enviado',
        jiso_whatsapp_enviado_em: enviadoEm,
        jiso_whatsapp_enviado_por: authUser.email,
        jiso_whatsapp_mensagem: mensagemFinal,
        jiso_whatsapp_data_agendada_snapshot: atestado.data_jiso_agendada || '',
        jiso_whatsapp_hora_agendada_snapshot: atestado.hora_jiso_agendada || '',
      });
    } catch (trackingError: any) {
      console.error('[notificarJisoWhatsAppTemplate] Mensagem enviada, mas tracking falhou:', trackingError);
      return jsonResponse({
        success: true,
        tracking_saved: false,
        enviado_em: enviadoEm,
        enviado_por: authUser.email,
        data_jiso_snapshot: atestado.data_jiso_agendada || '',
        hora_jiso_snapshot: atestado.hora_jiso_agendada || '',
        template_id: template.id,
        template_nome: template.nome || template.tipo_registro,
        template_hash: templateHash,
        warning: 'Mensagem enviada, porém o comprovante não pôde ser gravado no atestado.',
        telefone: rawTelefone,
      });
    }

    return jsonResponse({
      success: true,
      tracking_saved: true,
      enviado_em: enviadoEm,
      enviado_por: authUser.email,
      data_jiso_snapshot: atestado.data_jiso_agendada || '',
      hora_jiso_snapshot: atestado.hora_jiso_agendada || '',
      template_id: template.id,
      template_nome: template.nome || template.tipo_registro,
      template_hash: templateHash,
      message: 'Notificação enviada a partir do template ativo e registrada no atestado.',
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