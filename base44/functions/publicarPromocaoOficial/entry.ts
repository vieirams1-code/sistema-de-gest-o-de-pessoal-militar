import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { atualizarCadastroMilitar } from './utils.ts';

const STATUS_PROMOCAO_PUBLICADA = new Set(['publicada_parcial', 'publicada', 'publicado', 'consolidada', 'consolidado', 'ativa', 'ativo', 'historica', 'homologada']);
const STATUS_ITEM_BLOQUEADO_PUBLICACAO = new Set(['bloqueado', 'bloqueada', 'cancelado', 'cancelada', 'retificado', 'retificada']);

const texto = (valor: unknown) => String(valor ?? '').trim();
const normalizar = (valor: unknown) => texto(valor).toLowerCase();
const dataSomente = (valor: unknown) => texto(valor).split('T')[0];

// === Regra do Cadastro Presumidamente Correto ===
// Hierarquia oficial de postos. O índice maior = posto superior.
const POSTOS_HIERARQUIA = [
  'Soldado', 'Cabo', '3º Sargento', '2º Sargento', '1º Sargento', 'Subtenente',
  'Aspirante a Oficial', '2º Tenente', '1º Tenente', 'Capitão', 'Major',
  'Tenente-Coronel', 'Coronel',
];
const chavePosto = (valor: unknown) => texto(valor)
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[°º]/g, 'o').replace(/[-–—.]/g, ' ')
  .replace(/\s+/g, ' ').trim().toLowerCase();
const INDICE_POR_POSTO = new Map(POSTOS_HIERARQUIA.map((p, i) => [chavePosto(p), i]));
INDICE_POR_POSTO.set(chavePosto('Aspirante'), POSTOS_HIERARQUIA.indexOf('Aspirante a Oficial'));
INDICE_POR_POSTO.set(chavePosto('Asp Oficial'), POSTOS_HIERARQUIA.indexOf('Aspirante a Oficial'));
INDICE_POR_POSTO.set(chavePosto('Tenente Coronel'), POSTOS_HIERARQUIA.indexOf('Tenente-Coronel'));
const indicePosto = (valor: unknown) => {
  const idx = INDICE_POR_POSTO.get(chavePosto(valor));
  return Number.isInteger(idx) ? (idx as number) : -1;
};
// Retorna: 'superior' | 'igual' | 'inferior' | 'indefinido'
function compararPromocaoComCadastro(postoPromocao: unknown, postoCadastro: unknown) {
  const idxPromocao = indicePosto(postoPromocao);
  const idxCadastro = indicePosto(postoCadastro);
  if (idxPromocao === -1 || idxCadastro === -1) return 'indefinido';
  if (idxPromocao > idxCadastro) return 'superior';
  if (idxPromocao === idxCadastro) return 'igual';
  return 'inferior';
}

function postoAnteriorPrevisto(postoNovo: unknown, quadroNovo: unknown) {
  const indiceNovo = indicePosto(postoNovo);
  if (indiceNovo <= 0) return '';
  if (indiceNovo === POSTOS_HIERARQUIA.indexOf('Aspirante a Oficial')) return '';
  if (
    indiceNovo === POSTOS_HIERARQUIA.indexOf('2º Tenente')
    && chavePosto(quadroNovo) === chavePosto('QAOBM')
  ) {
    return 'Subtenente';
  }
  return POSTOS_HIERARQUIA[indiceNovo - 1] || '';
}

function resolverOrigemHistorica({
  militar,
  promocao,
  historicoAnterior,
}: {
  militar: any;
  promocao: any;
  historicoAnterior: any;
}) {
  if (indicePosto(promocao?.posto_graduacao) === 0) {
    return { posto: '', quadro: '', origem: 'inicio_cadeia' };
  }
  if (historicoAnterior) {
    return {
      posto: texto(historicoAnterior?.posto_graduacao_novo),
      quadro: texto(historicoAnterior?.quadro_novo),
      origem: 'historico_anterior',
    };
  }

  const comparacaoCadastro = compararPromocaoComCadastro(
    promocao?.posto_graduacao,
    militar?.posto_graduacao,
  );
  if (comparacaoCadastro === 'superior') {
    return {
      posto: texto(militar?.posto_graduacao),
      quadro: texto(militar?.quadro),
      origem: 'cadastro_atual',
    };
  }

  const postoPrevisto = postoAnteriorPrevisto(promocao?.posto_graduacao, promocao?.quadro);
  const transicaoQaobm = chavePosto(promocao?.posto_graduacao) === chavePosto('2º Tenente')
    && chavePosto(promocao?.quadro) === chavePosto('QAOBM');
  return {
    posto: postoPrevisto,
    quadro: postoPrevisto && !transicaoQaobm ? texto(promocao?.quadro) : '',
    origem: postoPrevisto ? 'hierarquia_institucional' : 'inicio_cadeia',
  };
}

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


async function adquirirTrava(entity: any, id: string, campo: string) {
  if (typeof entity.updateMany !== 'function') throw new Error('controle_concorrencia_indisponivel');
  const token = crypto.randomUUID();
  const resultado = await entity.updateMany(
    {id, $or:[{[campo]:''},{[campo]:null},{[campo]:{$exists:false}}]},
    {$set:{[campo]:token}}
  );
  if (resultado?.success !== true || resultado.updated !== 1) throw new Error('operacao_oficial_em_andamento');
  return token;
}
async function liberarTrava(entity: any, id: string, campo: string, token: string) {
  if (!token) return;
  await entity.updateMany({id,[campo]:token},{$set:{[campo]:''}});
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let lockId = '';
  let tokenPersistido = '';
  let manterTrava = false;
  try {
    const authUser = await base44.auth.me();
    if (!authUser) return Response.json({ success: false, etapa: 'autorizacao', motivo: 'nao_autenticado' }, { status: 401 });
    if (String(authUser.role || '').trim().toLowerCase() !== 'admin') {
      return Response.json({ success: false, etapa: 'autorizacao', motivo: 'requer_administrador_plataforma' }, { status: 403 });
    }
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
    let promocao = payload?.promocao || payload?.data?.promocao || {};
    let itens = Array.isArray(payload?.itens) ? payload.itens : Array.isArray(payload?.data?.itens) ? payload.data.itens : [];
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

    tokenPersistido = await adquirirTrava(Promocao, texto(promocaoId), 'operacao_token');
    const promocaoPersistida = await Promocao.get(promocaoId).catch(() => null);
    const itensPersistidos = await PromocaoMilitar.filter({ promocao_id: promocaoId }, undefined, 5000);
    const idsSolicitados = new Set((itens || []).map((item: any) => texto(item?.id)).filter(Boolean));
    const itensAutoritativos = (itensPersistidos || []).filter((item: any) => idsSolicitados.has(texto(item?.id)));

    if (!promocaoPersistida?.id || itensAutoritativos.length !== idsSolicitados.size) {
      const erroAutoridade = montarErro({
        etapa: 'validacao_servidor',
        motivo: !promocaoPersistida?.id ? 'promocao_nao_encontrada' : 'item_nao_pertence_promocao',
        promocao_id: texto(promocaoId),
      });
      return Response.json({ ...erroAutoridade, publicados: 0, militar_ids_afetados: [], historicos: [], warnings: [], errors: [erroAutoridade] }, { status: 409 });
    }

    promocao = promocaoPersistida;
    itens = itensAutoritativos;
    const erroValidacaoServidor = validarEntrada(promocaoId, promocao, itens, temAlteracoesPendentes);
    if (erroValidacaoServidor) {
      return Response.json({ ...erroValidacaoServidor, publicados: 0, militar_ids_afetados: [], historicos: [], warnings: [], errors: [erroValidacaoServidor] }, { status: 400 });
    }

    const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Campo_Grande', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
    const dataEfetiva = dataSomente(promocao.data_promocao);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataEfetiva) || Number.isNaN(Date.parse(dataEfetiva)) || new Date(dataEfetiva).toISOString().slice(0, 10) !== dataEfetiva || dataEfetiva > hoje) {
      return Response.json({ success:false, etapa:'validacao_servidor', motivo:'promocao_sem_vigencia', publicados:0 }, {status:409});
    }
    const warnings: any[] = [];
    const errors: any[] = [];
    const historicos: any[] = [];
    const militarIdsAfetados = new Set<string>();
    let publicados = 0;

    const historicosAtivos = await Historico.filter({ status_registro: 'ativo' }, undefined, 5000);

    for (const item of itens) {
      // Repetições e inclusão complementar não reaplicam itens já concluídos.
      if (item.publicado === true || STATUS_PROMOCAO_PUBLICADA.has(normalizar(item.status))) continue;
      const desfazer: Array<() => Promise<any>> = [];
      let preservarCadeia = false;
      const itemId = texto(item?.id) || null;
      const militarId = texto(item?.militar_id) || null;
      try {
        const militarEncontrado = await Militar.get(item.militar_id).catch(() => null);
        if (!militarEncontrado) throw montarErro({ etapa: 'atualizar_militar', motivo: 'militar_nao_encontrado', promocao_id: promocaoId, item_id: itemId });

        const dataPromocao = dataSomente(promocao.data_promocao);
        const historicoAnterior = (historicosAtivos || [])
          .filter((h: any) => (
            normalizar(h?.status_registro) === 'ativo'
            && texto(h?.militar_id) === militarId
            && dataSomente(h?.data_promocao) < dataPromocao
          ))
          .sort((a: any, b: any) => (
            dataSomente(b?.data_promocao).localeCompare(dataSomente(a?.data_promocao))
            || texto(b?.created_date).localeCompare(texto(a?.created_date))
          ))[0] || null;
        const origemHistorica = resolverOrigemHistorica({
          militar: militarEncontrado,
          promocao,
          historicoAnterior,
        });

        const payloadHistorico = {
          militar_id: militarId,
          promocao_id: promocaoId,
          posto_graduacao_anterior: origemHistorica.posto,
          quadro_anterior: origemHistorica.quadro,
          posto_graduacao_novo: texto(promocao.posto_graduacao),
          quadro_novo: texto(promocao.quadro),
          data_promocao: dataPromocao,
          data_publicacao: dataSomente(promocao.data_publicacao) || dataPromocao,
          boletim_referencia: texto(promocao.boletim_referencia),
          ato_referencia: texto(promocao.ato_referencia),
          antiguidade_referencia_ordem: Number(item.ordem),
          antiguidade_referencia_id: indicePosto(promocao.posto_graduacao) === 0 ? '' : texto(historicoAnterior?.id),
          origem_dado: 'publicacao_promocao',
          status_registro: 'ativo',
          observacoes: `Registro gerado pela publicação da promoção ${promocaoId}. Origem anterior: ${origemHistorica.origem}.`,
        };

        const historicosMesmoEvento = (historicosAtivos || []).filter((h: any) => normalizar(h?.status_registro) === 'ativo' && texto(h?.militar_id) === militarId && normalizar(h?.posto_graduacao_novo) === normalizar(payloadHistorico.posto_graduacao_novo) && normalizar(h?.quadro_novo) === normalizar(payloadHistorico.quadro_novo) && dataSomente(h?.data_promocao) === dataSomente(payloadHistorico.data_promocao));
        const historicoConflitante = historicosMesmoEvento.find((h: any) => texto(h?.promocao_id) && texto(h?.promocao_id) !== texto(promocaoId));
        if (historicoConflitante) {
          throw montarErro({ etapa: 'vincular_historico', motivo: 'historico_vinculado_outra_promocao', promocao_id: promocaoId, item_id: itemId });
        }
        const historicoExistente = historicosMesmoEvento.find((h: any) => !texto(h?.promocao_id) || texto(h?.promocao_id) === texto(promocaoId));

        if (historicosMesmoEvento.length > 1) throw new Error('historicos_duplicados_evento');
        const journal = await base44.asServiceRole.entities.AssistenteLog.create({
          tipo:'publicacao_promocao', acao:'publicacao_item_iniciada',
          descricao:'Estado anterior preservado antes da publicação.',
          metadata:{promocao_id:promocaoId,item_id:itemId,militar_id:militarId,item_antes:item,historico_antes:historicoExistente || null,militar_antes:militarEncontrado}
        });
        let historico = historicoExistente;
        if (!historico) {
          // Manter o candidato identificável caso a API grave e perca a resposta.
          desfazer.push(async () => {
            const candidatos = await Historico.filter({promocao_id:promocaoId,militar_id:militarId,status_registro:'ativo'}, undefined, 5000);
            for (const h of candidatos.filter((h:any) => dataSomente(h.data_promocao) === dataPromocao)) {
              await Historico.update(h.id,{status_registro:'cancelado',observacoes:payloadHistorico.observacoes + ' Publicação não concluída; compensação registrada.'});
            }
          });
          historico = await Historico.create(payloadHistorico);
          if (!historico?.id) throw montarErro({ etapa: 'criar_historico', motivo: 'historico_criacao_falhou', promocao_id: promocaoId, item_id: itemId });
        } else {
          const campos = Object.keys(payloadHistorico);
          const snapshot = Object.fromEntries(campos.map(k => [k, historicoExistente[k] ?? '']));
          desfazer.push(() => Historico.update(historicoExistente.id,snapshot));
          historico = await Historico.update(historico.id, {
            promocao_id: promocaoId,
            posto_graduacao_novo: payloadHistorico.posto_graduacao_novo,
            quadro_novo: payloadHistorico.quadro_novo,
            data_promocao: payloadHistorico.data_promocao,
            data_publicacao: payloadHistorico.data_publicacao,
            boletim_referencia: payloadHistorico.boletim_referencia,
            ato_referencia: payloadHistorico.ato_referencia,
            antiguidade_referencia_ordem: payloadHistorico.antiguidade_referencia_ordem,
            antiguidade_referencia_id: texto(historico?.antiguidade_referencia_id) || payloadHistorico.antiguidade_referencia_id,
          });
        }

        // === Regra do Cadastro Presumidamente Correto ===
        // Compara o posto da promoção com o posto ATUAL do cadastro do militar.
        // Só atualiza o cadastro quando a promoção for SUPERIOR (avanço hierárquico).
        const comparacaoCadastro = compararPromocaoComCadastro(
          texto(promocao.posto_graduacao),
          texto(militarEncontrado?.posto_graduacao)
        );

        // Confirmar vínculo antes de qualquer escrita no cadastro.
        const snapshotItem = Object.fromEntries(['status','publicado','historico_promocao_v2_id','atualizar_cadastro_militar','motivo_atualizacao_cadastro','resultado_aplicacao_cadastro','cadastro_anterior_promocao'].map(k => [k,item[k] ?? (k === 'cadastro_anterior_promocao' ? {} : (k === 'publicado' || k === 'atualizar_cadastro_militar' ? false : ''))]));
        desfazer.push(() => PromocaoMilitar.update(item.id,snapshotItem));
        await PromocaoMilitar.update(item.id, {
          status:'publicado',publicado:true,historico_promocao_v2_id:historico.id,
          atualizar_cadastro_militar:false,resultado_aplicacao_cadastro:'cadastro_preservado'
        });
        const itemConfirmado = await PromocaoMilitar.get(item.id);
        if (itemConfirmado.publicado !== true || texto(itemConfirmado.historico_promocao_v2_id) !== texto(historico.id)) throw new Error('vinculo_nao_confirmado');

        const posterior = historicosAtivos.some((h:any) => texto(h.militar_id) === militarId && dataSomente(h.data_promocao) > dataPromocao && dataSomente(h.data_promocao) <= hoje);
        const podeAplicar = comparacaoCadastro === 'superior' && !posterior && dataSomente(militarEncontrado.data_promocao_atual) <= dataPromocao;
        let resultadoAplicacao = 'cadastro_preservado';
        let motivoAplicacao = 'Cadastro atual preservado (superior ao evento histórico).';

        if (podeAplicar) {
          // Marcar a intenção antes da escrita; se houver falha, restaurar junto ao vínculo.
          await PromocaoMilitar.update(item.id,{atualizar_cadastro_militar:true,resultado_aplicacao_cadastro:'imediatamente_superior',motivo_atualizacao_cadastro:'Aplicação oficial após confirmação do vínculo.'});
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
          );

          if (!atualizacaoMilitar || !atualizacaoMilitar.success) {
            preservarCadeia = atualizacaoMilitar?.rollback_completo === false;
            throw montarErro({
              etapa: 'atualizar_militar',
              motivo: atualizacaoMilitar?.erro_api || 'update_militar_falhou',
              promocao_id: promocaoId,
              item_id: itemId
            });
          }
          resultadoAplicacao = 'imediatamente_superior';
          motivoAplicacao = 'Cadastro atualizado por publicação oficial (promoção superior ao cadastro atual).';
        } else if (comparacaoCadastro === 'igual') {
          resultadoAplicacao = 'atual';
          motivoAplicacao = 'Cadastro já compatível com a promoção publicada.';
        } else if (comparacaoCadastro === 'indefinido') {
          resultadoAplicacao = 'revisao';
          motivoAplicacao = 'Posto da promoção ou do cadastro não reconhecido. Verifique manualmente.';
          warnings.push({ etapa: 'aplicar_cadastro', motivo: 'comparacao_indefinida', promocao_id: promocaoId, item_id: itemId, militar_id: militarId });
        } else {
          // inferior: cadastro preservado (não rebaixar automaticamente)
          warnings.push({ etapa: 'aplicar_cadastro', motivo: 'cadastro_preservado_superior_ao_historico', promocao_id: promocaoId, item_id: itemId, militar_id: militarId });
        }

        if (!podeAplicar) {
          await PromocaoMilitar.update(item.id, {
            atualizar_cadastro_militar:false,motivo_atualizacao_cadastro:motivoAplicacao,
            resultado_aplicacao_cadastro:resultadoAplicacao
          });
        }
        try { await base44.asServiceRole.entities.AssistenteLog.update(journal.id,{acao:'publicacao_item_concluida'}); }
        catch (_) { warnings.push({motivo:'log_final_pendente',item_id:itemId,journal_id:journal.id}); }

        historicos.push({ promocao_militar_id: item.id, historico_promocao_v2_id: texto(historico?.id) });
        militarIdsAfetados.add(militarId!);
        publicados += 1;
      } catch (error: any) {
        const falhasRollback: string[] = [];
        if (!preservarCadeia) {
          for (const undo of [...desfazer].reverse()) {
            try { await undo(); } catch (e:any) { falhasRollback.push(e.message || String(e)); }
          }
        } else {
          falhasRollback.push('cadastro_sem_restauracao_confirmada; preservar cadeia para revisão');
        }
        if (falhasRollback.length) manterTrava = true;
        const erroItem = error?.motivo ? error : montarErro({ etapa: 'processar_item', motivo: 'falha_publicacao_item', promocao_id: promocaoId, item_id: itemId });
        errors.push({ ...erroItem, message: error?.message || erroItem?.motivo || 'Falha ao publicar item.',rollback_completo:falhasRollback.length === 0,falhas_rollback:falhasRollback });
      }
    }

    if (!promocaoId) throw montarErro({ etapa: 'validacao_entrada', motivo: 'promocao_id_ausente'});
    const itensFinais = await PromocaoMilitar.filter({promocao_id:promocaoId}, undefined, 5000);
    const operacionais = itensFinais.filter((i:any) => !STATUS_ITEM_BLOQUEADO_PUBLICACAO.has(normalizar(i.status)));
    const totalPublicados = operacionais.filter((i:any) => i.publicado === true && normalizar(i.status) === 'publicado').length;
    const statusFinal = totalPublicados === 0 ? 'rascunho' : (totalPublicados < operacionais.length ? 'publicada_parcial' : 'publicada');
    const totalVinculados = itensFinais.length;
    try {
      await Promocao.update(promocaoId, { status: statusFinal, total_militares_vinculados: totalVinculados });
    } catch (e:any) {
      return Response.json({success:false,etapa:'consolidacao_lote',motivo:'consolidacao_pendente_repetir_publicacao',publicados,militar_ids_afetados:Array.from(militarIdsAfetados),historicos,warnings,errors:[...errors,{message:e.message}],reconciliacao_pendente:true},{status:500});
    }

    return Response.json({ success: errors.length === 0, etapa: errors.length > 0 ? 'processar_item' : null, motivo: errors.length > 0 ? 'falha_parcial_itens' : null, publicados, militar_ids_afetados: Array.from(militarIdsAfetados), historicos, warnings, errors });
  } catch (error: any) {
    const erroInterno = montarErro({ etapa: 'erro_interno', motivo: error?.motivo || error?.message || 'erro_interno_publicacao'});
    return Response.json({ ...erroInterno, publicados: 0, militar_ids_afetados: [], historicos: [], warnings: [], errors: [{ ...erroInterno, message: erroInterno.motivo }] }, { status: 500 });
  } finally {
    if (tokenPersistido && !manterTrava) {
      try { await liberarTrava(base44.asServiceRole.entities.Promocao,lockId,'operacao_token',tokenPersistido); }
      catch (_) { console.error('Trava de promoção mantida para reconciliação',lockId); }
    }
    if (lockId) EXECUCOES_EM_ANDAMENTO.delete(lockId);
  }
});