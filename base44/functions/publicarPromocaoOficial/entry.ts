import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { atualizarCadastroMilitar } from '../utils.ts';

const STATUS_PROMOCAO_PUBLICADA = new Set(['publicada', 'publicado', 'consolidada', 'consolidado']);
const STATUS_ITEM_BLOQUEADO_PUBLICACAO = new Set(['bloqueado', 'bloqueada', 'cancelado', 'cancelada', 'retificado', 'retificada']);

const texto = (valor: unknown) => String(valor ?? '').trim();
const normalizar = (valor: unknown) => texto(valor).toLowerCase();
const dataSomente = (valor: unknown) => texto(valor).split('T')[0];

const EXECUCOES_EM_ANDAMENTO = (globalThis as any).__PUBLICAR_PROMOCAO_OFICIAL_LOCK__ ?? new Set<string>();
(globalThis as any).__PUBLICAR_PROMOCAO_OFICIAL_LOCK__ = EXECUCOES_EM_ANDAMENTO;

function montarErro({ etapa, motivo, promocao_id = null, item_id = null }: any) {
  const erro = { success: false, etapa, motivo, promocao_id, item_id };
  return erro;
}

function validarEntrada(promocao_id: unknown, promocao: any, itens: any[], temAlteracoesPendentes: boolean) {
  const promocaoId = texto(promocao_id) || texto(promocao?.id) || null;
  if (!promocaoId) return montarErro({ etapa: 'validacao_entrada', motivo: 'promocao_id_ausente', promocao_id: null});
  if (!promocao || Object.keys(promocao).length === 0) return montarErro({ etapa: 'validacao_entrada', motivo: 'promocao_nao_encontrada', promocao_id: promocaoId});

  if (STATUS_PROMOCAO_PUBLICADA.has(normalizar(promocao?.status))) {
    const temItensParaPublicar = (itens || []).some(item =>
      !STATUS_PROMOCAO_PUBLICADA.has(normalizar(item?.status)) &&
      !STATUS_ITEM_BLOQUEADO_PUBLICACAO.has(normalizar(item?.status))
    );
    if (!temItensParaPublicar) {
      return montarErro({ etapa: 'validacao_entrada', motivo: 'promocao_ja_publicada', promocao_id: promocaoId});
    }
  }

  if (!dataSomente(promocao?.data_promocao)) return montarErro({ etapa: 'validacao_entrada', motivo: 'promocao_sem_data', promocao_id: promocaoId});
  if (!texto(promocao?.posto_graduacao)) return montarErro({ etapa: 'validacao_entrada', motivo: 'promocao_sem_posto', promocao_id: promocaoId});
  if (!texto(promocao?.quadro)) return montarErro({ etapa: 'validacao_entrada', motivo: 'promocao_sem_quadro', promocao_id: promocaoId});
  if (!Array.isArray(itens) || itens.length === 0) return montarErro({ etapa: 'validacao_entrada', motivo: 'itens_ausentes', promocao_id: promocaoId});
  if (temAlteracoesPendentes) return montarErro({ etapa: 'validacao_entrada', motivo: 'alteracoes_pendentes', promocao_id: promocaoId});

  const ordens = new Set<string>();
  const militarIds = new Set<string>();
  const itensComOrdem = [];
  for (const item of itens || []) {
    const itemId = texto(item?.id) || null;
    const militarId = texto(item?.militar_id) || null;
    const ordem = Number(item?.ordem);
    const status = normalizar(item?.status);

    if (!itemId) return montarErro({ etapa: 'validacao_entrada', motivo: 'item_sem_id', promocao_id: promocaoId, item_id: null });
    if (!militarId) return montarErro({ etapa: 'validacao_entrada', motivo: 'militar_id_ausente', promocao_id: promocaoId, item_id: itemId });
    if (militarIds.has(militarId)) return montarErro({ etapa: 'validacao_entrada', motivo: 'duplicidade_militar_id', promocao_id: promocaoId, item_id: itemId });
    if (!Number.isFinite(ordem) || ordem <= 0) return montarErro({ etapa: 'validacao_entrada', motivo: 'ordem_invalida', promocao_id: promocaoId, item_id: itemId });
    if (ordens.has(String(ordem))) return montarErro({ etapa: 'validacao_entrada', motivo: 'duplicidade_ordem', promocao_id: promocaoId, item_id: itemId });
    ordens.add(String(ordem));
    militarIds.add(militarId);
    itensComOrdem.push({ itemId, militarId, ordem });
    if (STATUS_ITEM_BLOQUEADO_PUBLICACAO.has(status)) return montarErro({ etapa: 'validacao_entrada', motivo: 'item_status_bloqueado', promocao_id: promocaoId, item_id: itemId });
  }

  const ordensOrdenadas = itensComOrdem.map((i: any) => i.ordem).sort((a: number, b: number) => a - b);
  for (let i = 1; i < ordensOrdenadas.length; i += 1) {
    if (ordensOrdenadas[i] <= ordensOrdenadas[i - 1]) {
      return montarErro({ etapa: 'validacao_entrada', motivo: 'ordem_antiguidade_inconsistente', promocao_id: promocaoId});
    }
  }

  return null;
}

async function parseBase44Payload(req: any) {
  const candidatos = [];

  candidatos.push(req?.body);
  candidatos.push(req?.body?.data);
  candidatos.push(req?.data);
  candidatos.push(req?.payload);

  try {
    if (typeof req?.json === 'function') {
      candidatos.push(await req.json());
    }
  } catch (_) {}

  for (const c of candidatos) {
    if (c && typeof c === 'object') {
      if (c.promocao_id || c.promocaoId || c.promocao?.id) return c;
      if (c.data && typeof c.data === 'object') return c.data;
      if (c.body && typeof c.body === 'object') return c.body;
    }
  }

  return {};
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let lockId = '';
  try {
    const authUser = await base44.auth.me();
    const input = (globalThis as any)?.input;
    const parsedPayload = await parseBase44Payload(req);
    const payload = parsedPayload ?? input ?? {};

    const promocaoId =
      payload?.promocao_id ||
      payload?.promocaoId ||
      payload?.promocao?.id ||
      payload?.data?.promocao_id ||
      payload?.data?.promocaoId ||
      payload?.data?.promocao?.id;
    const promocao_id = promocaoId;
    const promocao = payload?.promocao || payload?.data?.promocao || {};
    const itens = Array.isArray(payload?.itens) ? payload.itens : Array.isArray(payload?.data?.itens) ? payload.data.itens : [];
    const temAlteracoesPendentes = Boolean(payload?.temAlteracoesPendentes ?? payload?.data?.temAlteracoesPendentes);

    const erroConcorrencia = promocaoId && EXECUCOES_EM_ANDAMENTO.has(texto(promocaoId))
      ? montarErro({ etapa: 'controle_concorrencia', motivo: 'publicacao_em_andamento', promocao_id: texto(promocaoId)})
      : null;
    if (erroConcorrencia) {
      return Response.json({ ...erroConcorrencia, publicados: 0, militar_ids_afetados: [], historicos: [], warnings: [], errors: [erroConcorrencia] }, { status: 409 });
    }

    const erroValidacao = validarEntrada(promocao_id, promocao, itens, temAlteracoesPendentes);
    if (erroValidacao) {
      return Response.json({ ...erroValidacao, publicados: 0, militar_ids_afetados: [], historicos: [], warnings: [], errors: [erroValidacao] }, { status: 400 });
    }

    lockId = texto(promocaoId);
    EXECUCOES_EM_ANDAMENTO.add(lockId);

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
      const itemId = texto(item?.id) || null;
      const militarId = texto(item?.militar_id) || null;
      try {
        const militarEncontrado = await Militar.get(item.militar_id).catch(() => null);
        if (!militarEncontrado) throw montarErro({ etapa: 'atualizar_militar', motivo: 'militar_nao_encontrado', promocao_id: promocaoId, item_id: itemId });

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
          if (!historico?.id) throw montarErro({ etapa: 'criar_historico', motivo: 'historico_criacao_falhou', promocao_id: promocaoId, item_id: itemId });
        } else if (!texto(historico?.promocao_id)) {
          historico = await Historico.update(historico.id, { promocao_id: promocaoId });
        }

        const atualizacaoMilitar = await atualizarCadastroMilitar(
          base44,
          militarId!,
          {
            posto_graduacao: texto(promocao.posto_graduacao),
            quadro: texto(promocao.quadro),
          },
          {
            executado_por: authUser?.email || 'sistema_publicacao',
            origem: 'publicacao_oficial_promocao',
            historico_id: historico?.id
          }
        ).catch(() => null);

        if (!atualizacaoMilitar || !atualizacaoMilitar.success) {
          throw montarErro({
            etapa: 'atualizar_militar',
            motivo: atualizacaoMilitar?.erro_api || 'update_militar_falhou',
            promocao_id: promocaoId,
            item_id: itemId
          });
        }

        await PromocaoMilitar.update(item.id, {
          status: 'publicado',
          publicado: true,
          historico_promocao_v2_id: texto(historico?.id),
          atualizar_cadastro_militar: true,
          motivo_atualizacao_cadastro: 'Cadastro atualizado por publicação oficial via backend service-role com confirmação de persistência.',
          resultado_aplicacao_cadastro: 'imediatamente_superior',
        });

        historicos.push({ promocao_militar_id: item.id, historico_promocao_v2_id: texto(historico?.id) });
        militarIdsAfetados.add(militarId!);
        publicados += 1;
      } catch (error: any) {
        const erroItem = error?.motivo ? error : montarErro({ etapa: 'processar_item', motivo: 'falha_publicacao_item', promocao_id: promocaoId, item_id: itemId });
        errors.push({ ...erroItem, message: erroItem?.motivo || error?.message || 'Falha ao publicar item.' });
      }
    }

    if (!promocaoId) throw montarErro({ etapa: 'validacao_entrada', motivo: 'promocao_id_ausente'});
    const statusFinal = publicados === 0 ? 'rascunho' : (publicados < itens.length ? 'publicada_parcial' : 'publicada');
    await Promocao.update(promocaoId, { status: statusFinal });

    return Response.json({ success: errors.length === 0, etapa: errors.length > 0 ? 'processar_item' : null, motivo: errors.length > 0 ? 'falha_parcial_itens' : null, publicados, militar_ids_afetados: Array.from(militarIdsAfetados), historicos, warnings, errors });
  } catch (error: any) {
    const erroInterno = montarErro({ etapa: 'erro_interno', motivo: error?.motivo || error?.message || 'erro_interno_publicacao'});
    return Response.json({ ...erroInterno, publicados: 0, militar_ids_afetados: [], historicos: [], warnings: [], errors: [{ ...erroInterno, message: erroInterno.motivo }] }, { status: 500 });
  } finally {
    if (lockId) EXECUCOES_EM_ANDAMENTO.delete(lockId);
  }
});
