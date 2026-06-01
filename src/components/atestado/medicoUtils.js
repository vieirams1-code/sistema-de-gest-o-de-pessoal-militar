export function normalizeCrm(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export function medicoDisplayName(medico = {}) {
  const nome = String(medico.nome || medico.medico_nome_snapshot || medico.medico || '').trim();
  const crm = normalizeCrm(medico.crm || medico.medico_crm_snapshot || medico.crm_medico || '');
  if (!nome && !crm) return '';
  if (!crm) return nome;
  if (!nome) return `CRM ${crm}`;
  return `${nome} — CRM ${crm}`;
}

export function compactCrm(value) {
  return normalizeCrm(value).replace(/[^A-Z0-9]/g, '');
}

export function isSameCrm(a, b) {
  const compactA = compactCrm(a);
  const compactB = compactCrm(b);
  return !!compactA && !!compactB && compactA === compactB;
}

export function normalizeSpaces(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function normalizeMedicoForm(form = {}) {
  return {
    nome: normalizeSpaces(form.nome),
    crm: normalizeCrm(form.crm),
    observacoes: normalizeSpaces(form.observacoes),
    ativo: form.ativo !== false,
  };
}

export function validateMedicoForm(form = {}) {
  if (!normalizeSpaces(form.nome)) return 'Informe o nome do médico.';
  if (!normalizeCrm(form.crm)) return 'Informe o CRM do médico.';
  return '';
}

export function findDuplicateCrm(medicos = [], crm, ignoredId = '') {
  return medicos.find((medico) => medico?.id !== ignoredId && isSameCrm(medico?.crm, crm)) || null;
}

export function matchesMedicoSearch(medico = {}, search = '') {
  const term = normalizeSpaces(search).toLowerCase();
  if (!term) return true;
  return normalizeSpaces(medico.nome).toLowerCase().includes(term)
    || normalizeCrm(medico.crm).toLowerCase().includes(normalizeCrm(search).toLowerCase())
    || compactCrm(medico.crm).toLowerCase().includes(compactCrm(search).toLowerCase());
}
