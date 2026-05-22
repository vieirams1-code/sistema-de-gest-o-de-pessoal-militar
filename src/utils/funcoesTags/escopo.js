const ESCOPO_LABELS = {
  global: 'Global',
  grupamento: 'Grupamento',
  subgrupamento: 'Subgrupamento',
  unidade: 'Unidade',
  setor: 'Setor',
  subsetor: 'Subsetor'
};

export function getEscopoLabel(escopoTipo) {
  if (!escopoTipo) return 'Global';
  return ESCOPO_LABELS[String(escopoTipo).toLowerCase()] || 'Global';
}
