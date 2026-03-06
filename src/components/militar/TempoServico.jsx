import React from 'react';
import { differenceInDays, differenceInMonths, differenceInYears, parseISO } from 'date-fns';

export default function TempoServico({ dataInclusao, className = '' }) {
  if (!dataInclusao) return null;

  const hoje = new Date();
  let inicio;
  try {
    inicio = parseISO(dataInclusao);
  } catch {
    return null;
  }

  const totalDias = differenceInDays(hoje, inicio);
  const anos = differenceInYears(hoje, inicio);
  const meses = differenceInMonths(hoje, inicio) % 12;

  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
        <div>
          <p className="text-xs text-blue-500 font-medium uppercase tracking-wide">Tempo de Serviço</p>
          <p className="text-sm font-bold text-blue-800">
            {anos > 0 && `${anos} ano${anos !== 1 ? 's' : ''}`}
            {meses > 0 && `${anos > 0 ? ' e ' : ''}${meses} mês${meses !== 1 ? 'es' : ''}`}
            {anos === 0 && meses === 0 && 'Menos de 1 mês'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
        <div>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Em dias</p>
          <p className="text-sm font-bold text-slate-700">{totalDias.toLocaleString('pt-BR')} dias</p>
        </div>
      </div>
    </div>
  );
}