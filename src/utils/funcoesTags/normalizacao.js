export function normalizarTexto(valor = '') {
  return String(valor)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function normalizarGrupoId(grupoId) {
  return grupoId ? String(grupoId).trim() : '';
}
