import { POSTOS_GRADUACOES_HIERARQUIA } from '../constants/postosGraduacoes.js';
import { MENSAGEM_BLOQUEIO_REBAIXAMENTO_CADASTRAL, getSugestaoAtualizacaoCadastro, normalizarPostoGraduacao } from '../utils/postoGraduacaoHierarquia.js';

const TEXTO_VAZIO = '—';

export const POSTOS_GRADUACOES_PROMOCAO = [...POSTOS_GRADUACOES_HIERARQUIA].reverse();

const STATUS_OPERACIONAIS = new Set(['ativo', 'previsto']);
const STATUS_CANCELADOS_RETIFICADOS = new Set(['cancelado', 'cancelada', 'retificado', 'retificada']);

export const STATUS_TURMA_OPERACIONAL = [
  'elegivel',
  'selecionado',
  'bloqueado',
  'publicado',
  'retificado',
  'cancelado',
];

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
