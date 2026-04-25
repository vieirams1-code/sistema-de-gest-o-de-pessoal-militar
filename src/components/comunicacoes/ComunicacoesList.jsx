import React from 'react';

const priorityColor = {
  Alta: 'bg-red-100 text-red-700',
  Média: 'bg-amber-100 text-amber-700',
  Baixa: 'bg-slate-100 text-slate-700',
};

export default function ComunicacoesList({ comunicacoes, selectedComunicacao, onSelect }) {
  if (!comunicacoes.length) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        Nenhuma comunicação encontrada para os filtros selecionados.
      </section>
    );
  }

  return (
    <section className="space-y-3">
      {comunicacoes.map((item) => {
        const selected = selectedComunicacao?.id === item.id;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={`w-full rounded-2xl border p-4 text-left shadow-sm transition ${selected
              ? 'border-[#173764] bg-slate-50'
              : 'border-slate-200 bg-white hover:border-slate-300'}`}
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.protocolo}</span>
              <span className="text-xs text-slate-500">{new Date(item.data).toLocaleDateString('pt-BR')}</span>
            </div>
            <h3 className="text-sm font-semibold text-slate-800">{item.assunto}</h3>
            <p className="mt-1 text-xs text-slate-600">{item.origem} • {item.tipo}</p>
            <p className="mt-2 line-clamp-2 text-sm text-slate-600">{item.resumo}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${priorityColor[item.prioridade] || priorityColor.Baixa}`}>
                {item.prioridade}
              </span>
              <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">{item.status}</span>
              {item.tags.map((tag) => (
                <span key={`${item.id}-${tag}`} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                  #{tag}
                </span>
              ))}
            </div>
          </button>
        );
      })}
    </section>
  );
}
