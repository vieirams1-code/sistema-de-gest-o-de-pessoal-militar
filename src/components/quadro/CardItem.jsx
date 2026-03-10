import React from 'react';
import { Calendar, MessageSquare, User, CheckSquare, AlertTriangle, Tag, Gavel } from 'lucide-react';

const PRIORIDADE_COR = {
  'Urgente': 'bg-red-500',
  'Alta': 'bg-orange-400',
  'Média': 'bg-blue-400',
  'Baixa': 'bg-slate-300',
};

function formatPrazo(prazo) {
  if (!prazo) return null;
  const d = new Date(prazo + 'T00:00:00');
  const hoje = new Date();
  hoje.setHours(0,0,0,0);
  const diff = Math.round((d - hoje) / 86400000);
  const str = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  if (diff < 0) return { str, cls: 'bg-red-100 text-red-700 font-semibold', icon: true };
  if (diff <= 3) return { str, cls: 'bg-amber-100 text-amber-700 font-semibold', icon: true };
  return { str, cls: 'bg-slate-100 text-slate-500', icon: false };
}

export default function CardItem({ card, onClick }) {
  const prazo = formatPrazo(card.prazo);
  const dotPrioridade = PRIORIDADE_COR[card.prioridade] || 'bg-slate-300';

  return (
    <div
      onClick={() => onClick(card)}
      className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm hover:shadow-md hover:border-slate-300 cursor-pointer transition-all group"
    >
      {/* Etiqueta */}
      {card.etiqueta_texto && (
        <div
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold mb-2 text-white"
          style={{ backgroundColor: card.etiqueta_cor || '#6366f1' }}
        >
          <Tag className="w-2.5 h-2.5" />
          {card.etiqueta_texto}
        </div>
      )}

      {/* Título + dot prioridade */}
      <div className="flex items-start gap-2">
        <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${dotPrioridade}`} />
        <p className="text-sm font-medium text-slate-800 leading-snug group-hover:text-slate-900 flex-1">
          {card.titulo}
        </p>
      </div>

      {card.aguardando_decisao && (
        <div className="mt-2 ml-4 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
            <Gavel className="w-3 h-3" />
            Aguardando decisão
          </div>
          {card.encaminhado_para_nome && (
            <p className="text-[10px] text-amber-700 mt-0.5 truncate">
              Para: <span className="font-semibold">{card.encaminhado_para_nome}</span>
            </p>
          )}
        </div>
      )}

      {/* Militar */}
      {card.militar_nome_snapshot && (
        <div className="flex items-center gap-1 mt-1.5 ml-4">
          <User className="w-3 h-3 text-slate-400 shrink-0" />
          <span className="text-[11px] text-slate-500 truncate">{card.militar_nome_snapshot}</span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-2.5 ml-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {prazo && (
            <span className={`flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded ${prazo.cls}`}>
              {prazo.icon && <AlertTriangle className="w-2.5 h-2.5" />}
              <Calendar className="w-2.5 h-2.5" />
              {prazo.str}
            </span>
          )}
          {card.checklist_resumo && (
            <span className="flex items-center gap-1 text-[11px] text-slate-400">
              <CheckSquare className="w-3 h-3" />
              {card.checklist_resumo}
            </span>
          )}
        </div>
        {card.comentarios_count > 0 && (
          <span className="flex items-center gap-1 text-[11px] text-slate-400">
            <MessageSquare className="w-3 h-3" />
            {card.comentarios_count}
          </span>
        )}
      </div>

      {/* Origem badge */}
      {(card.origem_tipo && card.origem_tipo !== 'Manual') || card.aguardando_decisao ? (
        <div className="mt-2 ml-4 flex flex-wrap gap-1.5">
          {card.origem_tipo && card.origem_tipo !== 'Manual' && (
          <span className="text-[10px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded font-medium">
            {card.origem_tipo}
          </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
