const normalizarStatus = (valor) => String(valor || '').trim().toLowerCase();

export function getFuncaoMilitarId(vinculo = {}) {
  return vinculo?.funcao_militar_id || vinculo?.funcao_id || null;
}

export function getTagGrupoId(tag = {}) {
  return tag?.grupo_id || tag?.tag_grupo_id || null;
}

export function isRegistroAtivo(registro = {}) {
  if (registro?.ativo === true || registro?.ativa === true) return true;
  const status = normalizarStatus(registro?.status);
  return status === 'ativa' || status === 'ativo';
}

export function isCatalogoAtivo(registro = {}) {
  return isRegistroAtivo(registro);
}
