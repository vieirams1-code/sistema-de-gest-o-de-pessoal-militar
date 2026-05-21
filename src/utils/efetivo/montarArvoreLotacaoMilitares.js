const SEM_SETOR = 'Setor não informado';
const SEM_SUBSETOR = 'Subsetor não informado';
const SEM_UNIDADE = 'Unidade não informada';

const normalizarTexto = (v, fallback) => {
  const t = String(v || '').trim();
  return t || fallback;
};

export function resolverNomesEstrutura(militar = {}, lotacoesById = new Map()) {
  const estrutura = lotacoesById.get(String(militar?.estrutura_id || ''));
  const unidadeNome = normalizarTexto(
    estrutura?.nome || militar?.estrutura_nome || militar?.lotacao || militar?.subgrupamento_nome,
    SEM_UNIDADE,
  );

  const subsetorNome = normalizarTexto(
    estrutura?.parent?.nome || militar?.subgrupamento_nome || militar?.grupamento_nome,
    SEM_SUBSETOR,
  );

  const setorNome = normalizarTexto(
    estrutura?.parent?.parent?.nome || militar?.grupamento_nome || militar?.lotacao,
    SEM_SETOR,
  );

  return { setorNome, subsetorNome, unidadeNome };
}

export default function montarArvoreLotacaoMilitares(militares = [], lotacoes = []) {
  const lotacoesById = new Map((lotacoes || []).map((l) => [String(l.id), l]));
  const tree = new Map();

  (militares || []).forEach((militar) => {
    const { setorNome, subsetorNome, unidadeNome } = resolverNomesEstrutura(militar, lotacoesById);

    if (!tree.has(setorNome)) tree.set(setorNome, new Map());
    const subsetores = tree.get(setorNome);

    if (!subsetores.has(subsetorNome)) subsetores.set(subsetorNome, new Map());
    const unidades = subsetores.get(subsetorNome);

    if (!unidades.has(unidadeNome)) unidades.set(unidadeNome, []);
    unidades.get(unidadeNome).push(militar);
  });

  return Array.from(tree.entries()).map(([setorNome, subsetores]) => ({
    setorNome,
    subsetores: Array.from(subsetores.entries()).map(([subsetorNome, unidades]) => ({
      subsetorNome,
      unidades: Array.from(unidades.entries()).map(([unidadeNome, militaresUnidade]) => ({
        unidadeNome,
        militares: militaresUnidade,
      })),
    })),
  }));
}
