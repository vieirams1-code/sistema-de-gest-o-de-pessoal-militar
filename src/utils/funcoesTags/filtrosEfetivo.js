import { getFuncaoMilitarId, getMilitarTagMilitarId, getMilitarTagTagId, getTagGrupoId, isRegistroAtivo } from './contratoCampos';

export function filtrarMilitaresPorFuncoesETags({
  militares = [],
  filtros = {},
  vinculosFuncoesAtivos = [],
  vinculosTagsAtivos = [],
  tagsAtivas = [],
}) {
  const funcoesSelecionadas = new Set((filtros.funcoesIds || []).map(String));
  const tagsSelecionadas = new Set((filtros.tagsIds || []).map(String));
  const gruposSelecionados = new Set((filtros.gruposIds || []).map(String));

  if (funcoesSelecionadas.size === 0 && tagsSelecionadas.size === 0 && gruposSelecionados.size === 0) {
    return militares;
  }

  const tagsById = new Map(tagsAtivas.map((tag) => [String(tag.id), tag]));

  const funcoesByMilitar = new Map();
  vinculosFuncoesAtivos.forEach((vinculo) => {
    if (!isRegistroAtivo(vinculo)) return;
    const militarId = String(vinculo?.militar_id || '');
    const funcaoId = String(getFuncaoMilitarId(vinculo) || '');
    if (!militarId || !funcaoId) return;
    if (!funcoesByMilitar.has(militarId)) funcoesByMilitar.set(militarId, new Set());
    funcoesByMilitar.get(militarId).add(funcaoId);
  });

  const tagsByMilitar = new Map();
  vinculosTagsAtivos.forEach((vinculo) => {
    if (!isRegistroAtivo(vinculo)) return;
    const militarId = String(getMilitarTagMilitarId(vinculo) || '');
    const tagId = String(getMilitarTagTagId(vinculo) || '');
    if (!militarId || !tagId) return;
    if (!tagsByMilitar.has(militarId)) tagsByMilitar.set(militarId, new Set());
    tagsByMilitar.get(militarId).add(tagId);
  });

  return militares.filter((militar) => {
    const militarId = String(militar?.id || '');
    const funcoesMilitar = funcoesByMilitar.get(militarId) || new Set();
    const tagsMilitar = tagsByMilitar.get(militarId) || new Set();

    const passaFuncoes = funcoesSelecionadas.size === 0
      || [...funcoesSelecionadas].some((funcaoId) => funcoesMilitar.has(funcaoId));

    const passaTags = tagsSelecionadas.size === 0
      || [...tagsSelecionadas].some((tagId) => tagsMilitar.has(tagId));

    const passaGrupos = gruposSelecionados.size === 0
      || [...tagsMilitar].some((tagId) => {
        const grupoId = getTagGrupoId(tagsById.get(String(tagId)));
        return grupoId && gruposSelecionados.has(String(grupoId));
      });

    return passaFuncoes && passaTags && passaGrupos;
  });
}
