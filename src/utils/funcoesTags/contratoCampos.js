const normalizarStatus = (valor) => String(valor || '').trim().toLowerCase();

export function getFuncaoMilitarId(vinculo = {}) {
  return vinculo?.funcao_militar_id || vinculo?.funcao_id || null;
}

export function getTagGrupoId(tag = {}) {
  return tag?.grupo_id || tag?.tag_grupo_id || tag?.grupoId || tag?.tagGrupoId || null;
}

export function getMilitarTagMilitarId(vinculo = {}) {
  return vinculo?.militar_id || vinculo?.militarId || vinculo?.militar?.id || null;
}

export function getMilitarTagTagId(vinculo = {}) {
  return vinculo?.tag_id || vinculo?.tagId || vinculo?.tag?.id || null;
}

export function getTagId(tag = {}) {
  return tag?.id || null;
}

export function isRegistroAtivo(registro = {}) {
  if (registro?.ativo === true || registro?.ativa === true) return true;
  const status = normalizarStatus(registro?.status);
  return status === 'ativa' || status === 'ativo';
}

export function isCatalogoAtivo(registro = {}) {
  return isRegistroAtivo(registro);
}
