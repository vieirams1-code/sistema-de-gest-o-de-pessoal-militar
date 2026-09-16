import React from 'react';

const formatarData = (data) => {
  const match = String(data || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '-';
};

export default function CoberturaPeriodoChips({ periodos = [] }) {
  return (
    <div className="flex min-w-[280px] flex-wrap gap-2">
      {periodos.map((periodo) => (
        <div key={periodo.id} className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-2 text-xs text-blue-900">
          <div className="font-bold">{periodo.ano_referencia || 'Período'} · {periodo.saldo_disponivel} dia(s)</div>
          <div className="mt-0.5 text-blue-700">{periodo.situacao_aquisitiva} · gozo a partir de {formatarData(periodo.primeira_data_legal_gozo)}</div>
        </div>
      ))}
    </div>
  );
}