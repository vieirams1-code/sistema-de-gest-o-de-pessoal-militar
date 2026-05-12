import { QUADROS_FIXOS, QUADROS_OFICIAIS, normalizarQuadroLegado } from '../../utils/postoQuadroCompatibilidade.js';

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
    .map(normalizarQuadroLegado)
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
  const quadroNormalizado = normalizarQuadroLegado(normalizarQuadroPromocao(quadro));
  return QUADROS_PRACAS_HISTORICO_CONFIAVEL.has(quadroNormalizado);
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
