const TAG_COLOR_FALLBACK = '#64748b';

function pickText(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function normalizeAtivo(tag) {
  if (!tag || typeof tag !== 'object') return true;
  if (tag.ativo === false || tag.ativa === false) return false;
  const status = String(tag.status || '').trim().toLowerCase();
  return status !== 'inativo';
}

export function resolveTagVisual(tag) {
  return {
    nome: pickText(tag?.nome, tag?.label),
    emoji: pickText(tag?.emoji, tag?.icone, tag?.icon) || '🏷️',
    cor: pickText(tag?.cor) || TAG_COLOR_FALLBACK,
    grupoId: tag?.grupo_id || tag?.tag_grupo_id || tag?.grupoId || tag?.tagGrupoId || '',
    aplicabilidade: pickText(tag?.aplicabilidade),
    ativo: normalizeAtivo(tag),
  };
}
