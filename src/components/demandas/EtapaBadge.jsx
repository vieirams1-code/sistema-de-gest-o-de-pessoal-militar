import React from 'react';
import { AlertTriangle, Pencil, Clock } from 'lucide-react';
import { ETAPAS_CHEFE } from './DemandaUtils';

const etapaConfig = {
  'Aguardando decisão do chefe': {
    icon: AlertTriangle,
    cls: 'bg-amber-500 text-white border-amber-600',
    clsSm: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  'Aguardando assinatura do chefe': {
    icon: Pencil,
    cls: 'bg-orange-500 text-white border-orange-600',
    clsSm: 'bg-orange-100 text-orange-800 border-orange-300',
  },
  'Aguardando comando superior': {
    icon: Clock,
    cls: 'bg-rose-500 text-white border-rose-600',
    clsSm: 'bg-rose-100 text-rose-800 border-rose-300',
  },
  Recebido: { cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  Triagem: { cls: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  'Em elaboração': { cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  'Aguardando documento': { cls: 'bg-purple-100 text-purple-700 border-purple-200' },
  'Retornado para execução': { cls: 'bg-teal-100 text-teal-700 border-teal-200' },
  Concluído: { cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  Arquivado: { cls: 'bg-slate-100 text-slate-400 border-slate-200' },
};

export default function EtapaBadge({ etapa, size = 'md' }) {
  if (!etapa) return null;

  const cfg = etapaConfig[etapa] || { cls: 'bg-slate-100 text-slate-600 border-slate-200' };
  const isChefe = ETAPAS_CHEFE.includes(etapa);
  const Icon = cfg.icon;

  // Para etapas do chefe em tamanho normal usamos a versão mais destacada
  const colorClass = size === 'sm' ? (cfg.clsSm || cfg.cls) : cfg.cls;
  const textClass = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5';

  return (
    <span className={`inline-flex items-center gap-1 rounded-md border font-semibold ${colorClass} ${textClass}`}>
      {Icon && <Icon className={size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />}
      {etapa}
    </span>
  );
}