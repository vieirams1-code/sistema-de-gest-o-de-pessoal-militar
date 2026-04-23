import React from 'react';
import { AlertTriangle, CheckCircle2, ClipboardList, FileWarning, HelpCircle } from 'lucide-react';

const itens = [
  { key: 'total_linhas', label: 'Total', cor: 'text-slate-700', Icon: ClipboardList, fundo: 'bg-slate-100' },
  { key: 'total_aptas', label: 'Aptas', cor: 'text-emerald-700', Icon: CheckCircle2, fundo: 'bg-emerald-100' },
  { key: 'total_revisar', label: 'Revisar', cor: 'text-indigo-700', Icon: AlertTriangle, fundo: 'bg-indigo-100' },
  { key: 'total_pendentes_classificacao', label: 'Pendentes Classificação', cor: 'text-amber-700', Icon: HelpCircle, fundo: 'bg-amber-100' },
  { key: 'total_erros', label: 'Erros', cor: 'text-rose-700', Icon: FileWarning, fundo: 'bg-rose-100' },
];

export default function ResumoMigracaoAlteracoesLegadoCards({ resumo }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
      {itens.map(({ key, label, cor, Icon, fundo }) => (
        <div key={key} className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
              <p className={`text-3xl font-bold mt-1 ${cor}`}>{resumo?.[key] || 0}</p>
            </div>
            <div className={`rounded-lg p-2 ${fundo}`}>
              <Icon className={`w-4 h-4 ${cor}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
