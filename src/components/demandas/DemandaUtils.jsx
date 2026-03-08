export const ETAPAS_CHEFE = [
  'Aguardando decisão do chefe',
  'Aguardando assinatura do chefe',
  'Aguardando comando superior',
];

export const prioridadeColors = {
  Baixa: 'bg-slate-100 text-slate-600',
  Média: 'bg-blue-100 text-blue-700',
  Alta: 'bg-orange-100 text-orange-700',
  Urgente: 'bg-red-100 text-red-700',
};

export const criticidadeColors = {
  Rotina: 'bg-slate-100 text-slate-500',
  'Prazo Próximo': 'bg-amber-100 text-amber-700',
  'Prazo Vencido': 'bg-red-100 text-red-700',
  'Impacta Efetivo': 'bg-purple-100 text-purple-700',
  'Determinação de Comando': 'bg-[#1e3a5f]/10 text-[#1e3a5f]',
  Sensível: 'bg-rose-100 text-rose-700',
};

export const etapaColors = {
  Recebido: 'bg-slate-100 text-slate-700',
  Triagem: 'bg-cyan-100 text-cyan-700',
  'Aguardando decisão do chefe': 'bg-amber-100 text-amber-800',
  'Aguardando assinatura do chefe': 'bg-orange-100 text-orange-800',
  'Em elaboração': 'bg-blue-100 text-blue-700',
  'Aguardando documento': 'bg-purple-100 text-purple-700',
  'Aguardando comando superior': 'bg-rose-100 text-rose-700',
  'Retornado para execução': 'bg-teal-100 text-teal-700',
  Concluído: 'bg-emerald-100 text-emerald-700',
  Arquivado: 'bg-slate-100 text-slate-400',
};

export const statusColors = {
  Aberta: 'bg-blue-100 text-blue-700',
  'Em Andamento': 'bg-amber-100 text-amber-700',
  Concluída: 'bg-emerald-100 text-emerald-700',
  Arquivada: 'bg-slate-100 text-slate-500',
  Cancelada: 'bg-red-100 text-red-600',
};

export function isAtrasada(demanda) {
  if (!demanda.prazo_final) return false;
  if (demanda.status === 'Concluída' || demanda.status === 'Arquivada') return false;
  return new Date(demanda.prazo_final + 'T00:00:00') < new Date();
}

export function isVencendoHoje(demanda) {
  if (!demanda.prazo_final) return false;
  if (demanda.status === 'Concluída' || demanda.status === 'Arquivada') return false;
  const today = new Date().toISOString().split('T')[0];
  return demanda.prazo_final === today;
}

export function sortDemandas(list) {
  const prio = { Urgente: 0, Alta: 1, Média: 2, Baixa: 3 };
  const crit = {
    'Prazo Vencido': 0,
    'Determinação de Comando': 1,
    'Impacta Efetivo': 2,
    Sensível: 3,
    'Prazo Próximo': 4,
    Rotina: 5,
  };

  const today = new Date().toISOString().split('T')[0];

  return [...list].sort((a, b) => {
    // 1. Prazo vencido primeiro
    const aVencida = a.prazo_final && a.prazo_final < today ? 0 : 1;
    const bVencida = b.prazo_final && b.prazo_final < today ? 0 : 1;
    if (aVencida !== bVencida) return aVencida - bVencida;

    // 2. Sem responsável sobe
    const aSemResp = !a.responsavel_atual_nome ? 0 : 1;
    const bSemResp = !b.responsavel_atual_nome ? 0 : 1;
    if (aSemResp !== bSemResp) return aSemResp - bSemResp;

    // 3. Prioridade
    const pa = prio[a.prioridade] ?? 4;
    const pb = prio[b.prioridade] ?? 4;
    if (pa !== pb) return pa - pb;

    // 4. Criticidade
    const ca = crit[a.criticidade] ?? 6;
    const cb = crit[b.criticidade] ?? 6;
    if (ca !== cb) return ca - cb;

    // 5. Prazo mais próximo
    if (a.prazo_final && b.prazo_final) return a.prazo_final.localeCompare(b.prazo_final);
    if (a.prazo_final) return -1;
    if (b.prazo_final) return 1;
    return 0;
  });
}

export function formatDate(d) {
  if (!d) return '—';
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
  } catch {
    return d;
  }
}