import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const TIPO_DESCONTO = 'Dispensa com Desconto em Férias';
const TIPO_TSE = 'Tornar sem Efeito';
const STATUS_FERIAS_BLOQUEIO = ['Gozada', 'Finalizada', 'Retornada', 'Concluída', 'Encerrada'];
const normalizeEmail = (e) => String(e || '').trim().toLowerCase();
const isPublicado = (p = {}) => String(p.status || '').trim() === 'Publicado' || Boolean(p.numero_bg && p.data_bg);
const erro = (message, status = 400) => Response.json({ error: message }, { status });

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
    status: 'revertido',
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return erro('Não autenticado.', 401);
    let payload = {};
    try { payload = await req.json(); } catch (_e) { payload = {}; }
    const publicacaoId = String(payload?.publicacao_id || '').trim();
    if (!publicacaoId) return erro('publicacao_id é obrigatório.');
    const acionadoPor = normalizeEmail(payload?.effectiveEmail || authUser.email);

    const tse = await base44.asServiceRole.entities.PublicacaoExOfficio.get(publicacaoId).catch(() => null);
    if (!tse) return erro('Publicação Tornar sem Efeito não encontrada.', 404);
    if (String(tse.tipo || '') !== TIPO_TSE) return Response.json({ ok: true, aplicado: false, motivo: 'tipo_nao_aplicavel' });
    if (!tse.publicacao_referencia_id) return erro('Tornar sem Efeito sem publicação de referência.');
    if (!isPublicado(tse)) return Response.json({ ok: true, aplicado: false, motivo: 'tse_nao_publicado' });

    if (String(tse.status || '').trim() !== 'Publicado' && tse.numero_bg && tse.data_bg) {
      await base44.asServiceRole.entities.PublicacaoExOfficio.update(tse.id, { status: 'Publicado' });
    }

    const original = await base44.asServiceRole.entities.PublicacaoExOfficio.get(tse.publicacao_referencia_id).catch(() => null);
    if (!original) return erro('Publicação original não encontrada.', 404);
    if (String(original.tipo || '') !== TIPO_DESCONTO) return Response.json({ ok: true, aplicado: false, motivo: 'original_nao_desconto_ferias' });

    const [desconto] = await base44.asServiceRole.entities.DescontoFerias.filter({ publicacao_id: original.id }).catch(() => []);
    if (!desconto) return erro('Desconto em férias vinculado à publicação original não encontrado.', 404);

    if (String(desconto.status || '') === 'revertido') {
      const ajusteSaldoFerias = await upsertAjusteDescontoFerias(base44, desconto, { status: 'revertido' });
      return Response.json({ ok: true, aplicado: false, ja_aplicado: true, descontoFerias: desconto, ajusteSaldoFerias });
    }
    if (String(desconto.status || '') !== 'ativo') return erro('Somente desconto ativo pode ser revertido.');

    const ferias = await base44.asServiceRole.entities.Ferias.filter({ periodo_aquisitivo_id: desconto.periodo_aquisitivo_id }).catch(() => []);
    if ((ferias || []).some((f) => STATUS_FERIAS_BLOQUEIO.includes(String(f?.status || '').trim()))) {
      return erro('Não é permitido reverter desconto de período com férias já gozada/finalizada/retornada/concluída/encerrada.');
    }
    const feriasIds = new Set((ferias || []).map((f) => String(f?.id || '')).filter(Boolean));
    const registros = await base44.asServiceRole.entities.RegistroLivro.filter({ militar_id: desconto.militar_id }).catch(() => []);
    if ((registros || []).some((r) => String(r?.tipo_registro || '') === 'Retorno Férias' && (feriasIds.has(String(r?.ferias_id || '')) || String(r?.periodo_aquisitivo_id || '') === String(desconto.periodo_aquisitivo_id)))) {
      return erro('Não é permitido reverter desconto com Retorno Férias vinculado ao mesmo período/família.');
    }

    const periodo = await base44.asServiceRole.entities.PeriodoAquisitivo.get(desconto.periodo_aquisitivo_id).catch(() => null);
    if (!periodo) return erro('Período aquisitivo vinculado não encontrado.', 404);
    const dias = Math.max(0, Number(desconto.dias) || 0);
    if (dias <= 0) return erro('Desconto sem dias válidos para reverter.');
    const diasDireitoAtual = Number.isFinite(Number(periodo.dias_direito)) ? Number(periodo.dias_direito) : 30;
    const carimbo = new Date().toISOString();
    const auditoriaTexto = `[${carimbo}] Desconto revertido por Tornar sem Efeito ${tse.id} (BG ${tse.numero_bg || '—'} de ${tse.data_bg || '—'}). AjusteSaldoFerias de ${dias}d marcado como revertido para o período ${periodo.ano_referencia || periodo.id}. Nenhuma alteração realizada no cálculo oficial/dias_direito (${diasDireitoAtual}). Acionado por ${acionadoPor}.`;
    const descontoAtualizado = await base44.asServiceRole.entities.DescontoFerias.update(desconto.id, {
      status: 'revertido',
      saldo_aplicado: false,
      observacoes: [String(desconto.observacoes || '').trim(), auditoriaTexto].filter(Boolean).join('\n'),
    });
    const ajusteSaldoFerias = await upsertAjusteDescontoFerias(base44, descontoAtualizado, {
      status: 'revertido',
      observacoes: descontoAtualizado.observacoes || '',
    });

    return Response.json({ ok: true, aplicado: true, descontoFerias: descontoAtualizado, ajusteSaldoFerias, periodo: { id: periodo.id, dias_direito_anterior: diasDireitoAtual, dias_direito_novo: diasDireitoAtual } });
  } catch (error) {
    const status = error?.response?.status || error?.status || 500;
    console.error('[ativarReversaoDescontoFeriasPublicado] erro', { message: error?.message, status });
    return Response.json({ error: error?.message || 'Erro ao ativar reversão de desconto em férias.' }, { status });
  }
});
