function normalizeKeyPart(value) {
  if (value === undefined || value === '') return null;
  return value;
}

function normalizeIds(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((item) => (typeof item === 'object' && item !== null ? item.id : item))
    .filter(Boolean)
    .map(String)
    .sort();
}

export function buildAccessScopeKey({
  isAdmin = false,
  hasGlobalScope = false,
  modoAcesso = null,
  effectiveEmail = null,
  linkedMilitarId = null,
  subgrupamentoId = null,
  subgrupamentoTipo = null,
  unidadesFilhas = [],
} = {}) {
  return {
    isAdmin: Boolean(isAdmin),
    hasGlobalScope: Boolean(hasGlobalScope),
    modoAcesso: normalizeKeyPart(modoAcesso),
    effectiveEmail: normalizeKeyPart(typeof effectiveEmail === 'string' ? effectiveEmail.trim().toLowerCase() : effectiveEmail),
    linkedMilitarId: normalizeKeyPart(linkedMilitarId),
    subgrupamentoId: normalizeKeyPart(subgrupamentoId),
    subgrupamentoTipo: normalizeKeyPart(subgrupamentoTipo),
    unidadesFilhasIds: normalizeIds(unidadesFilhas),
  };
}
