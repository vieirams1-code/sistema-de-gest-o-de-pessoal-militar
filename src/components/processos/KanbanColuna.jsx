import React from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import ProcessoCard from './ProcessoCard';
import { Plus } from 'lucide-react';

const colunaConfig = {
  'A Fazer':        { color: 'bg-slate-100 border-slate-300',   header: 'bg-slate-200 text-slate-700',   dot: 'bg-slate-400' },
  'Em Andamento':   { color: 'bg-blue-50 border-blue-200',      header: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500' },
  'Aguardando Info':{ color: 'bg-yellow-50 border-yellow-200',  header: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  'Concluído':      { color: 'bg-green-50 border-green-200',    header: 'bg-green-100 text-green-700',   dot: 'bg-green-500' },
  'Arquivado':      { color: 'bg-slate-50 border-slate-200',    header: 'bg-slate-100 text-slate-500',   dot: 'bg-slate-300' },
};

export default function KanbanColuna({ status, processos, onCardClick, onAddNew }) {
  const cfg = colunaConfig[status] || colunaConfig['A Fazer'];

  return (
    <div className={`flex flex-col rounded-xl border ${cfg.color} min-w-[260px] w-[260px] max-h-[calc(100vh-220px)]`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-3 py-2.5 rounded-t-xl ${cfg.header}`}>
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
          <span className="font-semibold text-sm">{status}</span>
          <span className="text-xs font-normal opacity-70">({processos.length})</span>
        </div>
        <button
          onClick={() => onAddNew(status)}
          className="opacity-60 hover:opacity-100 transition-opacity rounded p-0.5 hover:bg-black/10"
          title="Adicionar nesta coluna"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Cards */}
      <Droppable droppableId={status}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 overflow-y-auto p-2 space-y-2 min-h-[60px] transition-colors ${snapshot.isDraggingOver ? 'bg-blue-50/60' : ''}`}
          >
            {processos.map((p, index) => (
              <Draggable key={p.id} draggableId={p.id} index={index}>
                {(drag, dragSnap) => (
                  <div
                    ref={drag.innerRef}
                    {...drag.draggableProps}
                    style={{
                      ...drag.draggableProps.style,
                      opacity: dragSnap.isDragging ? 0.85 : 1,
                    }}
                  >
                    <ProcessoCard
                      processo={p}
                      onClick={() => onCardClick(p)}
                      dragHandleProps={drag.dragHandleProps}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}