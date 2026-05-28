export const filtrarUnidadesCartoes = (unidades = [], busca = '') => {
  const q = String(busca || '').trim().toLowerCase();
  if (!q) return unidades;

  return unidades.filter((u) => [u.unidadeNome, u.unidadeSigla, u.setorNome, u.subsetorNome]
    .some((valor) => String(valor || '').toLowerCase().includes(q)));
};
