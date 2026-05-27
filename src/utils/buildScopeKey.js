function normalizeString(value) {
  if (typeof value !== 'string') {
    return value ?? null;
  }

  const normalized = value.trim();
  return normalized === '' ? null : normalized;
}

function normalizeEmail(value) {
  const normalized = normalizeString(value);
  if (normalized == null) return null;
  return String(normalized).toLowerCase();
}

function normalizeValue(value) {
  if (value === '') return null;
  return value ?? null;
}

export function buildScopeKey({
  isAdmin = false,
  modoAcesso = null,
  userEmail = null,
  effectiveEmail = null,
  linkedMilitarId = null,
  subgrupamentoId = null,
} = {}) {
  return {
    v: 1,
    isAdmin: Boolean(isAdmin),
    modoAcesso: normalizeString(modoAcesso),
    userEmail: normalizeEmail(userEmail),
    effectiveEmail: normalizeEmail(effectiveEmail),
    linkedMilitarId: normalizeValue(linkedMilitarId),
    subgrupamentoId: normalizeValue(subgrupamentoId),
  };
}

export default buildScopeKey;
