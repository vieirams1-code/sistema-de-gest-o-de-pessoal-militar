import React, { useState } from 'react';
import { Plus, Pencil, Trash2, Lock } from 'lucide-react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import CardItem from './CardItem';

export default function ColunaBoard({
  coluna,
  cards,
  onCardClick,
  onAddCard,
  onRenomearColuna,
  onExcluirColuna,
  dragDisabled = false,
}) {
  const [hover, setHover] = useState(false);
  const ativos = cards.filter((c) => !c.arquivado);
  const cor = coluna.cor || '#64748b';
  const colunaFixa = coluna.fixa || coluna.origem_coluna === 'automacao' || (coluna.nome || '').trim().toUpperCase() === 'JISO';

  return (
    <div
      className="flex flex-col w-[260px] shrink-0 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shadow-sm"
      style={{ borderTop: `3px solid ${cor}` }}
    >
      <div className="flex items-center justify-between px-3 py-2.5 bg-white border-b border-slate-100">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider truncate">{coluna.nome}</span>
          {colunaFixa && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full shrink-0">
              <Lock className="w-2.5 h-2.5" /> Fixa
            </span>
          )}
          <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full shrink-0">
            {ativos.length}
          </span>
        </div>
        {!colunaFixa && (
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => onRenomearColuna?.(coluna)}
              className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              title="Renomear coluna"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onExcluirColuna?.(coluna)}
              className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
              title="Excluir coluna"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <Droppable droppableId={coluna.id} isDropDisabled={dragDisabled}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 overflow-y-auto px-2 py-2 space-y-2 min-h-[120px] max-h-[calc(100vh-200px)] ${snapshot.isDraggingOver ? 'bg-blue-50/60' : ''}`}
          >
            {ativos.map((card, index) => (
              <Draggable key={card.id} draggableId={card.id} index={index} isDragDisabled={dragDisabled}>
                {(dragProvided, dragSnapshot) => (
                  <div
                    ref={dragProvided.innerRef}
                    {...dragProvided.draggableProps}
                    {...dragProvided.dragHandleProps}
                    className={dragSnapshot.isDragging ? 'rotate-[1deg]' : ''}
                  >
                    <CardItem card={card} onClick={onCardClick} />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
            {ativos.length === 0 && !snapshot.isDraggingOver && (
              <div className="flex items-center justify-center h-16 rounded-lg border-2 border-dashed border-slate-200">
                <span className="text-xs text-slate-300">Vazio</span>
              </div>
            )}
          </div>
        )}
      </Droppable>

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
