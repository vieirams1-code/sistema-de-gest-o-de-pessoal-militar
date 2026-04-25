import React from 'react';

const filterItems = [
  { key: 'unread', label: 'Não lidas' },
  { key: 'important', label: 'Importantes' },
  { key: 'archived', label: 'Arquivadas' },
  { key: 'awaitingDispatch', label: 'Aguardando despacho' },
];

export default function ComunicacoesFiltersPanel({ filters, setFilters }) {
  const toggle = (key) => {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">Filtros</h2>
      <div className="space-y-2">
        {filterItems.map((filter) => (
          <label key={filter.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={filters[filter.key]}
              onChange={() => toggle(filter.key)}
            />
            {filter.label}
          </label>
        ))}
      </div>
    </section>
  );
}
