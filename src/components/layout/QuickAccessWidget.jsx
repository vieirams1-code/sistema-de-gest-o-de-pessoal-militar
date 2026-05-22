import React from 'react';
import { Link } from 'react-router-dom';
import { Pin, ChevronDown } from 'lucide-react';

const QUICK_ACCESS_COLLAPSED_KEY = 'sgp_quick_access_collapsed';

export default function QuickAccessWidget({ items, getPinKey, createHref }) {
  const [isQuickAccessCollapsed, setIsQuickAccessCollapsed] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(QUICK_ACCESS_COLLAPSED_KEY) === 'true';
  });

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(QUICK_ACCESS_COLLAPSED_KEY, String(isQuickAccessCollapsed));
  }, [isQuickAccessCollapsed]);

  if (items.length === 0) return null;

  if (isQuickAccessCollapsed) {
    return (
      <button
        type="button"
        onClick={() => setIsQuickAccessCollapsed(false)}
        className="fixed bottom-6 right-6 z-[200] flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white/95 px-3 text-slate-700 shadow-xl backdrop-blur transition-colors hover:bg-slate-100 hover:text-slate-900"
        aria-label={`Expandir acesso rápido (${items.length} favoritos)`}
        title="Expandir acesso rápido"
      >
        <Pin className="h-4 w-4" />
        <span className="text-xs font-semibold leading-none">{items.length}</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-[200] w-64 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800">Acesso rápido</p>
        <button
          type="button"
          onClick={() => setIsQuickAccessCollapsed(true)}
          className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          aria-label="Minimizar acesso rápido"
          title="Minimizar acesso rápido"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-1">
        {items.map((item) => {
          const ItemIcon = item.icon;
          return (
            <Link
              key={getPinKey(item)}
              to={createHref(item)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              {ItemIcon ? <ItemIcon className="h-4 w-4 shrink-0" /> : <span className="h-2 w-2 rounded-full bg-slate-400" />}
              <span className="truncate">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
