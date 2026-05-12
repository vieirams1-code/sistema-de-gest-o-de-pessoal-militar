import React from 'react';

const CARDS = [
  ['total', 'Períodos analisados'],
  ['pendentes', 'Decisão pendente'],
  ['marcar_legado_ativa', 'Marcar legado'],
  ['marcar_indenizado', 'Marcar indenizado'],
  ['excluir_cadeia_operacional', 'Excluir cadeia'],
  ['cancelar_periodo_futuro_indevido', 'Cancelar futuro'],
  ['manter', 'Manter'],
  ['bloqueantes', 'Bloqueantes'],
  ['riscos', 'Riscos'],
  ['overrides', 'Overrides'],
];

export default function TransicaoDesignacaoResumoAcoes({ resumo = {} }) {
  return (
    <section className="grid grid-cols-2 gap-2 text-center text-sm md:grid-cols-5">
      {CARDS.map(([key, label]) => (
        <div key={key} className={`rounded-md border p-2 ${key === 'pendentes' && resumo[key] > 0 ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-lg font-bold text-slate-900">{resumo[key] || 0}</p>
        </div>
      ))}
    </section>
  );
}
