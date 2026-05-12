import React from 'react';

const CARDS = [
  ['total', 'Períodos analisados'],
  ['pendentes', 'Decisão pendente'],
  ['marcar_legado_ativa', 'Marcar legado'],
  ['cancelar_periodo_futuro_indevido', 'Cancelar futuro'],
  ['manter', 'Manter'],
  ['bloqueantes', 'Bloqueantes'],
];

export default function TransicaoDesignacaoResumoAcoes({ resumo = {} }) {
  return (
    <section className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3 xl:grid-cols-6">
      {CARDS.map(([key, label]) => {
        const alerta = (key === 'pendentes' || key === 'bloqueantes') && resumo[key] > 0;
        return (
          <div key={key} className={`rounded-lg border p-3 ${alerta ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
            <p className="text-xs font-medium text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{resumo[key] || 0}</p>
          </div>
        );
      })}
    </section>
  );
}
