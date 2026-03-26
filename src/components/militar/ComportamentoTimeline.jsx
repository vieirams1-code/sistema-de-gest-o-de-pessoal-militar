import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

const tipoEventoClasses = {
  Implantação: 'bg-blue-100 text-blue-700',
  Punição: 'bg-red-100 text-red-700',
  Recalculo: 'bg-amber-100 text-amber-700',
  Mudança: 'bg-emerald-100 text-emerald-700',
  Revisão: 'bg-slate-100 text-slate-700',
};

function formatarData(data) {
  if (!data) return 'Data não informada';
  try {
    return format(new Date(`${data}T00:00:00`), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return data;
  }
}

export default function ComportamentoTimeline({ eventos = [] }) {
  if (!eventos.length) {
    return <p className="text-sm text-slate-500">Nenhum evento de comportamento registrado.</p>;
  }

  return (
    <div className="space-y-3">
      {eventos.map((evento) => (
        <div key={evento.id} className="border rounded p-3 text-sm">
          <div className="flex items-center justify-between gap-2 mb-2">
            <Badge className={tipoEventoClasses[evento.tipo_evento] || 'bg-slate-100 text-slate-700'}>
              {evento.tipo_evento || 'Evento'}
            </Badge>
            <span className="text-slate-500">{formatarData(evento.data_evento || evento.data_alteracao)}</span>
          </div>

          <p>
            <strong>{evento.comportamento_anterior || 'N/D'}</strong> → <strong>{evento.comportamento_novo || 'N/D'}</strong>
          </p>
          {evento.observacoes && <p className="text-slate-600 mt-1">{evento.observacoes}</p>}
        </div>
      ))}
    </div>
  );
}
