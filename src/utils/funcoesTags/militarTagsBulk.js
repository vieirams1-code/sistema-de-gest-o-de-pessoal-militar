import { getTagGrupoId } from './contratoCampos';

export const BULK_TAGS_MAX_MILITARES = 20;

export function calcularTentativasBulk(totalMilitares = 0, totalTags = 0) {
  return Math.max(0, Number(totalMilitares) || 0) * Math.max(0, Number(totalTags) || 0);
}

export function excedeLimiteMilitaresSelecionados(totalMilitares = 0, limite = BULK_TAGS_MAX_MILITARES) {
  return (Number(totalMilitares) || 0) > limite;
}

export function agruparTagsPorGrupo(tags = [], grupos = []) {
  const gruposById = new Map(grupos.map((g) => [String(g.id), g]));
  const mapa = new Map();

  tags.forEach((tag) => {
    const grupoId = String(getTagGrupoId(tag) || 'sem-grupo');
    if (!mapa.has(grupoId)) {
      mapa.set(grupoId, {
        id: grupoId,
        nome: grupoId === 'sem-grupo' ? 'Sem grupo' : (gruposById.get(grupoId)?.nome || 'Sem grupo'),
        emoji: gruposById.get(grupoId)?.emoji || '🗂️',
        ordem: Number(gruposById.get(grupoId)?.ordem ?? 9999),
        tags: [],
      });
    }
    mapa.get(grupoId).tags.push(tag);
  });

  return Array.from(mapa.values())
    .map((grupo) => ({
      ...grupo,
      tags: grupo.tags.sort((a, b) => String(a?.nome || '').localeCompare(String(b?.nome || ''), 'pt-BR')),
    }))
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function montarTagsPresentesNosSelecionados({ selectedMilitarIds = [], vinculosTagsAtivos = [], tagsAtivas = [] }) {
  const selectedSet = new Set((selectedMilitarIds || []).map(String));
  const tagsById = new Map((tagsAtivas || []).map((tag) => [String(tag.id), tag]));
  const contador = new Map();

  (vinculosTagsAtivos || []).forEach((vinculo) => {
    const militarId = String(vinculo?.militar_id || '');
    const tagId = String(vinculo?.tag_id || '');
    if (!militarId || !tagId || !selectedSet.has(militarId)) return;
    contador.set(tagId, (contador.get(tagId) || 0) + 1);
  });

  return Array.from(contador.entries())
    .map(([tagId, presentes]) => ({ tag: tagsById.get(tagId), tagId, presentes }))
    .filter((item) => item.tag)
    .sort((a, b) => b.presentes - a.presentes || String(a.tag?.nome || '').localeCompare(String(b.tag?.nome || ''), 'pt-BR'));
}

export function resumirResultadoBulk({ aplicadas = 0, duplicadas = 0, removidas = 0, erros = 0, modo = 'apply' }) {
  if (modo === 'remove') {
    return `Tags removidas em ${removidas} vínculo(s). ${erros} erro(s).`;
  }
  return `Tags aplicadas em ${aplicadas} vínculo(s). ${duplicadas} já possuíam a tag. ${erros} erro(s).`;
}

export function isErroDuplicidade(error) {
  const msg = String(error?.message || '').toLowerCase();
  return msg.includes('duplic') || msg.includes('already exists') || msg.includes('já existe') || msg.includes('unique');
}
