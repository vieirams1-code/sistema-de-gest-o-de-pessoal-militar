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
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {CARDS.map(({ key, label, icon: Icon, classe }) => (
        <div key={key} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <span className={`rounded-lg p-1.5 ${classe}`}>
              <Icon className="h-4 w-4" />
            </span>
            <span className="text-xs font-medium text-slate-500">{label}</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-800">{resumo[key] || 0}</p>
        </div>
      ))}
    </div>
  );
}