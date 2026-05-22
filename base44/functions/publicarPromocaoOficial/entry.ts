import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const STATUS_PROMOCAO_PUBLICADA = new Set(['publicada', 'publicado', 'consolidada', 'consolidado']);
const STATUS_ITEM_BLOQUEADO_PUBLICACAO = new Set(['bloqueado', 'bloqueada', 'cancelado', 'cancelada', 'retificado', 'retificada']);

const texto = (valor: unknown) => String(valor ?? '').trim();
const normalizar = (valor: unknown) => texto(valor).toLowerCase();
const dataSomente = (valor: unknown) => texto(valor).split('T')[0];

function logDiagnosticoErro({ etapa, promocao_id = null, item_id = null, militar_id = null, payloadRecebido = null, motivo = '' }: any) {
  console.error('[publicarPromocaoOficial][erro]', { etapa, promocao_id, item_id, militar_id, payloadRecebido, motivo });
}

function montarErro({ etapa, motivo, promocao_id = null, item_id = null, militar_id = null, payloadRecebido = null }: any) {
  const erro = { success: false, etapa, motivo, promocao_id, item_id, militar_id };
  logDiagnosticoErro({ ...erro, payloadRecebido });
  return erro;
}

function validarEntrada(promocao_id: unknown, promocao: any, itens: any[], temAlteracoesPendentes: boolean) {
  const promocaoId = texto(promocao_id) || texto(promocao?.id) || null;
  if (!promocaoId) return montarErro({ etapa: 'validacao_entrada', motivo: 'promocao_id_ausente', promocao_id: null, payloadRecebido: { promocao, itens } });
  if (!promocao || Object.keys(promocao).length === 0) return montarErro({ etapa: 'validacao_entrada', motivo: 'promocao_nao_encontrada', promocao_id: promocaoId, payloadRecebido: { promocao, itens } });
  if (STATUS_PROMOCAO_PUBLICADA.has(normalizar(promocao?.status))) return montarErro({ etapa: 'validacao_entrada', motivo: 'promocao_ja_publicada', promocao_id: promocaoId, payloadRecebido: { promocao, itens } });
  if (!dataSomente(promocao?.data_promocao)) return montarErro({ etapa: 'validacao_entrada', motivo: 'promocao_sem_data', promocao_id: promocaoId, payloadRecebido: { promocao, itens } });
  if (!texto(promocao?.posto_graduacao)) return montarErro({ etapa: 'validacao_entrada', motivo: 'promocao_sem_posto', promocao_id: promocaoId, payloadRecebido: { promocao, itens } });
  if (!texto(promocao?.quadro)) return montarErro({ etapa: 'validacao_entrada', motivo: 'promocao_sem_quadro', promocao_id: promocaoId, payloadRecebido: { promocao, itens } });
  if (!Array.isArray(itens) || itens.length === 0) return montarErro({ etapa: 'validacao_entrada', motivo: 'itens_ausentes', promocao_id: promocaoId, payloadRecebido: { promocao, itens } });
  if (temAlteracoesPendentes) return montarErro({ etapa: 'validacao_entrada', motivo: 'alteracoes_pendentes', promocao_id: promocaoId, payloadRecebido: { promocao, itens } });

  const ordens = new Set<string>();
  for (const item of itens || []) {
    const itemId = texto(item?.id) || null;
    const militarId = texto(item?.militar_id) || null;
    const ordem = Number(item?.ordem);
    const status = normalizar(item?.status);

    if (!itemId) return montarErro({ etapa: 'validacao_entrada', motivo: 'item_sem_id', promocao_id: promocaoId, item_id: null, militar_id: militarId, payloadRecebido: item });
    if (!militarId) return montarErro({ etapa: 'validacao_entrada', motivo: 'militar_id_ausente', promocao_id: promocaoId, item_id: itemId, militar_id: null, payloadRecebido: item });
    if (!Number.isFinite(ordem) || ordem <= 0) return montarErro({ etapa: 'validacao_entrada', motivo: 'ordem_invalida', promocao_id: promocaoId, item_id: itemId, militar_id: militarId, payloadRecebido: item });
    if (ordens.has(String(ordem))) return montarErro({ etapa: 'validacao_entrada', motivo: 'duplicidade_ordem', promocao_id: promocaoId, item_id: itemId, militar_id: militarId, payloadRecebido: item });
    ordens.add(String(ordem));
    if (STATUS_ITEM_BLOQUEADO_PUBLICACAO.has(status)) return montarErro({ etapa: 'validacao_entrada', motivo: 'item_status_bloqueado', promocao_id: promocaoId, item_id: itemId, militar_id: militarId, payloadRecebido: item });
  }

  return null;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json().catch(() => ({}));

  try {
    const input = (globalThis as any)?.input;
    const payload = body ?? input ?? {};

    console.error(
      'PAYLOAD_RECEBIDO_BACKEND',
      JSON.stringify(req.body ?? input ?? payload, null, 2)
    );
    console.error('PAYLOAD_TIPO_BACKEND', typeof payload);
    console.error('PAYLOAD_KEYS_BACKEND', Object.keys(payload || {}));

    return Response.json({
      debug: true,
      payloadRecebido: payload,
    });
    const promocao_id = body?.promocao_id;
    const promocao = body?.promocao || {};
    const itens = Array.isArray(body?.itens) ? body.itens : [];
    const temAlteracoesPendentes = Boolean(body?.temAlteracoesPendentes);

    const erroValidacao = validarEntrada(promocao_id, promocao, itens, temAlteracoesPendentes);
    if (erroValidacao) {
      return Response.json({ ...erroValidacao, publicados: 0, militar_ids_afetados: [], historicos: [], warnings: [], errors: [erroValidacao] }, { status: 400 });
    }

    const Historico = base44.asServiceRole.entities.HistoricoPromocaoMilitarV2;
    const Militar = base44.asServiceRole.entities.Militar;
    const PromocaoMilitar = base44.asServiceRole.entities.PromocaoMilitar;
    const Promocao = base44.asServiceRole.entities.Promocao;

    const warnings: any[] = [];
    const errors: any[] = [];
    const historicos: any[] = [];
    const militarIdsAfetados = new Set<string>();
    let publicados = 0;

    const historicosAtivos = await Historico.filter({ status_registro: 'ativo' });

    for (const item of itens) {
      const promocaoId = texto(promocao_id) || texto(promocao?.id) || null;
      const itemId = texto(item?.id) || null;
      const militarId = texto(item?.militar_id) || null;
      try {
        const militarEncontrado = await Militar.get(item.militar_id).catch(() => null);
        if (!militarEncontrado) throw montarErro({ etapa: 'atualizar_militar', motivo: 'militar_nao_encontrado', promocao_id: promocaoId, item_id: itemId, militar_id: militarId, payloadRecebido: item });

        const payloadHistorico = {
          militar_id: militarId,
          promocao_id: promocaoId,
          posto_graduacao_anterior: texto(item?.militar?.posto_graduacao || item?.militar?.posto_graduacao_atual),
          quadro_anterior: texto(item?.militar?.quadro || item?.militar?.quadro_atual),
          posto_graduacao_novo: texto(promocao.posto_graduacao),
          quadro_novo: texto(promocao.quadro),
          data_promocao: dataSomente(promocao.data_promocao),
          data_publicacao: dataSomente(promocao.data_publicacao) || dataSomente(promocao.data_promocao),
          boletim_referencia: texto(promocao.boletim_referencia),
          ato_referencia: texto(promocao.ato_referencia),
          antiguidade_referencia_ordem: Number(item.ordem),
          origem_dado: 'publicacao_promocao',
          status_registro: 'ativo',
          observacoes: `Registro gerado pela publicação da promoção ${promocaoId}.`,
        };

        const historicoExistente = (historicosAtivos || []).find((h: any) => normalizar(h?.status_registro) === 'ativo' && texto(h?.militar_id) === militarId && normalizar(h?.posto_graduacao_novo) === normalizar(payloadHistorico.posto_graduacao_novo) && normalizar(h?.quadro_novo) === normalizar(payloadHistorico.quadro_novo) && dataSomente(h?.data_promocao) === dataSomente(payloadHistorico.data_promocao));

        let historico = historicoExistente;
        if (!historico) {
          historico = await Historico.create(payloadHistorico).catch(() => null);
          if (!historico?.id) throw montarErro({ etapa: 'criar_historico', motivo: 'historico_criacao_falhou', promocao_id: promocaoId, item_id: itemId, militar_id: militarId, payloadRecebido: payloadHistorico });
        } else if (!texto(historico?.promocao_id)) {
          historico = await Historico.update(historico.id, { promocao_id: promocaoId });
        }

        const atualizacaoMilitar = await Militar.update(item.militar_id, { posto_graduacao: texto(promocao.posto_graduacao), quadro: texto(promocao.quadro) }).catch(() => null);
        if (!atualizacaoMilitar) throw montarErro({ etapa: 'atualizar_militar', motivo: 'update_militar_falhou', promocao_id: promocaoId, item_id: itemId, militar_id: militarId, payloadRecebido: item });

        await PromocaoMilitar.update(item.id, { status: 'publicado', publicado: true, historico_promocao_v2_id: texto(historico?.id), atualizar_cadastro_militar: true, motivo_atualizacao_cadastro: 'Cadastro atualizado por publicação oficial via backend service-role.', resultado_aplicacao_cadastro: 'imediatamente_superior' });

        historicos.push({ promocao_militar_id: item.id, historico_promocao_v2_id: texto(historico?.id) });
        militarIdsAfetados.add(militarId);
        publicados += 1;
      } catch (error: any) {
        const erroItem = error?.motivo ? error : montarErro({ etapa: 'processar_item', motivo: 'falha_publicacao_item', promocao_id: promocaoId, item_id: itemId, militar_id: militarId, payloadRecebido: item });
        errors.push({ ...erroItem, message: erroItem?.motivo || error?.message || 'Falha ao publicar item.' });
      }
    }

    const promocaoId = texto(promocao_id) || texto(promocao?.id) || null;
    if (!promocaoId) throw montarErro({ etapa: 'validacao_entrada', motivo: 'promocao_id_ausente', payloadRecebido: body });
    await Promocao.update(promocaoId, { status: errors.length > 0 ? 'rascunho' : 'publicada' });

    return Response.json({ success: errors.length === 0, etapa: errors.length > 0 ? 'processar_item' : null, motivo: errors.length > 0 ? 'falha_parcial_itens' : null, publicados, militar_ids_afetados: Array.from(militarIdsAfetados), historicos, warnings, errors });
  } catch (error: any) {
    const erroInterno = montarErro({ etapa: 'erro_interno', motivo: error?.motivo || error?.message || 'erro_interno_publicacao', payloadRecebido: body });
    return Response.json({ ...erroInterno, publicados: 0, militar_ids_afetados: [], historicos: [], warnings: [], errors: [{ ...erroInterno, message: erroInterno.motivo }] }, { status: 500 });
  }
});
