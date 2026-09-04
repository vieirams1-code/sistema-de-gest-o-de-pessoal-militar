import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { evolutionWhatsAppProvider } from '../../shared/portal/otp/providers/evolutionWhatsAppProvider.ts';

const FUNCTION_VERSION = 'jiso-independent-wa-v1-2026-09-04';
const MODULO_TEMPLATE = 'WhatsApp Notificações';
const TIPO_TEMPLATE = 'Notificação de JISO WA';
const ACTION_GERIR_JISO = 'gerir_jiso';
const ATESTADO_ONLY_VARS = new Set(['dias_atestado', 'tipo_afastamento', 'data_inicio', 'data_termino']);

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

function montarPostoNome(militar: any, jiso: any) {
  const posto = normalizeText(militar?.posto_graduacao || jiso?.militar_posto);
  const quadro = normalizeText(militar?.quadro || militar?.quadro_bombeiro_militar || militar?.qbmp);
  return [posto, quadro].filter(Boolean).join(' ');
}

function aplicarTemplate(template: string, vars: Record<string, string>) {
  return String(template || '').replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    const value = vars[key];
    return value === undefined || value === null ? `{{${key}}}` : String(value);
  });
}

function getTemplateVariables(template: string) {
  const matches = String(template || '').matchAll(/\{\{(\w+)\}\}/g);
  return Array.from(new Set(Array.from(matches, (match) => match[1])));
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
  if (escopo === 'SETOR') return Boolean(contexto.setorId && setorTemplate === contexto.setorId);
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

async function getJiso(base44: any, jisoId: string) {
  const rows = await base44.asServiceRole.entities.JISO.filter({ id: jisoId }, undefined, 1, 0);
  return rows?.[0] || null;
}

async function getScopedMilitar(base44: any, payload: Record<string, unknown>, militarId: string) {
  const response = await base44.functions.invoke('getScopedMilitares', {
    ...payload,
    militarIds: [militarId],
    limit: 10,
    offset: 0,
    includeFoto: false,
  });
  const data = response?.data ?? response ?? {};
  const militares = Array.isArray(data?.militares) ? data.militares : [];
  return militares.find((item: any) => normalizeText(item?.id) === militarId) || null;
}

async function getAtestadosVinculados(base44: any, jiso: any) {
  const jisoId = normalizeText(jiso?.id);
  const vinculos = await base44.asServiceRole.entities.JISOAtestado
    .filter({ jiso_id: jisoId, ativo: true }, undefined, 200, 0)
    .catch(() => []);

  const ids = new Set((vinculos || []).map((item: any) => normalizeText(item?.atestado_id)).filter(Boolean));
  const legadoId = normalizeText(jiso?.atestado_id);
  if (legadoId) ids.add(legadoId);
  if (ids.size === 0) return [];

  const rows = await base44.asServiceRole.entities.Atestado.filter({ id: { $in: Array.from(ids) } }, undefined, 200, 0);
  return (rows || []).filter((atestado: any) => normalizeText(atestado?.militar_id) === normalizeText(jiso?.militar_id));
}

function montarResumoAtestados(atestados: any[]) {
  if (!atestados.length) return '';
  return atestados.map((atestado, index) => {
    const inicio = formatDateBR(atestado?.data_inicio) || 'data não informada';
    const dias = normalizeText(atestado?.dias);
    const tipo = normalizeText(atestado?.tipo_afastamento);
    return `${index + 1}. ${tipo || 'Atestado'} de ${inicio}${dias ? ` (${dias} dias)` : ''}`;
  }).join('; ');
}

function buildSnapshot(jiso: any) {
  return {
    data_jiso_snapshot: normalizeText(jiso?.data_jiso),
    hora_jiso_snapshot: normalizeText(jiso?.hora_jiso),
    local_jiso_snapshot: normalizeText(jiso?.local_jiso),
    finalidade_jiso_snapshot: normalizeText(jiso?.finalidade_jiso),
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
    const jisoId = normalizeText(payload?.jiso_id);
    if (!jisoId) return jsonResponse({ success: false, error: 'jiso_id obrigatório' }, 400);

    const permissionResponse = await base44.functions.invoke('getUserPermissions', payload);
    const permissionData = permissionResponse?.data ?? permissionResponse ?? {};
    const actions = permissionData?.actions && typeof permissionData.actions === 'object' ? permissionData.actions : {};
    const isAdmin = Boolean(permissionData?.isAdmin) || String(authUser.role || '').toLowerCase() === 'admin';
    if (!isAdmin && actions?.[ACTION_GERIR_JISO] !== true) {
      return jsonResponse({ success: false, error: 'Permissão gerir_jiso é obrigatória para convocar militar para JISO.' }, 403);
    }

    const jiso = await getJiso(base44, jisoId);
    if (!jiso) return jsonResponse({ success: false, error: 'JISO não encontrada' }, 404);

    const militarId = normalizeText(jiso?.militar_id);
    if (!militarId) return jsonResponse({ success: false, error: 'JISO sem militar_id válido' }, 422);
    const militar = await getScopedMilitar(base44, payload, militarId);
    if (!militar) return jsonResponse({ success: false, error: 'JISO fora do escopo permitido do usuário.' }, 403);

    const dataJiso = normalizeText(jiso?.data_jiso);
    const horaJiso = normalizeText(jiso?.hora_jiso);
    if (!dataJiso || !horaJiso) {
      return jsonResponse({ success: false, error: 'Data e horário devem estar registrados na JISO antes da convocação.' }, 422);
    }

    const atestados = await getAtestadosVinculados(base44, jiso);
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

    const templateVars = getTemplateVariables(template.template);
    const atestadoVarsUsadas = templateVars.filter((key) => ATESTADO_ONLY_VARS.has(key));
    if (atestadoVarsUsadas.length > 0 && atestados.length !== 1) {
      return jsonResponse({
        success: false,
        code: 'JISO_TEMPLATE_REQUER_ATTESTADO_UNICO',
        error: atestados.length === 0
          ? 'O template atual usa variáveis específicas de atestado, mas esta JISO não possui atestado vinculado.'
          : 'O template atual usa variáveis específicas de um único atestado, mas esta JISO possui vários atestados vinculados.',
        variaveis_incompativeis: atestadoVarsUsadas,
        quantidade_atestados: atestados.length,
        sugestao: 'Adapte o template para variáveis da JISO, como {{finalidade_jiso}}, {{motivo_jiso}}, {{local_jiso}} e {{resumo_atestados}}.',
      }, 422);
    }

    const atestadoUnico = atestados.length === 1 ? atestados[0] : null;
    const vars: Record<string, string> = {
      posto_nome: montarPostoNome(militar, jiso),
      posto_graduacao: normalizeText(militar?.posto_graduacao || jiso?.militar_posto),
      nome_completo: normalizeText(militar?.nome_completo || jiso?.militar_nome),
      nome_guerra: normalizeText(militar?.nome_guerra || militar?.nome_completo || jiso?.militar_nome),
      matricula: normalizeText(militar?.matricula_atual || militar?.matricula || jiso?.militar_matricula_atual || jiso?.militar_matricula),
      data_jiso: formatDateBR(dataJiso),
      hora_jiso: horaJiso,
      local_jiso: normalizeText(jiso?.local_jiso),
      secao_jiso: normalizeText(jiso?.secao_jiso),
      finalidade_jiso: normalizeText(jiso?.finalidade_jiso),
      motivo_jiso: normalizeText(jiso?.motivo_jiso),
      nup: normalizeText(jiso?.nup),
      numero_tars: normalizeText(jiso?.numero_tars),
      quantidade_atestados: String(atestados.length),
      resumo_atestados: montarResumoAtestados(atestados),
      dias_atestado: normalizeText(atestadoUnico?.dias),
      tipo_afastamento: normalizeText(atestadoUnico?.tipo_afastamento),
      data_inicio: formatDateBR(atestadoUnico?.data_inicio),
      data_termino: formatDateBR(atestadoUnico?.data_termino),
    };

    const renderedText = aplicarTemplate(template.template, vars).trim();
    const variaveisPendentes = renderedText.match(/\{\{[^}]+\}\}/g) || [];
    if (!renderedText || variaveisPendentes.length > 0) {
      return jsonResponse({
        success: false,
        error: variaveisPendentes.length > 0
          ? `Template possui variáveis sem valor reconhecido: ${[...new Set(variaveisPendentes)].join(', ')}`
          : 'O template resultou em mensagem vazia.',
        supported_variables: Object.keys(vars),
      }, 422);
    }

    const templateHash = await sha256(String(template.template || ''));
    const snapshot = buildSnapshot(jiso);

    if (action === 'preview') {
      return jsonResponse({
        success: true,
        preview: true,
        jiso_id: jisoId,
        militar_id: militarId,
        mensagem: renderedText,
        template_id: template.id,
        template_nome: template.nome || template.tipo_registro,
        template_updated_date: template.updated_date || '',
        template_hash: templateHash,
        quantidade_atestados: atestados.length,
        supported_variables: Object.keys(vars),
        ...snapshot,
      });
    }

    if (action !== 'send') return jsonResponse({ success: false, error: 'Ação inválida.' }, 400);

    const mensagemFinal = normalizeText(payload?.mensagem_final);
    if (!mensagemFinal) return jsonResponse({ success: false, error: 'mensagem_final obrigatória.' }, 400);
    if (normalizeText(payload?.template_id) !== normalizeText(template.id)) {
      return jsonResponse({ success: false, error: 'O template ativo mudou após a prévia. Gere uma nova prévia antes de enviar.' }, 409);
    }
    if (normalizeText(payload?.template_hash) !== templateHash) {
      return jsonResponse({ success: false, error: 'O conteúdo do template foi alterado após a prévia. Gere uma nova prévia antes de enviar.' }, 409);
    }

    const currentSnapshot = buildSnapshot(jiso);
    for (const [key, value] of Object.entries(currentSnapshot)) {
      if (normalizeText(payload?.[key]) !== normalizeText(value)) {
        return jsonResponse({ success: false, error: 'Os dados de convocação da JISO mudaram após a prévia. Gere uma nova prévia antes de enviar.' }, 409);
      }
    }

    const rawTelefone = militar.whatsapp || militar.telefone_celular || militar.telefone || militar.celular;
    if (!rawTelefone) return jsonResponse({ success: false, error: 'Militar não possui telefone cadastrado' }, 400);

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
      await base44.asServiceRole.entities.JISO.update(jisoId, {
        jiso_whatsapp_status: 'enviado',
        jiso_whatsapp_enviado_em: enviadoEm,
        jiso_whatsapp_enviado_por: authUser.email,
        jiso_whatsapp_mensagem: mensagemFinal,
        jiso_whatsapp_data_agendada_snapshot: dataJiso,
        jiso_whatsapp_hora_agendada_snapshot: horaJiso,
      });
    } catch (trackingError: any) {
      console.error('[notificarJisoIndependenteWhatsAppTemplate] Mensagem enviada, mas tracking falhou:', trackingError);
      return jsonResponse({
        success: true,
        tracking_saved: false,
        enviado_em: enviadoEm,
        enviado_por: authUser.email,
        jiso_id: jisoId,
        warning: 'Mensagem enviada, porém o comprovante não pôde ser gravado na JISO.',
        telefone: rawTelefone,
      });
    }

    await base44.asServiceRole.entities.AssistenteLog.create({
      tipo: 'auditoria_jiso_whatsapp',
      acao: 'enviar_convocacao_jiso_whatsapp',
      descricao: `Convocação JISO enviada para ${normalizeText(militar?.nome_completo || jiso?.militar_nome)}.`,
      metadata: {
        modulo: 'JISO',
        origem: 'notificarJisoIndependenteWhatsAppTemplate',
        jiso_id: jisoId,
        militar_id: militarId,
        enviado_em: enviadoEm,
        enviado_por: authUser.email,
        template_id: template.id,
        template_hash: templateHash,
        quantidade_atestados: atestados.length,
      },
    }).catch(() => null);

    return jsonResponse({
      success: true,
      tracking_saved: true,
      enviado_em: enviadoEm,
      enviado_por: authUser.email,
      jiso_id: jisoId,
      data_jiso_snapshot: dataJiso,
      hora_jiso_snapshot: horaJiso,
      template_id: template.id,
      template_nome: template.nome || template.tipo_registro,
      template_hash: templateHash,
      message: 'Convocação enviada e registrada na JISO.',
      telefone: rawTelefone,
    });
  } catch (error: any) {
    console.error('[notificarJisoIndependenteWhatsAppTemplate] Erro interno:', error);
    return jsonResponse({
      success: false,
      error: 'Erro interno ao processar convocação JISO',
      details: error?.message || String(error),
    }, 500);
  }
});
