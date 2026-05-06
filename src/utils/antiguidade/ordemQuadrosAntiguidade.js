import { QUADROS } from '../../components/antiguidade/promocaoHistoricaUtils.js';
import { QUADROS_FIXOS, normalizarQuadroLegado } from '../postoQuadroCompatibilidade.js';

const VALOR_AUSENTE_NUMERICO = Number.POSITIVE_INFINITY;

// Ordem técnica inicial para a Prévia da Listagem de Antiguidade Geral.
// IMPORTANTE: os grupos, membros equivalentes e índices abaixo preservam
// aproximadamente a ordem técnica anteriormente usada pelo frontend, mas ainda
// precisam de confirmação institucional antes de qualquer listagem oficial.
export const ORDEM_GRUPOS_QUADROS_ANTIGUIDADE = Object.freeze([
  Object.freeze({
    grupo: 'QOBM',
    indice: 0,
    membros: Object.freeze(['QOBM']),
    observacao: 'Confirmar precedência institucional.',
  }),
  Object.freeze({
    grupo: 'QAOBM',
    indice: 1,
    membros: Object.freeze(['QAOBM']),
    observacao: 'Confirmar precedência institucional.',
  }),
  Object.freeze({
    grupo: 'QOEBM',
    indice: 2,
    membros: Object.freeze(['QOEBM']),
    observacao: 'Confirmar precedência institucional.',
  }),
  Object.freeze({
    grupo: 'QOSAU',
    indice: 3,
    membros: Object.freeze(['QOSAU']),
    observacao: 'Confirmar precedência institucional.',
  }),
  Object.freeze({
    grupo: 'QBMP',
    indice: 4,
    membros: Object.freeze([
      'QBMP',
      'QBMP-1.a',
      'QBMP-1.b',
      'QBMP-2',
      'QBMP 1.A',
      'QBMP 1.B',
      'QBMP 2',
      'QBMP 2.B',
    ]),
    observacao: 'Grupo de equivalência para qualificações/subquadros sem precedência interna confirmada.',
  }),
  Object.freeze({
    grupo: 'QOETBM',
    indice: 5,
    membros: Object.freeze(['QOETBM']),
    observacao: 'Confirmar precedência institucional.',
  }),
  Object.freeze({
    grupo: 'QOSTBM',
    indice: 6,
    membros: Object.freeze(['QOSTBM']),
    observacao: 'Confirmar precedência institucional.',
  }),
  Object.freeze({
    grupo: 'QPTBM',
    indice: 7,
    membros: Object.freeze(['QPTBM', 'QBMPT']),
    observacao: 'QBMPT tratado como alias legado/equivalente de QPTBM.',
  }),
]);

export function normalizarQuadroParaAntiguidade(quadro) {
  const original = String(quadro ?? '').trim();
  if (!original) return '';
  return String(normalizarQuadroLegado(original) || '').trim().toUpperCase();
}

const normalizarMembroGrupo = (quadro) => normalizarQuadroParaAntiguidade(quadro);

const GRUPO_POR_QUADRO_NORMALIZADO = new Map();
ORDEM_GRUPOS_QUADROS_ANTIGUIDADE.forEach((grupo) => {
  grupo.membros.forEach((membro) => {
    const membroNormalizado = normalizarMembroGrupo(membro);
    if (membroNormalizado && !GRUPO_POR_QUADRO_NORMALIZADO.has(membroNormalizado)) {
      GRUPO_POR_QUADRO_NORMALIZADO.set(membroNormalizado, grupo);
    }
  });
});

const QUADROS_GENERICAMENTE_CONHECIDOS = new Set(
  [...(QUADROS_FIXOS || []), ...(QUADROS || []), ...ORDEM_GRUPOS_QUADROS_ANTIGUIDADE.flatMap((grupo) => grupo.membros)]
    .map((quadro) => normalizarQuadroParaAntiguidade(quadro))
    .filter(Boolean),
);

function obterGrupoPorQuadro(quadro) {
  const quadroNormalizado = normalizarQuadroParaAntiguidade(quadro);
  return quadroNormalizado ? GRUPO_POR_QUADRO_NORMALIZADO.get(quadroNormalizado) || null : null;
}

export function obterGrupoAntiguidadeQuadro(quadro) {
  return obterGrupoPorQuadro(quadro)?.grupo || '';
}

export function obterIndiceAntiguidadeQuadro(quadro) {
  const grupo = obterGrupoPorQuadro(quadro);
  return grupo ? grupo.indice : VALOR_AUSENTE_NUMERICO;
}

export function isQuadroConhecidoNaAntiguidade(quadro) {
  return Boolean(obterGrupoPorQuadro(quadro));
}

export function obterDetalheAntiguidadeQuadro(quadro) {
  const quadroOriginal = String(quadro ?? '').trim();
  const quadroNormalizado = normalizarQuadroParaAntiguidade(quadroOriginal);
  const grupo = obterGrupoPorQuadro(quadroOriginal);
  const grupoAntiguidadeQuadro = grupo?.grupo || '';
  const conhecido = Boolean(grupo);
  const foiNormalizado = Boolean(
    quadroNormalizado
      && quadroOriginal.toUpperCase().replace(/\s+/g, '') !== quadroNormalizado.replace(/\s+/g, ''),
  );
  const foiAgrupado = Boolean(
    conhecido
      && grupoAntiguidadeQuadro
      && quadroNormalizado
      && grupoAntiguidadeQuadro !== quadroNormalizado,
  );

  return {
    quadroOriginal,
    quadroNormalizado,
    grupoAntiguidadeQuadro,
    quadroIndice: conhecido ? grupo.indice : VALOR_AUSENTE_NUMERICO,
    conhecido,
    foiNormalizado,
    foiAgrupado,
    conhecidoGenericamente: Boolean(quadroNormalizado && QUADROS_GENERICAMENTE_CONHECIDOS.has(quadroNormalizado)),
  };
}
