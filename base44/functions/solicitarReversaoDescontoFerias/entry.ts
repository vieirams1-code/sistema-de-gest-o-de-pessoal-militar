import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const TIPO_DESCONTO = 'Dispensa com Desconto em Férias';
const TIPO_TSE = 'Tornar sem Efeito';
const STATUS_FERIAS_BLOQUEIO = ['Gozada', 'Finalizada', 'Retornada', 'Concluída', 'Encerrada'];
const normalizeEmail = (e) => String(e || '').trim().toLowerCase();
const isPublicado = (p = {}) => String(p.status || '').trim() === 'Publicado' || Boolean(p.numero_bg && p.data_bg);
const erro = (message, status = 400) => Response.json({ error: message }, { status });

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return erro('Não autenticado.', 401);
    let payload = {};
    try { payload = await req.json(); } catch (_e) { payload = {}; }

    const descontoId = String(payload?.desconto_ferias_id || '').trim();
    if (!descontoId) return erro('desconto_ferias_id é obrigatório.');
    const acionadoPor = normalizeEmail(payload?.effectiveEmail || authUser.email);

    const desconto = await base44.asServiceRole.entities.DescontoFerias.get(descontoId).catch(() => null);
    if (!desconto) return erro('Desconto em férias não encontrado.', 404);
    if (String(desconto.status || '') !== 'ativo') return erro('Somente descontos ativos podem solicitar reversão.');
    if (desconto.saldo_aplicado !== true) return erro('Somente descontos com saldo aplicado podem solicitar reversão.');
    if (!desconto.publicacao_id) return erro('Desconto sem publicação original vinculada.');

    const original = await base44.asServiceRole.entities.PublicacaoExOfficio.get(desconto.publicacao_id).catch(() => null);
    if (!original) return erro('Publicação original do desconto não encontrada.', 404);
    if (!isPublicado(original)) return erro('A publicação original precisa estar publicada.');

    const existentes = await base44.asServiceRole.entities.PublicacaoExOfficio
      .filter({ publicacao_referencia_id: original.id }).catch(() => []);
    const tseExistente = (existentes || []).find((p) => String(p?.tipo || '') === TIPO_TSE && ['Aguardando Nota', 'Aguardando Publicação', 'Publicado'].includes(String(p?.status || '')));
    if (tseExistente) return erro('Já existe Tornar sem Efeito pendente ou publicado para esta publicação original.');

    const ferias = await base44.asServiceRole.entities.Ferias.filter({ periodo_aquisitivo_id: desconto.periodo_aquisitivo_id }).catch(() => []);
    if ((ferias || []).some((f) => STATUS_FERIAS_BLOQUEIO.includes(String(f?.status || '').trim()))) {
      return erro('Não é permitido reverter desconto de período com férias já gozada/finalizada/retornada/concluída/encerrada.');
    }
    const feriasIds = new Set((ferias || []).map((f) => String(f?.id || '')).filter(Boolean));
    const registros = await base44.asServiceRole.entities.RegistroLivro.filter({ militar_id: desconto.militar_id }).catch(() => []);
    if ((registros || []).some((r) => String(r?.tipo_registro || '') === 'Retorno Férias' && (feriasIds.has(String(r?.ferias_id || '')) || String(r?.periodo_aquisitivo_id || '') === String(desconto.periodo_aquisitivo_id)))) {
      return erro('Não é permitido reverter desconto com Retorno Férias vinculado ao mesmo período/família.');
    }

    const texto = `Torna sem efeito a publicação original de ${TIPO_DESCONTO}${original.numero_bg ? `, BG nº ${original.numero_bg}` : ''}${original.data_bg ? ` de ${original.data_bg}` : ''}, referente ao desconto em férias de ${desconto.militar_posto || ''} ${desconto.militar_nome || original.militar_nome || ''}, restituindo ${Number(desconto.dias) || 0} dia(s) somente após esta publicação em BG.`;
    const tse = await base44.asServiceRole.entities.PublicacaoExOfficio.create({
      militar_id: original.militar_id || desconto.militar_id,
      militar_nome: original.militar_nome || desconto.militar_nome || '',
      militar_posto: original.militar_posto || desconto.militar_posto || '',
      militar_matricula: original.militar_matricula || desconto.militar_matricula || '',
      tipo: TIPO_TSE,
      publicacao_referencia_id: original.id,
      publicacao_referencia_origem_tipo: 'exofficio',
      publicacao_referencia_tipo_label: TIPO_DESCONTO,
      publicacao_referencia_numero_bg: original.numero_bg || '',
      publicacao_referencia_data_bg: original.data_bg || '',
      publicacao_referencia_nota: original.nota_para_bg || '',
      texto_publicacao: texto,
      data_publicacao: '',
      status: 'Aguardando Nota',
      observacoes: `Solicitação de reversão do DescontoFerias ${desconto.id}. Acionado por ${acionadoPor}.`,
      criado_por_email: acionadoPor,
    });

    const carimbo = new Date().toISOString();
    await base44.asServiceRole.entities.DescontoFerias.update(desconto.id, {
      observacoes: [String(desconto.observacoes || '').trim(), `[${carimbo}] Reversão solicitada: criada publicação Tornar sem Efeito ${tse.id}. Saldo ainda não restituído. Acionado por ${acionadoPor}.`].filter(Boolean).join('\n'),
    });

    return Response.json({ ok: true, publicacao: tse });
  } catch (error) {
    const status = error?.response?.status || error?.status || 500;
    console.error('[solicitarReversaoDescontoFerias] erro', { message: error?.message, status });
    return Response.json({ error: error?.message || 'Erro ao solicitar reversão de desconto em férias.' }, { status });
  }
});
