import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { evolutionWhatsAppProvider } from '../../shared/portal/otp/providers/evolutionWhatsAppProvider.ts';

const FUNCTION_VERSION = 'jiso-template-v3-2026-08-29';
const MODULO_TEMPLATE = 'WhatsApp Notificações';
const TIPO_TEMPLATE = 'Notificação de JISO WA';

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify({ function_version: FUNCTION_VERSION, ...data }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

const normalizeText = (value: unknown) => String(value ?? '').trim();

function normalizeScope(value: unknown) {
  const raw = normalizeText(value).toUpperCase();
  return ['SETOR', 'SUBSETOR', 'UNIDADE'].includes(raw) ? raw : 'GLOBAL';
}

function normalizeTipo(value: unknown) {
  return normalizeText(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^\w\s]/g, ' ').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeModulo(value: unknown) {
  return normalizeText(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\s+/g, '').replace('publicacao', '');
}

function formatDateBR(value: unknown) {
  const raw = normalizeText(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : raw;
}

function montarPostoNome(militar: any, reference: any) {
  const posto = normalizeText(militar?.posto_graduacao || reference?.militar_posto);
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
  const unidadeId = normalizeText(militar?.unidade_id || (tipoSubgrupamento === 'unidade' ? militar?.subgrupamento_id : ''));
  return { setorId, subsetorId, unidadeId };
}

function templateMatchesScope(template: any, contexto: ReturnType<typeof getContextoMilitar>) {
  const escopo = normalizeScope(template?.escopo);
  const setorTemplate = normalizeText(template?.setor_id);
  const subsetorTemplate = normalizeText(template?.subsetor_id);
  const unidadeTemplate = normalizeText(template?.unidade_id);
  if (escopo === 'GLOBAL') return true;
  if (escopo === 'SETOR') return Boolean(contexto.setorId && setorTemplate === contexto.setorId);
  if (escopo === 'SUBSETOR') return Boolean(contexto.setorId && contexto.subsetorId && setorTemplate === contexto.setorId && subsetorTemplate === contexto.subsetorId);
  if (escopo === 'UNIDADE') return Boolean(contexto.setorId && contexto.subsetorId && contexto.unidadeId && setorTemplate === contexto.setorId && subsetorTemplate === contexto.subsetorId && unidadeTemplate === contexto.unidadeId);
  return false;
}

function selecionarTemplate(templates: any[], militar: any) {
  const tipoAlvo = normalizeTipo(TIPO_TEMPLATE);
  const moduloAlvo = normalizeModulo(MODULO_TEMPLATE);
  const contexto = getContextoMilitar(militar);
  const candidatos = (templates || []).filter((template) => (
    template && template.ativo !== false &&
    normalizeTipo(template.tipo_registro) === tipoAlvo &&
    normalizeModulo(template.modulo) === moduloAlvo
  ));
  for (const escopo of ['UNIDADE', 'SUBSETOR', 'SETOR', 'GLOBAL']) {
    const encontrado = candidatos.find((template) => normalizeScope(template.escopo) === escopo && templateMatchesScope(template, contexto));
    if (encontrado) return encontrado;
  }
  return null;
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function resolverAutorizacaoJiso(base44: any, payload: any, militarId: string) {
  const response = await base44.functions.invoke('getUserPermissions', {
    ...(payload?.effectiveEmail ? { effectiveEmail: payload.effectiveEmail } : {}),
    scopeMilitarIds: [militarId],
  });
  const authz = response?.data ?? response ?? {};
  if (authz?.error) throw Object.assign(new Error(authz.error), { status: 403 });
  if (authz?.isAdmin !== true && authz?.actions?.gerir_jiso !== true) {
    throw Object.assign(new Error('Acesso negado: requer gerir_jiso.'), { status: 403 });
  }
  if (authz?.scopeCheck?.allAllowed !== true) {
    throw Object.assign(new Error('Acesso negado: militar fora do escopo organizacional.'), { status: 403 });
  }
  return authz;
}

async function loadContext(base44: any, payload: any) {
  const jisoId = normalizeText(payload?.jiso_id);
  const atestadoId = normalizeText(payload?.atestado_id);

  if (jisoId) {
    const jisos = await base44.asServiceRole.entities.JISO.filter({ id: jisoId }, undefined, 1, 0);
    const jiso = jisos?.[0];
    if (!jiso) throw Object.assign(new Error('JISO não encontrada.'), { status: 404 });
    const links = await base44.asServiceRole.entities.JISOAtestado.filter({ jiso_id: jisoId, status: 'Ativo' }, 'ordem', 500, 0);
    const ids = links.map((item: any) => item.atestado_id).filter(Boolean);
    const atestados = ids.length
      ? await base44.asServiceRole.entities.Atestado.filter({ id: { $in: ids } }, 'data_inicio', 500, 0)
      : [];
    const principal = atestados[0] || {
      militar_id: jiso.militar_id,
      militar_nome: jiso.militar_nome,
      militar_posto: jiso.militar_posto,
      militar_matricula: jiso.militar_matricula,
    };
    return {
      mode: 'jiso',
      jisoId,
      jiso,
      atestadoId: principal?.id || '',
      atestado: principal,
      atestados,
      militarId: normalizeText(jiso.militar_id),
      dataJiso: normalizeText(payload?.data_jiso || jiso.data_jiso),
      horaJiso: normalizeText(payload?.hora_jiso || jiso.hora_jiso),
    };
  }

  if (!atestadoId) throw Object.assign(new Error('jiso_id ou atestado_id é obrigatório.'), { status: 400 });
  const atestados = await base44.asServiceRole.entities.Atestado.filter({ id: atestadoId }, undefined, 1, 0);
  const atestado = atestados?.[0];
  if (!atestado) throw Object.assign(new Error('Atestado não encontrado.'), { status: 404 });
  return {
    mode: 'legacy',
    jisoId: '',
    jiso: null,
    atestadoId,
    atestado,
    atestados: [atestado],
    militarId: normalizeText(payload?.militar_id || atestado.militar_id),
    dataJiso: normalizeText(payload?.data_jiso || atestado.data_jiso_agendada),
    horaJiso: normalizeText(payload?.hora_jiso || atestado.hora_jiso_agendada),
  };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  if (req.method !== 'POST') return jsonResponse({ success: false, error: 'Method not allowed' }, 405);

  try {
    const authUser = await base44.auth.me();
    if (!authUser?.email) return jsonResponse({ success: false, error: 'Usuário não autenticado' }, 401);

    const payload = await req.json();
    const action = normalizeText(payload?.action || 'preview').toLowerCase();
    const context = await loadContext(base44, payload);
    if (!context.militarId) return jsonResponse({ success: false, error: 'militar_id obrigatório' }, 400);
    if (!context.dataJiso || !context.horaJiso) {
      return jsonResponse({ success: false, error: 'Data e horário da JISO são obrigatórios.' }, 422);
    }

    const authz = await resolverAutorizacaoJiso(base44, payload, context.militarId);
    const effectiveEmail = normalizeText(authz?.effectiveUserEmail || authUser.email);
    const militares = await base44.asServiceRole.entities.Militar.filter({ id: context.militarId }, undefined, 1, 0);
    const militar = militares?.[0];
    if (!militar) return jsonResponse({ success: false, error: 'Militar não encontrado' }, 404);

    const templates = await base44.asServiceRole.entities.TemplateTexto.filter({ modulo: MODULO_TEMPLATE, tipo_registro: TIPO_TEMPLATE });
    const template = selecionarTemplate(templates || [], militar);
    if (!template?.template) {
      return jsonResponse({ success: false, error: `Template ativo "${TIPO_TEMPLATE}" não encontrado para o escopo deste militar.` }, 422);
    }

    const datasInicio = context.atestados.map((item: any) => normalizeText(item.data_inicio)).filter(Boolean).sort();
    const datasTermino = context.atestados.map((item: any) => normalizeText(item.data_termino)).filter(Boolean).sort();
    const totalDias = context.atestados.reduce((sum: number, item: any) => sum + Number(item.dias || 0), 0);
    const tipos = [...new Set(context.atestados.map((item: any) => normalizeText(item.tipo_afastamento)).filter(Boolean))];

    const vars = {
      posto_nome: montarPostoNome(militar, context.atestado),
      posto_graduacao: normalizeText(militar?.posto_graduacao || context.atestado?.militar_posto),
      nome_completo: normalizeText(militar?.nome_completo || context.atestado?.militar_nome),
      nome_guerra: normalizeText(militar?.nome_guerra || militar?.nome_completo || context.atestado?.militar_nome),
      matricula: normalizeText(militar?.matricula_atual || militar?.matricula || context.atestado?.militar_matricula),
      data_jiso: formatDateBR(context.dataJiso),
      hora_jiso: context.horaJiso,
      dias_atestado: context.atestados.length > 1 ? `${totalDias} dias em ${context.atestados.length} atestados` : normalizeText(context.atestado?.dias),
      tipo_afastamento: tipos.join(', '),
      data_inicio: formatDateBR(datasInicio[0] || ''),
      data_termino: formatDateBR(datasTermino[datasTermino.length - 1] || ''),
    };

    const renderedText = aplicarTemplate(template.template, vars).trim();
    const pending = renderedText.match(/\{\{[^}]+\}\}/g) || [];
    if (!renderedText || pending.length) {
      return jsonResponse({
        success: false,
        error: pending.length ? `Template possui variáveis sem valor: ${[...new Set(pending)].join(', ')}` : 'O template resultou em mensagem vazia.',
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
        data_jiso_snapshot: context.dataJiso,
        hora_jiso_snapshot: context.horaJiso,
        total_atestados: context.atestados.length,
      });
    }
    if (action !== 'send') return jsonResponse({ success: false, error: 'Ação inválida.' }, 400);

    const mensagemFinal = normalizeText(payload?.mensagem_final);
    if (!mensagemFinal) return jsonResponse({ success: false, error: 'mensagem_final obrigatória.' }, 400);
    if (normalizeText(payload?.template_id) !== normalizeText(template.id) || normalizeText(payload?.template_hash) !== templateHash) {
      return jsonResponse({ success: false, error: 'O template ativo mudou após a prévia. Gere uma nova prévia antes de enviar.' }, 409);
    }
    if (normalizeText(payload?.data_jiso_snapshot) !== context.dataJiso || normalizeText(payload?.hora_jiso_snapshot) !== context.horaJiso) {
      return jsonResponse({ success: false, error: 'A data ou o horário da JISO mudou após a prévia. Gere uma nova prévia antes de enviar.' }, 409);
    }

    const rawTelefone = militar.whatsapp || militar.telefone_celular || militar.telefone || militar.celular;
    if (!rawTelefone) return jsonResponse({ success: false, error: 'Militar não possui telefone cadastrado' }, 400);

    const dispatchRes = await evolutionWhatsAppProvider.sendTextMessage({ to: rawTelefone, text: mensagemFinal }, base44.asServiceRole);
    if (!dispatchRes.success) {
      if (context.mode === 'jiso') {
        await base44.asServiceRole.entities.JISONotificacao.create({
          jiso_id: context.jisoId,
          militar_id: context.militarId,
          tipo: context.jiso?.whatsapp_enviado_em ? 'Reagendamento' : 'Agendamento',
          canal: 'WhatsApp',
          status: 'Falhou',
          destinatario: String(rawTelefone),
          mensagem: mensagemFinal,
          data_jiso_snapshot: context.dataJiso,
          hora_jiso_snapshot: context.horaJiso,
          template_id: template.id,
          template_nome: template.nome || template.tipo_registro,
          template_hash: templateHash,
          enviado_por: effectiveEmail,
          erro: dispatchRes.error || 'Falha no provedor',
        });
      }
      return jsonResponse({ success: false, error: dispatchRes.error || 'Falha ao enviar WhatsApp', telefone: rawTelefone }, 502);
    }

    const enviadoEm = new Date().toISOString();
    try {
      if (context.mode === 'jiso') {
        const tipo = context.jiso?.whatsapp_enviado_em ? 'Reagendamento' : 'Agendamento';
        await base44.asServiceRole.entities.JISO.update(context.jisoId, {
          whatsapp_status: 'enviado',
          whatsapp_enviado_em: enviadoEm,
          whatsapp_enviado_por: effectiveEmail,
          whatsapp_mensagem: mensagemFinal,
          whatsapp_data_agendada_snapshot: context.dataJiso,
          whatsapp_hora_agendada_snapshot: context.horaJiso,
          template_id: template.id,
          template_hash: templateHash,
        });
        await base44.asServiceRole.entities.JISONotificacao.create({
          jiso_id: context.jisoId,
          militar_id: context.militarId,
          tipo,
          canal: 'WhatsApp',
          status: 'Enviada',
          destinatario: String(rawTelefone),
          mensagem: mensagemFinal,
          data_jiso_snapshot: context.dataJiso,
          hora_jiso_snapshot: context.horaJiso,
          template_id: template.id,
          template_nome: template.nome || template.tipo_registro,
          template_hash: templateHash,
          enviado_em: enviadoEm,
          enviado_por: effectiveEmail,
          provedor_retorno: dispatchRes,
        });
      } else {
        await base44.asServiceRole.entities.Atestado.update(context.atestadoId, {
          jiso_whatsapp_status: 'enviado',
          jiso_whatsapp_enviado_em: enviadoEm,
          jiso_whatsapp_enviado_por: effectiveEmail,
          jiso_whatsapp_mensagem: mensagemFinal,
          jiso_whatsapp_data_agendada_snapshot: context.dataJiso,
          jiso_whatsapp_hora_agendada_snapshot: context.horaJiso,
        });
      }
    } catch (trackingError: any) {
      console.error('[notificarJisoWhatsAppTemplate] envio confirmado, tracking falhou:', trackingError);
      return jsonResponse({
        success: true,
        tracking_saved: false,
        enviado_em: enviadoEm,
        enviado_por: effectiveEmail,
        data_jiso_snapshot: context.dataJiso,
        hora_jiso_snapshot: context.horaJiso,
        template_id: template.id,
        template_nome: template.nome || template.tipo_registro,
        template_hash: templateHash,
        warning: 'Mensagem enviada, porém o comprovante não pôde ser gravado.',
        telefone: rawTelefone,
      });
    }

    return jsonResponse({
      success: true,
      tracking_saved: true,
      enviado_em: enviadoEm,
      enviado_por: effectiveEmail,
      data_jiso_snapshot: context.dataJiso,
      hora_jiso_snapshot: context.horaJiso,
      template_id: template.id,
      template_nome: template.nome || template.tipo_registro,
      template_hash: templateHash,
      message: context.mode === 'jiso' ? 'Notificação registrada na JISO.' : 'Notificação legada registrada no atestado.',
      telefone: rawTelefone,
    });
  } catch (caught: any) {
    const status = Number(caught?.status || caught?.response?.status || 500);
    console.error('[notificarJisoWhatsAppTemplate]', caught);
    return jsonResponse({
      success: false,
      error: status === 403 ? (caught?.message || 'Acesso negado.') : (caught?.message || 'Erro interno ao processar notificação'),
    }, Number.isFinite(status) ? status : 500);
  }
});
