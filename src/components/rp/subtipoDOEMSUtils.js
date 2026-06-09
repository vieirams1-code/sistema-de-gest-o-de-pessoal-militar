export function normalizeSpaces(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function normalizeSubtipoForm(form = {}) {
  return {
    nome: normalizeSpaces(form.nome),
    ativo: form.ativo !== false,
    ordem: Number(form.ordem || 0),
    observacoes: normalizeSpaces(form.observacoes),
  };
}

export function validateSubtipoForm(form = {}) {
  if (!normalizeSpaces(form.nome)) return 'Informe o nome do subtipo.';
  return '';
}

export function matchesSubtipoSearch(subtipo = {}, search = '') {
  const term = normalizeSpaces(search).toLowerCase();
  if (!term) return true;
  return normalizeSpaces(subtipo.nome).toLowerCase().includes(term)
    || normalizeSpaces(subtipo.observacoes).toLowerCase().includes(term);
}
