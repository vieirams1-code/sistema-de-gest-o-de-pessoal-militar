const NORMALIZACAO_REGEX = /\s+/g;

export const QUADROS_OFICIAIS = ['QOBM', 'QAOBM', 'QOEBM', 'QOSAU', 'QOETBM', 'QOSTBM'];
export const QUADROS_FIXOS = ['QOBM', 'QAOBM', 'QOEBM', 'QOSAU', 'QBMP-1.a', 'QBMP-1.b', 'QBMP-2', 'QOETBM', 'QOSTBM', 'QPTBM'];
export const QUADROS_PRACAS = QUADROS_FIXOS.filter((quadro) => !QUADROS_OFICIAIS.includes(quadro));

const QUADRO_ALIASES_LEGADOS = {
  QBMPT: 'QPTBM',
  'QBMP-1': 'QBMP-1.a',
  'QBMP-1A': 'QBMP-1.a',
  'QBMP-1.A': 'QBMP-1.a',
  'QBMP-1ª': 'QBMP-1.a',
};

const QUADROS_COM_DESTAQUE = new Set(['QOETBM', 'QOSTBM', 'QPTBM']);

export function normalizarQuadroLegado(quadro) {
  const quadroNormalizado = String(quadro || '').trim().toUpperCase();
  if (!quadroNormalizado) return '';
  const quadroCompactado = quadroNormalizado.replace(/\s+/g, '').replace(/-/g, '-');
  const chaveSemPontuacao = quadroCompactado.replace(/[.\-]/g, '');
  return (
    QUADRO_ALIASES_LEGADOS[quadroCompactado]
    || QUADRO_ALIASES_LEGADOS[chaveSemPontuacao]
    || QUADRO_ALIASES_LEGADOS[quadroNormalizado]
    || quadroCompactado
  );
}

export const POSTOS_OFICIAIS = new Set([
  'CORONEL',
  'TENENTE CORONEL',
  'MAJOR',
  'CAPITÃO',
  '1º TENENTE',
  '2º TENENTE',
  'ASPIRANTE',
]);

export const POSTOS_PRACAS = new Set([
  'SUBTENENTE',
  '1º SARGENTO',
  '2º SARGENTO',
  '3º SARGENTO',
  'CABO',
  'SOLDADO',
]);

function normalizarTexto(valor) {
  return String(valor || '')
    .trim()
    .toUpperCase()
    .replace(/-/g, ' ')
    .replace(NORMALIZACAO_REGEX, ' ');
}

/**
 * Classifica o posto/graduação em "oficial" ou "praca".
 * Regra especial: "Aspirante" é tratado como oficial.
 */
export function classificarPostoGraduacao(postoGraduacao) {
  const postoNormalizado = normalizarTexto(postoGraduacao);
  if (!postoNormalizado) return null;
  if (POSTOS_OFICIAIS.has(postoNormalizado)) return 'oficial';
  if (POSTOS_PRACAS.has(postoNormalizado)) return 'praca';
  return null;
}

export function isPostoOficial(postoGraduacao) {
  return classificarPostoGraduacao(postoGraduacao) === 'oficial';
}

export function isPostoPraca(postoGraduacao) {
  return classificarPostoGraduacao(postoGraduacao) === 'praca';
}

export function getQuadrosCompativeis(postoGraduacao, quadrosFixos = QUADROS_FIXOS) {
  const categoria = classificarPostoGraduacao(postoGraduacao);
  if (!categoria) return quadrosFixos;
  return quadrosFixos.filter((quadro) => {
    const isQuadroOficial = QUADROS_OFICIAIS.includes(normalizarQuadroLegado(quadro));
    return categoria === 'oficial' ? isQuadroOficial : !isQuadroOficial;
  });
}

export function classificarQuadro(quadro) {
  const quadroNormalizado = normalizarQuadroLegado(quadro);
  if (!quadroNormalizado) return null;
  return QUADROS_OFICIAIS.includes(quadroNormalizado) ? 'oficial' : 'praca';
}

export function isQuadroOficial(quadro) {
  return classificarQuadro(quadro) === 'oficial';
}

export function isQuadroPraca(quadro) {
  return classificarQuadro(quadro) === 'praca';
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

export function validarCompatibilidadeCarreira({ categoria = null, postos = [], quadros = [] } = {}) {
  const categoriasPostos = new Set((postos || []).map(classificarPostoGraduacao).filter(Boolean));
  const categoriasQuadros = new Set((quadros || []).map(classificarQuadro).filter(Boolean));

  const categoriaPostos = categoriasPostos.size === 1 ? [...categoriasPostos][0] : null;
  const categoriaQuadros = categoriasQuadros.size === 1 ? [...categoriasQuadros][0] : null;

  return {
    misturaPostos: categoriasPostos.size > 1,
    categoriaPostos,
    categoriaQuadros,
    postosCompativeis: categoriasPostos.size <= 1,
    quadrosCompativeisComCategoria: !categoria || categoriasQuadros.size === 0 || (categoriasQuadros.size === 1 && categoriasQuadros.has(categoria)),
    postosCompativeisComCategoria: !categoria || categoriasPostos.size === 0 || (categoriasPostos.size === 1 && categoriasPostos.has(categoria)),
  };
}
