import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const OPERACOES = new Set(['create', 'update']);
const ACTION_GERIR = 'gerir_jiso';
const ACTION_DECISAO = 'registrar_decisao_jiso';
const ACTION_PUBLICAR = 'publicar_ata_jiso';

const CAMPOS_GESTAO = new Set([
  'data_jiso',
  'hora_jiso',
  'local_jiso',
  'secao_jiso',
  'finalidade_jiso',
  'motivo_jiso',
  'nup',
  'numero_tars',
  'status',
  'observacoes',
]);
const CAMPOS_DECISAO = new Set([
  'resultado_jiso',
  'dias_original',
  'dias_jiso',
  'ata_jiso',
  'parecer_jiso',
]);
const CAMPOS_PUBLICACAO = new Set([
  'arquivo_ata_jiso',
  'nota_para_bg',
  'numero_bg',
  'data_bg',
  'status_publicacao',
  'texto_publicacao',
  'render_metadata',
]);
const CAMPOS_BLOQUEADOS = new Set([
  'atestado_id',
  'militar_id',
  'militar_nome',
  'militar_posto',
  'militar_matricula',
  'militar_matricula_atual',
  'militar_matricula_vinculo',
  'jiso_whatsapp_status',
  'jiso_whatsapp_enviado_em',
  'jiso_whatsapp_enviado_por',
  'jiso_whatsapp_mensagem',
  'jiso_whatsapp_data_agendada_snapshot',
  'jiso_whatsapp_hora_agendada_snapshot',
]);

function normalizeId(value: unknown) {
  return String(value || '').trim();
}

function responseError(status: number, code: string, error: string, meta: Record<string, unknown> = {}) {
  return Response.json({ error, code, meta }, { status });
}

async function resolvePermissions(base44: any, payload: Record<string, unknown>, authUser: any) {
  const response = await base44.functions.invoke('getUserPermissions', payload);
  const data = response?.data ?? response ?? {};
  return {
    actions: data?.actions && typeof data.actions === 'object' ? data.actions : {},
    isAdmin: Boolean(data?.isAdmin) || String(authUser?.role || '').toLowerCase() === 'admin',
  };
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
  return militares.find((item: any) => normalizeId(item?.id) === militarId) || null;
}

async function getJiso(base44: any, jisoId: string) {
  const rows = await base44.asServiceRole.entities.JISO.filter({ id: jisoId }, undefined, 1, 0);
  return rows?.[0] || null;
}

function requiredActionsForUpdate(data: Record<string, unknown>) {
  const required = new Set<string>();
  for (const key of Object.keys(data || {})) {
    if (CAMPOS_BLOQUEADOS.has(key)) {
      const error: any = new Error(`Campo ${key} não pode ser alterado por esta rota.`);
      error.status = 409;
      error.code = 'JISO_FIELD_IMMUTABLE';
      throw error;
    }
    if (CAMPOS_GESTAO.has(key)) required.add(ACTION_GERIR);
    else if (CAMPOS_DECISAO.has(key)) required.add(ACTION_DECISAO);
    else if (CAMPOS_PUBLICACAO.has(key)) required.add(ACTION_PUBLICAR);
    else {
      const error: any = new Error(`Campo ${key} não é permitido na atualização da JISO.`);
      error.status = 400;
      error.code = 'JISO_UPDATE_FIELD_INVALID';
      throw error;
    }
  }
  return Array.from(required);
}

async function audit(base44: any, metadata: Record<string, unknown>) {
  const payload = {
    modulo: 'JISO',
    origem: 'cudJiso',
    ...metadata,
    data_hora: new Date().toISOString(),
  };
  await base44.asServiceRole.entities.AssistenteLog.create({
    tipo: 'auditoria_jiso',
    acao: String(metadata?.acao || 'alteracao_jiso'),
    descricao: JSON.stringify(payload),
    metadata: payload,
  }).catch((error: any) => {
    console.warn('[cudJiso] falha de auditoria', error?.message || error);
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return responseError(401, 'UNAUTHENTICATED', 'Não autenticado.');

    let payload: Record<string, any> = {};
    try { payload = await req.json(); } catch (_e) { payload = {}; }

    const operation = String(payload?.operation || '').trim().toLowerCase();
    const registroId = normalizeId(payload?.registroId || payload?.id);
    const data = payload?.data && typeof payload.data === 'object' ? payload.data : {};
    if (!OPERACOES.has(operation)) return responseError(400, 'OPERATION_INVALID', 'operation deve ser create ou update.');
    if (operation === 'update' && !registroId) return responseError(400, 'REGISTRO_ID_REQUIRED', 'registroId é obrigatório para update.');

    const permissions = await resolvePermissions(base44, payload, authUser);

    if (operation === 'create') {
      if (!permissions.isAdmin && permissions.actions?.[ACTION_GERIR] !== true) {
        return responseError(403, 'FORBIDDEN_PERMISSION', 'Permissão gerir_jiso é obrigatória para criar/agendar JISO.');
      }

      const militarId = normalizeId(data?.militar_id);
      if (!militarId) return responseError(400, 'MILITAR_ID_REQUIRED', 'militar_id é obrigatório.');
      const militar = await getScopedMilitar(base44, payload, militarId);
      if (!militar) return responseError(403, 'MILITAR_OUT_OF_SCOPE', 'Militar fora do escopo permitido do usuário.');

      const dataJiso = String(data?.data_jiso || '').trim();
      const status = String(data?.status || '').trim() || (dataJiso ? 'Agendada' : 'Aguardando Agendamento');
      const criado = await base44.asServiceRole.entities.JISO.create({
        militar_id: militarId,
        militar_nome: militar?.nome_completo || militar?.nome_guerra || '',
        militar_posto: militar?.posto_graduacao || '',
        militar_matricula: militar?.matricula || '',
        militar_matricula_atual: militar?.matricula_atual || militar?.matricula || '',
        militar_matricula_vinculo: militar?.matricula_atual || militar?.matricula || '',
        data_jiso: dataJiso,
        hora_jiso: data?.hora_jiso || '',
        local_jiso: data?.local_jiso || '',
        secao_jiso: data?.secao_jiso || '',
        finalidade_jiso: data?.finalidade_jiso || '',
        motivo_jiso: data?.motivo_jiso || '',
        nup: data?.nup || '',
        numero_tars: data?.numero_tars || '',
        status,
        observacoes: data?.observacoes || '',
        jiso_whatsapp_status: 'pendente',
        status_publicacao: 'Aguardando Nota',
      });

      await audit(base44, {
        acao: 'criar_jiso',
        jiso_id: criado?.id || '',
        militar_id: militarId,
        criado_por: String(authUser.email || ''),
      });
      return Response.json({ ok: true, operation, data: criado });
    }

    const existente = await getJiso(base44, registroId);
    if (!existente) return responseError(404, 'JISO_NOT_FOUND', 'JISO não encontrada.');
    const militarId = normalizeId(existente?.militar_id);
    if (!militarId) return responseError(422, 'JISO_SEM_MILITAR', 'JISO sem militar_id válido.');
    const militar = await getScopedMilitar(base44, payload, militarId);
    if (!militar) return responseError(403, 'MILITAR_OUT_OF_SCOPE', 'JISO fora do escopo permitido do usuário.');

    const requiredActions = requiredActionsForUpdate(data);
    if (requiredActions.length === 0) return responseError(400, 'JISO_UPDATE_EMPTY', 'Nenhum campo válido informado para atualização.');
    if (!permissions.isAdmin) {
      const missing = requiredActions.filter((key) => permissions.actions?.[key] !== true);
      if (missing.length > 0) {
        return responseError(403, 'FORBIDDEN_PERMISSION', 'Permissão funcional insuficiente para os campos informados.', {
          required_actions: requiredActions,
          missing_actions: missing,
        });
      }
    }

    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) patch[key] = value;
    const atualizado = await base44.asServiceRole.entities.JISO.update(registroId, patch);

    await audit(base44, {
      acao: 'atualizar_jiso',
      jiso_id: registroId,
      militar_id: militarId,
      campos_alterados: Object.keys(patch),
      atualizado_por: String(authUser.email || ''),
    });
    return Response.json({ ok: true, operation, data: atualizado });
  } catch (error: any) {
    const status = error?.status || error?.response?.status || 500;
    const code = error?.code || 'CUD_JISO_FAILED';
    console.error('[cudJiso] erro', { status, code, message: error?.message });
    return responseError(status, code, error?.message || 'Erro ao processar JISO.');
  }
});
