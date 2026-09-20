import React, { useMemo, useState } from 'react';
import { CalendarDays, CheckCircle, ChevronDown, ChevronRight, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AtestadoCard from './AtestadoCard';
import { montarLabelMilitarAtestado } from '@/services/atestadoJisoMilitarContextService';
import { createPageUrl } from '@/utils';

const statusClasses = {
  Ativo: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Encerrado: 'bg-slate-50 text-slate-600 border-slate-200',
  Cancelado: 'bg-red-50 text-red-700 border-red-200',
  Prorrogado: 'bg-blue-50 text-blue-700 border-blue-200',
};

function formatDate(value) {
  if (!value) return '—';
  const [year, month, day] = String(value).split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function getStatusOperacional(atestado) {
  if (atestado?.status === 'Cancelado') return { label: 'Cancelado', variant: 'cancelado' };
  if (atestado?.status === 'Encerrado') return { label: 'Encerrado', variant: 'encerrado' };
  if (atestado?.homologado_comandante) return { label: 'Homologado Cmt', variant: 'success' };
  return { label: atestado?.status || 'Ativo', variant: 'default' };
}

export default function AtestadoCompactItem({
  atestado,
  onEdit,
  onDelete,
  onView,
  canEdit,
  canDelete,
}) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const matricula = montarLabelMilitarAtestado(atestado, { contexto: 'operacional' });
  const periodoFinal = atestado?.data_retorno || atestado?.data_termino;
  const statusOperacional = useMemo(() => getStatusOperacional(atestado), [atestado]);
  const quickAction = atestado?.jiso_vinculo_ativo
    ? { label: 'Abrir JISO', tone: 'primary', action: 'jiso' }
    : { label: 'Gerenciar', tone: 'neutral', action: 'expand' };

  const statusClass = statusOperacional.variant === 'success'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : statusOperacional.variant === 'purple'
      ? 'bg-purple-50 text-purple-700 border-purple-200'
      : statusOperacional.variant === 'warning'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : statusClasses[atestado?.status] || statusClasses.Ativo;

  const handleQuickAction = (event) => {
    event.stopPropagation();
    if (quickAction.action === 'jiso' && atestado?.jiso_id_derivado) {
      navigate(createPageUrl('EditarJISO') + `?jiso_id=${atestado.jiso_id_derivado}`);
      return;
    }
    setExpanded(true);
  };

  return (
    <div className={`border-b border-slate-100 last:border-b-0 ${expanded ? 'bg-slate-50/60' : 'bg-white'}`}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') setExpanded((value) => !value);
        }}
        className="grid grid-cols-1 lg:grid-cols-[32px_minmax(280px,1.45fr)_minmax(250px,1.15fr)_minmax(220px,1fr)_150px] items-center gap-2 lg:gap-3 px-3 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
      >
        <div className="hidden lg:flex items-center justify-center text-slate-400">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>

        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">
            {atestado?.militar_nome || 'Militar'}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 truncate">
            {atestado?.militar_posto || '—'} · {matricula || '—'}
            {atestado?.tipo_afastamento ? ` · ${atestado.tipo_afastamento}` : ''}
          </p>
        </div>

        <div className="min-w-0 flex items-center gap-2">
          <CalendarDays className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{atestado?.dias || 0} dias</p>
            <p className="text-[11px] text-slate-500 truncate">
              {formatDate(atestado?.data_inicio)} à {formatDate(periodoFinal)}
            </p>
          </div>
        </div>

        <div className="min-w-0 flex flex-wrap items-center gap-1.5">
          <Badge className={`${statusClass} border text-[10px] px-1.5 py-0.5`}>
            {statusOperacional.label}
          </Badge>
          {atestado?.jiso_vinculo_ativo && (
            <span className="text-[10px] text-purple-600 inline-flex items-center gap-1 truncate">
              <Shield className="w-3 h-3 shrink-0" />
              {atestado.jiso_codigo || 'JISO'} · {atestado.jiso_status || 'Em andamento'}
              {atestado?.jiso_data ? ` · ${formatDate(atestado.jiso_data)}` : ''}
            </span>
          )}
        </div>

        <div className="flex items-center justify-end gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={quickAction.tone === 'primary' ? 'default' : 'outline'}
            className={`h-7 px-2.5 text-[11px] ${quickAction.tone === 'primary' ? 'bg-[#1e3a5f] hover:bg-[#2d4a6f]' : ''}`}
            onClick={handleQuickAction}
          >
            {quickAction.label}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-slate-400 hover:text-[#1e3a5f]"
            onClick={(event) => {
              event.stopPropagation();
              onView(atestado);
            }}
            title="Abrir atestado"
          >
            <CheckCircle className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/80 px-3 py-3 lg:pl-11">
          <AtestadoCard
            atestado={atestado}
            onEdit={onEdit}
            onDelete={onDelete}
            onView={onView}
            canEdit={canEdit}
            canDelete={canDelete}
            embedded
            defaultExpanded
          />
        </div>
      )}
    </div>
  );
}
