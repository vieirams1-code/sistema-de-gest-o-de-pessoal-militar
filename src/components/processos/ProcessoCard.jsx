import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Calendar, User, Hash, AlertCircle, Clock } from 'lucide-react';
import { format, differenceInDays, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const prioridadeConfig = {
  'Baixa':   { color: 'bg-slate-100 text-slate-600',   dot: 'bg-slate-400' },
  'Média':   { color: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500' },
  'Alta':    { color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  'Urgente': { color: 'bg-red-100 text-red-700',       dot: 'bg-red-500' },
};

function PrazoLabel({ data }) {
  if (!data) return null;
  const d = new Date(data + 'T00:00:00');
  const diff = differenceInDays(d, new Date());
  const vencido = isPast(d) && !isToday(d);
  const hoje = isToday(d);
  const urgente = diff <= 3 && diff >= 0;

  if (vencido) return (
    <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
      <AlertCircle className="w-3 h-3" /> Vencido há {Math.abs(diff)}d
    </span>
  );
  if (hoje) return (
    <span className="flex items-center gap-1 text-xs text-orange-600 font-medium">
      <Clock className="w-3 h-3" /> Vence hoje
    </span>
  );
  if (urgente) return (
    <span className="flex items-center gap-1 text-xs text-orange-500 font-medium">
      <Clock className="w-3 h-3" /> {diff}d restantes
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-xs text-slate-500">
      <Calendar className="w-3 h-3" />
      {format(d, 'dd/MM/yyyy')}
    </span>
  );
}

export default function ProcessoCard({ processo, onClick, dragHandleProps = {} }) {
  const prio = prioridadeConfig[processo.prioridade] || prioridadeConfig['Média'];
  const prazoData = processo.data_limite || processo.data_renovacao;

  return (
    <div
      className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-all cursor-pointer group"
      onClick={onClick}
      {...dragHandleProps}
    >
      {/* Barra de prioridade */}
      <div className={`h-1 rounded-full mb-2 ${prio.dot}`} />

      <p className="text-sm font-semibold text-slate-800 leading-snug mb-2 group-hover:text-[#1e3a5f] transition-colors">
        {processo.titulo}
      </p>

      {processo.militar_nome && (
        <div className="flex items-center gap-1 text-xs text-slate-500 mb-1.5">
          <User className="w-3 h-3 shrink-0" />
          <span className="truncate">{processo.militar_posto} {processo.militar_nome}</span>
        </div>
      )}

      {processo.numero_protocolo && (
        <div className="flex items-center gap-1 text-xs text-slate-500 mb-1.5">
          <Hash className="w-3 h-3 shrink-0" />
          <span>Prot. {processo.numero_protocolo}</span>
        </div>
      )}

      <div className="flex items-center justify-between mt-2 flex-wrap gap-1">
        <Badge className={`text-xs px-2 py-0.5 ${prio.color} border-0`}>
          {processo.prioridade}
        </Badge>
        <PrazoLabel data={prazoData} />
      </div>

      {processo.tags && processo.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {processo.tags.slice(0, 3).map((tag, i) => (
            <span key={i} className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}