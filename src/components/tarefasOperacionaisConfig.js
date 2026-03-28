export const STATUS_TAREFA = ['Aberta', 'Em andamento', 'Concluída', 'Encerrada'];

export const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos os status' },
  ...STATUS_TAREFA.map((status) => ({ value: status, label: status })),
];

export const TIPO_TAREFA_OPTIONS = [
  'Administrativa',
  'Operacional',
  'Documental',
  'Logística',
  'Treinamento',
];

export const PRIORIDADE_OPTIONS = ['Baixa', 'Média', 'Alta', 'Crítica'];

export const TIPO_FILTER_OPTIONS = [
  { value: 'all', label: 'Todos os tipos' },
  ...TIPO_TAREFA_OPTIONS.map((tipo) => ({ value: tipo, label: tipo })),
];

export function getStatusBadgeClass(status) {
  if (status === 'Concluída') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'Em andamento') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (status === 'Encerrada') return 'bg-slate-100 text-slate-600 border-slate-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
}

export function getPrioridadeBadgeClass(prioridade) {
  if (prioridade === 'Crítica') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (prioridade === 'Alta') return 'bg-orange-50 text-orange-700 border-orange-200';
  if (prioridade === 'Média') return 'bg-blue-50 text-blue-700 border-blue-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

export function formatDateBR(dateValue) {
  if (!dateValue) return 'Sem prazo';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'Data inválida';
  return date.toLocaleDateString('pt-BR');
}
