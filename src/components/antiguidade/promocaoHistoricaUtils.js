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

export const QUADROS = ['QOBM', 'QAOBM', 'QOEBM', 'QOSAU', 'QBMP-1.a', 'QBMP-1.b', 'QBMP-2', 'QOETBM', 'QOSTBM', 'QPTBM'];

const normalizar = (valor) => String(valor || '').trim().toLowerCase();
const valorTexto = (valor) => String(valor || '').trim();

const normalizarQuadroPromocao = (quadro) => {
  const texto = valorTexto(quadro);
  if (!texto) return '';

  return QUADROS.find((item) => normalizar(item) === normalizar(texto)) || texto;
};

const indicePosto = (posto) => POSTOS_GRADUACOES.findIndex((item) => normalizar(item) === normalizar(posto));

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
  return Boolean(quadroNormalizado) && normalizar(quadroNormalizado) !== 'qaobm';
};

const dataRegistro = (registro) => valorTexto(registro?.data_promocao);

const isRegistroAnteriorOuSemData = (registro, dataPromocaoReferencia) => {
  const dataReferencia = valorTexto(dataPromocaoReferencia);
  const data = dataRegistro(registro);
  return !dataReferencia || !data || data < dataReferencia;
};

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
