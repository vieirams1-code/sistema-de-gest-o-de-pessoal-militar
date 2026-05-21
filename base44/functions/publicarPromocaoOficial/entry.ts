import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const STATUS_PROMOCAO_PUBLICADA = new Set(['publicada', 'publicado', 'consolidada', 'consolidado']);
const STATUS_ITEM_BLOQUEADO_PUBLICACAO = new Set(['bloqueado', 'bloqueada', 'cancelado', 'cancelada', 'retificado', 'retificada']);

const texto = (valor: unknown) => String(valor ?? '').trim();
const normalizar = (valor: unknown) => texto(valor).toLowerCase();
const dataSomente = (valor: unknown) => texto(valor).split('T')[0];

function validarEntrada(promocao: any, itens: any[], temAlteracoesPendentes: boolean) {
  const bloqueios: string[] = [];
  if (!promocao || !texto(promocao.id)) bloqueios.push('Promoção não carregada.');
  if (STATUS_PROMOCAO_PUBLICADA.has(normalizar(promocao?.status))) bloqueios.push('Promoção já publicada/consolidada.');
  if (!dataSomente(promocao?.data_promocao)) bloqueios.push('Informe a data da promoção antes de publicar.');
  if (!texto(promocao?.posto_graduacao)) bloqueios.push('Informe o posto/graduação destino antes de publicar.');
  if (!texto(promocao?.quadro)) bloqueios.push('Informe o quadro destino antes de publicar.');
  if (!Array.isArray(itens) || itens.length === 0) bloqueios.push('Inclua ao menos um militar antes de publicar.');
  if (temAlteracoesPendentes) bloqueios.push('Salve as alterações pendentes antes de publicar.');

  const ordens = new Set<string>();
  const militares = new Set<string>();
  (itens || []).forEach((item, indice) => {
    const linha = `Linha ${indice + 1}`;
    const militarId = texto(item?.militar_id);
    const ordem = Number(item?.ordem);
    const status = normalizar(item?.status);
    if (!militarId) bloqueios.push(`${linha}: militar_id ausente.`);
    if (!Number.isFinite(ordem) || ordem <= 0) bloqueios.push(`${linha}: ordem inválida.`);
    if (militarId) {
      if (militares.has(militarId)) bloqueios.push('Há militar duplicado na promoção.');
      militares.add(militarId);
    }
    if (Number.isFinite(ordem) && ordem > 0) {
      const chaveOrdem = String(ordem);
      if (ordens.has(chaveOrdem)) bloqueios.push('Há ordem duplicada na promoção.');
      ordens.add(chaveOrdem);
    }
    if (STATUS_ITEM_BLOQUEADO_PUBLICACAO.has(status)) bloqueios.push(`${linha}: item bloqueado/cancelado/retificado não pode ser publicado.`);
  });

  return [...new Set(bloqueios)];
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const body = await req.json().catch(() => ({}));
    const promocao = body?.promocao || {};
    const itens = Array.isArray(body?.itens) ? body.itens : [];
    const temAlteracoesPendentes = Boolean(body?.temAlteracoesPendentes);

    const bloqueios = validarEntrada(promocao, itens, temAlteracoesPendentes);
    if (bloqueios.length > 0) {
      return Response.json({ publicados: 0, militar_ids_afetados: [], historicos: [], warnings: [], errors: bloqueios }, { status: 400 });
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
      try {
        const payloadHistorico = {
          militar_id: texto(item.militar_id),
          promocao_id: texto(promocao.id),
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
          observacoes: `Registro gerado pela publicação da promoção ${texto(promocao.id)}.`,
        };

        const historicoExistente = (historicosAtivos || []).find((h: any) => (
          normalizar(h?.status_registro) === 'ativo'
          && texto(h?.militar_id) === texto(payloadHistorico.militar_id)
          && normalizar(h?.posto_graduacao_novo) === normalizar(payloadHistorico.posto_graduacao_novo)
          && normalizar(h?.quadro_novo) === normalizar(payloadHistorico.quadro_novo)
          && dataSomente(h?.data_promocao) === dataSomente(payloadHistorico.data_promocao)
        ));

        let historico = historicoExistente;
        if (!historico) {
          historico = await Historico.create(payloadHistorico);
        } else if (!texto(historico?.promocao_id)) {
          historico = await Historico.update(historico.id, { promocao_id: texto(promocao.id) });
        }

        await Militar.update(item.militar_id, {
          posto_graduacao: texto(promocao.posto_graduacao),
          quadro: texto(promocao.quadro),
        });

        await PromocaoMilitar.update(item.id, {
          status: 'publicado',
          publicado: true,
          historico_promocao_v2_id: texto(historico?.id),
          atualizar_cadastro_militar: true,
          motivo_atualizacao_cadastro: 'Cadastro atualizado por publicação oficial via backend service-role.',
          resultado_aplicacao_cadastro: 'imediatamente_superior',
        });

        historicos.push({ promocao_militar_id: item.id, historico_promocao_v2_id: texto(historico?.id) });
        militarIdsAfetados.add(texto(item.militar_id));
        publicados += 1;
      } catch (error: any) {
        errors.push({ promocao_militar_id: item?.id || null, militar_id: item?.militar_id || null, message: error?.message || 'Falha ao publicar item.' });
      }
    }

    await Promocao.update(promocao.id, { status: errors.length > 0 ? 'rascunho' : 'publicada' });
    if (errors.length > 0) warnings.push('Publicação parcial: alguns itens falharam.');

    return Response.json({ publicados, militar_ids_afetados: Array.from(militarIdsAfetados), historicos, warnings, errors });
  } catch (error: any) {
    return Response.json({ publicados: 0, militar_ids_afetados: [], historicos: [], warnings: [], errors: [{ message: error?.message || 'Erro interno na publicação oficial.' }] }, { status: 500 });
  }
});
