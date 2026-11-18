import React from 'react';
import { ChevronRight, Lock, UserCheck, Users } from 'lucide-react';
import {
  classeStatus, classePrazo, classificarPrazo, formatarData,
} from '@/components/procedimentos/procedimentoConfig';

export default function ProcedimentoCard({ procedimento, envolvidos = [], onOpen }) {
  const prazo = classificarPrazo(procedimento);
  const investigados = envolvidos.filter((e) => e.papel === 'Investigado').length;

  return (
    <button
      type="button"
      onClick={() => onOpen(procedimento)}
      className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-blue-300 hover:shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
          {procedimento.tipo_procedimento}
        </span>
        <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${classeStatus(procedimento.status)}`}>
          {procedimento.status}
        </span>
        <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${classePrazo(prazo.chave)}`}>
          {prazo.label}
        </span>
        {procedimento.sigiloso && (
          <span className="inline-flex items-center gap-1 rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700">
            <Lock className="h-3 w-3" /> Sigiloso
          </span>
        )}
        <ChevronRight className="ml-auto h-4 w-4 text-slate-300" />
      </div>

      <p className="mt-2 text-sm font-semibold text-slate-800">
        {procedimento.numero_procedimento || 'Sem número'}
        {procedimento.numero_portaria ? ` · Portaria ${procedimento.numero_portaria}` : ''}
      </p>
      {procedimento.objeto && (
        <p className="mt-1 line-clamp-2 text-xs text-slate-500">{procedimento.objeto}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <UserCheck className="h-3.5 w-3.5" />
          {procedimento.encarregado_nome || 'Sem encarregado'}
        </span>
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {investigados} investigado{investigados === 1 ? '' : 's'}
        </span>
        <span>Prazo: {formatarData(procedimento.prazo_final)}</span>
        {Number(procedimento.prorrogacoes_count || 0) > 0 && (
          <span>{procedimento.prorrogacoes_count} prorrogação(ões)</span>
        )}
      </div>
    </button>
  );
}