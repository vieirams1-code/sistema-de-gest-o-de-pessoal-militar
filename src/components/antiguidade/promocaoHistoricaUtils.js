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
