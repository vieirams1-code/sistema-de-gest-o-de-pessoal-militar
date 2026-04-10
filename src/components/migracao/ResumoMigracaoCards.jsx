import React from 'react';

const itens = [
  { key: 'total_linhas', label: 'Total de registros', cor: 'text-slate-700' },
  { key: 'total_aptas', label: 'Aptas', cor: 'text-emerald-700' },
  { key: 'total_aptas_com_alerta', label: 'Aptas com alerta', cor: 'text-amber-700' },
  { key: 'total_duplicadas', label: 'Duplicadas', cor: 'text-indigo-700' },
  { key: 'total_erros', label: 'Com erro', cor: 'text-rose-700' },
];

export default function ResumoMigracaoCards({ resumo }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
      {itens.map((item) => (
        <div key={item.key} className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">{item.label}</p>
          <p className={`text-2xl font-bold mt-1 ${item.cor}`}>{resumo?.[item.key] || 0}</p>
        </div>
      ))}
    </div>
  );
}
