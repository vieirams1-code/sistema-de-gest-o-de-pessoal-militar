import { normalizarChaveBusca, normalizarTagsMilitar } from './montarArvoreLotacaoMilitares.js';

export const filtrarUnidadesCartoes = (unidades = [], busca = '') => {
  const q = String(busca || '').trim().toLowerCase();
  if (!q) return unidades;

  return unidades.filter((u) => [u.unidadeNome, u.unidadeSigla, u.setorNome, u.subsetorNome]
    .some((valor) => String(valor || '').toLowerCase().includes(q)));
};

export function listarTagsDisponiveisGestor(militares = []) {
  const mapa = new Map();

  for (const militar of militares || []) {
    for (const tag of normalizarTagsMilitar(militar)) {
      const nome = tag?.nome || tag?.id;
      const chave = normalizarChaveBusca(nome);
      if (!chave) continue;

      if (!mapa.has(chave)) mapa.set(chave, { id: chave, nome, total: 0 });
      mapa.get(chave).total += 1;
    }
  }

  return Array.from(mapa.values()).sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function filtrarMilitaresGestor(militares = [], busca = '', tagsSelecionadas = []) {
  const termo = normalizarChaveBusca(busca);

  return (militares || []).filter((militar) => {
    const textoBusca = normalizarChaveBusca([
      militar?.nome,
      militar?.nome_completo,
      militar?.nome_guerra,
      militar?.matricula,
      militar?.cpf,
      militar?.lotacao,
      militar?.posto_graduacao,
    ].filter(Boolean).join(' '));
    const passaBusca = !termo || textoBusca.includes(termo);
    const tagsMilitar = normalizarTagsMilitar(militar).map((tag) => normalizarChaveBusca(tag.nome || tag.id));
    const passaTags = !tagsSelecionadas.length || tagsSelecionadas.every((tagId) => tagsMilitar.includes(normalizarChaveBusca(tagId)));

    return passaBusca && passaTags;
  });
}
