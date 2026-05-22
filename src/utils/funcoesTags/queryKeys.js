export function buildFuncoesTagsScopeKey(userContext = {}) {
  const unidadesFilhasIds = Array.isArray(userContext?.unidadesFilhasIds)
    ? [...new Set(userContext.unidadesFilhasIds.map(String).filter(Boolean))].sort()
    : [];

  return [
    userContext?.effectiveEmail || null,
    userContext?.userEmail || null,
    userContext?.modoAcesso || null,
    userContext?.linkedMilitarId || null,
    userContext?.subgrupamentoId || null,
    userContext?.subgrupamentoTipo || null,
    unidadesFilhasIds.join(',') || null,
  ];
}

export const funcoesTagsKeys = {
  catalogo: (scopeKey, tipo) => ['funcoes-tags', scopeKey, tipo],
  militarFuncoes: (scopeKey, militarId) => ['militar-funcoes', scopeKey, militarId],
  militarTags: (scopeKey, militarId) => ['militar-tags', scopeKey, militarId],
  feriasTags: (scopeKey, feriasId) => ['ferias-tags', scopeKey, feriasId],
  militarFuncaoInstitucional: (scopeKey, militarId) => ['militar-funcao-institucional', scopeKey, militarId],
  militaresFuncoesInstitucionais: (scopeKey, idsHash) => ['militares-funcoes-institucionais', scopeKey, idsHash],
  militaresFuncoesFiltros: (scopeKey, idsHash) => ['militares-funcoes-filtros', scopeKey, idsHash],
  militaresTagsFiltros: (scopeKey, idsHash) => ['militares-tags-filtros', scopeKey, idsHash],
};
