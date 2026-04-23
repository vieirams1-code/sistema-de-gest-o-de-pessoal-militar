import React from 'react';
import { Archive, AlertTriangle, CheckCircle2, Layers3, Clock3 } from 'lucide-react';

function Card({ titulo, valor, subtitulo, icon: Icon, className = '', valorClassName = '' }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">{titulo}</p>
          <p className={`text-2xl font-bold text-slate-800 ${valorClassName}`}>{valor}</p>
          {subtitulo ? <p className="text-xs text-slate-500 mt-1">{subtitulo}</p> : null}
        </div>
        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
          <Icon className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}

function formatarDataHora(valor) {
  if (!valor) return '—';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '—';
  return data.toLocaleString('pt-BR');
}

export default function HistoricoImportacoesMilitaresResumoCards({ resumo }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
      <Card titulo="Total de importações" valor={resumo.totalLotes} icon={Archive} />
      <Card titulo="Concluídas" valor={resumo.totalConcluidas} icon={CheckCircle2} className="bg-emerald-50/70" valorClassName="text-emerald-700" />
      <Card titulo="Parciais" valor={resumo.totalParciais} icon={Layers3} className="bg-amber-50/70" valorClassName="text-amber-700" />
      <Card titulo="Com erro" valor={resumo.totalComErro} icon={AlertTriangle} className="bg-rose-50/70" valorClassName="text-rose-700" />
      <Card
        titulo="Última importação"
        valor={resumo.ultimoLote ? (resumo.ultimoLote.nomeArquivo || 'Sem nome') : '—'}
        icon={Clock3}
        subtitulo={resumo.ultimoLote ? formatarDataHora(resumo.ultimoLote.dataHora) : 'Nenhum lote processado'}
      />
    </div>
  );
}
