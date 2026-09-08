import { fetchScopedFeriasBundle } from '@/services/getScopedFeriasBundleClient';

const STATUS_LABELS = {
  pendente_publicacao: 'Pendente de Publicação',
  ativo: 'Ativo',
  cancelado: 'Cancelado',
  revertido: 'Revertido',
};

const STATUS_BADGE = {
  pendente_publicacao: 'bg-amber-100 text-amber-800 border-amber-200',
  ativo: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  cancelado: 'bg-slate-100 text-slate-600 border-slate-200',
  revertido: 'bg-rose-100 text-rose-800 border-rose-200',
};

export function getStatusDescontoLabel(status) {
  return STATUS_LABELS[status] || status || '—';
}

export function getStatusDescontoBadgeClass(status) {
  return STATUS_BADGE[status] || 'bg-slate-100 text-slate-600 border-slate-200';
}

/**
 * Lista descontos de férias exclusivamente pelo bundle escopado. O backend
 * valida módulo + ação + escopo organizacional e devolve somente a projeção
 * documental mínima das publicações/reversões vinculadas.
 */
export async function listarDescontosFerias() {
  const bundle = await fetchScopedFeriasBundle({ includeDescontos: true });
  return bundle.descontosFerias || [];
}
