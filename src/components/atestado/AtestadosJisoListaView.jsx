import React, { useMemo, useState } from 'react';
import { differenceInCalendarDays, format } from 'date-fns';
import { ChevronDown, ChevronRight, Eye, Pencil } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

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
  atestados = [],
  jisos = [],
  loading = false,
  onRegistrarDecisaoJiso,
  onVisualizarJiso,
  canRegistrarDecisaoJiso = false,
}) {
  const [expanded, setExpanded] = useState({});

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
      {atestados.map((atestado) => {
        const jiso = jisoPorAtestado.get(atestado.id);
        const statusJiso = getStatusJisoDerivado({ atestado, jiso });
        const dias = Number(atestado?.dias || atestado?.quantidade_dias || 0);
        const inicio = parseDateOnly(atestado?.data_inicio);
        const fim = parseDateOnly(atestado?.data_retorno || atestado?.data_termino);
        const hoje = parseDateOnly(new Date().toISOString().slice(0, 10));
        const diasRestantes = fim ? differenceInCalendarDays(fim, hoje) : null;
        const diasDecorridos = inicio ? Math.max(0, differenceInCalendarDays(hoje, inicio)) : 0;
        const progresso = dias > 0 ? Math.max(0, Math.min(100, (diasDecorridos / dias) * 100)) : 0;
        const isExpanded = Boolean(expanded[atestado.id]);
        const historico = buildHistorico(atestado, jiso);

        return (
          <div key={atestado.id} className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 flex-1 gap-3">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="mt-1 h-7 w-7"
                    onClick={() => setExpanded((p) => ({ ...p, [atestado.id]: !isExpanded }))}
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
                      <Progress value={progresso} className="mt-2 h-2" />
                      <p className="mt-1 text-xs text-slate-600">
                        {diasRestantes === null ? 'Dias restantes não calculáveis' : diasRestantes < 0 ? `${Math.abs(diasRestantes)} dia(s) em atraso` : `${diasRestantes} dia(s) restantes`}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[280px]">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Badge variant="outline">{atestado.status || '—'}</Badge>
                      <Badge variant="outline">{atestado.tipo_afastamento || '—'}</Badge>
                      <Badge className="bg-slate-100 text-slate-700">{statusJiso}</Badge>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => onVisualizarJiso?.(atestado, jiso)}>
                      <Eye className="mr-1 h-4 w-4" />Visualizar
                    </Button>
                    {canRegistrarDecisaoJiso && (
                      <Button size="sm" variant="outline" onClick={() => onRegistrarDecisaoJiso?.(atestado, jiso)}>
                        <Pencil className="mr-1 h-4 w-4" />{jiso ? 'Editar JISO' : 'Registrar JISO'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {isExpanded && (
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid gap-4 lg:grid-cols-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Timeline derivada JISO</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline">Encaminhado</Badge>
                      <Badge variant={jiso?.data_jiso || jiso?.data_agendamento ? 'default' : 'outline'}>Agendada</Badge>
                      <Badge variant={jiso?.resultado_jiso || jiso?.data_ata || jiso?.ata_jiso ? 'default' : 'outline'}>Decisão</Badge>
                      <Badge variant={atestado?.status_publicacao === 'Publicado' ? 'default' : 'outline'}>Publicação</Badge>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Histórico simples</p>
                    <ul className="mt-2 space-y-1 text-sm text-slate-700">
                      {historico.length ? historico.map((evento) => (
                        <li key={`${evento.label}-${evento.data}`}>• {formatDate(evento.data)} — {evento.label}</li>
                      )) : <li>Sem eventos adicionais.</li>}
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                      Documentos por template serão integrados futuramente.
                    </div>
                    {canRegistrarDecisaoJiso && (
                      <Button size="sm" className="w-full" onClick={() => onRegistrarDecisaoJiso?.(atestado, jiso)}>
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
