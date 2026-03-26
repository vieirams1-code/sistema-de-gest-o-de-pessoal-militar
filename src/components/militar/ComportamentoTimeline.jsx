import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

const comportamentoClasses = {
  Excepcional: 'bg-blue-100 text-blue-700',
  Ótimo: 'bg-emerald-100 text-emerald-700',
  Bom: 'bg-slate-100 text-slate-700',
  Insuficiente: 'bg-amber-100 text-amber-700',
  MAU: 'bg-red-100 text-red-700',
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
    return <p className="text-sm text-slate-500">Nenhum marco de comportamento registrado.</p>;
  }
  const eventosOrdenados = [...eventos].sort((a, b) => {
    const dataA = a.data_vigencia || a.data_evento || a.data_alteracao;
    const dataB = b.data_vigencia || b.data_evento || b.data_alteracao;
    if (!dataA && !dataB) return 0;
    if (!dataA) return 1;
    if (!dataB) return -1;
    return new Date(dataA) - new Date(dataB);
  });

  return (
    <div className="space-y-3">
      {eventosOrdenados.map((evento) => (
        <div key={evento.id} className="border rounded p-3 text-sm">
          <div className="flex items-center justify-between gap-2 mb-2">
            <Badge className={comportamentoClasses[evento.comportamento] || 'bg-slate-100 text-slate-700'}>
              {evento.comportamento || 'N/D'}
            </Badge>
            <span className="text-slate-500">{formatarData(evento.data_vigencia || evento.data_evento || evento.data_alteracao)}</span>
          </div>

          {evento.comportamento_anterior ? (
            <p><strong>{evento.comportamento_anterior}</strong> → <strong>{evento.comportamento || 'N/D'}</strong></p>
          ) : (
            <p><strong>Comportamento vigente:</strong> {evento.comportamento || 'N/D'}</p>
          )}
          {evento.motivo_mudanca && <p className="text-slate-700 mt-1"><strong>Motivo:</strong> {evento.motivo_mudanca}</p>}
          {evento.observacoes && <p className="text-slate-600 mt-1">{evento.observacoes}</p>}
        </div>
      ))}
    </div>
  );
}
