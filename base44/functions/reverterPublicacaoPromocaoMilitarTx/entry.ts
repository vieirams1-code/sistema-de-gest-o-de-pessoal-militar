import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const texto = (valor: unknown) => String(valor ?? '').trim();
const normalizar = (valor: unknown) => texto(valor).toLowerCase();

function statusPromocaoPosReversao(itens: any[] = []) {
  const publicados = (itens || []).filter((item) => Boolean(item?.publicado) && normalizar(item?.status) === 'publicado').length;
  if (publicados === 0) return 'rascunho';
  if (publicados < (itens || []).length) return 'publicada_parcial';
  return 'publicada';
}

async function parsePayload(req: any) {
  const candidates: any[] = [req?.body, req?.body?.data, req?.data, req?.payload, (globalThis as any)?.input];
  try { if (typeof req?.json === 'function') candidates.push(await req.json()); } catch (_) {}
  for (const c of candidates) {
    if (c && typeof c === 'object') return c?.data && typeof c.data === 'object' ? c.data : c;
  }
  return {};
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  try {
    const payload = await parsePayload(req);
    const promocao = payload?.promocao || {};
    const item = payload?.item || {};
    const itensPromocao = Array.isArray(payload?.itensPromocao) ? payload.itensPromocao : [];
    const motivo = texto(payload?.motivo);
    const observacoes = texto(payload?.observacoes);
    const usuario = payload?.usuario || null;

    if (!texto(promocao?.id)) return Response.json({ success: false, etapa: 'validacao', motivo: 'promocao_nao_carregada' }, { status: 400 });
    if (!texto(item?.id)) return Response.json({ success: false, etapa: 'validacao', motivo: 'item_nao_carregado' }, { status: 400 });
    if (!texto(item?.historico_promocao_v2_id)) return Response.json({ success: false, etapa: 'validacao', motivo: 'historico_ausente' }, { status: 400 });
    if (!motivo) return Response.json({ success: false, etapa: 'validacao', motivo: 'motivo_obrigatorio' }, { status: 400 });

    const Historico = base44.asServiceRole.entities.HistoricoPromocaoMilitarV2;
    const PromocaoMilitar = base44.asServiceRole.entities.PromocaoMilitar;
    const Promocao = base44.asServiceRole.entities.Promocao;
    const Militar = base44.asServiceRole.entities.Militar;

    const historicoId = texto(item.historico_promocao_v2_id);
    const historicoAtual = await Historico.get(historicoId);
    const itemAtual = await PromocaoMilitar.get(item.id);
    if (!historicoAtual?.id || !itemAtual?.id) return Response.json({ success: false, etapa: 'validacao', motivo: 'registros_nao_encontrados' }, { status: 404 });

    let militarAnterior: any = null;
    const precisaRollbackCadastro = Boolean(itemAtual?.atualizar_cadastro_militar) || normalizar(itemAtual?.resultado_aplicacao_cadastro) === 'imediatamente_superior';
    if (precisaRollbackCadastro) {
      militarAnterior = await Militar.get(itemAtual?.militar_id);
      if (!militarAnterior?.id) return Response.json({ success: false, etapa: 'validacao', motivo: 'militar_nao_encontrado' }, { status: 404 });
      if (texto(militarAnterior?.posto_graduacao) !== texto(historicoAtual?.posto_graduacao_novo) || texto(militarAnterior?.quadro) !== texto(historicoAtual?.quadro_novo)) {
        return Response.json({ success: false, etapa: 'validacao', motivo: 'rollback_cadastro_bloqueado_divergencia' }, { status: 409 });
      }
    }

    const trilhaAdmin = ['[REVERSAO_ADMINISTRATIVA]', `motivo=${motivo}`, observacoes ? `observacoes=${observacoes}` : '', texto(usuario?.email) ? `usuario=${texto(usuario.email)}` : '', `data=${new Date().toISOString()}`].filter(Boolean).join(' | ');
    const historicoSnapshot = { status_registro: historicoAtual?.status_registro, motivo_retificacao: historicoAtual?.motivo_retificacao, observacoes: historicoAtual?.observacoes };
    const itemSnapshot = { status: itemAtual?.status, publicado: itemAtual?.publicado };
    const promocaoAtual = await Promocao.get(promocao.id);
    const promocaoSnapshot = { status: promocaoAtual?.status };
    const statusPromocao = statusPromocaoPosReversao((itensPromocao || []).map((registro: any) => (String(registro?.id) === String(itemAtual.id) ? { ...registro, status: 'cancelado', publicado: false } : registro)));

    try {
      await Historico.update(historicoId, { status_registro: 'cancelado', motivo_retificacao: motivo, observacoes: [texto(historicoAtual?.observacoes), trilhaAdmin].filter(Boolean).join('\n') });
      if (precisaRollbackCadastro) await Militar.update(militarAnterior.id, { posto_graduacao: texto(historicoAtual?.posto_graduacao_anterior), quadro: texto(historicoAtual?.quadro_anterior) });
      await PromocaoMilitar.update(itemAtual.id, { status: 'cancelado', publicado: false });
      await Promocao.update(promocao.id, { status: statusPromocao });
    } catch (error: any) {
      try { await Historico.update(historicoId, historicoSnapshot); } catch (_) {}
      try { await PromocaoMilitar.update(itemAtual.id, itemSnapshot); } catch (_) {}
      try { await Promocao.update(promocao.id, promocaoSnapshot); } catch (_) {}
      if (precisaRollbackCadastro && militarAnterior?.id) {
        try { await Militar.update(militarAnterior.id, { posto_graduacao: militarAnterior?.posto_graduacao, quadro: militarAnterior?.quadro }); } catch (_) {}
      }
      return Response.json({ success: false, etapa: 'transacao', motivo: error?.message || 'falha_reversao' }, { status: 500 });
    }

    return Response.json({ success: true, historicoCancelado: true, cadastroRestaurado: Boolean(precisaRollbackCadastro), promocaoRecalculada: true, statusPromocao });
  } catch (error: any) {
    return Response.json({ success: false, etapa: 'erro_interno', motivo: error?.message || 'erro_interno_reversao' }, { status: 500 });
  }
});
