import React from "react";
import {
  ArrowRightLeft,
  Bookmark,
  Flag,
  MoreVertical,
  Search,
} from "lucide-react";
import { QUICK_FILTER_OPTIONS } from "../../utils/comunicacoes/comunicacoes.constants";
import {
  formatPrioridadeLabel,
  formatStatusLabel,
  formatTipoLabel,
} from "../../utils/comunicacoes/comunicacoes.helpers";

function FilterChip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-bold transition border ${
        active
          ? "bg-blue-600 text-white border-blue-600"
          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}

function Badge({ children, variant = "default" }) {
  const variants = {
    default: "bg-slate-100 text-slate-700",
    blue: "bg-blue-100 text-blue-800",
    red: "bg-red-100 text-red-800",
    green: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
  };

  return (
    <span
      className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${variants[variant]}`}
    >
      {children}
    </span>
  );
}

export default function ComunicacoesListPanel({
  items,
  loading,
  error,
  selectedId,
  onSelect,
  query,
  onQueryChange,
  quickFilter,
  onQuickFilterToggle,
  onClearFilters,
}) {
  return (
    <section className="w-full md:w-[420px] bg-white border-r border-slate-200 flex flex-col shrink-0">
      <div className="p-4 border-b border-slate-100 bg-slate-50/70">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="font-bold text-slate-800">Caixa de Entrada</h2>

          <div className="flex gap-1">
            <button
              type="button"
              className="p-1.5 hover:bg-white rounded-md border border-transparent hover:border-slate-200"
            >
              <ArrowRightLeft size={16} />
            </button>
            <button
              type="button"
              className="p-1.5 hover:bg-white rounded-md border border-transparent hover:border-slate-200"
            >
              <MoreVertical size={16} />
            </button>
          </div>
        </div>

        <div className="relative mb-3">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={16}
          />
          <input
            type="text"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Buscar comunicações, protocolos ou assuntos..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {QUICK_FILTER_OPTIONS.map((filter) => (
            <FilterChip
              key={filter.key}
              label={filter.label}
              active={quickFilter === filter.key}
              onClick={() => onQuickFilterToggle(filter.key)}
            />
          ))}

          <button
            type="button"
            onClick={onClearFilters}
            className="px-3 py-1.5 rounded-full text-xs font-bold border border-slate-200 text-slate-500 hover:bg-white"
          >
            Limpar
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
        {loading && (
          <div className="p-6 text-sm text-slate-500">Carregando comunicações...</div>
        )}

        {!loading && error && (
          <div className="p-6 text-sm text-red-600">{error}</div>
        )}

        {!loading && !error && !items.length && (
          <div className="p-6 text-sm text-slate-500">
            Nenhuma comunicação encontrada para os filtros aplicados.
          </div>
        )}

        {!loading &&
          !error &&
          items.map((msg) => (
            <button
              type="button"
              key={msg.id}
              onClick={() => onSelect(msg.id)}
              className={`w-full text-left p-4 hover:bg-blue-50 transition relative ${
                selectedId === msg.id ? "bg-blue-50 border-r-4 border-r-blue-600" : ""
              }`}
            >
              <div className="flex justify-between items-start mb-1 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {msg.unread && <div className="w-2 h-2 bg-blue-600 rounded-full" />}
                  <span className="text-[11px] font-bold text-slate-400 truncate">
                    {msg.protocolo}
                  </span>
                </div>

                <span className="text-[10px] font-medium text-slate-500 shrink-0">
                  {msg.data}
                </span>
              </div>

              <h3
                className={`text-sm mb-1 truncate ${
                  msg.unread ? "font-bold text-slate-900" : "font-medium text-slate-600"
                }`}
              >
                {msg.assunto}
              </h3>

              <p className="text-xs text-slate-500 truncate mb-3">{msg.resumo}</p>

              <div className="flex items-center justify-between gap-3">
                <div className="flex gap-1 flex-wrap">
                  <Badge>{formatTipoLabel(msg.tipo)}</Badge>
                  <Badge variant={msg.prioridade === "alta" ? "red" : "amber"}>
                    {formatPrioridadeLabel(msg.prioridade)}
                  </Badge>
                  <Badge variant="green">{formatStatusLabel(msg.status)}</Badge>
                </div>

                <div className="flex gap-2 shrink-0">
                  {msg.important && (
                    <Bookmark size={14} className="fill-amber-400 text-amber-400" />
                  )}
                  {msg.flag && (
                    <Flag
                      size={14}
                      className={
                        msg.flag === "red"
                          ? "fill-red-500 text-red-500"
                          : "fill-blue-500 text-blue-500"
                      }
                    />
                  )}
                </div>
              </div>
            </button>
          ))}
      </div>
    </section>
  );
}
