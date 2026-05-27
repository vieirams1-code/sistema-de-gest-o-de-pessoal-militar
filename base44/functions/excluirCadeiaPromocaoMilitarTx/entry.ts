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
    const promocaoMilitarId = texto(payload?.promocaoMilitarId);
    const motivo = texto(payload?.motivo);

    if (!promocaoMilitarId) return Response.json({ success: false, etapa: 'validacao', motivo: 'item_nao_informado' }, { status: 400 });
    if (!motivo) return Response.json({ success: false, etapa: 'validacao', motivo: 'motivo_obrigatorio' }, { status: 400 });

    const PromocaoMilitar = base44.asServiceRole.entities.PromocaoMilitar;
    const Promocao = base44.asServiceRole.entities.Promocao;
    const Historico = base44.asServiceRole.entities.HistoricoPromocaoMilitarV2;
    const Militar = base44.asServiceRole.entities.Militar;

    const item = await PromocaoMilitar.get(promocaoMilitarId);
    if (!item?.id) return Response.json({ success: false, etapa: 'validacao', motivo: 'item_nao_encontrado' }, { status: 404 });
    if (!texto(item?.promocao_id)) return Response.json({ success: false, etapa: 'validacao', motivo: 'item_sem_promocao' }, { status: 400 });

    const historicoId = texto(item?.historico_promocao_v2_id);
    const historico = historicoId ? await Historico.get(historicoId) : null;

    const precisaRollbackCadastro = Boolean(item?.atualizar_cadastro_militar) || normalizar(item?.resultado_aplicacao_cadastro) === 'imediatamente_superior';
    let militarAnterior: any = null;
    if (precisaRollbackCadastro) {
      militarAnterior = await Militar.get(item?.militar_id);
      if (!militarAnterior?.id) return Response.json({ success: false, etapa: 'validacao', motivo: 'militar_nao_encontrado' }, { status: 404 });
      if (texto(militarAnterior?.posto_graduacao) !== texto(historico?.posto_graduacao_novo) || texto(militarAnterior?.quadro) !== texto(historico?.quadro_novo)) {
        return Response.json({ success: false, etapa: 'validacao', motivo: 'rollback_cadastro_bloqueado_divergencia' }, { status: 409 });
      }
    }

    const promocaoId = texto(item.promocao_id);
    const vinculados = typeof PromocaoMilitar.filter === 'function'
      ? await PromocaoMilitar.filter({ promocao_id: promocaoId })
      : (await PromocaoMilitar.list()).filter((registro: any) => texto(registro?.promocao_id) === promocaoId);

    const vinculadosPosExclusao = (vinculados || []).filter((registro: any) => texto(registro?.id) !== texto(item.id));
    const statusPromocao = statusPromocaoPosReversao(vinculadosPosExclusao);

    try {
      if (precisaRollbackCadastro) {
        await Militar.update(militarAnterior.id, {
          posto_graduacao: texto(historico?.posto_graduacao_anterior),
          quadro: texto(historico?.quadro_anterior),
        });
      }
      if (historicoId) await Historico.delete(historicoId);
      await PromocaoMilitar.delete(item.id);

      if (vinculadosPosExclusao.length === 0) {
        await Promocao.delete(promocaoId);
        return Response.json({ success: true, promocaoExcluida: true, promocaoMilitarExcluido: true, historicoExcluido: Boolean(historicoId), cadastroRestaurado: Boolean(precisaRollbackCadastro) });
      }

      await Promocao.update(promocaoId, { status: statusPromocao });
      return Response.json({ success: true, promocaoExcluida: false, promocaoMilitarExcluido: true, historicoExcluido: Boolean(historicoId), cadastroRestaurado: Boolean(precisaRollbackCadastro) });
    } catch (error: any) {
      return Response.json({ success: false, etapa: 'transacao', motivo: error?.message || 'falha_exclusao' }, { status: 500 });
    }
  } catch (error: any) {
    return Response.json({ success: false, etapa: 'erro_interno', motivo: error?.message || 'erro_interno_exclusao' }, { status: 500 });
  }
});
