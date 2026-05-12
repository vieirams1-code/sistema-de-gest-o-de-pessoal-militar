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

function isGrupoAtivo(grupo) {
  if (grupo?.ativo === false) return false;
  const ativoTexto = String(grupo?.ativo ?? '').trim().toUpperCase();
  return !['FALSE', 'INATIVO', 'INATIVA', 'NÃO', 'NAO', '0'].includes(ativoTexto);
}

function toIndiceConfigurado(valor, fallback) {
  if (valor === null || valor === undefined || valor === '') return fallback;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : fallback;
}

function obterMembrosConfigurados(grupo) {
  if (Array.isArray(grupo?.membros_reais)) return grupo.membros_reais;
  if (Array.isArray(grupo?.membros)) return grupo.membros;
  return null;
}

function congelarOrdemQuadrosAntiguidade(grupos) {
  return Object.freeze(
    grupos.map((grupo) => Object.freeze({
      ...grupo,
      membros: Object.freeze([...(grupo.membros || [])]),
    })),
  );
}

function criarMapaGrupoPorQuadro(grupos) {
  const mapa = new Map();
  grupos.forEach((grupo) => {
    grupo.membros.forEach((membro) => {
      const membroNormalizado = normalizarMembroGrupo(membro);
      if (membroNormalizado && !mapa.has(membroNormalizado)) {
        mapa.set(membroNormalizado, grupo);
      }
    });
  });
  return mapa;
}

const CONTEXTO_ORDEM_QUADROS_ANTIGUIDADE_ESTATICO = Object.freeze({
  grupos: ORDEM_GRUPOS_QUADROS_ANTIGUIDADE,
  mapaGrupoPorQuadro: criarMapaGrupoPorQuadro(ORDEM_GRUPOS_QUADROS_ANTIGUIDADE),
  usandoFallbackEstatico: true,
});

export function normalizarOrdemQuadrosAntiguidadeConfigurada(ordemQuadros) {
  try {
    if (!Array.isArray(ordemQuadros)) return ORDEM_GRUPOS_QUADROS_ANTIGUIDADE;

    const grupos = ordemQuadros
      .filter((grupo) => grupo && typeof grupo === 'object' && isGrupoAtivo(grupo))
      .map((grupo, posicaoOriginal) => {
        const membros = obterMembrosConfigurados(grupo);
        if (!Array.isArray(membros)) return null;

        const membrosNormalizados = membros
          .map((membro) => String(membro ?? '').trim())
          .filter(Boolean);
        if (membrosNormalizados.length === 0) return null;

        const nomeGrupo = String(grupo.nome_grupo ?? grupo.grupo ?? membrosNormalizados[0] ?? '').trim();
        if (!nomeGrupo) return null;

        const indice = toIndiceConfigurado(grupo.indice, posicaoOriginal);
        return {
          grupo: nomeGrupo.toUpperCase(),
          indice,
          membros: membrosNormalizados,
          observacao: grupo.observacao,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.indice - b.indice);

    return grupos.length > 0
      ? congelarOrdemQuadrosAntiguidade(grupos)
      : ORDEM_GRUPOS_QUADROS_ANTIGUIDADE;
  } catch {
    return ORDEM_GRUPOS_QUADROS_ANTIGUIDADE;
  }
}

export function criarContextoOrdemQuadrosAntiguidade(ordemQuadros) {
  const grupos = normalizarOrdemQuadrosAntiguidadeConfigurada(ordemQuadros);
  if (grupos === ORDEM_GRUPOS_QUADROS_ANTIGUIDADE) return CONTEXTO_ORDEM_QUADROS_ANTIGUIDADE_ESTATICO;
  return Object.freeze({
    grupos,
    mapaGrupoPorQuadro: criarMapaGrupoPorQuadro(grupos),
    usandoFallbackEstatico: false,
  });
}

function obterContextoOrdemQuadrosAntiguidade(contextoOrdemQuadros) {
  if (contextoOrdemQuadros?.mapaGrupoPorQuadro instanceof Map && Array.isArray(contextoOrdemQuadros?.grupos)) {
    return contextoOrdemQuadros;
  }
  if (contextoOrdemQuadros === undefined) return CONTEXTO_ORDEM_QUADROS_ANTIGUIDADE_ESTATICO;
  return criarContextoOrdemQuadrosAntiguidade(contextoOrdemQuadros);
}

const QUADROS_GENERICAMENTE_CONHECIDOS = new Set(
  [...(QUADROS_FIXOS || []), ...(QUADROS || []), ...ORDEM_GRUPOS_QUADROS_ANTIGUIDADE.flatMap((grupo) => grupo.membros)]
    .map((quadro) => normalizarQuadroParaAntiguidade(quadro))
    .filter(Boolean),
);

function obterGrupoPorQuadro(quadro, contextoOrdemQuadros) {
  const quadroNormalizado = normalizarQuadroParaAntiguidade(quadro);
  if (!quadroNormalizado) return null;
  const contexto = obterContextoOrdemQuadrosAntiguidade(contextoOrdemQuadros);
  return contexto.mapaGrupoPorQuadro.get(quadroNormalizado) || null;
}

export function obterGrupoAntiguidadeQuadro(quadro, contextoOrdemQuadros) {
  return obterGrupoPorQuadro(quadro, contextoOrdemQuadros)?.grupo || '';
}

export function obterIndiceAntiguidadeQuadro(quadro, contextoOrdemQuadros) {
  const grupo = obterGrupoPorQuadro(quadro, contextoOrdemQuadros);
  return grupo ? grupo.indice : VALOR_AUSENTE_NUMERICO;
}

export function isQuadroConhecidoNaAntiguidade(quadro, contextoOrdemQuadros) {
  return Boolean(obterGrupoPorQuadro(quadro, contextoOrdemQuadros));
}

export function obterDetalheAntiguidadeQuadro(quadro, contextoOrdemQuadros) {
  const quadroOriginal = String(quadro ?? '').trim();
  const quadroNormalizado = normalizarQuadroParaAntiguidade(quadroOriginal);
  const grupo = obterGrupoPorQuadro(quadroOriginal, contextoOrdemQuadros);
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
