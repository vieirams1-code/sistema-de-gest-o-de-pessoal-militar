import { POSTOS_GRADUACOES_HIERARQUIA } from '../constants/postosGraduacoes.js';
import { MENSAGEM_BLOQUEIO_REBAIXAMENTO_CADASTRAL, getSugestaoAtualizacaoCadastro, normalizarPostoGraduacao } from '../utils/postoGraduacaoHierarquia.js';

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

function montarErroPublicacao(mensagens) {
  const erro = new Error([...new Set(mensagens)].join(' '));
  erro.bloqueios = [...new Set(mensagens)];
  return erro;
}

function validarPublicacaoPromocaoBase({ promocao, itens = [], permitirAlteracoesPendentes = false, temAlteracoesPendentes = false } = {}) {
  const bloqueios = [];

  if (!promocao || !texto(promocao.id)) bloqueios.push('Promoção não carregada.');
  if (STATUS_PROMOCAO_PUBLICADA.has(statusNormalizado(promocao?.status))) bloqueios.push('Promoção já publicada/consolidada.');
  if (!dataSomente(promocao?.data_promocao)) bloqueios.push('Informe a data da promoção antes de publicar.');
  if (!texto(promocao?.posto_graduacao)) bloqueios.push('Informe o posto/graduação destino antes de publicar.');
  if (!texto(promocao?.quadro)) bloqueios.push('Informe o quadro destino antes de publicar.');
  if (!Array.isArray(itens) || itens.length === 0) bloqueios.push('Inclua ao menos um militar antes de publicar.');
  if (!permitirAlteracoesPendentes && temAlteracoesPendentes) bloqueios.push('Salve as alterações pendentes antes de publicar.');

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
    if (efeito.tipo === 'incompativel') bloqueios.push(`${linha}: militar incompatível com o posto/graduação destino.`);
    if (efeito.tipo === 'revisao') bloqueios.push(`${linha}: militar em revisão cadastral.`);
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

export async function publicarPromocaoOficial({ promocao, itens = [], entities, temAlteracoesPendentes = false } = {}) {
  const validacao = validarPublicacaoPromocaoBase({ promocao, itens, temAlteracoesPendentes });
  if (!validacao.valido) throw montarErroPublicacao(validacao.bloqueios);

  const Historico = entities?.HistoricoPromocaoMilitarV2;
  const MilitarEntity = entities?.Militar;
  const PromocaoMilitar = entities?.PromocaoMilitar;
  const Promocao = entities?.Promocao;

  if (!Historico || typeof Historico.create !== 'function') throw new Error('Entidade HistoricoPromocaoMilitarV2 indisponível para criação.');
  if (typeof Historico.update !== 'function') throw new Error('Entidade HistoricoPromocaoMilitarV2 indisponível para vínculo seguro.');
  if (!PromocaoMilitar || typeof PromocaoMilitar.update !== 'function') throw new Error('Entidade PromocaoMilitar indisponível para publicação.');
  if (!Promocao || typeof Promocao.update !== 'function') throw new Error('Entidade Promocao indisponível para finalizar a promoção.');

  const historicos = await listarHistoricosPublicacao(Historico);
  const planos = itens.map((item) => {
    const efeito = getSugestaoAtualizacaoCadastro({ militar: item.militar, promocao });
    const payload = montarPayloadHistoricoPublicacao({ promocao, item, efeito });
    return { item, efeito, payload, resolucao: resolverHistoricoPublicacao({ historicos, payload }) };
  });

  if (planos.some((plano) => plano.efeito.tipo === 'imediatamente_superior') && (!MilitarEntity || typeof MilitarEntity.update !== 'function')) {
    throw new Error('Entidade Militar indisponível para atualização cadastral da promoção imediatamente superior.');
  }

  const resultados = [];
  for (const plano of planos) {
    let historico = plano.resolucao.historico;
    if (plano.resolucao.acao === 'criar') {
      historico = await Historico.create(plano.payload);
    } else if (plano.resolucao.acao === 'vincular') {
      const patch = patchDocumentalFaltante(historico, plano.payload);
      await Historico.update(historico.id, patch);
      historico = { ...historico, ...patch };
    }

    if (plano.efeito.tipo === 'imediatamente_superior') {
      const patchMilitar = { posto_graduacao: texto(promocao.posto_graduacao) };
      if (!mesmoTextoNormalizado(plano.item.militar?.quadro || plano.item.militar?.quadro_atual, promocao.quadro)) {
        patchMilitar.quadro = texto(promocao.quadro);
      }
      await MilitarEntity.update(plano.item.militar_id, patchMilitar);
    }

    await PromocaoMilitar.update(plano.item.id, {
      status: 'publicado',
      publicado: true,
      historico_promocao_v2_id: texto(historico?.id),
      atualizar_cadastro_militar: plano.efeito.tipo === 'imediatamente_superior',
      motivo_atualizacao_cadastro: plano.efeito.mensagem,
      resultado_aplicacao_cadastro: plano.efeito.tipo,
    });

    resultados.push({ promocao_militar_id: plano.item.id, historico_promocao_v2_id: texto(historico?.id), efeito: plano.efeito.tipo });
  }

  await Promocao.update(promocao.id, { status: 'publicada' });

  return { publicados: resultados.length, resultados };
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
  await Promise.all(ativosDaPromocao.map(async (registro) => {
    try {
      diagLog('sincronizacao-historico:update:enviando', { historicoId: registro?.id, patch });
      const retorno = await Historico.update(registro.id, patch);
      diagLog('sincronizacao-historico:update:retorno', { historicoId: registro?.id, retorno });
      const atualizado = typeof Historico.get === 'function' ? await Historico.get(registro.id) : null;
      diagLog('sincronizacao-historico:update:refetch', { historicoId: registro?.id, data_promocao: atualizado?.data_promocao, atualizado });
    } catch (error) {
      diagLog('sincronizacao-historico:update:erro', { historicoId: registro?.id, erro: error?.message || String(error) });
      throw error;
    }
  }));
  return { atualizados: ativosDaPromocao.length, ignorado: false };
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
  const coincideComHistoricoPublicado = mesmoTextoNormalizado(postoAtual, postoNovo) && mesmoTextoNormalizado(quadroAtual, quadroNovo);
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
  if (!item?.publicado || statusNormalizado(item?.status) !== 'publicado') throw new Error('Somente itens publicados podem ser revertidos.');
  if (!motivoNormalizado) throw new Error('Motivo da reversão é obrigatório.');

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
  if (!historicoId) throw new Error('Item publicado sem vínculo de histórico V2.');
  const historicoRegistro = typeof Historico.get === 'function' ? await Historico.get(historicoId) : null;
  diagLog('reversao:historico-carregado', { historicoId, historicoRegistro, postoAnterior: historicoRegistro?.posto_graduacao_anterior, quadroAnterior: historicoRegistro?.quadro_anterior, postoNovo: historicoRegistro?.posto_graduacao_novo, quadroNovo: historicoRegistro?.quadro_novo });

  const trilhaAdmin = [
    '[REVERSAO_ADMINISTRATIVA]',
    `motivo=${motivoNormalizado}`,
    texto(observacoes) ? `observacoes=${texto(observacoes)}` : '',
    texto(usuario?.email) ? `usuario=${texto(usuario.email)}` : '',
    `data=${new Date().toISOString()}`,
  ].filter(Boolean).join(' | ');
  await Historico.update(historicoId, {
    status_registro: 'cancelado',
    motivo_retificacao: motivoNormalizado,
    observacoes: [texto(historicoRegistro?.observacoes), trilhaAdmin].filter(Boolean).join('\n'),
  });

  const resultadoRollback = await restaurarCadastroMilitarDaPromocao({
    item,
    historico: historicoRegistro,
    militar: item?.militar,
    entities,
    contexto: 'reversão de publicação',
  });
  const cadastroRestaurado = Boolean(resultadoRollback?.cadastroRestaurado);

  await PromocaoMilitar.update(item.id, {
    status: 'cancelado',
    publicado: false,
  });

  const itensAtualizados = (itensPromocao || []).map((registro) => (
    String(registro?.id) === String(item.id) ? { ...registro, status: 'cancelado', publicado: false } : registro
  ));
  await Promocao.update(promocao.id, { status: statusPromocaoPosReversao(itensAtualizados) });

  return { historicoCancelado: true, cadastroRestaurado, promocaoRecalculada: true };
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
  const Promocao = entities?.Promocao;
  const Historico = entities?.HistoricoPromocaoMilitarV2;

  if (!PromocaoMilitar || typeof PromocaoMilitar.delete !== 'function') throw new Error('Entidade PromocaoMilitar indisponível para exclusão definitiva.');
  if (!Promocao || typeof Promocao.delete !== 'function' || typeof Promocao.update !== 'function') throw new Error('Entidade Promocao indisponível para exclusão definitiva.');
  if (!Historico || typeof Historico.delete !== 'function') throw new Error('Entidade HistoricoPromocaoMilitarV2 indisponível para exclusão definitiva.');

  const item = typeof PromocaoMilitar.get === 'function' ? await PromocaoMilitar.get(itemId) : null;
  if (!item?.id) throw new Error('Item da promoção não encontrado.');
  if (!item?.promocao_id) throw new Error('Item sem promoção vinculada.');

  const statusItem = statusNormalizado(item?.status);
  if (!(statusItem === 'cancelado' || item?.publicado === false)) {
    throw new Error('Exclusão definitiva permitida apenas para item cancelado ou não publicado.');
  }

  const historicoId = texto(item?.historico_promocao_v2_id);
  const historicoRegistro = historicoId && typeof Historico.get === 'function' ? await Historico.get(historicoId) : null;

  const resultadoRollback = await restaurarCadastroMilitarDaPromocao({
    item,
    historico: historicoRegistro,
    militar: item?.militar,
    entities,
    contexto: 'exclusão definitiva',
  });
  const cadastroRestaurado = Boolean(resultadoRollback?.cadastroRestaurado);

  if (historicoId) {
    await Historico.delete(historicoId);
  }

  await PromocaoMilitar.delete(itemId);

  const vinculados = typeof PromocaoMilitar.filter === 'function'
    ? await PromocaoMilitar.filter({ promocao_id: item.promocao_id })
    : (typeof PromocaoMilitar.list === 'function'
      ? (await PromocaoMilitar.list()).filter((registro) => texto(registro?.promocao_id) === texto(item.promocao_id))
      : []);

  if ((vinculados || []).length === 0) {
    await Promocao.delete(item.promocao_id);
    return { promocaoExcluida: true, promocaoMilitarExcluido: true, historicoExcluido: Boolean(historicoId), cadastroRestaurado };
  }

  await Promocao.update(item.promocao_id, { status: statusPromocaoPosReversao(vinculados) });
  return { promocaoExcluida: false, promocaoMilitarExcluido: true, historicoExcluido: Boolean(historicoId), cadastroRestaurado };
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
  const { alertasPorId, alertasGlobais } = avaliarAlertasTurmaOperacional(itens);
  const bloqueios = [...alertasGlobais];

  alertasPorId.forEach((alertas) => {
    alertas.forEach((alerta) => {
      if (alerta === 'bloqueado/cancelado sem justificativa') bloqueios.push(alerta);
    });
  });

  const temIncompatibilidadeCadastro = itens.some((item) => {
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
  const registrosParaOrdem = [...(registrosExistentes || [])];
  const payloads = [];

  (historicos || []).forEach((historico) => {
    const promocaoId = texto(promocao?.id);
    const militarId = texto(historico?.militar_id);
    const chave = `${promocaoId}|${militarId}`;
    if (!promocaoId || !militarId || existentes.has(chave)) return;

    const ordem = ordemHistoricoOuProxima(historico, registrosParaOrdem);
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
    registrosParaOrdem.push(payload);
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
