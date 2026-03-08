import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { User, Calendar, FileText, AlertTriangle, Eye } from 'lucide-react';
import EtapaBadge from './EtapaBadge';
import {
  prioridadeColors,
  criticidadeColors,
  isAtrasada,
  isVencendoHoje,
  formatDate,
} from './DemandaUtils';

export default function DemandaCard({ demanda, onClick }) {
  const atrasada = isAtrasada(demanda);
  const venceHoje = isVencendoHoje(demanda);

  return (
    <div
      className={`bg-white rounded-xl border p-4 shadow-sm cursor-pointer hover:shadow-md transition-all ${
        atrasada ? 'border-red-300 bg-red-50/30' : venceHoje ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200'
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 truncate">{demanda.titulo}</p>
          {demanda.assunto_resumido && (
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{demanda.assunto_resumido}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Badge className={`${prioridadeColors[demanda.prioridade]} text-[10px]`}>
            {demanda.prioridade}
          </Badge>
          {atrasada && <Badge className="bg-red-100 text-red-700 text-[10px]">Atrasada</Badge>}
          {venceHoje && !atrasada && <Badge className="bg-amber-100 text-amber-700 text-[10px]">Vence hoje</Badge>}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        <EtapaBadge etapa={demanda.etapa_fluxo} size="sm" />
        {demanda.criticidade && demanda.criticidade !== 'Rotina' && (
          <Badge className={`${criticidadeColors[demanda.criticidade]} text-[10px]`}>
            {demanda.criticidade}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-4 text-xs text-slate-500">
        {demanda.militar_nome_snapshot && (
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {demanda.militar_posto_snapshot ? `${demanda.militar_posto_snapshot} ` : ''}
            {demanda.militar_nome_snapshot}
          </span>
        )}
        {demanda.prazo_final && (
          <span className={`flex items-center gap-1 ${atrasada ? 'text-red-600 font-medium' : venceHoje ? 'text-amber-600 font-medium' : ''}`}>
            <Calendar className="w-3 h-3" />
            {formatDate(demanda.prazo_final)}
          </span>
        )}
        {demanda.origem_tipo && (
          <span className="flex items-center gap-1">
            <FileText className="w-3 h-3" />
            {demanda.origem_tipo}
          </span>
        )}
      </div>
    </div>
  );
}