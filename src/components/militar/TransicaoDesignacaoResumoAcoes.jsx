import React from 'react';

const CARDS = [
  ['total', 'Períodos analisados', 'border-slate-200 bg-white text-slate-900'],
  ['pendentes', 'Decisão pendente', 'border-amber-300 bg-amber-50 text-amber-900'],
  ['marcar_legado_ativa', 'Marcar legado', 'border-blue-200 bg-blue-50 text-blue-900'],
  ['cancelar_periodo_futuro_indevido', 'Cancelar futuro', 'border-purple-200 bg-purple-50 text-purple-900'],
  ['manter', 'Manter', 'border-emerald-200 bg-emerald-50 text-emerald-900'],
  ['bloqueantes', 'Bloqueantes', 'border-red-200 bg-red-50 text-red-900'],
];

export default function TransicaoDesignacaoResumoAcoes({ resumo = {} }) {
  return (
    <section className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3 xl:grid-cols-6">
      {CARDS.map(([key, label, tone]) => {
        const value = resumo[key] || 0;
        const muted = value === 0 && key !== 'total';
        return (
          <div key={key} className={`rounded-xl border p-3 shadow-sm ${muted ? 'border-slate-200 bg-white text-slate-700' : tone}`}>
            <p className="text-xs font-medium opacity-75">{label}</p>
            <p className="mt-1 text-2xl font-bold leading-none">{value}</p>
          </div>
        );
      })}
    </section>
  );
}
