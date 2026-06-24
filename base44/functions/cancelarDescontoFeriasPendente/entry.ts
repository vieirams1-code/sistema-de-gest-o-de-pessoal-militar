import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// =====================================================================
// cancelarDescontoFeriasPendente — Proteção contra órfãos (Fase 3A)
// ---------------------------------------------------------------------
// Cancela de forma idempotente um DescontoFerias ainda pendente antes da
// exclusão física da PublicacaoExOfficio vinculada no painel Publicações.
//
// Regras:
//   - somente para PublicacaoExOfficio tipo "Dispensa com Desconto em Férias";
//   - recusa se a publicação já possui BG/data ou status Publicado;
//   - recusa se o desconto está ativo ou saldo_aplicado=true;
//   - se já estiver cancelado, retorna sucesso;
//   - se pendente_publicacao e saldo_aplicado=false, marca como cancelado;
//   - nunca altera PeriodoAquisitivo nem saldo.
// =====================================================================

const TIPO_INTERNO = 'Dispensa com Desconto em Férias';
const MENSAGEM_REVERSAO = 'Este desconto já foi publicado. Use Solicitar Reversão em Descontos em Férias.';
const normalizeEmail = (e) => String(e || '').trim().toLowerCase();

function publicacaoEstaPublicada(pub = {}) {
  if (String(pub.status || '').trim() === 'Publicado') return true;
  return Boolean(pub.numero_bg || pub.data_bg);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return Response.json({ error: 'Não autenticado.' }, { status: 401 });

    let payload = {};
    try { payload = await req.json(); } catch (_e) { payload = {}; }

    const publicacaoId = String(payload?.publicacao_id || '').trim();
    if (!publicacaoId) {
      return Response.json({ error: 'publicacao_id é obrigatório.' }, { status: 400 });
    }

    const publicacao = await base44.asServiceRole.entities.PublicacaoExOfficio
      .get(publicacaoId).catch(() => null);
    if (!publicacao) {
      return Response.json({ error: 'Publicação não encontrada.' }, { status: 404 });
    }

    if (String(publicacao.tipo || '').trim() !== TIPO_INTERNO) {
      return Response.json({ ok: true, cancelado: false, motivo: 'tipo_nao_aplicavel' });
    }

    if (publicacaoEstaPublicada(publicacao)) {
      return Response.json({ error: MENSAGEM_REVERSAO, motivo: 'publicacao_publicada' }, { status: 409 });
    }

    const vinculados = await base44.asServiceRole.entities.DescontoFerias
      .filter({ publicacao_id: publicacaoId }).catch(() => []);
    const desconto = (vinculados || [])[0];
    if (!desconto) {
      return Response.json({ ok: true, cancelado: false, motivo: 'desconto_nao_encontrado' });
    }

    if (String(desconto.status || '') === 'cancelado') {
      return Response.json({ ok: true, cancelado: false, ja_cancelado: true, descontoFerias: desconto });
    }

    if (desconto.saldo_aplicado === true || String(desconto.status || '') === 'ativo') {
      return Response.json({ error: MENSAGEM_REVERSAO, motivo: 'desconto_ativo_ou_saldo_aplicado' }, { status: 409 });
    }

    if (String(desconto.status || '') !== 'pendente_publicacao') {
      return Response.json({ error: 'Desconto em férias não está pendente de publicação e não pode ser cancelado por exclusão.' }, { status: 409 });
    }

    const carimbo = new Date().toISOString();
    const auditoriaTexto = `[${carimbo}] Desconto cancelado por exclusão da publicação pendente ${publicacaoId}. ` +
      `Nenhuma alteração de saldo/período aquisitivo realizada. Acionado por ${normalizeEmail(authUser.email)}.`;
    const observacoesNovas = [String(desconto.observacoes || '').trim(), auditoriaTexto]
      .filter(Boolean).join('\n');

    const descontoAtualizado = await base44.asServiceRole.entities.DescontoFerias.update(desconto.id, {
      status: 'cancelado',
      saldo_aplicado: false,
      observacoes: observacoesNovas,
    });

    return Response.json({ ok: true, cancelado: true, descontoFerias: descontoAtualizado });
  } catch (error) {
    const status = error?.response?.status || error?.status || 500;
    console.error('[cancelarDescontoFeriasPendente] erro', { message: error?.message, status });
    return Response.json({ error: error?.message || 'Erro ao cancelar desconto em férias pendente.' }, { status });
  }
});
