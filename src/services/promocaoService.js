import { base44 } from '@/api/base44Client';
import { POSTOS_GRADUACOES_HIERARQUIA } from '../constants/postosGraduacoes.js';
import { MENSAGEM_BLOQUEIO_REBAIXAMENTO_CADASTRAL, getSugestaoAtualizacaoCadastro, normalizarPostoGraduacao } from '../utils/postoGraduacaoHierarquia.js';
import { deveAtualizarCadastroMilitarPorPromocao } from '../utils/promocao/deveAtualizarCadastroMilitarPorPromocao.js';
import { deveRollbackCadastroMilitarPorReversao, podeExcluirDefinitivamentePromocaoMilitar, podeReverterPublicacaoPromocao } from '../utils/promocao/reversaoExclusaoRules.js';
import { isPostoDestinoPromocaoInicial } from '../utils/promocao/buildPromocaoContext.js';

const TEXTO_VAZIO = '—';

export const POSTOS_GRADUACOES_PROMOCAO = [...POSTOS_GRADUACOES_HIERARQUIA].reverse();

const STATUS_OPERACIONAIS = new Set(['ativo', 'previsto']);
const STATUS_CANCELADOS_RETIFICADOS = new Set(['cancelado', 'cancelada', 'retificado', 'retificada']);

const STATUS_PROMOCAO_RASCUNHO = new Set(['rascunho']);

const STATUS_PROMOCAO_PUBLICADA = new Set(['publicada', 'publicado', 'consolidada', 'consolidado']);
const STATUS_ITEM_BLOQUEADO_PUBLICACAO = new Set(['bloqueado', 'bloqueada', 'cancelado', 'cancelada', 'retificado', 'retificada']);

function dataSomente(valor) {
  return texto(valor).split('T')[0];
}

function mesmoTextoNormalizado(a, b) {
  return normalizar(a) === normalizar(b);
}

export function isPromocaoFormacaoTerceiroSargento(postoGraduacao = '') {
  const normalizadoCanonico = normalizarPostoGraduacao(postoGraduacao);
  const textoNormalizado = normalizar(postoGraduacao);
  return (
    normalizadoCanonico.includes('3º sargento')
    || normalizadoCanonico.includes('3o sargento')
    || textoNormalizado.includes('3º sgt')
    || textoNormalizado.includes('3o sgt')
    || textoNormalizado.includes('3 sgt')
    || textoNormalizado.includes('terceiro sargento')
  );
}

export function isPromocaoInicioCadeia(promocao = {}) {
  const posto = promocao?.posto_graduacao || promocao;
  return isPostoDestinoPromocaoInicial(posto);
}

function montarErroPublicacao(mensagens) {
  const erro = new Error([...new Set(mensagens)].join(' '));
  erro.bloqueios = [...new Set(mensagens)];
  return erro;
}

function validarPublicacaoPromocaoBase({ promocao, itens = [], permitirAlteracoesPendentes = false, temAlteracoesPendentes = false, contextoPublicacao = {} } = {}) {
  const bloqueios = [];
  const promocaoInicioCadeia = typeof contextoPublicacao?.promocaoInicio === 'boolean' ? contextoPublicacao.promocaoInicio : isPromocaoInicioCadeia(promocao);
  const promocaoSucessiva = typeof contextoPublicacao?.promocaoSucessiva === 'boolean' ? contextoPublicacao.promocaoSucessiva : !promocaoInicioCadeia;
  const statusOperacional = statusNormalizado(contextoPublicacao?.statusOperacional || '');
  const fonteOrdem = statusNormalizado(contextoPublicacao?.fonteOrdem || '');

  if (!promocao || !texto(promocao.id)) bloqueios.push('Promoção não carregada.');
  if (STATUS_PROMOCAO_PUBLICADA.has(statusNormalizado(promocao?.status))) bloqueios.push('Promoção já publicada/consolidada.');
  if (!dataSomente(promocao?.data_promocao)) bloqueios.push('Informe a data da promoção antes de publicar.');
  if (!texto(promocao?.posto_graduacao)) bloqueios.push('Informe o posto/graduação destino antes de publicar.');
  if (!texto(promocao?.quadro)) bloqueios.push('Informe o quadro destino antes de publicar.');
  if (!Array.isArray(itens) || itens.length === 0) bloqueios.push('Inclua ao menos um militar antes de publicar.');
  if (!permitirAlteracoesPendentes && temAlteracoesPendentes) bloqueios.push('Salve as alterações pendentes antes de publicar.');



  if (promocaoSucessiva && fonteOrdem === 'manual') {
    bloqueios.push('Promoção sucessiva não permite ordem manual como fonte primária.');
  }
  if (promocaoSucessiva && statusOperacional === 'historica' && fonteOrdem && fonteOrdem !== 'historico_v2_temporal') {
    bloqueios.push('Promoção sucessiva histórica exige ordenação por histórico V2 temporal.');
  }

  const ordens = new Set();
  const militares = new Set();

  (itens || []).forEach((item, indice) => {
    const linha = `Linha ${indice + 1}`;
    const militarId = texto(item?.militar_id);
    const ordem = Number(item?.ordem);
    const status = statusNormalizado(item?.status);
    const efeito = getSugestaoAtualizacaoCadastro({ militar: item?.militar, promocao });

    if (!militarId) bloqueios.push(`${linha}: militar_id ausente.`);
    if (!item?.militar) bloqueios.push(`${linha}: militar não carregado.`);
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
    if (!promocaoInicioCadeia) {
      if (efeito.tipo === 'incompativel') bloqueios.push(`${linha}: militar incompatível com o posto/graduação destino.`);
      if (efeito.tipo === 'revisao') bloqueios.push(`${linha}: militar em revisão cadastral.`);
    }
  });

  return {
    valido: bloqueios.length === 0,
    bloqueios: [...new Set(bloqueios)],
  };
}

export function validarPublicacaoPromocao(contexto = {}) {
  return validarPublicacaoPromocaoBase(contexto);
}

function montarPayloadHistoricoPublicacao({ promocao, item, efeito }) {
  const militar = item.militar || {};
  return {
    militar_id: texto(item.militar_id),
    promocao_id: texto(promocao.id),
    posto_graduacao_anterior: texto(militar.posto_graduacao || militar.posto_graduacao_atual),
    quadro_anterior: texto(militar.quadro || militar.quadro_atual),
    posto_graduacao_novo: texto(promocao.posto_graduacao),
    quadro_novo: texto(promocao.quadro),
    data_promocao: dataSomente(promocao.data_promocao),
    data_publicacao: dataSomente(promocao.data_publicacao) || dataSomente(promocao.data_promocao),
    boletim_referencia: texto(promocao.boletim_referencia),
    ato_referencia: texto(promocao.ato_referencia),
    antiguidade_referencia_ordem: Number(item.ordem),
    origem_dado: 'publicacao_promocao',
    status_registro: 'ativo',
    observacoes: `Registro gerado pela publicação da promoção ${texto(promocao.id)} (${efeito.tipo}).`,
  };
}

async function listarHistoricosPublicacao(entity) {
  if (!entity) throw new Error('Entidade HistoricoPromocaoMilitarV2 indisponível.');
  if (typeof entity.list === 'function') return entity.list();
  if (typeof entity.filter === 'function') return entity.filter({ status_registro: 'ativo' });
  throw new Error('Não foi possível consultar o Histórico V2 antes da publicação.');
}

function resolverHistoricoPublicacao({ historicos = [], payload }) {
  const ativosMesmoMilitarPostoQuadro = (historicos || []).filter((historico) => (
    statusNormalizado(historico?.status_registro) === 'ativo'
    && texto(historico?.militar_id) === texto(payload.militar_id)
    && mesmoTextoNormalizado(historico?.posto_graduacao_novo, payload.posto_graduacao_novo)
    && mesmoTextoNormalizado(historico?.quadro_novo, payload.quadro_novo)
  ));

  const exato = ativosMesmoMilitarPostoQuadro.find((historico) => dataSomente(historico?.data_promocao) === dataSomente(payload.data_promocao));
  if (exato) {
    const promocaoIdExistente = texto(exato.promocao_id);
    if (!promocaoIdExistente) return { acao: 'vincular', historico: exato };
    if (promocaoIdExistente === texto(payload.promocao_id)) return { acao: 'idempotente', historico: exato };
    throw new Error(`Histórico V2 ativo exato do militar ${payload.militar_id} já está vinculado a outra promoção (${promocaoIdExistente}).`);
  }

  const divergente = ativosMesmoMilitarPostoQuadro.find((historico) => dataSomente(historico?.data_promocao) !== dataSomente(payload.data_promocao));
  if (divergente) {
    throw new Error(`Histórico V2 ativo divergente para o militar ${payload.militar_id} no mesmo posto/quadro exige revisão manual.`);
  }

  return { acao: 'criar', historico: null };
}

function patchDocumentalFaltante(historico = {}, payload = {}) {
  const patch = { promocao_id: payload.promocao_id };
  ['data_publicacao', 'boletim_referencia', 'ato_referencia', 'antiguidade_referencia_ordem', 'origem_dado', 'observacoes'].forEach((campo) => {
    if (!texto(historico?.[campo]) && texto(payload?.[campo])) patch[campo] = payload[campo];
  });
  return patch;
}

export async function publicarPromocaoOficial({ promocao, itens = [], temAlteracoesPendentes = false, contextoPublicacao = {} } = {}) {
  const filtroElegibilidade = {
    status_bloqueado: 0,
  };
  const itensElegiveis = (itens || []).filter((item) => {
    const bloqueado = STATUS_ITEM_BLOQUEADO_PUBLICACAO.has(statusNormalizado(item?.status));
    if (bloqueado) filtroElegibilidade.status_bloqueado += 1;
    return !bloqueado;
  });

  const validacao = validarPublicacaoPromocaoBase({ promocao, itens, temAlteracoesPendentes, contextoPublicacao });
  if (!validacao.valido) throw montarErroPublicacao(validacao.bloqueios);

  if (!texto(promocao?.id)) {
    throw new Error(`Falha ao publicar promoção
Motivo: promocao.id ausente no frontend`);
  }

  const payload = {
    promocao_id: promocao.id,
    promocao,
    itens: itensElegiveis,
    temAlteracoesPendentes,
    contextoPublicacao,
  };


  let response;
  try {
    response = await base44.functions.invoke('publicarPromocaoOficial', {
      body: payload,
    });
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.error('[publicarPromocaoOficial][frontend][invoke-error][message]', error?.message);
    }

    const dadosErro = error?.response?.data || error?.data || {};
    const etapaErro = (
      dadosErro?.etapa
      || dadosErro?.error?.etapa
      || error?.etapa
      || 'nao_informada'
    );
    const motivoErro = (
      error?.response?.data?.motivo
      || error?.response?.data?.error?.motivo
      || error?.data?.motivo
      || error?.motivo
      || error?.message
      || 'nao_informado'
    );
    const itemIdErro = (
      dadosErro?.item_id
      || dadosErro?.error?.item_id
      || error?.item_id
      || 'nao_informado'
    );
    const militarIdErro = (
      dadosErro?.militar_id
      || dadosErro?.error?.militar_id
      || error?.militar_id
      || 'nao_informado'
    );

    throw new Error(`Falha ao publicar promoção
Etapa: ${etapaErro}
Motivo: ${motivoErro}
Item: ${itemIdErro}
Militar: ${militarIdErro}`);
  }

  const etapa = response?.data?.etapa || null;
  const motivo = response?.data?.motivo || null;
  const erros = response?.data?.errors || [];
  if (response?.data?.success === false || (Array.isArray(erros) && erros.length > 0)) {
    const mensagens = [];
    if (etapa || motivo) mensagens.push(`Falha ao publicar: Etapa: ${etapa || 'nao_informada'} Motivo: ${motivo || 'nao_informado'} item_id: ${response?.data?.item_id || 'nao_informado'} militar_id: ${response?.data?.militar_id || 'nao_informado'}`);
    if (Array.isArray(erros) && erros.length > 0) {
      mensagens.push(...erros.map((erro) => {
        if (typeof erro === 'string') return erro;
        if (erro?.etapa || erro?.motivo) return `Etapa: ${erro?.etapa || 'nao_informada'} Motivo: ${erro?.motivo || erro?.message || 'nao_informado'} item_id: ${erro?.item_id || 'nao_informado'} militar_id: ${erro?.militar_id || 'nao_informado'}`;
        return erro?.message;
      }).filter(Boolean));
    }
    if (mensagens.length > 0) throw montarErroPublicacao(mensagens);
  }

  return response?.data || { publicados: 0, militar_ids_afetados: [], historicos: [], warnings: [], errors: [] };
}


function ehStatusPublicado(status) {
  return STATUS_PROMOCAO_PUBLICADA.has(statusNormalizado(status));
}


function diagLog(evento, dados = {}) {
  void evento;
  void dados;
}

function montarPatchSincronizacaoHistoricoPromocao(promocao = {}) {
  return {
    data_promocao: dataSomente(promocao?.data_promocao),
    boletim_referencia: texto(promocao?.boletim_referencia),
    ato_referencia: texto(promocao?.ato_referencia),
    quadro_novo: texto(promocao?.quadro),
    data_publicacao: dataSomente(promocao?.data_publicacao) || dataSomente(promocao?.data_promocao),
  };
}

export async function sincronizarHistoricoPromocaoPublicada({
  promocaoAntes = null,
  promocaoDepois = null,
  entities = null,
} = {}) {
  if (!promocaoDepois?.id || !ehStatusPublicado(promocaoDepois?.status)) return { atualizados: 0, ignorado: true };
  diagLog('salvar-promocao-publicada:inicio', { promocaoId: promocaoDepois?.id, status: promocaoDepois?.status });
  const Historico = entities?.HistoricoPromocaoMilitarV2;
  if (!Historico || typeof Historico.list !== 'function' || typeof Historico.update !== 'function') {
    throw new Error('Entidade HistoricoPromocaoMilitarV2 indisponível para sincronização da promoção publicada.');
  }

  const houveMudancaEstrutural = (
    dataSomente(promocaoAntes?.data_promocao) !== dataSomente(promocaoDepois?.data_promocao)
    || dataSomente(promocaoAntes?.data_publicacao) !== dataSomente(promocaoDepois?.data_publicacao)
    || texto(promocaoAntes?.boletim_referencia) !== texto(promocaoDepois?.boletim_referencia)
    || texto(promocaoAntes?.ato_referencia) !== texto(promocaoDepois?.ato_referencia)
    || texto(promocaoAntes?.quadro) !== texto(promocaoDepois?.quadro)
  );
  if (!houveMudancaEstrutural) return { atualizados: 0, ignorado: true };

  const historicos = await Historico.list();
  const ativosDaPromocao = (historicos || []).filter((registro) => (
    statusNormalizado(registro?.status_registro) === 'ativo'
    && texto(registro?.promocao_id) === texto(promocaoDepois.id)
  ));

  const patch = montarPatchSincronizacaoHistoricoPromocao(promocaoDepois);
  diagLog('sincronizacao-historico:busca-vinculados', { totalHistoricos: (historicos || []).length, encontrados: ativosDaPromocao.length, idsHistoricos: ativosDaPromocao.map((r) => r?.id), patch });
  await sincronizarHistoricoPromocaoPublicadaTx({
    promocaoId: promocaoDepois.id,
    idsHistoricos: ativosDaPromocao.map((registro) => registro?.id).filter(Boolean),
    patch,
  });
  return { atualizados: ativosDaPromocao.length, ignorado: false };
}

export async function sincronizarHistoricoPromocaoPublicadaTx({
  promocaoId = '',
  idsHistoricos = [],
  patch = {},
} = {}) {
  const idsUnicos = [...new Set((idsHistoricos || []).map((id) => texto(id)).filter(Boolean))];
  if (idsUnicos.length === 0) return { atualizados: 0, ignorado: true };

  const payload = {
    promocao_id: texto(promocaoId),
    historico_ids: idsUnicos,
    patch: {
      data_promocao: dataSomente(patch?.data_promocao),
      boletim_referencia: texto(patch?.boletim_referencia),
      ato_referencia: texto(patch?.ato_referencia),
      quadro_novo: texto(patch?.quadro_novo),
      data_publicacao: dataSomente(patch?.data_publicacao),
    },
  };

  try {
    const response = await base44.functions.invoke('sincronizarHistoricoPromocaoPublicadaTx', { body: payload });
    return response?.data || { atualizados: idsUnicos.length, ignorado: false };
  } catch (error) {
    diagLog('sincronizacao-historico:tx:erro', {
      promocaoId: payload.promocao_id,
      idsHistoricos: payload.historico_ids,
      erro: error?.message || String(error),
    });
    throw error;
  }
}

function statusPromocaoPosReversao(itens = []) {
  const publicados = (itens || []).filter((item) => Boolean(item?.publicado) && statusNormalizado(item?.status) === 'publicado').length;
  if (publicados === 0) return 'rascunho';
  if (publicados < (itens || []).length) return 'publicada_parcial';
  return 'publicada';
}

async function restaurarCadastroMilitarDaPromocao({
  item,
  historico,
  militar,
  entities,
  contexto = 'rollback',
} = {}) {
  const deveRestaurarCadastro = Boolean(item?.atualizar_cadastro_militar)
    || statusNormalizado(item?.resultado_aplicacao_cadastro) === 'imediatamente_superior';
  if (!deveRestaurarCadastro) return { exigiaRollback: false, cadastroRestaurado: false };

  if (!historico?.id) {
    throw new Error(`Rollback cadastral bloqueado (${contexto}): histórico oficial da promoção não foi encontrado.`);
  }

  const MilitarEntity = entities?.Militar;
  if (!MilitarEntity || typeof MilitarEntity.get !== 'function' || typeof MilitarEntity.update !== 'function') {
    throw new Error(`Entidade Militar indisponível para rollback cadastral (${contexto}).`);
  }

  const militarId = texto(item?.militar_id) || texto(item?.militar?.id) || texto(militar?.id);
  if (!militarId) {
    throw new Error(`Rollback cadastral bloqueado (${contexto}): item sem militar vinculado.`);
  }

  const militarAtual = await MilitarEntity.get(militarId);
  if (!militarAtual?.id) {
    throw new Error(`Rollback cadastral bloqueado (${contexto}): militar vinculado não encontrado.`);
  }

  const postoAtual = texto(militarAtual?.posto_graduacao);
  const quadroAtual = texto(militarAtual?.quadro);
  const postoNovo = texto(historico?.posto_graduacao_novo);
  const quadroNovo = texto(historico?.quadro_novo);
  const coincideComHistoricoPublicado = deveRollbackCadastroMilitarPorReversao({
    historico: { ...historico, posto_graduacao_novo: postoNovo, quadro_novo: quadroNovo },
    militar: { ...militarAtual, posto_graduacao: postoAtual, quadro: quadroAtual },
  });
  if (!coincideComHistoricoPublicado) {
    throw new Error(`Rollback cadastral bloqueado (${contexto}): cadastro atual do militar diverge do posto/quadro publicado nesta promoção.`);
  }

  await MilitarEntity.update(militarId, {
    posto_graduacao: texto(historico?.posto_graduacao_anterior),
    quadro: texto(historico?.quadro_anterior),
  });
  return { exigiaRollback: true, cadastroRestaurado: true };
}

export async function reverterPublicacaoPromocaoMilitar({
  promocao,
  item,
  itensPromocao = [],
  entities,
  motivo = '',
  observacoes = '',
  usuario = null,
} = {}) {
  const motivoNormalizado = texto(motivo);
  if (!promocao?.id) throw new Error('Promoção não carregada.');
  if (!item?.id) throw new Error('Item da promoção não carregado.');

  const Historico = entities?.HistoricoPromocaoMilitarV2;
  const PromocaoMilitar = entities?.PromocaoMilitar;
  const Promocao = entities?.Promocao;

  if (!Historico || typeof Historico.update !== 'function') throw new Error('Entidade HistoricoPromocaoMilitarV2 indisponível para reversão.');
  if (!PromocaoMilitar || typeof PromocaoMilitar.update !== 'function') throw new Error('Entidade PromocaoMilitar indisponível para reversão.');
  if (!Promocao || typeof Promocao.update !== 'function') throw new Error('Entidade Promocao indisponível para recalcular status.');

  diagLog('reversao:inicio', {
    promocaoMilitarId: item?.id,
    militarId: item?.militar_id,
    historicoPromocaoV2Id: item?.historico_promocao_v2_id,
    atualizar_cadastro_militar: item?.atualizar_cadastro_militar,
    resultado_aplicacao_cadastro: item?.resultado_aplicacao_cadastro,
  });

  const historicoId = texto(item?.historico_promocao_v2_id);
  if (!historicoId) throw new Error('Sem histórico vinculado para reversão.');
  const historicoRegistro = typeof Historico.get === 'function' ? await Historico.get(historicoId) : null;
  diagLog('reversao:historico-carregado', { historicoId, historicoRegistro, postoAnterior: historicoRegistro?.posto_graduacao_anterior, quadroAnterior: historicoRegistro?.quadro_anterior, postoNovo: historicoRegistro?.posto_graduacao_novo, quadroNovo: historicoRegistro?.quadro_novo });
  const militarAtual = (entities?.Militar && typeof entities.Militar.get === 'function' && item?.militar_id)
    ? await entities.Militar.get(item.militar_id)
    : item?.militar;
  const validacaoReversao = podeReverterPublicacaoPromocao({
    promocao,
    item,
    historico: historicoRegistro,
    militar: militarAtual,
    motivo: motivoNormalizado,
  });
  if (!validacaoReversao.permitido) throw new Error(validacaoReversao.motivo);

  const payload = {
    promocao,
    item,
    itensPromocao,
    motivo: motivoNormalizado,
    observacoes,
    usuario,
  };

  const response = await base44.functions.invoke('reverterPublicacaoPromocaoMilitarTx', {
    body: payload,
  });
  const data = response?.data || response || {};
  if (data?.success === false) {
    throw new Error(data?.motivo || 'Falha ao reverter publicação da promoção militar.');
  }

  return {
    historicoCancelado: Boolean(data?.historicoCancelado ?? true),
    cadastroRestaurado: Boolean(data?.cadastroRestaurado),
    promocaoRecalculada: Boolean(data?.promocaoRecalculada ?? true),
  };
}

export async function excluirCadeiaPromocaoMilitar({
  promocaoMilitarId,
  motivo = '',
  entities,
} = {}) {
  const itemId = texto(promocaoMilitarId);
  const motivoNormalizado = texto(motivo);
  if (!itemId) throw new Error('Item da promoção não informado.');
  if (!motivoNormalizado) throw new Error('Motivo da exclusão definitiva é obrigatório.');

  const PromocaoMilitar = entities?.PromocaoMilitar;
  const Historico = entities?.HistoricoPromocaoMilitarV2;
  if (!PromocaoMilitar || typeof PromocaoMilitar.get !== 'function') throw new Error('Entidade PromocaoMilitar indisponível para exclusão definitiva.');
  if (!Historico || typeof Historico.get !== 'function') throw new Error('Entidade HistoricoPromocaoMilitarV2 indisponível para exclusão definitiva.');

  const item = typeof PromocaoMilitar.get === 'function' ? await PromocaoMilitar.get(itemId) : null;
  if (!item?.id) throw new Error('Item da promoção não encontrado.');
  if (!item?.promocao_id) throw new Error('Item sem promoção vinculada.');

  const historicoId = texto(item?.historico_promocao_v2_id);
  const historicoRegistro = historicoId && typeof Historico.get === 'function' ? await Historico.get(historicoId) : null;
  const validacaoExclusao = podeExcluirDefinitivamentePromocaoMilitar({ item, historico: historicoRegistro });
  if (!validacaoExclusao.permitido) throw new Error(validacaoExclusao.motivo);

  const response = await base44.functions.invoke('excluirCadeiaPromocaoMilitarTx', {
    body: {
      promocaoMilitarId: itemId,
      motivo: motivoNormalizado,
    },
  });
  const data = response?.data || response || {};
  if (data?.success === false) {
    throw new Error(data?.motivo || 'Falha ao excluir definitivamente promoção militar.');
  }

  return {
    promocaoExcluida: Boolean(data?.promocaoExcluida),
    promocaoMilitarExcluido: Boolean(data?.promocaoMilitarExcluido ?? true),
    historicoExcluido: Boolean(data?.historicoExcluido ?? Boolean(historicoId)),
    cadastroRestaurado: Boolean(data?.cadastroRestaurado),
  };
}

export const STATUS_TURMA_OPERACIONAL = [
  'elegivel',
  'selecionado',
  'bloqueado',
  'publicado',
  'retificado',
  'cancelado',
];

function contarVinculadosReaisExclusao({ vinculadosReais, turma, listaVinculada } = {}) {
  if (Number.isFinite(Number(vinculadosReais))) return Number(vinculadosReais);
  if (Array.isArray(turma)) return turma.length;
  if (Array.isArray(listaVinculada)) return listaVinculada.length;
  return null;
}

function temIndicicioVinculoOficial({ turma, listaVinculada } = {}) {
  const vinculados = Array.isArray(turma) ? turma : listaVinculada;
  if (!Array.isArray(vinculados)) return false;
  return vinculados.some((item) => texto(item?.historico_promocao_v2_id));
}

export function promocaoPermiteExclusao(promocao = {}, contexto = {}) {
  if (temIndicicioVinculoOficial(contexto)) return false;
  const totalVinculadosReais = contarVinculadosReaisExclusao(contexto);
  if (totalVinculadosReais > 0) return false;
  if (STATUS_PROMOCAO_RASCUNHO.has(statusNormalizado(promocao?.status))) return true;
  return totalVinculadosReais === 0;
}

export function mensagemBloqueioExclusaoPromocao(promocao = {}, contexto = {}) {
  if (promocaoPermiteExclusao(promocao, contexto)) return '';
  return 'Somente promoções em rascunho ou sem militares vinculados reais podem ser excluídas.';
}

export function valorOrdemTurma(valor) {
  const conteudo = texto(valor);
  if (!conteudo) return '';
  const numero = Number(conteudo);
  return Number.isFinite(numero) ? numero : conteudo;
}

export function normalizarItemTurmaOperacional(item = {}) {
  return {
    id: item.id,
    promocao_id: texto(item.promocao_id),
    militar_id: texto(item.militar_id),
    historico_promocao_v2_id: texto(item.historico_promocao_v2_id),
    ordem: valorOrdemTurma(item.ordem),
    status: STATUS_TURMA_OPERACIONAL.includes(texto(item.status)) ? texto(item.status) : 'elegivel',
    selecionado: Boolean(item.selecionado),
    publicado: Boolean(item.publicado),
    justificativa: texto(item.justificativa),
    observacao: texto(item.observacao),
    origem: texto(item.origem),
    atualizar_cadastro_militar: Boolean(item.atualizar_cadastro_militar),
    motivo_atualizacao_cadastro: texto(item.motivo_atualizacao_cadastro),
    resultado_aplicacao_cadastro: texto(item.resultado_aplicacao_cadastro),
  };
}

export function aplicarEfeitoCadastroPromocaoMilitar(item = {}, { promocao } = {}) {
  const efeito = getSugestaoAtualizacaoCadastro({
    militar: item?.militar,
    promocao: promocao || item?.promocao,
  });

  return {
    ...item,
    atualizar_cadastro_militar: efeito.atualizar,
    motivo_atualizacao_cadastro: efeito.mensagem,
    resultado_aplicacao_cadastro: efeito.tipo,
  };
}

export function montarPatchPromocaoMilitar(item = {}, { promocao } = {}) {
  const normalizado = normalizarItemTurmaOperacional(
    promocao ? aplicarEfeitoCadastroPromocaoMilitar(item, { promocao }) : item,
  );
  const patch = {
    selecionado: normalizado.selecionado,
    status: normalizado.status,
    justificativa: normalizado.justificativa,
    observacao: normalizado.observacao,
    atualizar_cadastro_militar: normalizado.atualizar_cadastro_militar,
    motivo_atualizacao_cadastro: normalizado.motivo_atualizacao_cadastro,
    resultado_aplicacao_cadastro: normalizado.resultado_aplicacao_cadastro,
  };
  if (isOrdemPreenchida(normalizado.ordem)) patch.ordem = Number(normalizado.ordem);
  return patch;
}

function valorComparavelImutabilidade(valor) {
  const conteudo = texto(valor);
  if (!conteudo) return '';
  return conteudo.toLowerCase();
}

function itemBloqueadoEdicaoDireta(item = {}, historicoPorId = new Map()) {
  if (Boolean(item?.publicado) || statusNormalizado(item?.status) === 'publicado') return true;
  const historicoId = texto(item?.historico_promocao_v2_id);
  if (!historicoId) return false;
  const historico = historicoPorId.get(historicoId);
  return statusNormalizado(historico?.status_registro) === 'ativo';
}

export function validarImutabilidadePosPublicacao({
  itensOriginais = [],
  itensRascunho = [],
  historicosV2 = [],
} = {}) {
  const originaisPorId = new Map((itensOriginais || []).map((item) => [texto(item?.id), item]));
  const historicoPorId = new Map((historicosV2 || []).map((item) => [texto(item?.id), item]));
  const camposBloqueados = ['ordem', 'militar_id', 'quadro', 'posto_graduacao'];
  const mudancasBloqueadas = [];

  (itensRascunho || []).forEach((atual) => {
    const id = texto(atual?.id);
    const original = originaisPorId.get(id);
    if (!original || !itemBloqueadoEdicaoDireta(original, historicoPorId)) return;
    camposBloqueados.forEach((campo) => {
      const antes = valorComparavelImutabilidade(original?.[campo]);
      const depois = valorComparavelImutabilidade(atual?.[campo]);
      if (antes !== depois) mudancasBloqueadas.push({ id, campo, antes, depois });
    });
  });

  const mensagens = mudancasBloqueadas.map((item) => `Item ${item.id}: alteração de ${item.campo} não permitida após publicação.`);
  return { valido: mudancasBloqueadas.length === 0, mudancasBloqueadas, mensagens };
}

export function avaliarAlertasTurmaOperacional(itens = []) {
  const alertasPorId = new Map();
  const alertasGlobais = [];
  const adicionar = (id, alerta) => {
    if (!alertasPorId.has(id)) alertasPorId.set(id, []);
    alertasPorId.get(id).push(alerta);
  };

  const porMilitar = new Map();
  const ordensSelecionadas = new Map();

  itens.forEach((itemBruto, indice) => {
    const item = normalizarItemTurmaOperacional(itemBruto);
    const id = texto(item.id) || `linha-${indice}`;
    const militarId = texto(item.militar_id);
    const ordemTexto = texto(item.ordem);

    if (militarId) {
      if (!porMilitar.has(militarId)) porMilitar.set(militarId, []);
      porMilitar.get(militarId).push(id);
    }

    if (!ordemTexto) adicionar(id, 'sem ordem');
    if (item.selecionado && ['bloqueado', 'cancelado'].includes(item.status)) adicionar(id, 'selecionado com status bloqueado/cancelado');
    if (item.publicado && !item.selecionado) adicionar(id, 'publicado mas selecionado = false');
    if (item.status === 'publicado' && !texto(item.historico_promocao_v2_id)) adicionar(id, 'status publicado sem historico_promocao_v2_id');
    if (['bloqueado', 'cancelado'].includes(item.status) && !texto(item.justificativa)) adicionar(id, 'bloqueado/cancelado sem justificativa');

    if (item.selecionado && ordemTexto) {
      if (!ordensSelecionadas.has(ordemTexto)) ordensSelecionadas.set(ordemTexto, []);
      ordensSelecionadas.get(ordemTexto).push(id);
    }
  });

  porMilitar.forEach((ids) => {
    if (ids.length > 1) {
      alertasGlobais.push('militar duplicado na turma');
      ids.forEach((id) => adicionar(id, 'militar duplicado na turma'));
    }
  });

  ordensSelecionadas.forEach((ids) => {
    if (ids.length > 1) {
      alertasGlobais.push('ordem duplicada entre selecionados');
      ids.forEach((id) => adicionar(id, 'ordem duplicada'));
    }
  });

  return {
    alertasPorId,
    alertasGlobais: [...new Set(alertasGlobais)],
  };
}

export function validarSalvarTurmaOperacional(itens = [], { promocao } = {}) {
  const promocaoInicioCadeia = isPromocaoInicioCadeia(promocao);
  const { alertasPorId, alertasGlobais } = avaliarAlertasTurmaOperacional(itens);
  const bloqueios = [...alertasGlobais];

  alertasPorId.forEach((alertas) => {
    alertas.forEach((alerta) => {
      if (alerta === 'bloqueado/cancelado sem justificativa') bloqueios.push(alerta);
    });
  });

  const temIncompatibilidadeCadastro = !promocaoInicioCadeia && itens.some((item) => {
    const promocaoReferencia = promocao || item?.promocao;
    if (!promocaoReferencia || !item?.militar) return false;
    return getSugestaoAtualizacaoCadastro({
      militar: item.militar,
      promocao: promocaoReferencia,
    }).bloqueiaSalvar;
  });
  if (temIncompatibilidadeCadastro) bloqueios.push(MENSAGEM_BLOQUEIO_REBAIXAMENTO_CADASTRAL);

  return {
    valido: bloqueios.length === 0,
    bloqueios: [...new Set(bloqueios)],
    alertasPorId,
    alertasGlobais,
  };
}

export function montarPayloadAdicaoManualTurma({ promocao = {}, historico = {}, militar = null, militarId = '', usuario = {}, registrosExistentes = [], ordem } = {}) {
  const agora = new Date().toISOString();
  const ordemNumerica = isOrdemPreenchida(ordem) ? Number(ordem) : proximaOrdemNumerica(registrosExistentes);
  const efeito = getSugestaoAtualizacaoCadastro({ militar: militar || historico?.militar, promocao });
  return {
    promocao_id: texto(promocao?.id),
    militar_id: texto(militarId || historico?.militar_id),
    historico_promocao_v2_id: texto(historico?.id),
    ordem: ordemNumerica,
    status: 'elegivel',
    selecionado: false,
    publicado: false,
    origem: 'adicao_manual',
    data_vinculo: agora,
    usuario_vinculo: texto(usuario?.email) || texto(usuario?.full_name) || texto(usuario?.name) || 'operador',
    atualizar_cadastro_militar: efeito.atualizar,
    motivo_atualizacao_cadastro: efeito.mensagem,
    resultado_aplicacao_cadastro: efeito.tipo,
  };
}

function chaveDesempateMilitar(militar = {}, militarId = '') {
  return [texto(militar?.matricula), texto(militarId)].join('|').toLowerCase();
}

export function postoGraduacaoBaseAnterior(postoGraduacaoAtual = '') {
  const atual = normalizarPostoGraduacao(postoGraduacaoAtual);
  if (!atual || atual.includes('3º sargento') || atual.includes('3o sargento')) return '';
  if (atual.includes('2º ten') || atual.includes('2o ten') || atual.includes('2º tenente') || atual.includes('2o tenente')) return 'subtenente';
  if (atual.includes('subtenente')) return '1º sargento';
  if (atual.includes('1º sargento') || atual.includes('1o sargento')) return '2º sargento';
  if (atual.includes('2º sargento') || atual.includes('2o sargento')) return '3º sargento';
  const indiceAtual = POSTOS_GRADUACOES_HIERARQUIA.findIndex((posto) => posto === atual);
  if (indiceAtual <= 0) return '';
  return POSTOS_GRADUACOES_HIERARQUIA[indiceAtual - 1];
}

export function calcularInsercaoPorAntiguidadeAnterior({
  promocao = {},
  militar = {},
  turmaAtual = [],
  historicos = [],
  militares = [],
} = {}) {
  const alertas = [];
  const postoBaseAnterior = postoGraduacaoBaseAnterior(promocao?.posto_graduacao);
  if (!postoBaseAnterior) {
    return {
      ordemSugerida: null,
      baseAnterior: null,
      deslocamentos: [],
      alertas: ['Promoção de formação ou sem posto-base anterior: manter ordem manual.'],
      podeAdicionar: true,
    };
  }

  const ativosNoPostoPorMilitar = new Map();
  (historicos || []).forEach((h) => {
    if (statusNormalizado(h?.status_registro) !== 'ativo') return;
    if (normalizarPostoGraduacao(h?.posto_graduacao_novo) !== postoBaseAnterior) return;
    const mid = texto(h?.militar_id);
    if (!mid) return;
    const existente = ativosNoPostoPorMilitar.get(mid);
    if (!existente || texto(h?.data_promocao) > texto(existente?.data_promocao)) {
      ativosNoPostoPorMilitar.set(mid, h);
    }
  });

  const militarId = texto(militar?.id);
  const historicoBase = ativosNoPostoPorMilitar.get(militarId);

  if (!historicoBase) {
    return { ordemSugerida: null, baseAnterior: null, deslocamentos: [], alertas: ['Sem histórico ativo no posto anterior esperado.'], podeAdicionar: false };
  }

  const referencia = {
    militar_id: militarId,
    data_promocao: texto(historicoBase?.data_promocao),
    classificacao: Number(historicoBase?.antiguidade_referencia_ordem || 0),
    data_nascimento: texto(militar?.data_nascimento),
    desempate: chaveDesempateMilitar(militar, militarId),
  };

  const militarPorId = new Map((militares || []).map((m) => [texto(m?.id), m]));
  const ordenados = (turmaAtual || []).filter((item) => Number(item?.ordem) > 0).sort((a, b) => Number(a.ordem) - Number(b.ordem));
  let posicao = ordenados.length;
  for (let i = 0; i < ordenados.length; i += 1) {
    const item = ordenados[i];
    const hist = ativosNoPostoPorMilitar.get(texto(item?.militar_id));
    if (!hist) continue;
    const cmpData = texto(hist?.data_promocao).localeCompare(referencia.data_promocao);
    const cmpClassificacao = Number(hist?.antiguidade_referencia_ordem || 0) - referencia.classificacao;
    const militarDaTurma = militarPorId.get(texto(item?.militar_id));
    const cmpNascimento = texto(militarDaTurma?.data_nascimento).localeCompare(referencia.data_nascimento);
    const cmpDesempate = chaveDesempateMilitar(militarDaTurma, texto(item?.militar_id)).localeCompare(referencia.desempate);
    if (
      cmpData > 0
      || (cmpData === 0 && cmpClassificacao > 0)
      || (cmpData === 0 && cmpClassificacao === 0 && cmpNascimento > 0)
      || (cmpData === 0 && cmpClassificacao === 0 && cmpNascimento === 0 && cmpDesempate > 0)
    ) {
      posicao = i;
      break;
    }
  }
  const ordemSugerida = posicao + 1;
  const deslocamentos = ordenados
    .filter((item) => Number(item?.ordem) >= ordemSugerida)
    .map((item) => ({ id: item.id, militar_id: item.militar_id, ordemAtual: Number(item.ordem), ordemSugerida: Number(item.ordem) + 1 }));

  return {
    ordemSugerida,
    baseAnterior: {
      posto: postoBaseAnterior,
      dataPromocao: texto(historicoBase?.data_promocao),
      classificacao: referencia.classificacao,
    },
    deslocamentos,
    alertas,
    podeAdicionar: true,
  };
}


export function resultadoAplicacaoCadastro(efeitoOuAtualizar) {
  if (typeof efeitoOuAtualizar === 'object' && efeitoOuAtualizar !== null) {
    if (efeitoOuAtualizar.tipo === 'imediatamente_superior') return 'Cadastro será atualizado';
    if (['incompativel', 'revisao'].includes(efeitoOuAtualizar.tipo)) return 'Promoção incompatível';
    return 'Cadastro preservado';
  }
  return efeitoOuAtualizar ? 'Cadastro será atualizado' : 'Cadastro preservado';
}

export function proximaOrdemNumerica(registros = []) {
  const maior = (registros || []).reduce((atual, registro) => {
    const numero = Number(registro?.ordem ?? registro?.antiguidade_referencia_ordem);
    return Number.isFinite(numero) && numero > atual ? numero : atual;
  }, 0);
  return maior + 1;
}

export function ordemHistoricoOuProxima(historico = {}, registrosExistentes = []) {
  if (isOrdemPreenchida(historico?.antiguidade_referencia_ordem)) {
    return Number(historico.antiguidade_referencia_ordem);
  }
  return proximaOrdemNumerica(registrosExistentes);
}

export function montarPayloadsPromocaoMilitarAgrupamento({ promocao = {}, historicos = [], registrosExistentes = [], militarPorId = new Map() } = {}) {
  const existentes = new Set((registrosExistentes || []).map((registro) => `${texto(registro?.promocao_id)}|${texto(registro?.militar_id)}`));
  const payloads = [];

  let maiorOrdem = (registrosExistentes || []).reduce((atual, registro) => {
    const numero = Number(registro?.ordem ?? registro?.antiguidade_referencia_ordem);
    return Number.isFinite(numero) && numero > atual ? numero : atual;
  }, 0);

  (historicos || []).forEach((historico) => {
    const promocaoId = texto(promocao?.id);
    const militarId = texto(historico?.militar_id);
    const chave = `${promocaoId}|${militarId}`;
    if (!promocaoId || !militarId || existentes.has(chave)) return;

    let ordem;
    if (isOrdemPreenchida(historico?.antiguidade_referencia_ordem)) {
      ordem = Number(historico.antiguidade_referencia_ordem);
    } else {
      maiorOrdem += 1;
      ordem = maiorOrdem;
    }

    const militar = historico?.militar || militarPorId.get(militarId) || null;
    const sugestao = getSugestaoAtualizacaoCadastro({ militar, promocao });
    const atualizarCadastro = Boolean(sugestao.atualizar);
    const payload = {
      promocao_id: promocaoId,
      militar_id: militarId,
      historico_promocao_v2_id: texto(historico?.id),
      ordem,
      status: 'publicado',
      selecionado: true,
      publicado: true,
      origem: 'agrupamento',
      atualizar_cadastro_militar: atualizarCadastro,
      motivo_atualizacao_cadastro: sugestao.mensagem,
      resultado_aplicacao_cadastro: sugestao.tipo,
    };

    existentes.add(chave);
    if (ordem > maiorOrdem) maiorOrdem = ordem;
    payloads.push(payload);
  });

  return payloads;
}

export function texto(valor) {
  return String(valor ?? '').trim();
}

export function normalizar(valor) {
  return texto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function valorOuTraco(valor) {
  return texto(valor) || TEXTO_VAZIO;
}

export function dataFormatada(data) {
  if (!data) return TEXTO_VAZIO;
  const [ano, mes, dia] = String(data).split('T')[0].split('-');
  if (!ano || !mes || !dia) return texto(data) || TEXTO_VAZIO;
  return `${dia}/${mes}/${ano}`;
}

export function nomeMilitar(militar) {
  return texto(militar?.nome_guerra) || texto(militar?.nome_completo) || 'Militar sem nome';
}

export function tituloPromocao(promocao) {
  const partes = [
    promocao?.posto_graduacao,
    promocao?.quadro,
    dataFormatada(promocao?.data_promocao),
  ].filter((parte) => texto(parte) && parte !== TEXTO_VAZIO);
  return partes.length ? partes.join(' • ') : `Promoção ${promocao?.id || ''}`.trim();
}

export function statusNormalizado(valor) {
  return normalizar(valor) || 'ativo';
}

export function isStatusOperacional(registro) {
  return STATUS_OPERACIONAIS.has(statusNormalizado(registro?.status_registro));
}

export function isStatusCanceladoRetificado(registro) {
  return STATUS_CANCELADOS_RETIFICADOS.has(statusNormalizado(registro?.status_registro));
}

export function isOrdemPreenchida(valor) {
  if (valor === null || valor === undefined || valor === '') return false;
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0;
}

export function indicePostoGraduacao(postoGraduacao) {
  const normalizado = normalizarPostoGraduacao(postoGraduacao);
  const indice = POSTOS_GRADUACOES_PROMOCAO.findIndex((posto) => posto === normalizado);
  return indice >= 0 ? indice : POSTOS_GRADUACOES_PROMOCAO.length;
}

export function compararTexto(a, b) {
  return texto(a).localeCompare(texto(b), 'pt-BR', { sensitivity: 'base', numeric: true });
}

export function ordenarPromocoes(promocoes = []) {
  return [...promocoes].sort((a, b) => {
    const data = texto(b?.data_promocao).localeCompare(texto(a?.data_promocao));
    if (data) return data;

    const posto = indicePostoGraduacao(a?.posto_graduacao) - indicePostoGraduacao(b?.posto_graduacao);
    if (posto) return posto;

    const quadro = compararTexto(a?.quadro, b?.quadro);
    if (quadro) return quadro;

    const status = compararTexto(a?.status, b?.status);
    if (status) return status;

    return compararTexto(a?.id, b?.id);
  });
}

export function chaveAgrupamentoPromocaoLike(item) {
  return [
    item?.posto_graduacao ?? item?.posto_graduacao_novo,
    item?.quadro ?? item?.quadro_novo,
    item?.data_promocao,
    item?.data_publicacao,
    item?.boletim_referencia,
    item?.ato_referencia,
  ].map((valor) => normalizar(valor) || '∅').join('|');
}


function mesmoValorNormalizado(a, b) {
  return normalizar(a) === normalizar(b);
}

function rotuloCampoAusenteOuDivergente(valorHistorico, valorPromocao, rotuloAusente, rotuloDivergente = rotuloAusente) {
  if (!texto(valorHistorico) || !texto(valorPromocao)) return rotuloAusente;
  return mesmoValorNormalizado(valorHistorico, valorPromocao) ? '' : rotuloDivergente;
}

export function avaliarCompatibilidadePromocao(historico, promocao) {
  const motivos = [];
  const mesmoPosto = mesmoValorNormalizado(historico?.posto_graduacao_novo, promocao?.posto_graduacao);
  const mesmoQuadro = mesmoValorNormalizado(historico?.quadro_novo, promocao?.quadro);
  const mesmaDataPromocao = mesmoValorNormalizado(historico?.data_promocao, promocao?.data_promocao);

  if (!mesmoPosto || !mesmoQuadro || !mesmaDataPromocao) {
    return {
      compatibilidade: 'fraca',
      motivos: [
        !mesmoPosto ? 'posto divergente' : '',
        !mesmoQuadro ? 'quadro divergente' : '',
        !mesmaDataPromocao ? 'data de promoção divergente' : '',
      ].filter(Boolean),
    };
  }

  const dataPublicacao = rotuloCampoAusenteOuDivergente(
    historico?.data_publicacao,
    promocao?.data_publicacao,
    'faltando data de publicação',
    'data de publicação divergente',
  );
  const boletim = rotuloCampoAusenteOuDivergente(
    historico?.boletim_referencia,
    promocao?.boletim_referencia,
    'faltando boletim',
    'boletim divergente',
  );
  const ato = rotuloCampoAusenteOuDivergente(
    historico?.ato_referencia,
    promocao?.ato_referencia,
    'faltando ato',
    'ato divergente',
  );

  [dataPublicacao, boletim, ato].filter(Boolean).forEach((motivo) => motivos.push(motivo));

  if (texto(historico?.promocao_id) && texto(historico?.promocao_id) !== texto(promocao?.id)) motivos.push('já vinculado');
  if (!isOrdemPreenchida(historico?.antiguidade_referencia_ordem)) motivos.push('sem ordem');
  if (isStatusCanceladoRetificado(historico)) motivos.push(statusNormalizado(historico?.status_registro).startsWith('retific') ? 'retificado' : 'cancelado');
  if (!statusCompativelComPromocao(historico, promocao)) motivos.push('status incompatível');

  return {
    compatibilidade: motivos.length === 0 ? 'forte' : 'provável',
    motivos: [...new Set(motivos)],
  };
}

export function possuiNucleoMinimoProvavelVinculavel(historico, promocao) {
  return mesmoValorNormalizado(historico?.posto_graduacao_novo, promocao?.posto_graduacao)
    && mesmoValorNormalizado(historico?.quadro_novo, promocao?.quadro)
    && mesmoValorNormalizado(historico?.data_promocao, promocao?.data_promocao);
}

export function motivosBloqueioVinculoProvavel(historico, promocao) {
  const motivos = [];
  const mesmoPosto = mesmoValorNormalizado(historico?.posto_graduacao_novo, promocao?.posto_graduacao);
  const mesmoQuadro = mesmoValorNormalizado(historico?.quadro_novo, promocao?.quadro);
  const mesmaDataPromocao = mesmoValorNormalizado(historico?.data_promocao, promocao?.data_promocao);

  if (!texto(historico?.militar_id)) motivos.push('militar_id ausente');
  if (!mesmoPosto) motivos.push('posto divergente');
  if (!mesmoQuadro) motivos.push('quadro divergente');
  if (!mesmaDataPromocao) motivos.push('data de promoção divergente');
  if (isStatusCanceladoRetificado(historico)) motivos.push(statusNormalizado(historico?.status_registro).startsWith('retific') ? 'retificado' : 'cancelado');
  if (texto(historico?.promocao_id) && texto(historico?.promocao_id) !== texto(promocao?.id)) motivos.push('já vinculado a outra Promoção');
  if (!statusCompativelComPromocao(historico, promocao)) motivos.push('status incompatível grave');

  return [...new Set(motivos)];
}

export function podeVincularProvavelAdministrativamente(historico, promocao) {
  return avaliarCompatibilidadePromocao(historico, promocao).compatibilidade === 'provável'
    && possuiNucleoMinimoProvavelVinculavel(historico, promocao)
    && motivosBloqueioVinculoProvavel(historico, promocao).length === 0;
}

export function historicoCombinaComPromocao(historico, promocao) {
  return avaliarCompatibilidadePromocao(historico, promocao).compatibilidade === 'forte';
}

export function statusCompativelComPromocao(historico, promocao) {
  const statusHistorico = statusNormalizado(historico?.status_registro);
  const statusPromocao = statusNormalizado(promocao?.status);
  const tipoPromocao = statusNormalizado(promocao?.tipo);

  if (statusPromocao === 'prevista' || tipoPromocao === 'prevista') return statusHistorico === 'previsto';
  if (['ativa', 'ativo', 'concluida', 'concluido', 'homologada', 'historica'].includes(statusPromocao) || tipoPromocao === 'historica') {
    return statusHistorico === 'ativo';
  }

  return STATUS_OPERACIONAIS.has(statusHistorico);
}

export function ordenarHistoricosVinculados(itens = []) {
  return [...itens].sort((a, b) => {
    const ordemA = Number(a?.antiguidade_referencia_ordem || 0) || Number.POSITIVE_INFINITY;
    const ordemB = Number(b?.antiguidade_referencia_ordem || 0) || Number.POSITIVE_INFINITY;
    if (ordemA !== ordemB) return ordemA - ordemB;

    const nome = compararTexto(nomeMilitar(a?.militar), nomeMilitar(b?.militar));
    if (nome) return nome;

    return compararTexto(a?.militar?.matricula, b?.militar?.matricula);
  });
}

export function montarMilitarPorId(militares = []) {
  return new Map((militares || []).map((militar) => [String(militar?.id || ''), militar]));
}

export function enriquecerHistoricos(historicos = [], militarPorId = new Map()) {
  return (historicos || []).map((historico) => ({
    ...historico,
    militar: militarPorId.get(String(historico?.militar_id || '')) || null,
  }));
}

export function alertasCandidato(historico, promocao) {
  const alertas = [];
  if (!isOrdemPreenchida(historico?.antiguidade_referencia_ordem)) alertas.push('Sem ordem de antiguidade');

  const chavePromocao = chaveAgrupamentoPromocaoLike(promocao);
  const chaveHistorico = chaveAgrupamentoPromocaoLike(historico);
  if (chavePromocao !== chaveHistorico) alertas.push('Chave divergente');

  return alertas;
}

export function diagnosticarPromocao({ promocao, historicosCompativeis = [] }) {
  const compativeisOutraPromocao = historicosCompativeis.filter((historico) => texto(historico?.promocao_id) && texto(historico?.promocao_id) !== texto(promocao?.id));
  const canceladosRetificados = historicosCompativeis.filter(isStatusCanceladoRetificado);
  const semOrdem = historicosCompativeis.filter((historico) => isStatusOperacional(historico) && !isOrdemPreenchida(historico?.antiguidade_referencia_ordem));

  const porMilitar = new Map();
  historicosCompativeis
    .filter((historico) => !isStatusCanceladoRetificado(historico))
    .forEach((historico) => {
      const militarId = texto(historico?.militar_id) || `sem-militar:${historico?.id}`;
      porMilitar.set(militarId, (porMilitar.get(militarId) || 0) + 1);
    });
  const duplicidadesMilitar = [...porMilitar.entries()].filter(([, total]) => total > 1);

  const chavePromocao = chaveAgrupamentoPromocaoLike(promocao);
  const chaveDivergente = texto(promocao?.chave_agrupamento) && texto(promocao?.chave_agrupamento) !== chavePromocao;

  return {
    compativeisOutraPromocao,
    duplicidadesMilitar,
    semOrdem,
    canceladosRetificados,
    chaveDivergente,
    chaveCalculada: chavePromocao,
  };
}

export function filtrarCandidatosCompativeis({ promocao, historicos = [] }) {
  return historicos.filter((historico) => (
    avaliarCompatibilidadePromocao(historico, promocao).compatibilidade === 'forte'
    && !texto(historico?.promocao_id)
    && statusCompativelComPromocao(historico, promocao)
  ));
}

export function buscarCandidatosProvaveis({ promocao, historicos = [] }) {
  return historicos
    .map((historico) => ({
      ...historico,
      diagnosticoCompatibilidade: avaliarCompatibilidadePromocao(historico, promocao),
    }))
    .filter((historico) => historico.diagnosticoCompatibilidade.compatibilidade === 'provável')
    .filter((historico) => texto(historico?.promocao_id) !== texto(promocao?.id));
}

export function montarDiagnosticoMilitaresPromocao({ promocao, historicos = [], militares = [] }) {
  const historicosPorMilitar = new Map();
  historicos.forEach((historico) => {
    const militarId = texto(historico?.militar_id);
    if (!militarId) return;
    if (!historicosPorMilitar.has(militarId)) historicosPorMilitar.set(militarId, []);
    historicosPorMilitar.get(militarId).push(historico);
  });

  const linhasHistoricos = historicos
    .map((historico) => ({ historico, avaliacao: avaliarCompatibilidadePromocao(historico, promocao) }))
    .filter(({ avaliacao }) => avaliacao.compatibilidade !== 'fraca')
    .map(({ historico, avaliacao }) => {
      const motivos = avaliacao.motivos.length ? avaliacao.motivos : ['histórico compatível'];
      const vinculadoNesta = texto(historico?.promocao_id) === texto(promocao?.id);
      const vinculadoOutra = texto(historico?.promocao_id) && !vinculadoNesta;
      const situacao = vinculadoNesta ? 'Vinculado' : vinculadoOutra ? 'Já vinculado em outra promoção' : avaliacao.compatibilidade === 'forte' ? 'Compatível' : 'Sem vínculo';
      const acaoSugerida = vinculadoNesta ? 'Acompanhar' : vinculadoOutra ? 'Conflito' : avaliacao.compatibilidade === 'forte' ? 'Pode vincular' : 'Revisar';

      return {
        chave: `historico:${historico?.id}`,
        militar_id: historico?.militar_id,
        historico_id: historico?.id,
        situacao,
        motivo: motivos.join(', '),
        acaoSugerida,
        compatibilidade: avaliacao.compatibilidade,
      };
    });

  const militaresSemHistorico = militares
    .filter((militar) => mesmoValorNormalizado(militar?.posto_graduacao, promocao?.posto_graduacao)
      && mesmoValorNormalizado(militar?.quadro, promocao?.quadro)
      && !historicosPorMilitar.has(texto(militar?.id)))
    .map((militar) => ({
      chave: `militar-sem-historico:${militar?.id}`,
      militar_id: militar?.id,
      historico_id: '',
      situacao: 'Sem histórico',
      motivo: 'Sem histórico V2',
      acaoSugerida: 'Criar histórico futuramente',
      compatibilidade: 'diagnóstico',
    }));

  return [...linhasHistoricos, ...militaresSemHistorico];
}

export function simularImpactoCadeiaPromocoes({
  promocaoBase,
  militarId,
  ordemSugeridaBase,
  promocoes = [],
  promocaoMilitar = [],
  militarPorId = new Map(),
}) {
  const alertas = [];
  const militarIdNormalizado = texto(militarId);
  const ordemSugerida = Number(ordemSugeridaBase);
  if (!promocaoBase?.id) throw new Error('promoção-base é obrigatória');
  if (!militarIdNormalizado) throw new Error('militarId é obrigatório');
  if (!Number.isFinite(ordemSugerida) || ordemSugerida <= 0) throw new Error('ordemSugeridaBase deve ser numérica e positiva');


  const futuras = (promocoes || [])
    .filter((p) => p?.id && String(p.id) !== String(promocaoBase.id))
    .filter((p) => texto(p?.quadro) === texto(promocaoBase?.quadro))
    .filter((p) => texto(p?.data_promocao) > texto(promocaoBase?.data_promocao))
    .sort((a, b) => texto(a?.data_promocao).localeCompare(texto(b?.data_promocao)));

  const idsInteresse = new Set(futuras.map((p) => String(p.id)));
  idsInteresse.add(String(promocaoBase.id));

  const itensPorPromocaoMap = new Map();
  const indexBase = new Map();
  (promocaoMilitar || []).forEach((item) => {
    const pid = String(item?.promocao_id || '');
    if (!pid || !idsInteresse.has(pid)) return;

    if (!itensPorPromocaoMap.has(pid)) itensPorPromocaoMap.set(pid, []);
    itensPorPromocaoMap.get(pid).push(item);

    if (pid === String(promocaoBase.id)) {
      indexBase.set(String(item?.militar_id || ''), item);
    }
  });

  const itemMilitarBase = indexBase.get(militarIdNormalizado);
  const ordemAtualBase = Number(itemMilitarBase?.ordem || 0);
  if (!Number.isFinite(ordemAtualBase) || ordemAtualBase <= 0) alertas.push('Militar não possui ordem válida na promoção-base.');

  const delta = ordemSugerida - ordemAtualBase;
  if (!Number.isFinite(delta) || delta === 0) {
    return { promocoesAfetadas: [], alertas: ['Sem impacto: a ordem sugerida é igual à ordem atual.'] };
  }

  const resultado = [];
  const cacheNomes = new Map();

  const getNomeCached = (item) => {
    const mId = String(item?.militar_id || '');
    if (cacheNomes.has(mId)) return cacheNomes.get(mId);
    const nome = nomeMilitar(militarPorId.get(mId) || item?.militar);
    cacheNomes.set(mId, nome);
    return nome;
  };

  futuras.forEach((promocao) => {
    const brutos = itensPorPromocaoMap.get(String(promocao.id)) || [];
    const itens = brutos
      .filter((item) => Number(item?.ordem) > 0)
      .sort((a, b) => Number(a?.ordem || 0) - Number(b?.ordem || 0));

    if (itens.length === 0) return;

    let atual = null;
    const semMilitar = [];
    const ordemAtualMap = new Map();
    const ordemAtualLista = [];

    for (let i = 0; i < itens.length; i++) {
      const item = itens[i];
      const mId = item.militar_id;
      const mIdStr = String(mId || '');
      const ordem = Number(item.ordem);

      if (mIdStr === militarIdNormalizado) {
        atual = item;
      } else {
        semMilitar.push(item);
      }

      const nome = getNomeCached(item);
      const info = {
        militar_id: mId,
        nome,
        ordem,
      };
      ordemAtualLista.push(info);
      if (mIdStr) {
        ordemAtualMap.set(mIdStr, { ordem, nome });
      }
    }

    if (!atual) return;

    const ordemAtual = Number(atual?.ordem || 0);
    const ordemSugeridaFutura = Math.max(1, ordemAtual + delta);

    const deslocados = [];
    const ordemSugeridaLista = [];
    let inserido = false;
    let novaOrdem = 1;

    const processarItem = (item, mId, mIdStr, ordemDestino) => {
      const infoAnterior = ordemAtualMap.get(mIdStr);
      const nome = infoAnterior?.nome || getNomeCached(item);

      ordemSugeridaLista.push({
        militar_id: mId,
        nome,
        ordem: ordemDestino,
      });

      if (infoAnterior !== undefined && infoAnterior.ordem !== ordemDestino) {
        deslocados.push({
          militar_id: mId,
          nome,
          ordemAtual: infoAnterior.ordem,
          ordemSugerida: ordemDestino,
        });
      }
    };

    for (let i = 0; i < semMilitar.length; i++) {
      const item = semMilitar[i];
      if (!inserido && Number(item?.ordem || 0) >= ordemSugeridaFutura) {
        processarItem(atual, atual.militar_id, militarIdNormalizado, novaOrdem++);
        inserido = true;
      }
      processarItem(item, item.militar_id, String(item.militar_id || ''), novaOrdem++);
    }

    if (!inserido) {
      processarItem(atual, atual.militar_id, militarIdNormalizado, novaOrdem++);
    }

    resultado.push({
      promocao_id: promocao.id,
      promocao_rotulo: `${valorOuTraco(promocao?.posto_graduacao)} • ${dataFormatada(promocao?.data_promocao)}`,
      ordemAtual: ordemAtualLista,
      ordemSugerida: ordemSugeridaLista,
      militaresDeslocados: deslocados,
    });
  });

  if (resultado.length === 0) alertas.push('Nenhuma promoção futura da cadeia foi impactada para este militar.');

  return { promocoesAfetadas: resultado, alertas };
}
