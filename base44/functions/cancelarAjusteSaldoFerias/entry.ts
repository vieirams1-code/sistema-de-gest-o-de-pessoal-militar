import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const STATUS_CANCELAVEIS = new Set(['ativo', 'rascunho', 'pendente_publicacao', 'pendente']);
const ALERTA_PUBLICACAO = 'Ajuste cancelado no sistema. Verifique necessidade de regularização documental no RP.';
const normalizeEmail = (e) => String(e || '').trim().toLowerCase();
const normalize = (v) => String(v ?? '').trim();

async function assertAdminFerias(base44, authUser) {
  if (String(authUser?.role || '').toLowerCase() === 'admin') return;
  const acessos = await base44.asServiceRole.entities.UsuarioAcesso
    .filter({ user_email: normalizeEmail(authUser?.email), ativo: true }, undefined, 100, 0)
    .catch(() => []);
  if ((acessos || []).some((a) => String(a?.tipo_acesso || '').trim().toLowerCase() === 'admin')) return;
  throw Object.assign(new Error('Acesso negado: operação restrita a administradores do módulo Férias.'), { status: 403 });
}

function anexarAuditoriaObservacoes(observacoes, texto) {
  return [normalize(observacoes), texto].filter(Boolean).join('\n');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return Response.json({ error: 'Não autenticado.' }, { status: 401 });
    await assertAdminFerias(base44, authUser);

    let payload = {};
    try { payload = await req.json(); } catch (_e) { payload = {}; }

    const ajusteId = normalize(payload?.ajuste_id);
    const motivoCancelamento = normalize(payload?.motivo_cancelamento);
    const effectiveEmail = normalizeEmail(payload?.effectiveEmail || authUser.email);

    if (!ajusteId) return Response.json({ error: 'ajuste_id é obrigatório.' }, { status: 400 });
    if (!motivoCancelamento) return Response.json({ error: 'motivo_cancelamento é obrigatório.' }, { status: 400 });

    const ajuste = await base44.asServiceRole.entities.AjusteSaldoFerias.get(ajusteId).catch(() => null);
    if (!ajuste) return Response.json({ error: 'Ajuste de saldo de férias não encontrado.' }, { status: 404 });

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
