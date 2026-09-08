import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const STATUS_CANCELAVEIS = new Set(['ativo', 'rascunho', 'pendente_publicacao', 'pendente']);
const ALERTA_PUBLICACAO = 'Ajuste cancelado no sistema. Verifique necessidade de regularização documental no RP.';
const normalizeEmail = (e) => String(e || '').trim().toLowerCase();
const normalize = (v) => String(v ?? '').trim();

async function resolverAutorizacao(base44, payload, militarId = null) {
  const request = {
    ...(payload?.effectiveEmail ? { effectiveEmail: payload.effectiveEmail } : {}),
    ...(militarId ? { scopeMilitarIds: [militarId] } : {}),
  };
  const response = await base44.functions.invoke('getUserPermissions', request);
  const authz = response?.data ?? response ?? {};
  if (authz?.error) throw Object.assign(new Error(authz.error), { status: 403 });
  if (authz?.isAdmin !== true && authz?.actions?.cancelar_credito_extra_ferias !== true) {
    throw Object.assign(new Error('Acesso negado: requer cancelar_credito_extra_ferias.'), { status: 403 });
  }
  if (militarId && authz?.scopeCheck?.allAllowed !== true) {
    throw Object.assign(new Error('Acesso negado: militar fora do escopo organizacional.'), { status: 403 });
  }
  return authz;
}

function anexarAuditoriaObservacoes(observacoes, texto) {
  return [normalize(observacoes), texto].filter(Boolean).join('\n');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return Response.json({ error: 'Não autenticado.' }, { status: 401 });

    let payload = {};
    try { payload = await req.json(); } catch (_e) { payload = {}; }

    const ajusteId = normalize(payload?.ajuste_id);
    const motivoCancelamento = normalize(payload?.motivo_cancelamento);

    if (!ajusteId) return Response.json({ error: 'ajuste_id é obrigatório.' }, { status: 400 });
    if (!motivoCancelamento) return Response.json({ error: 'motivo_cancelamento é obrigatório.' }, { status: 400 });

    await resolverAutorizacao(base44, payload);
    const ajuste = await base44.asServiceRole.entities.AjusteSaldoFerias.get(ajusteId).catch(() => null);
    if (!ajuste) return Response.json({ error: 'Ajuste de saldo de férias não encontrado.' }, { status: 404 });
    const authz = await resolverAutorizacao(base44, payload, String(ajuste?.militar_id || ''));
    const effectiveEmail = normalizeEmail(authz?.effectiveUserEmail || authUser.email);

    const statusAtual = normalize(ajuste?.status).toLowerCase();
    if (!STATUS_CANCELAVEIS.has(statusAtual)) {
      return Response.json({ error: 'Status atual não permite cancelamento.' }, { status: 409 });
    }

    const carimbo = new Date().toISOString();
    const auditoria = `[${carimbo}] Ajuste cancelado por ${effectiveEmail}. Motivo: ${motivoCancelamento}.`;
    const alerta = ajuste?.publicacao_id ? ALERTA_PUBLICACAO : '';
    const observacoes = anexarAuditoriaObservacoes(ajuste?.observacoes, [alerta, auditoria].filter(Boolean).join(' '));

    const ajusteSaldoFerias = await base44.asServiceRole.entities.AjusteSaldoFerias.update(ajusteId, {
      status: 'cancelado',
      cancelado_em: carimbo,
      cancelado_por_email: effectiveEmail,
      motivo_cancelamento: motivoCancelamento,
      observacoes,
    });

    return Response.json({ ok: true, ajusteSaldoFerias });
  } catch (error) {
    const status = error?.status || error?.response?.status || 500;
    console.error('[cancelarAjusteSaldoFerias] erro', { message: error?.message, status });
    return Response.json({ error: error?.message || 'Erro ao cancelar ajuste de saldo de férias.' }, { status });
  }
});
