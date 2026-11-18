import React from 'react';
import { Activity, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';

const CARDS = [
  { key: 'emAndamento', label: 'Em andamento', icon: Activity, classe: 'text-blue-600 bg-blue-50' },
  { key: 'vencidos', label: 'Prazo vencido', icon: AlertTriangle, classe: 'text-red-600 bg-red-50' },
  { key: 'vencendo', label: 'Vencendo (15 dias)', icon: Clock, classe: 'text-amber-600 bg-amber-50' },
  { key: 'solucionados', label: 'Solucionados', icon: CheckCircle2, classe: 'text-emerald-600 bg-emerald-50' },
];

export default function ProcedimentoResumoCards({ resumo = {} }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {CARDS.map(({ key, label, icon: Icon, classe }) => (
        <div key={key} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${classe}`}>
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-2xl font-bold text-[#1e3a5f]">{resumo[key] || 0}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}