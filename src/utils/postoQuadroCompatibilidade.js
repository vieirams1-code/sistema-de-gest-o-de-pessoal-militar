const NORMALIZACAO_REGEX = /\s+/g;

export const QUADROS_OFICIAIS = ['QOBM', 'QAOBM', 'QOEBM', 'QOSAU', 'QOETBM', 'QOSTBM'];
export const QUADROS_FIXOS = ['QOBM', 'QAOBM', 'QOEBM', 'QOSAU', 'QBMP-1.a', 'QBMP-1.b', 'QBMP-2', 'QOETBM', 'QOSTBM', 'QPTBM'];

const QUADRO_ALIASES_LEGADOS = {
  QBMPT: 'QPTBM',
};

const QUADROS_COM_DESTAQUE = new Set(['QOETBM', 'QOSTBM', 'QPTBM']);

export function normalizarQuadroLegado(quadro) {
  const quadroNormalizado = String(quadro || '').trim().toUpperCase();
  if (!quadroNormalizado) return '';
  return QUADRO_ALIASES_LEGADOS[quadroNormalizado] || quadroNormalizado;
}

const POSTOS_OFICIAIS = new Set([
  'CORONEL',
  'TENENTE CORONEL',
  'MAJOR',
  'CAPITÃO',
  '1º TENENTE',
  '2º TENENTE',
  'ASPIRANTE',
]);

function normalizarTexto(valor) {
  return String(valor || '')
    .trim()
    .toUpperCase()
    .replace(NORMALIZACAO_REGEX, ' ');
}

/**
 * Classifica o posto/graduação em "oficial" ou "praca".
 * Regra especial: "Aspirante" é tratado como oficial.
 */
export function classificarPostoGraduacao(postoGraduacao) {
  const postoNormalizado = normalizarTexto(postoGraduacao);
  if (!postoNormalizado) return null;
  return POSTOS_OFICIAIS.has(postoNormalizado) ? 'oficial' : 'praca';
}

export function isPostoOficial(postoGraduacao) {
  return classificarPostoGraduacao(postoGraduacao) === 'oficial';
}

export function getQuadrosCompativeis(postoGraduacao, quadrosFixos = QUADROS_FIXOS) {
  const categoria = classificarPostoGraduacao(postoGraduacao);
  if (!categoria) return quadrosFixos;
  return quadrosFixos.filter((quadro) => {
    const isQuadroOficial = QUADROS_OFICIAIS.includes(normalizarQuadroLegado(quadro));
    return categoria === 'oficial' ? isQuadroOficial : !isQuadroOficial;
  });
}

export function isQuadroCompativel(postoGraduacao, quadro) {
  if (!quadro) return true;
  const quadroNormalizado = normalizarQuadroLegado(quadro);
  return getQuadrosCompativeis(postoGraduacao).includes(quadroNormalizado);
}

export function isQuadroComDestaque(quadro) {
  const quadroNormalizado = normalizarQuadroLegado(quadro);
  return QUADROS_COM_DESTAQUE.has(quadroNormalizado);
}
