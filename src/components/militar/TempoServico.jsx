import React from 'react';
import { format } from 'date-fns';

import { calcularTempoServico } from '@/services/tempoServicoService';

export default function TempoServico({ militar = null, className = '' }) {
  const tempoServico = calcularTempoServico(militar || {});

  if (!tempoServico.valido || typeof tempoServico.dias_servico !== 'number' || typeof tempoServico.anos_completos !== 'number') {
    return (
      <div className={`flex flex-wrap gap-3 ${className}`}>
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
          <div>
            <p className="text-xs text-blue-500 font-medium uppercase tracking-wide">Tempo de Serviço</p>
            <p className="text-sm font-bold text-blue-800">—</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Em dias</p>
            <p className="text-sm font-bold text-slate-700">—</p>
          </div>
        </div>
      </div>
    );
  }

  const anos = tempoServico.anos_completos;
  const meses = Math.floor((tempoServico.dias_servico % 365) / 30);

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
          {tempoServico.data_base_calculo && (
            <p className="text-[11px] text-blue-600 mt-0.5">Base: {format(tempoServico.data_base_calculo, 'dd/MM/yyyy')}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
        <div>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Em dias</p>
          <p className="text-sm font-bold text-slate-700">{tempoServico.dias_servico.toLocaleString('pt-BR')} dias</p>
        </div>
      </div>
    </div>
  );
}
