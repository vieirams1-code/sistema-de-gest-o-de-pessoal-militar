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

export function buildPublicacoesScopeKey({
  isAdmin = false,
  modoAcesso = null,
  effectiveEmail = null,
  linkedMilitarId = null,
  subgrupamentoId = null,
  subgrupamentoTipo = null,
  unidadesFilhas = [],
} = {}) {
  return {
    isAdmin: Boolean(isAdmin),
    modoAcesso: normalizeKeyPart(modoAcesso),
    effectiveEmail: normalizeKeyPart(typeof effectiveEmail === 'string' ? effectiveEmail.trim().toLowerCase() : effectiveEmail),
    linkedMilitarId: normalizeKeyPart(linkedMilitarId),
    subgrupamentoId: normalizeKeyPart(subgrupamentoId),
    subgrupamentoTipo: normalizeKeyPart(subgrupamentoTipo),
    unidadesFilhasIds: normalizeIds(unidadesFilhas),
  };
}

export const publicacoesQueryKeys = {
  registrosLivro: (scopeKey) => ['registros-livro', scopeKey],
  exOfficio: (scopeKey) => ['publicacoes-ex-officio', scopeKey],
  atestados: (scopeKey) => ['atestados-publicacao', scopeKey],
  rpLista: (scopeKey) => ['registro-rp-lista', scopeKey],
};
