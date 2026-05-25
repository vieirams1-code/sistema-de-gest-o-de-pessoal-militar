import React, { useMemo, useState } from 'react';
import { differenceInCalendarDays, format } from 'date-fns';
import { Check, ChevronDown, ChevronRight, Circle, Eye, FileText, Pencil } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

function parseDateOnly(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDate(value) {
  const date = parseDateOnly(value);
  if (!date) return '—';
  return format(date, 'dd/MM/yyyy');
}

function getStatusJisoDerivado({ jiso }) {
  if (!jiso) return 'Sem JISO';
  if (jiso.resultado_jiso || jiso.ata_jiso || jiso.data_ata) return 'Decisão registrada';
  if (jiso.data_jiso || jiso.data_agendamento) return 'Sessão agendada';
  if (jiso.id) return 'Encaminhado';
  return 'Sem JISO';
}

function getJisoBadgeClass(statusJiso) {
  if (statusJiso === 'Encaminhado') return 'border-purple-200 bg-purple-50 text-purple-700';
  if (statusJiso === 'Sessão agendada') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (statusJiso === 'Decisão registrada') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return 'border-slate-200 bg-slate-100 text-slate-700';
}

function buildHistorico(atestado, jiso) {
  const eventos = [
    atestado?.data_inicio && { label: 'Atestado iniciado', data: atestado.data_inicio },
    (jiso?.data_agendamento || jiso?.data_jiso) && { label: 'JISO agendada', data: jiso.data_agendamento || jiso.data_jiso },
    (jiso?.data_ata || jiso?.ata_jiso) && { label: 'Ata registrada', data: jiso.data_ata || jiso.ata_jiso },
    atestado?.data_termino && { label: 'Término previsto', data: atestado.data_termino },
  ].filter(Boolean);

  return eventos.sort((a, b) => (a.data > b.data ? 1 : -1));
}

export default function AtestadosJisoListaView({
  atestados: atestadosProp = [],
  jisos: jisosProp = [],
  loading = false,
  onRegistrarDecisaoJiso,
  onVisualizarJiso,
  canRegistrarDecisaoJiso = false,
}) {
  const [expandedId, setExpandedId] = useState(null);
  const atestados = Array.isArray(atestadosProp) ? atestadosProp : [];
  const jisos = Array.isArray(jisosProp) ? jisosProp : [];

  const jisoPorAtestado = useMemo(() => {
    const mapa = new Map();
    jisos.forEach((jiso) => {
      if (jiso?.atestado_id) mapa.set(jiso.atestado_id, jiso);
    });
    return mapa;
  }, [jisos]);

  if (loading) {
    return <div className="py-10 text-center text-slate-500">Carregando lista...</div>;
  }

  if (!atestados.length) {
    return <div className="py-10 text-center text-slate-500">Nenhum atestado encaminhado para JISO.</div>;
  }

  return (
    <div className="space-y-3">
      {atestados.map((atestado, index) => {
        const atestadoId = atestado?.id ?? `sem-id-${index}`;
        const jiso = jisoPorAtestado.get(atestado?.id);
        const statusJiso = getStatusJisoDerivado({ atestado, jiso });
        const dias = Number(atestado?.dias || atestado?.quantidade_dias || 0);
        const inicio = parseDateOnly(atestado?.data_inicio);
        const fim = parseDateOnly(atestado?.data_retorno || atestado?.data_termino);
        const hoje = parseDateOnly(new Date().toISOString().slice(0, 10));
        const diasRestantes = fim ? differenceInCalendarDays(fim, hoje) : null;
        const diasDecorridos = inicio ? Math.max(0, differenceInCalendarDays(hoje, inicio)) : 0;
        const progresso = dias > 0 ? Math.max(0, Math.min(100, (diasDecorridos / dias) * 100)) : 0;
        const isExpanded = expandedId === atestadoId;
        const historico = buildHistorico(atestado, jiso);
        const timelineEtapas = [
          { label: 'Encaminhado', done: Boolean(jiso?.id) },
          { label: 'Agendada', done: Boolean(jiso?.data_jiso || jiso?.data_agendamento) },
          { label: 'Decisão', done: Boolean(jiso?.resultado_jiso || jiso?.data_ata || jiso?.ata_jiso) },
          { label: 'Publicação', done: atestado?.status_publicacao === 'Publicado' },
        ];

        return (
          <div key={atestadoId} className="space-y-3">
            <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md ${isExpanded ? 'border-blue-200 ring-1 ring-blue-100' : ''}`}>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_auto] lg:items-start">
                <div className="flex min-w-0 gap-3">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="mt-1 h-9 w-9 rounded-full bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                    onClick={() => setExpandedId((prev) => (prev === atestadoId ? null : atestadoId))}
                    aria-label={isExpanded ? 'Recolher linha' : 'Expandir linha'}
                  >
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>

                  <div className="min-w-0 flex-1 space-y-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Militar</p>
                      <p className="truncate text-base font-semibold text-slate-900">{atestado.militar_nome || '—'}</p>
                      <p className="text-sm text-slate-600">{atestado.militar_posto || '—'} • {atestado.militar_matricula_label || atestado.militar_matricula_atual || atestado.militar_matricula || '—'}</p>
                      <p className="text-sm text-slate-500">{atestado.militar_lotacao || atestado.lotacao || 'Lotação não informada'}</p>
                    </div>

                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Período</p>
                      <p className="text-sm text-slate-700">{formatDate(atestado.data_inicio)} → {formatDate(atestado.data_retorno || atestado.data_termino)}</p>
                                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${progresso}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        {diasRestantes === null ? 'Dias restantes não calculáveis' : diasRestantes < 0 ? `${Math.abs(diasRestantes)} dia(s) em atraso` : `${diasRestantes} dia(s) restantes`}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Badge variant="outline">{atestado.status || '—'}</Badge>
                      <Badge variant="outline">{atestado.tipo_afastamento || '—'}</Badge>
                      <Badge className={getJisoBadgeClass(statusJiso)}>{statusJiso}</Badge>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <Button size="sm" variant="outline" className="rounded-xl border-slate-200 bg-white hover:bg-slate-50" onClick={() => onVisualizarJiso?.(atestado, jiso)}>
                    <Eye className="mr-1 h-4 w-4" />Visualizar
                  </Button>
                  {canRegistrarDecisaoJiso && (
                    <Button size="sm" variant="outline" className="rounded-xl border-slate-200 bg-white hover:bg-slate-50" onClick={() => onRegistrarDecisaoJiso?.(atestado, jiso)}>
                      <Pencil className="mr-1 h-4 w-4" />{jiso ? 'Editar JISO' : 'Registrar JISO'}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {isExpanded && (
              <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-5 shadow-sm">
                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Timeline derivada JISO</p>
                    <div className="mt-3 grid grid-cols-4 gap-2">
                      {timelineEtapas.map((etapa, idx) => (
                        <div key={etapa.label} className="relative flex flex-col items-center text-center">
                          {idx < timelineEtapas.length - 1 && (
                            <span className={`absolute left-1/2 top-4 h-0.5 w-full ${etapa.done ? 'bg-emerald-300' : 'bg-slate-200'}`} />
                          )}
                          <span className={`z-10 flex h-8 w-8 items-center justify-center rounded-full border ${etapa.done ? 'border-emerald-300 bg-emerald-100 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>
                            {etapa.done ? <Check className="h-4 w-4" /> : <Circle className="h-3.5 w-3.5" />}
                          </span>
                          <span className="mt-2 text-[11px] font-medium text-slate-600">{etapa.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Histórico simples</p>
                    <ul className="mt-2 space-y-1 text-sm text-slate-700">
                      {historico.length ? historico.map((evento) => (
                        <li key={`${evento.label}-${evento.data}`}>• {formatDate(evento.data)} — {evento.label}</li>
                      )) : <li>Sem eventos adicionais.</li>}
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                      <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <FileText className="h-4 w-4 text-blue-600" />
                        Documentos por template
                      </p>
                      Documentos por template serão integrados futuramente.
                    </div>
                    {canRegistrarDecisaoJiso && (
                      <Button size="sm" className="w-full rounded-xl bg-blue-600 text-white shadow-sm hover:bg-blue-700" onClick={() => onRegistrarDecisaoJiso?.(atestado, jiso)}>
                        Registrar decisão JISO
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
