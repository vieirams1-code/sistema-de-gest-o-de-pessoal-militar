import React, { useMemo, useState } from 'react';
import { AlertCircle, CalendarDays, CheckCircle, ChevronDown, ChevronRight, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AtestadoCard from './AtestadoCard';
import { montarLabelMilitarAtestado } from '@/services/atestadoJisoMilitarContextService';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
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

function getStatusOperacional(atestado, isFluxoJiso) {
  if (atestado?.status === 'Cancelado') return { label: 'Cancelado', variant: 'cancelado' };
  if (atestado?.status === 'Encerrado') return { label: 'Encerrado', variant: 'encerrado' };
  if (atestado?.status_jiso === 'Homologado pela JISO') return { label: 'Homologado JISO', variant: 'success' };
  if (atestado?.homologado_comandante || atestado?.status_jiso === 'Homologado pelo Comandante') return { label: 'Homologado Cmt', variant: 'success' };
  if (isFluxoJiso && atestado?.data_jiso_agendada) return { label: 'JISO agendada', variant: 'purple' };
  if (isFluxoJiso) return { label: 'Aguardando JISO', variant: 'warning' };
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
  const { canAccessAction } = useCurrentUser();
  const [expanded, setExpanded] = useState(false);
  const matricula = montarLabelMilitarAtestado(atestado, { contexto: 'operacional' });
  const isFluxoJiso = Boolean(
    atestado?.necessita_jiso
    || atestado?.fluxo_homologacao === 'jiso'
    || Number(atestado?.dias || 0) > 15
  );
  const periodoFinal = atestado?.data_retorno || atestado?.data_termino;
  const statusOperacional = useMemo(() => getStatusOperacional(atestado, isFluxoJiso), [atestado, isFluxoJiso]);

  const quickAction = useMemo(() => {
    if (isFluxoJiso && !atestado?.data_jiso_agendada && canAccessAction('gerir_jiso')) {
      return { label: 'Agendar JISO', tone: 'warning', action: 'expand' };
    }
    if (
      isFluxoJiso
      && atestado?.data_jiso_agendada
      && atestado?.status_jiso !== 'Homologado pela JISO'
      && canAccessAction('registrar_decisao_jiso')
    ) {
      return { label: 'Registrar decisão', tone: 'primary', action: 'decision' };
    }
    if (
      atestado?.fluxo_homologacao === 'comandante'
      && !atestado?.homologado_comandante
      && canAccessAction('publicar_homologacao')
    ) {
      return { label: 'Homologar', tone: 'primary', action: 'expand' };
    }
    return { label: 'Gerenciar', tone: 'neutral', action: 'expand' };
  }, [atestado, canAccessAction, isFluxoJiso]);

  const statusClass = statusOperacional.variant === 'success'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : statusOperacional.variant === 'purple'
      ? 'bg-purple-50 text-purple-700 border-purple-200'
      : statusOperacional.variant === 'warning'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : statusClasses[atestado?.status] || statusClasses.Ativo;

  const handleQuickAction = (event) => {
    event.stopPropagation();
    if (quickAction.action === 'decision') {
      navigate(createPageUrl('EditarJISO') + `?atestado_id=${atestado.id}`);
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
          {isFluxoJiso && atestado?.data_jiso_agendada && (
            <span className="text-[10px] text-purple-600 inline-flex items-center gap-1 truncate">
              <Shield className="w-3 h-3 shrink-0" />
              {formatDate(atestado.data_jiso_agendada)}{atestado?.hora_jiso_agendada ? ` · ${atestado.hora_jiso_agendada}` : ''}
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
            {quickAction.tone === 'warning' && <AlertCircle className="w-3.5 h-3.5 mr-1 text-amber-600" />}
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
