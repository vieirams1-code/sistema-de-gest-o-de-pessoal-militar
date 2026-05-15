import {
  QUADROS_FIXOS,
  QUADROS_OFICIAIS,
  isQuadroCompativel,
} from '../../utils/postoQuadroCompatibilidade.js';

export const POSTOS_GRADUACOES = [
  'Coronel',
  'Tenente-Coronel',
  'Major',
  'Capitão',
  '1º Tenente',
  '2º Tenente',
  'Aspirante a Oficial',
  'Subtenente',
  '1º Sargento',
  '2º Sargento',
  '3º Sargento',
  'Cabo',
  'Soldado',
];

export const QUADROS = QUADROS_FIXOS;

const normalizar = (valor) => String(valor || '').trim().toLowerCase();
const valorTexto = (valor) => String(valor || '').trim();

const normalizarQuadroPromocao = (quadro) => {
  const texto = valorTexto(quadro);
  if (!texto) return '';

  return QUADROS.find((item) => normalizar(item) === normalizar(texto)) || texto;
};

const indicePosto = (posto) => POSTOS_GRADUACOES.findIndex((item) => normalizar(item) === normalizar(posto));

const QUADROS_PRACAS_HISTORICO_CONFIAVEL = new Set([
  ...QUADROS_FIXOS
    .filter((quadro) => quadro && !QUADROS_OFICIAIS.includes(quadro)),
  'QBMP',
  'QPBM',
]);

export function getPostosHistoricosPermitidos(postoAtual) {
  const idxAtual = indicePosto(postoAtual);
  if (idxAtual < 0) return [];
  return POSTOS_GRADUACOES.slice(idxAtual + 1);
}

export function getPostoAnteriorPrevisto(postoNovo) {
  const idxNovo = indicePosto(postoNovo);
  if (idxNovo < 0) return '';
  return POSTOS_GRADUACOES[idxNovo + 1] || '';
}

export function isPromocaoAcimaDoPostoAtual({ postoAtual, postoNovo }) {
  const idxAtual = indicePosto(postoAtual);
  const idxNovo = indicePosto(postoNovo);
  if (idxAtual < 0 || idxNovo < 0) return false;
  return idxNovo < idxAtual;
}

export function isPromocaoIgualOuAcimaDoPostoAtual({ postoAtual, postoNovo }) {
  const idxAtual = indicePosto(postoAtual);
  const idxNovo = indicePosto(postoNovo);
  if (idxAtual < 0 || idxNovo < 0) return false;
  return idxNovo <= idxAtual;
}

export function resolverQuadroPromocao({ postoAnterior, postoNovo, quadroAtual, quadroAnteriorInformado }) {
  const anterior = normalizar(postoAnterior);
  const novo = normalizar(postoNovo);

  if (anterior === 'subtenente' && novo === '2º tenente') {
    return 'QAOBM';
  }

  return String(quadroAtual || quadroAnteriorInformado || '').trim();
}

const isStatusAtivo = (registro) => normalizar(registro?.status_registro || 'ativo') === 'ativo';

const isTransicaoSubtenenteParaQAOBM = ({ postoAnterior, postoNovo, quadroNovo }) => (
  normalizar(postoAnterior) === 'subtenente'
  && normalizar(postoNovo) === '2º tenente'
  && normalizar(quadroNovo) === 'qaobm'
);

const isQuadroHistoricoPracaConfiavel = (quadro) => {
  const quadroNormalizado = normalizarQuadroPromocao(quadro);
  return QUADROS_PRACAS_HISTORICO_CONFIAVEL.has(quadroNormalizado);
};

const dataRegistro = (registro) => valorTexto(registro?.data_promocao);

const isRegistroAnteriorOuSemData = (registro, dataPromocaoReferencia) => {
  const dataReferencia = valorTexto(dataPromocaoReferencia);
  const data = dataRegistro(registro);
  return !dataReferencia || !data || data < dataReferencia;
};

const isOrdemAntiguidadeValida = (ordem) => {
  const numero = Number(ordem);
  return Number.isFinite(numero) && numero > 0;
};

const isStatusCanceladoOuRetificado = (registro) => ['cancelado', 'retificado'].includes(normalizar(registro?.status_registro));

const ordenarMaisRecentesPrimeiro = (a, b) => dataRegistro(b).localeCompare(dataRegistro(a));

const obterQuadroHistoricoAnteriorConfiavel = ({ postoAnterior, dataPromocao, registrosHistoricos = [] }) => {
  const registrosAtivos = (registrosHistoricos || [])
    .filter(isStatusAtivo)
    .filter((registro) => isRegistroAnteriorOuSemData(registro, dataPromocao))
    .sort(ordenarMaisRecentesPrimeiro);

  const promocaoDoPostoAnterior = registrosAtivos.find((registro) => (
    normalizar(registro?.posto_graduacao_novo) === normalizar(postoAnterior)
    && isQuadroHistoricoPracaConfiavel(registro?.quadro_novo)
  ));

  if (promocaoDoPostoAnterior) {
    return normalizarQuadroPromocao(promocaoDoPostoAnterior.quadro_novo);
  }

  const registroComQuadroAnterior = registrosAtivos.find((registro) => (
    normalizar(registro?.posto_graduacao_anterior) === normalizar(postoAnterior)
    && isQuadroHistoricoPracaConfiavel(registro?.quadro_anterior)
  ));

  if (registroComQuadroAnterior) {
    return normalizarQuadroPromocao(registroComQuadroAnterior.quadro_anterior);
  }

  return '';
};

export function resolverQuadroAnteriorPromocao({
  postoAnterior,
  postoNovo,
  quadroNovo,
  dataPromocao,
  registrosHistoricos = [],
}) {
  const quadroNovoNormalizado = normalizarQuadroPromocao(quadroNovo);

  if (!isTransicaoSubtenenteParaQAOBM({ postoAnterior, postoNovo, quadroNovo: quadroNovoNormalizado })) {
    return quadroNovoNormalizado;
  }

  return obterQuadroHistoricoAnteriorConfiavel({
    postoAnterior,
    dataPromocao,
    registrosHistoricos,
  });
}

export function getProximoPosto(postoAtual) {
  const idxAtual = indicePosto(postoAtual);
  if (idxAtual <= 0) return '';
  return POSTOS_GRADUACOES[idxAtual - 1] || '';
}

export function resolverQuadroPromocaoFutura({ postoAtual, postoPrevisto, quadroAtual }) {
  const atual = normalizar(postoAtual);
  const previsto = normalizar(postoPrevisto);
  if (atual === 'subtenente' && previsto === '2º tenente') return 'QAOBM';
  return String(quadroAtual || '').trim();
}

export const PROMOCAO_COLETIVA_TIPO_PREVISTO = 'previsto';
export const PROMOCAO_COLETIVA_TIPO_HISTORICO = 'historico';
export const PROMOCAO_COLETIVA_STATUS_PREVISTO = 'previsto';
export const PROMOCAO_COLETIVA_STATUS_ATIVO = 'ativo';
export const PROMOCAO_COLETIVA_ORIGEM = 'coletiva';
export const PROMOCAO_COLETIVA_TEXTO_CONFIRMACAO = 'CONFIRMAR PROMOÇÃO COLETIVA';
export const PROMOCAO_HISTORICA_TEXTO_CONFIRMACAO = 'CONFIRMAR PROMOÇÃO HISTÓRICA';

export const isQuadroQBMPT = (valor) => normalizar(valor) === 'qbmpt';

const isStatusPrevisto = (registro) => normalizar(registro?.status_registro) === PROMOCAO_COLETIVA_STATUS_PREVISTO;
const mesmoValor = (a, b) => normalizar(a) === normalizar(b);
const statusCadastroAtivo = (militar) => normalizar(militar?.status_cadastro) === 'ativo';

const getHistoricosDoMilitar = (historicos = [], militarId) => (historicos || []).filter((registro) => registro?.militar_id === militarId);

export function selecionarCandidatosPromocaoColetiva({
  militares = [],
  postoOrigem = '',
  tipoLancamento = PROMOCAO_COLETIVA_TIPO_PREVISTO,
}) {
  if (!valorTexto(postoOrigem)) return [];
  const isHistorico = tipoLancamento === PROMOCAO_COLETIVA_TIPO_HISTORICO;
  const ids = new Set();
  return (militares || []).filter((militar) => {
    if (!militar?.id || ids.has(militar.id)) return false;
    if (!statusCadastroAtivo(militar)) return false;
    if (!isHistorico && postoOrigem && !mesmoValor(militar.posto_graduacao, postoOrigem)) return false;
    ids.add(militar.id);
    return true;
  });
}

export function resolverQuadroAnteriorPromocaoColetiva({ militar, form, historicos = [] }) {
  const quadroNovo = valorTexto(form?.quadro_novo);
  const postoAnterior = valorTexto(form?.posto_graduacao_anterior || militar?.posto_graduacao);
  const postoNovo = valorTexto(form?.posto_graduacao_novo);

  if (isTransicaoSubtenenteParaQAOBM({ postoAnterior, postoNovo, quadroNovo })) {
    return resolverQuadroAnteriorPromocao({
      postoAnterior,
      postoNovo,
      quadroNovo,
      dataPromocao: form?.data_promocao,
      registrosHistoricos: getHistoricosDoMilitar(historicos, militar?.id),
    });
  }

  const quadroAtual = valorTexto(militar?.quadro);
  return isQuadroQBMPT(quadroAtual) ? '' : quadroAtual;
}

export function resolverCopiaOrdemPromocaoAnterior({ militar, form, historicos = [] }) {
  const militarId = militar?.id || '';
  const postoNovo = valorTexto(form?.posto_graduacao_novo);
  const quadroNovo = normalizarQuadroPromocao(form?.quadro_novo);
  const dataPromocao = valorTexto(form?.data_promocao);

  if (!militarId || !postoNovo || !quadroNovo || !dataPromocao) {
    return { ordem: '', alerta: 'Ordem anterior não pôde ser copiada', motivo: 'dados_incompletos' };
  }

  if (normalizar(quadroNovo) === 'qaobm') {
    return { ordem: '', alerta: 'Ordem anterior não pôde ser copiada', motivo: 'qaobm_ambiguo' };
  }

  if (!isQuadroCompativel(postoNovo, quadroNovo)) {
    return { ordem: '', alerta: 'Ordem anterior não pôde ser copiada', motivo: 'quadro_incompativel' };
  }

  const candidatos = getHistoricosDoMilitar(historicos, militarId)
    .filter((registro) => isStatusAtivo(registro))
    .filter((registro) => !isStatusPrevisto(registro))
    .filter((registro) => !isStatusCanceladoOuRetificado(registro))
    .filter((registro) => dataRegistro(registro) && dataRegistro(registro) < dataPromocao)
    .filter((registro) => isOrdemAntiguidadeValida(registro?.antiguidade_referencia_ordem))
    .sort(ordenarMaisRecentesPrimeiro);

  if (!candidatos.length) {
    return { ordem: '', alerta: 'Ordem anterior não pôde ser copiada', motivo: 'sem_ordem_anterior' };
  }

  const dataMaisRecente = dataRegistro(candidatos[0]);
  const candidatosMaisRecentes = candidatos.filter((registro) => dataRegistro(registro) === dataMaisRecente);
  if (candidatosMaisRecentes.length !== 1) {
    return { ordem: '', alerta: 'Ordem anterior não pôde ser copiada', motivo: 'multiplos_candidatos' };
  }

  const anterior = candidatosMaisRecentes[0];
  const quadroAnterior = normalizarQuadroPromocao(anterior?.quadro_novo || anterior?.quadro_anterior);
  const postoAnterior = valorTexto(anterior?.posto_graduacao_novo || anterior?.posto_graduacao_anterior);

  if (!quadroAnterior || normalizar(quadroAnterior) === 'qaobm') {
    return { ordem: '', alerta: 'Ordem anterior não pôde ser copiada', motivo: 'qaobm_ambiguo' };
  }

  if (!mesmoValor(quadroAnterior, quadroNovo)) {
    return { ordem: '', alerta: 'Ordem anterior não pôde ser copiada', motivo: 'mudanca_real_quadro' };
  }

  if (!isQuadroCompativel(postoAnterior, quadroAnterior) || !isQuadroCompativel(postoNovo, quadroAnterior)) {
    return { ordem: '', alerta: 'Ordem anterior não pôde ser copiada', motivo: 'quadro_incompativel' };
  }

  return { ordem: Number(anterior.antiguidade_referencia_ordem), alerta: '', motivo: '' };
}

export function validarLinhaPromocaoColetiva({ militar, form, historicos = [], ordem = '' }) {
  const bloqueios = [];
  const alertas = [];
  const militarId = militar?.id || '';
  const postoAnterior = valorTexto(form?.posto_graduacao_anterior || militar?.posto_graduacao);
  const postoNovo = valorTexto(form?.posto_graduacao_novo);
  const quadroNovo = valorTexto(form?.quadro_novo);
  const dataPromocao = valorTexto(form?.data_promocao);
  const quadroAnterior = resolverQuadroAnteriorPromocaoColetiva({ militar, form, historicos });
  const tipoLancamento = form?.tipo_lancamento || PROMOCAO_COLETIVA_TIPO_PREVISTO;
  const isHistorico = tipoLancamento === PROMOCAO_COLETIVA_TIPO_HISTORICO;

  if (!militarId) bloqueios.push('Militar sem ID.');
  if (!postoAnterior) bloqueios.push('Posto/graduação de origem ausente.');
  if (!statusCadastroAtivo(militar)) bloqueios.push('Militar inativo.');
  if (!postoNovo) bloqueios.push('Posto/graduação novo ausente.');
  if (!quadroNovo) bloqueios.push('Quadro novo ausente.');
  if (!dataPromocao) bloqueios.push('Data da promoção ausente.');
  if ([postoAnterior, postoNovo, quadroAnterior, quadroNovo].some(isQuadroQBMPT)) bloqueios.push('QBMPT não é aceito. Saneie o quadro para QPTBM ou valor válido antes do lançamento.');
  if (quadroNovo && !isQuadroCompativel(postoNovo, quadroNovo)) bloqueios.push('Quadro novo incompatível com posto/graduação novo.');
  if (isHistorico && mesmoValor(postoNovo, militar?.posto_graduacao)) bloqueios.push('Posto novo igual ao posto atual do cadastro. Use Corrigir promoção atual fora deste lote.');

  const historicosMilitar = getHistoricosDoMilitar(historicos, militarId);
  const mesmoPostoQuadro = (registro) => (
    mesmoValor(registro?.posto_graduacao_novo, postoNovo)
    && mesmoValor(registro?.quadro_novo, quadroNovo)
  );
  const igual = (registro) => (
    mesmoPostoQuadro(registro)
    && valorTexto(registro?.data_promocao) === dataPromocao
  );
  const mesmoAtoDataPostoQuadro = (registro) => (
    igual(registro)
    && mesmoValor(registro?.ato_referencia, form?.ato_referencia)
  );
  const previstoIgual = historicosMilitar.find((registro) => (
    isStatusPrevisto(registro) && (isHistorico ? mesmoAtoDataPostoQuadro(registro) : igual(registro))
  ));
  if (previstoIgual) bloqueios.push(isHistorico
    ? 'Já existe registro previsto para o mesmo ato/data/posto/quadro.'
    : 'Já existe registro previsto igual para este militar/posto/quadro/data.');
  const ativoIgual = historicosMilitar.find((registro) => isStatusAtivo(registro) && igual(registro));
  if (ativoIgual) bloqueios.push('Já existe registro ativo igual para este militar/posto/quadro/data.');
  const ativoConflitante = historicosMilitar.find((registro) => (
    isStatusAtivo(registro)
    && mesmoPostoQuadro(registro)
    && valorTexto(registro?.data_promocao) !== dataPromocao
  ));
  if (ativoConflitante) bloqueios.push(isHistorico
    ? 'Já existe registro ativo para este militar/posto/quadro, mesmo com data diferente.'
    : 'Já existe registro ativo conflitante para este militar/posto/quadro com data diferente.');

  if (isHistorico && postoAnterior && !mesmoValor(militar?.posto_graduacao, postoAnterior)) alertas.push('Posto atual do cadastro não corresponde ao posto de origem informado.');
  if (isHistorico && isPromocaoAcimaDoPostoAtual({ postoAtual: postoNovo, postoNovo: militar?.posto_graduacao })) alertas.push('Militar atual já está em posto superior ao posto novo histórico.');
  if (!valorTexto(ordem)) alertas.push('Ordem de antiguidade ausente.');
  if (!quadroAnterior) alertas.push('Quadro anterior ausente.');
  if (!historicosMilitar.length) alertas.push('Histórico anterior incompleto.');
  if (isTransicaoSubtenenteParaQAOBM({ postoAnterior, postoNovo, quadroNovo }) && !quadroAnterior) alertas.push('Possível QAOBM sem quadro anterior confiável.');
  const historicoMaisRecente = historicosMilitar.filter(isStatusAtivo).sort(ordenarMaisRecentesPrimeiro)[0];
  if (isHistorico && historicoMaisRecente?.data_promocao && dataPromocao > historicoMaisRecente.data_promocao) alertas.push('Data histórica posterior à promoção mais recente já cadastrada.');
  if (isHistorico) alertas.push('Criação de histórico pode não afetar promoção atual.');

  return { bloqueios, alertas, apto: bloqueios.length === 0, quadroAnterior };
}

export function prepararRegistroPromocaoColetiva({ militar, form, historicos = [], ordem = '' }) {
  const quadroAnterior = resolverQuadroAnteriorPromocaoColetiva({ militar, form, historicos });
  return {
    militar_id: militar?.id || '',
    posto_graduacao_anterior: valorTexto(form?.posto_graduacao_anterior || militar?.posto_graduacao),
    quadro_anterior: quadroAnterior,
    posto_graduacao_novo: valorTexto(form?.posto_graduacao_novo),
    quadro_novo: valorTexto(form?.quadro_novo),
    data_promocao: valorTexto(form?.data_promocao),
    data_publicacao: valorTexto(form?.data_publicacao),
    boletim_referencia: valorTexto(form?.boletim_referencia),
    ato_referencia: valorTexto(form?.ato_referencia),
    antiguidade_referencia_ordem: valorTexto(ordem) ? Number(ordem) : null,
    antiguidade_referencia_id: '',
    origem_dado: PROMOCAO_COLETIVA_ORIGEM,
    status_registro: form?.tipo_lancamento === PROMOCAO_COLETIVA_TIPO_HISTORICO
      ? PROMOCAO_COLETIVA_STATUS_ATIVO
      : PROMOCAO_COLETIVA_STATUS_PREVISTO,
    observacoes: valorTexto(form?.observacoes),
  };
}
