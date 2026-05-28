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

export function isSameCrm(a, b) {
  return normalizeCrm(a) === normalizeCrm(b);
}
