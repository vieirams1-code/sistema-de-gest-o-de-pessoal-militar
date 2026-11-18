import { format } from 'date-fns';

export const TIPOS_PROCEDIMENTO = [
  'PAD',
  'Inquérito Técnico',
  'Sindicância',
  'IPM',
  'Processo Administrativo',
  'Outro',
];

export const STATUS_PROCEDIMENTO = [
  'Instaurado',
  'Em andamento',
  'Prorrogado',
  'Aguardando solução',
  'Solucionado',
  'Arquivado',
  'Cancelado',
];

export const PAPEIS_ENVOLVIDO = [
  'Investigado',
  'Testemunha',
  'Encarregado',
  'Autoridade',
  'Outro',
];

export const PRIORIDADES = ['Baixa', 'Média', 'Alta'];

export const STATUS_ENCERRADOS = ['Solucionado', 'Arquivado', 'Cancelado'];

export const SITUACOES_PRAZO = [
  { value: 'vencido', label: 'Prazo vencido' },
  { value: 'vencendo', label: 'Vencendo (15 dias)' },
  { value: 'no_prazo', label: 'No prazo' },
  { value: 'encerrado', label: 'Encerrado' },
  { value: 'sem_prazo', label: 'Sem prazo' },
];

const STATUS_CLASSES = {
  Instaurado: 'bg-blue-50 text-blue-700 border-blue-200',
  'Em andamento': 'bg-blue-50 text-blue-700 border-blue-200',
  Prorrogado: 'bg-amber-50 text-amber-700 border-amber-200',
  'Aguardando solução': 'bg-amber-50 text-amber-700 border-amber-200',
  Solucionado: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Arquivado: 'bg-slate-100 text-slate-600 border-slate-200',
  Cancelado: 'bg-red-50 text-red-700 border-red-200',
};

const PRAZO_CLASSES = {
  vencido: 'bg-red-50 text-red-700 border-red-200',
  vencendo: 'bg-amber-50 text-amber-700 border-amber-200',
  no_prazo: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  encerrado: 'bg-slate-100 text-slate-600 border-slate-200',
  sem_prazo: 'bg-slate-100 text-slate-600 border-slate-200',
};

export function classeStatus(status) {
  return STATUS_CLASSES[status] || 'bg-slate-100 text-slate-600 border-slate-200';
}

export function classePrazo(chave) {
  return PRAZO_CLASSES[chave] || PRAZO_CLASSES.sem_prazo;
}

export function formatarData(valor) {
  const texto = String(valor || '').slice(0, 10);
  if (!texto) return '—';
  const data = new Date(`${texto}T00:00:00`);
  if (Number.isNaN(data.getTime())) return '—';
  return format(data, 'dd/MM/yyyy');
}

/** Dias corridos entre hoje e a data do prazo (negativo = vencido). */
export function diasAtePrazo(prazoFinal) {
  const texto = String(prazoFinal || '').slice(0, 10);
  if (!texto) return null;
  const alvo = new Date(`${texto}T00:00:00`);
  if (Number.isNaN(alvo.getTime())) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
}

export function classificarPrazo(procedimento) {
  if (!procedimento) return { chave: 'sem_prazo', label: 'Sem prazo', dias: null };
  if (STATUS_ENCERRADOS.includes(procedimento.status)) {
    return { chave: 'encerrado', label: 'Encerrado', dias: null };
  }
  const dias = diasAtePrazo(procedimento.prazo_final);
  if (dias === null) return { chave: 'sem_prazo', label: 'Sem prazo', dias: null };
  if (dias < 0) return { chave: 'vencido', label: `Vencido há ${Math.abs(dias)}d`, dias };
  if (dias === 0) return { chave: 'vencendo', label: 'Vence hoje', dias };
  if (dias <= 15) return { chave: 'vencendo', label: `Vence em ${dias}d`, dias };
  return { chave: 'no_prazo', label: `${dias}d restantes`, dias };
}