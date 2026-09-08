import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function normalizeString(value: unknown, max = 500) {
  return String(value || '').trim().slice(0, max);
}

function normalizeIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => normalizeString(item, 80)).filter(Boolean).slice(0, 2000);
}

function normalizeBoolean(value: unknown) {
  return value === true;
}

function normalizeInteger(value: unknown) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.floor(num));
}

Deno.serve(async (req) => {
  const nowIso = new Date().toISOString();
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser?.email) {
      return Response.json({ ok: false, warning: 'Não autenticado.' }, { status: 401 });
    }

    let payload: Record<string, unknown> = {};
    try {
      payload = await req.json();
    } catch (_error) {
      payload = {};
    }

    const atestadoIds = normalizeIds(payload?.atestado_ids);
    const permsResponse = await base44.functions.invoke('getUserPermissions', {
      ...(payload?.effectiveEmail ? { effectiveEmail: payload.effectiveEmail } : {}),
    });
    const perms = permsResponse?.data ?? permsResponse ?? {};
    if (perms?.error) {
      return Response.json({ ok: false, warning: perms.error }, { status: 403 });
    }

    const auditoriaPayload = {
      usuario_email: normalizeString(authUser.email, 200),
      usuario_id: normalizeString(authUser.id, 120),
      usuario_efetivo_email: normalizeString(perms?.effectiveUserEmail || authUser.email, 200),
      is_impersonating: perms?.isImpersonating === true,
      data_hora: nowIso,
      acao: normalizeString(payload?.acao, 60),
      quantidade_registros: normalizeInteger(payload?.quantidade_registros),
      atestado_ids: atestadoIds,
      incluiu_sensiveis: normalizeBoolean(payload?.incluiu_sensiveis),
      sensiveis_bloqueados: normalizeBoolean(payload?.sensiveis_bloqueados),
      modo_acesso: normalizeString(payload?.modo_acesso, 60),
      escopo: normalizeString(payload?.escopo, 120),
      extrato_parcial: normalizeBoolean(payload?.extrato_parcial),
      quantidade_anexos: normalizeInteger(payload?.quantidade_anexos),
      arquivos_ignorados_sem_anexo: normalizeInteger(payload?.arquivos_ignorados_sem_anexo),
      limite_excedido: normalizeBoolean(payload?.limite_excedido),
      origem: 'ExtratoAtestadosMedicos',
    };

    await base44.asServiceRole.entities.AssistenteLog.create({
      tipo: 'auditoria_extrato_atestados',
      acao: auditoriaPayload.acao,
      descricao: JSON.stringify(auditoriaPayload),
      metadata: {
        modulo: 'ExtratoAtestadosMedicos',
        ...auditoriaPayload,
      },
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.warn('[registrarAuditoriaExtratoAtestados] warning', {
      message: (error as { message?: string })?.message || 'erro desconhecido',
    });
    return Response.json({ ok: false, warning: 'Falha ao registrar auditoria.' }, { status: 200 });
  }
});
