import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// =====================================================================
// ativarDescontoFeriasPublicado — Fase 2 (Ativação do Desconto)
// ---------------------------------------------------------------------
// Quando uma PublicacaoExOfficio do tipo "Dispensa com Desconto em Férias"
// chega a Publicado, localiza o DescontoFerias vinculado (publicacao_id) e
// aplica o abatimento no PeriodoAquisitivo.
//
// Condições obrigatórias para aplicar o saldo:
//   - publicacao.tipo = "Dispensa com Desconto em Férias";
//   - publicacao.status = "Publicado" (ou equivalente: possui BG/data);
//   - existe DescontoFerias vinculado por publicacao_id;
//   - DescontoFerias.status = pendente_publicacao;
//   - DescontoFerias.saldo_aplicado !== true.
//
// Ao ativar:
//   - DescontoFerias.status -> ativo;
//   - DescontoFerias.saldo_aplicado -> true;
//   - PeriodoAquisitivo.dias_direito abatido pelos dias do desconto;
//   - auditoria textual no DescontoFerias.observacoes.
//
// Idempotência: se saldo_aplicado já for true OU status já for ativo,
// não aplica novamente (retorna ja_aplicado=true).
//
// NÃO aplica quando: publicação Aguardando Nota/Publicação, ou desconto
// cancelado/revertido. Esta fase NÃO faz reversão.
// =====================================================================

const TIPO_INTERNO = 'Dispensa com Desconto em Férias';
const normalizeEmail = (e) => String(e || '').trim().toLowerCase();

function publicacaoEstaPublicada(pub = {}) {
  if (String(pub.status || '').trim() === 'Publicado') return true;
  // Equivalência padrão do RP: possui BG/data caracteriza Publicado.
  return Boolean(pub.numero_bg && pub.data_bg);
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

    // ---- Carregar publicação ----
    const publicacao = await base44.asServiceRole.entities.PublicacaoExOfficio
      .get(publicacaoId).catch(() => null);
    if (!publicacao) {
      return Response.json({ error: 'Publicação não encontrada.' }, { status: 404 });
    }

    // ---- Condição: tipo correto ----
    if (String(publicacao.tipo || '').trim() !== TIPO_INTERNO) {
      return Response.json({ ok: true, aplicado: false, motivo: 'tipo_nao_aplicavel' });
    }

    // ---- Condição: publicação publicada (com BG/data) ----
    if (!publicacaoEstaPublicada(publicacao)) {
      return Response.json({ ok: true, aplicado: false, motivo: 'publicacao_nao_publicada' });
    }

    if (String(publicacao.status || '').trim() !== 'Publicado' && publicacao.numero_bg && publicacao.data_bg) {
      await base44.asServiceRole.entities.PublicacaoExOfficio.update(publicacao.id, {
        status: 'Publicado',
      });
    }

    // ---- Condição: existe desconto vinculado ----
    const vinculados = await base44.asServiceRole.entities.DescontoFerias
      .filter({ publicacao_id: publicacaoId }).catch(() => []);
    const desconto = (vinculados || [])[0];
    if (!desconto) {
      return Response.json({ ok: true, aplicado: false, motivo: 'desconto_nao_encontrado' });
    }

    // ---- Idempotência: já aplicado / já ativo ----
    if (desconto.saldo_aplicado === true || String(desconto.status || '') === 'ativo') {
      return Response.json({ ok: true, aplicado: false, ja_aplicado: true, descontoFerias: desconto });
    }

    // ---- Não aplicar para descontos cancelados/revertidos ----
    if (['cancelado', 'revertido'].includes(String(desconto.status || ''))) {
      return Response.json({ ok: true, aplicado: false, motivo: `desconto_${desconto.status}` });
    }

    // ---- Condição: status deve ser pendente_publicacao ----
    if (String(desconto.status || '') !== 'pendente_publicacao') {
      return Response.json({ ok: true, aplicado: false, motivo: 'status_desconto_invalido' });
    }

    const dias = Math.max(0, Number(desconto.dias) || 0);
    if (dias <= 0) {
      return Response.json({ error: 'Desconto sem dias válidos para aplicar.' }, { status: 400 });
    }

    // ---- Carregar período aquisitivo ----
    const periodo = await base44.asServiceRole.entities.PeriodoAquisitivo
      .get(desconto.periodo_aquisitivo_id).catch(() => null);
    if (!periodo) {
      return Response.json({ error: 'Período aquisitivo vinculado não encontrado.' }, { status: 404 });
    }

    // ---- Aplicar abatimento no saldo (reduz dias_direito) ----
    const diasDireitoAtual = Number.isFinite(Number(periodo.dias_direito)) ? Number(periodo.dias_direito) : 30;
    const diasDireitoNovo = Math.max(0, diasDireitoAtual - dias);

    await base44.asServiceRole.entities.PeriodoAquisitivo.update(periodo.id, {
      dias_direito: diasDireitoNovo,
    });

    // ---- Atualizar o desconto (status + saldo_aplicado + auditoria) ----
    const carimbo = new Date().toISOString();
    const auditoriaTexto = `[${carimbo}] Saldo aplicado por publicação ${publicacaoId} (status Publicado). ` +
      `Abatidos ${dias}d do período ${periodo.ano_referencia || periodo.id}: dias_direito ${diasDireitoAtual} -> ${diasDireitoNovo}. ` +
      `Acionado por ${normalizeEmail(authUser.email)}.`;
    const observacoesNovas = [String(desconto.observacoes || '').trim(), auditoriaTexto]
      .filter(Boolean).join('\n');

    const descontoAtualizado = await base44.asServiceRole.entities.DescontoFerias.update(desconto.id, {
      status: 'ativo',
      saldo_aplicado: true,
      observacoes: observacoesNovas,
    });

    return Response.json({
      ok: true,
      aplicado: true,
      descontoFerias: descontoAtualizado,
      periodo: { id: periodo.id, dias_direito_anterior: diasDireitoAtual, dias_direito_novo: diasDireitoNovo },
    });
  } catch (error) {
    const status = error?.response?.status || error?.status || 500;
    console.error('[ativarDescontoFeriasPublicado] erro', { message: error?.message, status });
    return Response.json({ error: error?.message || 'Erro ao ativar desconto em férias.' }, { status });
  }
});
