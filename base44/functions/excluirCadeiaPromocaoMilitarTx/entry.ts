import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

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
    if (c && typeof c === 'object') {
      const payload = c.body || c.data || c;
      if (payload.promocaoMilitarId) return payload;
    }
  }
  return {};
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  let promocaoId = '';
  let token = '';
  let manterTrava = false;
  let journalId = '';
  try {
    const authUser = await base44.auth.me();
    if (!authUser) return Response.json({ success: false, etapa: 'autorizacao', motivo: 'nao_autenticado' }, { status: 401 });
    if (String(authUser.role || '').trim().toLowerCase() !== 'admin') {
      return Response.json({ success: false, etapa: 'autorizacao', motivo: 'requer_administrador_plataforma' }, { status: 403 });
    }
    const payload = await parsePayload(req);
    const promocaoMilitarId = texto(payload?.promocaoMilitarId);
    const motivo = texto(payload?.motivo);

    if (!promocaoMilitarId) return Response.json({ success: false, etapa: 'validacao', motivo: 'item_nao_informado' }, { status: 400 });
    if (!motivo) return Response.json({ success: false, etapa: 'validacao', motivo: 'motivo_obrigatorio' }, { status: 400 });

    const PromocaoMilitar = base44.asServiceRole.entities.PromocaoMilitar;
    const Promocao = base44.asServiceRole.entities.Promocao;
    const Historico = base44.asServiceRole.entities.HistoricoPromocaoMilitarV2;
    // A exclusão nunca restaura cadastro: somente a reversão oficial pode fazê-lo.
    let item = await PromocaoMilitar.get(promocaoMilitarId);
    if (!item?.id || !texto(item.promocao_id)) return Response.json({success:false,motivo:'item_sem_promocao'},{status:409});
    promocaoId = texto(item.promocao_id);
    const candidato = crypto.randomUUID();
    const trava = await Promocao.updateMany({id:promocaoId,$or:[{operacao_token:''},{operacao_token:null},{operacao_token:{$exists:false}}]},{$set:{operacao_token:candidato}});
    if (trava?.success !== true || trava.updated !== 1) return Response.json({success:false,motivo:'operacao_oficial_em_andamento'},{status:409});
    token = candidato;
    item = await PromocaoMilitar.get(promocaoMilitarId);
    const promocao = await Promocao.get(promocaoId);
    if (texto(item.promocao_id) !== promocaoId) return Response.json({success:false,motivo:'vinculo_alterado'},{status:409});
    if (item.publicado || !['cancelado','cancelada','retificado','retificada'].includes(normalizar(item.status))) return Response.json({success:false,motivo:'exclusao_exige_reversao_previa'},{status:409});
    const precisaRollbackCadastro = Boolean(item.atualizar_cadastro_militar) || normalizar(item.resultado_aplicacao_cadastro) === 'imediatamente_superior';
    if (precisaRollbackCadastro) return Response.json({success:false,motivo:'exclusao_exige_reversao_cadastral_confirmada'},{status:409});
    const historicoId = texto(item.historico_promocao_v2_id);
    const historico = historicoId ? await Historico.get(historicoId) : null;
    if (historico && (texto(historico.promocao_id) !== promocaoId || texto(historico.militar_id) !== texto(item.militar_id) || !['cancelado','cancelada','retificado','retificada'].includes(normalizar(historico.status_registro)))) return Response.json({success:false,motivo:'historico_nao_cancelado_ou_vinculo_divergente'},{status:409});

    const vinculados = typeof PromocaoMilitar.filter === 'function'
      ? await PromocaoMilitar.filter({ promocao_id: promocaoId })
      : (await PromocaoMilitar.list()).filter((registro: any) => texto(registro?.promocao_id) === promocaoId);

    const vinculadosPosExclusao = (vinculados || []).filter((registro: any) => texto(registro?.id) !== texto(item.id));
    const statusPromocao = statusPromocaoPosReversao(vinculadosPosExclusao);

    const journal = await base44.asServiceRole.entities.AssistenteLog.create({tipo:'exclusao_promocao',acao:'exclusao_cadeia_iniciada',descricao:motivo,
      metadata:{promocao_id:promocaoId,item_id:item.id,executado_por:authUser.email,item_antes:item,historico_antes:historico,promocao_antes:promocao}});
    if (!journal?.id) throw new Error('journal_exclusao_nao_confirmado');
    journalId = journal.id;
    try {
      if (historicoId) await Historico.delete(historicoId);
      await PromocaoMilitar.delete(item.id);

      const historicosRestantes = await Historico.filter({promocao_id:promocaoId},undefined,5000);
      if (vinculadosPosExclusao.length === 0 && historicosRestantes.length === 0) {
        await Promocao.delete(promocaoId);
        return Response.json({ success: true, promocaoExcluida: true, promocaoMilitarExcluido: true, historicoExcluido: Boolean(historicoId), cadastroRestaurado: false, journal_id:journalId });
      }

      await Promocao.update(promocaoId, { status: statusPromocao });
      return Response.json({ success: true, promocaoExcluida: false, promocaoMilitarExcluido: true, historicoExcluido: Boolean(historicoId), cadastroRestaurado: false, journal_id:journalId });
    } catch (error: any) {
      manterTrava = true;
      return Response.json({ success: false, etapa: 'transacao', motivo: error?.message || 'falha_exclusao',reconciliacao_pendente:true,journal_id:journalId }, { status: 500 });
    }
  } catch (error: any) {
    return Response.json({ success: false, etapa: 'erro_interno', motivo: error?.message || 'erro_interno_exclusao' }, { status: 500 });
  } finally {
    if (token && !manterTrava) {
      try { await base44.asServiceRole.entities.Promocao.updateMany({id:promocaoId,operacao_token:token},{$set:{operacao_token:''}}); }
      catch (_) { console.error('Trava de exclusão mantida para reconciliação',promocaoId); }
    }
  }
});
