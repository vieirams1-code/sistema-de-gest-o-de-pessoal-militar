import React from 'react';

export default function CentralPendenciasEmptyState() {
  return (
    <div className="bg-white border border-dashed border-slate-300 rounded-xl p-8 text-center">
      <p className="text-slate-700 font-medium">Nenhuma pendência encontrada com os filtros atuais.</p>
      <p className="text-sm text-slate-500 mt-1">Ajuste os filtros ou atualize para nova leitura dos módulos.</p>
    </div>
  );
}
