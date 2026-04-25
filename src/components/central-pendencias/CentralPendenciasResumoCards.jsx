import React from 'react';

const CARD_CONFIG = [
  { key: 'total', label: 'Total de pendências' },
  { key: 'criticas', label: 'Críticas' },
  { key: 'alta', label: 'Alta prioridade' },
  { key: 'publicacoes', label: 'Publicações' },
  { key: 'atestados', label: 'Atestados' },
  { key: 'ferias', label: 'Férias' },
  { key: 'legadoOutros', label: 'Legado/Outros' },
];

export default function CentralPendenciasResumoCards({ resumo }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
      {CARD_CONFIG.map((item) => (
        <div key={item.key} className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">{item.label}</p>
          <p className="text-2xl font-bold text-[#1e3a5f]">{resumo?.[item.key] ?? 0}</p>
        </div>
      ))}
    </div>
  );
}
