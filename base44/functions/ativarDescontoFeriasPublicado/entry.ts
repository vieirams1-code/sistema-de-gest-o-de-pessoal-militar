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
//   - AjusteSaldoFerias vinculado -> ativo;
//   - NÃO altera PeriodoAquisitivo nem cálculo oficial nesta fase;
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

async function upsertAjusteDescontoFerias(base44, desconto, overrides = {}) {
  if (!desconto?.id) return null;
  const existentes = await base44.asServiceRole.entities.AjusteSaldoFerias
    .filter({ entidade_origem: 'DescontoFerias', entidade_origem_id: desconto.id })
    .catch(() => []);
  const existente = (existentes || [])[0];
  const data = {
    militar_id: desconto.militar_id || '',
    militar_nome: desconto.militar_nome || '',
    periodo_aquisitivo_id: desconto.periodo_aquisitivo_id || '',
    periodo_aquisitivo_ref: desconto.periodo_aquisitivo_ref || '',
    tipo: 'debito',
    dias: Math.max(0, Number(desconto.dias) || 0),
    motivo: 'Desconto em férias',
    origem: 'desconto_ferias',
    status: 'ativo',
    publicacao_id: desconto.publicacao_id || '',
    entidade_origem: 'DescontoFerias',
    entidade_origem_id: desconto.id,
    observacoes: desconto.observacoes || '',
    criado_por_email: desconto.criado_por_email || '',
    ...overrides,
  };
  if (existente?.id) return base44.asServiceRole.entities.AjusteSaldoFerias.update(existente.id, data);
  return base44.asServiceRole.entities.AjusteSaldoFerias.create(data);
}

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
      const ajusteSaldoFerias = await upsertAjusteDescontoFerias(base44, desconto, { status: 'ativo' });
      return Response.json({ ok: true, aplicado: false, ja_aplicado: true, descontoFerias: desconto, ajusteSaldoFerias });
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

    // ---- Carregar período aquisitivo apenas para auditoria/retorno; não alterar saldo oficial nesta fase. ----
    const periodo = await base44.asServiceRole.entities.PeriodoAquisitivo
      .get(desconto.periodo_aquisitivo_id).catch(() => null);
    if (!periodo) {
      return Response.json({ error: 'Período aquisitivo vinculado não encontrado.' }, { status: 404 });
    }

    const diasDireitoAtual = Number.isFinite(Number(periodo.dias_direito)) ? Number(periodo.dias_direito) : 30;

    // ---- Atualizar o desconto (status + saldo_aplicado + auditoria) ----
    const carimbo = new Date().toISOString();
    const auditoriaTexto = `[${carimbo}] Desconto ativado por publicação ${publicacaoId} (status Publicado). ` +
      `Criado/ativado AjusteSaldoFerias de débito com ${dias}d para o período ${periodo.ano_referencia || periodo.id}. ` +
      `Nenhuma alteração realizada no cálculo oficial/dias_direito (${diasDireitoAtual}). ` +
      `Acionado por ${normalizeEmail(authUser.email)}.`;
    const observacoesNovas = [String(desconto.observacoes || '').trim(), auditoriaTexto]
      .filter(Boolean).join('\n');

    const descontoAtualizado = await base44.asServiceRole.entities.DescontoFerias.update(desconto.id, {
      status: 'ativo',
      saldo_aplicado: false,
      observacoes: observacoesNovas,
    });
    const ajusteSaldoFerias = await upsertAjusteDescontoFerias(base44, descontoAtualizado, {
      status: 'ativo',
      observacoes: observacoesNovas,
    });

    return Response.json({
      ok: true,
      aplicado: true,
      descontoFerias: descontoAtualizado,
      ajusteSaldoFerias,
      periodo: { id: periodo.id, dias_direito_anterior: diasDireitoAtual, dias_direito_novo: diasDireitoAtual },
    });
  } catch (error) {
    const status = error?.response?.status || error?.status || 500;
    console.error('[ativarDescontoFeriasPublicado] erro', { message: error?.message, status });
    return Response.json({ error: error?.message || 'Erro ao ativar desconto em férias.' }, { status });
  }
});
