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

    let payload: Record<string, unknown> = {};
    try {
      payload = await req.json();
    } catch (_error) {
      payload = {};
    }

    const atestadoIds = normalizeIds(payload?.atestado_ids);

    const auditoriaPayload = {
      usuario_email: normalizeString(payload?.usuario_email || authUser?.email, 200),
      usuario_id: normalizeString(payload?.usuario_id || authUser?.id, 120),
      data_hora: normalizeString(payload?.data_hora || nowIso, 80),
      acao: normalizeString(payload?.acao, 60),
      quantidade_registros: normalizeInteger(payload?.quantidade_registros),
      atestado_ids: atestadoIds,
      incluiu_sensiveis: normalizeBoolean(payload?.incluiu_sensiveis),
      sensiveis_bloqueados: normalizeBoolean(payload?.sensiveis_bloqueados),
      modo_acesso: normalizeString(payload?.modo_acesso, 60),
      escopo: normalizeString(payload?.escopo, 120),
      extrato_parcial: normalizeBoolean(payload?.extrato_parcial),
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
