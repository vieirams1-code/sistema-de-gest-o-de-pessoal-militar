import React, { useState } from 'react';
import { ChevronDown, ChevronUp, FileText, Shield, CalendarDays } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AtestadoCard from './AtestadoCard';
import { montarLabelMilitarAtestado } from '@/services/atestadoJisoMilitarContextService';

const statusClasses = {
  Ativo: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Encerrado: 'bg-slate-100 text-slate-600 border-slate-200',
  Cancelado: 'bg-red-100 text-red-700 border-red-200',
  Prorrogado: 'bg-blue-100 text-blue-700 border-blue-200',
};

function formatDate(value) {
  if (!value) return '—';
  const [year, month, day] = String(value).split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

export default function AtestadoCompactItem({
  atestado,
  onEdit,
  onDelete,
  onView,
  canEdit,
  canDelete,
}) {
  const [expanded, setExpanded] = useState(false);
  const matricula = montarLabelMilitarAtestado(atestado, { contexto: 'operacional' });
  const isFluxoJiso = Boolean(
    atestado?.necessita_jiso
    || atestado?.fluxo_homologacao === 'jiso'
    || Number(atestado?.dias || 0) > 15
  );
  const periodoFinal = atestado?.data_termino || atestado?.data_retorno;

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(260px,1.45fr)_minmax(210px,1fr)_80px_minmax(190px,1fr)_auto] items-center gap-2 lg:gap-4 px-3 py-2.5">
        <div className="min-w-0 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
            <FileText className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => onView(atestado)}
              className="block max-w-full text-left text-sm font-semibold text-slate-900 truncate hover:text-[#1e3a5f]"
            >
              {atestado?.militar_posto ? `${atestado.militar_posto} ` : ''}{atestado?.militar_nome || 'Militar'}
            </button>
            <p className="mt-0.5 text-[11px] text-slate-500 truncate">
              Mat. {matricula || '—'}{atestado?.tipo_afastamento ? ` · ${atestado.tipo_afastamento}` : ''}
            </p>
          </div>
        </div>

        <div className="min-w-0 flex items-center gap-2">
          <CalendarDays className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide font-medium text-slate-400">Período</p>
            <p className="text-xs font-semibold text-slate-700 truncate">
              {formatDate(atestado?.data_inicio)} → {formatDate(periodoFinal)}
            </p>
          </div>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wide font-medium text-slate-400">Dias</p>
          <p className="text-sm font-bold text-slate-800">{atestado?.dias || 0}</p>
        </div>

        <div className="min-w-0 flex flex-wrap items-center gap-1.5">
          <Badge className={`${statusClasses[atestado?.status] || statusClasses.Ativo} border text-[10px] px-1.5 py-0.5`}>
            {atestado?.status || 'Ativo'}
          </Badge>
          {isFluxoJiso && (
            <Badge className="bg-purple-100 text-purple-700 border border-purple-200 text-[10px] px-1.5 py-0.5 max-w-full">
              <Shield className="w-3 h-3 mr-1 shrink-0" />
              <span className="truncate">
                {atestado?.data_jiso_agendada
                  ? `JISO ${formatDate(atestado.data_jiso_agendada)}${atestado?.hora_jiso_agendada ? ` ${atestado.hora_jiso_agendada}` : ''}`
                  : (atestado?.status_jiso || 'JISO pendente')}
              </span>
            </Badge>
          )}
          {atestado?.acompanhado && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 border-pink-200 text-pink-700">
              Acomp.
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-end gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] text-[#1e3a5f]"
            onClick={() => onView(atestado)}
          >
            Abrir
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
          >
            {expanded ? 'Recolher' : 'Ações'}
            {expanded ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-200 bg-slate-50 p-2.5">
          <AtestadoCard
            atestado={atestado}
            onEdit={onEdit}
            onDelete={onDelete}
            onView={onView}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        </div>
      )}
    </div>
  );
}
