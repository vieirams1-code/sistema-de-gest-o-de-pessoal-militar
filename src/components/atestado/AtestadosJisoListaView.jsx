import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ChevronDown, ChevronUp } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

function formatDate(value) {
  if (!value) return '—';
  return format(new Date(`${value}T00:00:00`), 'dd/MM/yyyy');
}

function getStatusJisoDerivado({ jiso }) {
  if (!jiso) return 'Sem JISO';
  if (jiso.ata_jiso || jiso.data_ata) return 'Ata registrada';
  if (jiso.data_jiso || jiso.data_agendamento) return 'Agendada';
  if (jiso.id) return 'Solicitada';
  return 'Sem JISO';
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
        const progresso = Math.max(0, Math.min(100, (dias / 60) * 100));
        const isExpanded = Boolean(expanded[atestado.id]);

        return (
          <div key={atestado.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
              <div>
                <p className="text-xs text-slate-500">Militar</p>
                <p className="font-semibold text-slate-900">{atestado.militar_posto} {atestado.militar_nome}</p>
                <p className="text-sm text-slate-600">Matrícula: {atestado.militar_matricula_label || atestado.militar_matricula_atual || atestado.militar_matricula || '—'}</p>
                <p className="text-sm text-slate-600">Lotação: {atestado.militar_lotacao || atestado.lotacao || '—'}</p>
              </div>

              <div>
                <p className="text-xs text-slate-500">Período do atestado</p>
                <p className="text-sm text-slate-700">{formatDate(atestado.data_inicio)} → {formatDate(atestado.data_termino)}</p>
                <p className="text-sm font-medium text-slate-900">{dias} dias</p>
                <Progress value={progresso} className="mt-2 h-2" />
              </div>

              <div>
                <p className="text-xs text-slate-500">Status</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Badge variant="outline">{atestado.status || '—'}</Badge>
                  <Badge variant="outline">{atestado.tipo_afastamento || '—'}</Badge>
                  <Badge className="bg-slate-100 text-slate-700">{statusJiso}</Badge>
                </div>
              </div>

              <div className="flex flex-wrap items-start justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => onVisualizarJiso?.(atestado, jiso)}>Visualizar atestado</Button>
                {canRegistrarDecisaoJiso && (
                  <Button size="sm" variant="outline" onClick={() => onRegistrarDecisaoJiso?.(atestado, jiso)}>
                    {jiso ? 'Editar JISO' : 'Registrar JISO'}
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setExpanded((p) => ({ ...p, [atestado.id]: !isExpanded }))}>
                  {isExpanded ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />} Expandir
                </Button>
              </div>
            </div>

            {isExpanded && (
              <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Timeline derivada</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">Solicitada</Badge>
                    <Badge variant={jiso?.data_jiso || jiso?.data_agendamento ? 'default' : 'outline'}>Agendada</Badge>
                    <Badge variant={jiso?.ata_jiso || jiso?.data_ata ? 'default' : 'outline'}>Ata</Badge>
                    <Badge variant={atestado?.status_publicacao === 'publicado' ? 'default' : 'outline'}>Publicada/Homologada</Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="mb-2 text-sm font-semibold text-slate-800">Documentos por template</p>
                    <p className="text-sm text-slate-600">
                      TARS de agendamento e ofício de apresentação serão integrados em lote próprio, usando templates institucionais.
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="mb-2 text-sm font-semibold text-slate-800">Rotinas atuais</p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => onVisualizarJiso?.(atestado, jiso)}>Visualizar atestado</Button>
                      {canRegistrarDecisaoJiso && (
                        <Button size="sm" variant="outline" onClick={() => onRegistrarDecisaoJiso?.(atestado, jiso)}>
                          {jiso ? 'Editar JISO' : 'Registrar JISO'}
                        </Button>
                      )}
                    </div>
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
