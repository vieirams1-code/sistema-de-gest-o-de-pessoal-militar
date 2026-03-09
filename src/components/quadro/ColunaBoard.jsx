import React, { useState } from 'react';
import { Plus, MoreHorizontal } from 'lucide-react';
import CardItem from './CardItem';

export default function ColunaBoard({ coluna, cards, onCardClick, onAddCard }) {
  const [hover, setHover] = useState(false);
  const ativos = cards.filter(c => !c.arquivado);
  const cor = coluna.cor || '#64748b';

  return (
    <div
      className="flex flex-col w-[260px] shrink-0 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shadow-sm"
      style={{ borderTop: `3px solid ${cor}` }}
    >
      {/* Header da coluna */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-white border-b border-slate-100">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider truncate">{coluna.nome}</span>
          <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full shrink-0">
            {ativos.length}
          </span>
        </div>
        <button className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2 min-h-[120px] max-h-[calc(100vh-200px)]">
        {ativos.map(card => (
          <CardItem key={card.id} card={card} onClick={onCardClick} />
        ))}
        {ativos.length === 0 && (
          <div className="flex items-center justify-center h-16 rounded-lg border-2 border-dashed border-slate-200">
            <span className="text-xs text-slate-300">Vazio</span>
          </div>
        )}
      </div>

      {/* Botão adicionar */}
      <div className="p-2 border-t border-slate-100 bg-white">
        <button
          onClick={() => onAddCard(coluna)}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Adicionar card</span>
        </button>
      </div>
    </div>
  );
}