// Constantes e helpers visuais do módulo Controle de Processos.

export const TIPOS_INTERNOS = [
  'PAD',
  'IPM',
  'Sindicância',
  'Processo de direito de militar',
  'Requerimento administrativo',
  'Reserva remunerada/Reforma',
  'Desligamento/Exclusão',
  'Processo disciplinar',
  'Processo de saúde/JISO',
  'Comunicação interna',
  'Ofício',
  'Outro',
];

export const SISTEMAS_ORIGEM = ['e-MS', 'TARS', 'Outro'];

export const PRIORIDADES = ['Baixa', 'Normal', 'Alta', 'Urgente'];

export const STATUS_PROCESSO = [
  'Novo',
  'Em análise',
  'Aguardando assinatura',
  'Aguardando resposta externa',
  'Aguardando providência da caixa',
  'Devolvido para ajustes',
  'Concluído',
  'Arquivado',
  'Cancelado',
];

export const ACOES_SOLICITADAS = [
  'Assinar documento',
  'Analisar',
  'Elaborar resposta',
  'Juntar documento',
  'Despachar',
  'Tomar ciência',
  'Devolver com providência',
  'Cumprir determinação',
];

export const STATUS_BADGE_CLASSES = {
  Novo: 'bg-blue-100 text-blue-800',
  'Em análise': 'bg-indigo-100 text-indigo-800',
  'Aguardando assinatura': 'bg-amber-100 text-amber-800',
  'Aguardando resposta externa': 'bg-purple-100 text-purple-800',
  'Aguardando providência da caixa': 'bg-orange-100 text-orange-800',
  'Devolvido para ajustes': 'bg-rose-100 text-rose-800',
  Concluído: 'bg-green-100 text-green-800',
  Arquivado: 'bg-slate-200 text-slate-700',
  Cancelado: 'bg-slate-100 text-slate-500',
};

export const PRIORIDADE_BADGE_CLASSES = {
  Baixa: 'bg-slate-100 text-slate-600',
  Normal: 'bg-sky-100 text-sky-700',
  Alta: 'bg-amber-100 text-amber-800',
  Urgente: 'bg-red-100 text-red-800',
};

export function getStatusBadgeClass(status) {
  return STATUS_BADGE_CLASSES[status] || 'bg-slate-100 text-slate-600';
}

export function getPrioridadeBadgeClass(prioridade) {
  return PRIORIDADE_BADGE_CLASSES[prioridade] || 'bg-slate-100 text-slate-600';
}

/**
 * Classifica o prazo de um processo em relação à data atual.
 * @returns {'sem_prazo'|'atrasado'|'hoje'|'proximo'|'no_prazo'}
 */
export function classificarPrazo(prazo) {
  if (!prazo) return 'sem_prazo';
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const data = new Date(`${prazo}T00:00:00`);
  if (Number.isNaN(data.getTime())) return 'sem_prazo';
  const diffDias = Math.round((data - hoje) / (1000 * 60 * 60 * 24));
  if (diffDias < 0) return 'atrasado';
  if (diffDias === 0) return 'hoje';
  if (diffDias <= 3) return 'proximo';
  return 'no_prazo';
}