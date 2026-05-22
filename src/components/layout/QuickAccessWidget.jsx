import React from 'react';
import { Link } from 'react-router-dom';

export default function QuickAccessWidget({ items, getPinKey, createHref }) {
  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[200] w-64 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur">
      <p className="mb-2 text-sm font-semibold text-slate-800">Acesso rápido</p>
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
