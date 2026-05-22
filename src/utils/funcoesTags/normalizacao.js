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


const APLICABILIDADE_MAP = {
  militar: 'militar',
  ferias: 'ferias',
  ambos: 'ambos'
};

export function normalizarAplicabilidade(valor) {
  const chave = normalizarTexto(valor);
  return APLICABILIDADE_MAP[chave] || null;
}
