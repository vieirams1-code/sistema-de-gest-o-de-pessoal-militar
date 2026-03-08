import React from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, Pencil } from 'lucide-react';
import { etapaColors, ETAPAS_CHEFE } from './DemandaUtils';

export default function EtapaBadge({ etapa, size = 'md' }) {
  if (!etapa) return null;

  const colorClass = etapaColors[etapa] || 'bg-slate-100 text-slate-600';
  const isChefe = ETAPAS_CHEFE.includes(etapa);

  const textClass = size === 'sm' ? 'text-[10px]' : 'text-xs';

  return (
    <Badge className={`${colorClass} ${textClass} flex items-center gap-1 font-medium`}>
      {etapa === 'Aguardando decisão do chefe' && <AlertTriangle className="w-3 h-3" />}
      {etapa === 'Aguardando assinatura do chefe' && <Pencil className="w-3 h-3" />}
      {etapa === 'Aguardando comando superior' && <Clock className="w-3 h-3" />}
      {etapa}
    </Badge>
  );
}