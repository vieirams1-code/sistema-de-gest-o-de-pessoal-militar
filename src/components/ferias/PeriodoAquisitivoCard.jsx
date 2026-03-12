import React from 'react';
import { AlertCircle, CalendarDays, Clock3, ExternalLink } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { obterDiasBase, calcularDiasTotal } from './feriasRules';

const statusColors = {
  'Pendente': 'bg-slate-100 text-slate-700 border-slate-200',
  'Disponível': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Previsto': 'bg-blue-100 text-blue-700 border-blue-200',
  'Parcialmente Gozado': 'bg-amber-100 text-amber-700 border-amber-200',
  'Gozado': 'bg-green-100 text-green-700 border-green-200',
  'Vencido': 'bg-red-100 text-red-700 border-red-200',
  'Inativo': 'bg-slate-100 text-slate-500 border-slate-200'
};

const alertaClasses = {
  danger: 'bg-red-50 border-red-200 text-red-700',
  warning: 'bg-amber-50 border-amber-200 text-amber-700',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
};

export default function PeriodoAquisitivoCard({ periodo, onManage, onOpenFerias }) {
  const diasBase = obterDiasBase(periodo);
  const diasTotal = Number(periodo.dias_total ?? calcularDiasTotal(periodo));
  const diasGozados = Number(periodo.dias_gozados || 0);
  const diasPrevistos = Number(periodo.dias_previstos || 0);
  const diasSaldo = Number(periodo.dias_saldo ?? diasTotal - diasGozados - diasPrevistos);

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Referência</p>
          <h4 className="text-base font-semibold text-slate-900">{periodo.referencia || 'Sem referência'}</h4>
        </div>
        <Badge className={`${statusColors[periodo.status_operacional] || statusColors.Pendente} border text-xs`}>
          {periodo.status_operacional}
        </Badge>
      </div>

      <div className="grid md:grid-cols-2 gap-3 text-sm mb-3">
        <div className="rounded-lg bg-slate-50 px-3 py-2 border border-slate-100">
          <p className="text-xs text-slate-500 mb-1">Período Aquisitivo</p>
          <p className="font-medium text-slate-800">{periodo.aquisitivo || '-'}</p>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2 border border-slate-100">
          <p className="text-xs text-slate-500 mb-1">Limite para gozo</p>
          <p className="font-medium text-slate-800 inline-flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4 text-slate-500" />
            {periodo.limite_gozo || '-'}
          </p>
        </div>
      </div>

      <div className={`mb-3 rounded-lg border px-3 py-2 text-xs ${alertaClasses[periodo.alerta_tipo] || alertaClasses.success}`}>
        <p className="font-semibold inline-flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" />
          Alerta gerencial: {periodo.alerta_gerencial}
        </p>
        <p className="mt-1 inline-flex items-center gap-1.5">
          <Clock3 className="w-3.5 h-3.5" />
          {periodo.mensagem_vencimento}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs mb-4">
        <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5"><p className="text-slate-500">Base</p><p className="font-semibold text-slate-800">{diasBase}d</p></div>
        <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5"><p className="text-slate-500">Total</p><p className="font-semibold text-slate-800">{diasTotal}d</p></div>
        <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5"><p className="text-slate-500">Gozados</p><p className="font-semibold text-slate-800">{diasGozados}d</p></div>
        <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5"><p className="text-slate-500">Previstos</p><p className="font-semibold text-slate-800">{diasPrevistos}d</p></div>
        <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5"><p className="text-slate-500">Saldo</p><p className="font-semibold text-[#1e3a5f]">{diasSaldo}d</p></div>
      </div>

      <div className="mb-4">
        <p className="text-xs font-semibold text-slate-500 mb-2">FRAÇÕES RELACIONADAS</p>
        {periodo.fracoes?.length ? (
          <div className="space-y-2">
            {periodo.fracoes.map((fracao) => (
              <div key={fracao.id} className="rounded-lg border border-slate-200 px-3 py-2 bg-slate-50/70">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-800">{fracao.nome}</span>
                  <Badge variant="outline" className="text-xs">{fracao.status}</Badge>
                </div>
                <p className="text-xs text-slate-500 mt-1">{fracao.dias} dia(s){fracao.data ? ` • ${fracao.data}` : ''}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 rounded-lg border border-dashed border-slate-200 px-3 py-2">
            Nenhuma fração vinculada.
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => onOpenFerias?.(periodo)}>
          <ExternalLink className="w-3.5 h-3.5 mr-1" />
          Abrir férias
        </Button>
        <Button size="sm" className="bg-[#1e3a5f] hover:bg-[#1e3a5f]/90" onClick={() => onManage?.(periodo)}>
          Gerenciar período
        </Button>
      </div>
    </article>
  );
}
