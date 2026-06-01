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

  return {
    setorNome,
    setorSigla: estrutura?.parent?.parent?.sigla,
    subsetorNome,
    subsetorSigla: estrutura?.parent?.sigla,
    unidadeNome,
    unidadeSigla: estrutura?.sigla,
    unidadeDescricao: estrutura?.descricao,
  };
}

export default function montarArvoreLotacaoMilitares(militares = [], lotacoes = []) {
  const lotacoesById = new Map((lotacoes || []).map((l) => [String(l.id), l]));
  const tree = new Map();

  (militares || []).forEach((militar) => {
    const { setorNome, setorSigla, subsetorNome, subsetorSigla, unidadeNome, unidadeSigla, unidadeDescricao } = resolverNomesEstrutura(militar, lotacoesById);

    if (!tree.has(setorNome)) tree.set(setorNome, { setorSigla, subsetores: new Map() });
    const setor = tree.get(setorNome);

    if (!setor.subsetores.has(subsetorNome)) setor.subsetores.set(subsetorNome, { subsetorSigla, unidades: new Map() });
    const subsetor = setor.subsetores.get(subsetorNome);

    if (!subsetor.unidades.has(unidadeNome)) subsetor.unidades.set(unidadeNome, { unidadeSigla, unidadeDescricao, militares: [] });
    subsetor.unidades.get(unidadeNome).militares.push(militar);
  });

  return Array.from(tree.entries()).map(([setorNome, setor]) => ({
    setorNome,
    setorSigla: setor.setorSigla,
    subsetores: Array.from(setor.subsetores.entries()).map(([subsetorNome, subsetor]) => ({
      subsetorNome,
      subsetorSigla: subsetor.subsetorSigla,
      unidades: Array.from(subsetor.unidades.entries()).map(([unidadeNome, unidade]) => ({
        unidadeNome,
        unidadeSigla: unidade.unidadeSigla,
        unidadeDescricao: unidade.unidadeDescricao,
        militares: unidade.militares,
      })),
    })),
  }));
}
