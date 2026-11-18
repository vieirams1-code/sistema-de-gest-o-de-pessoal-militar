import React from 'react';
import { ChevronRight, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { classePrazo, classeStatus, classificarPrazo, formatarData } from './procedimentoConfig';

export default function ProcedimentoLinha({ procedimento, envolvidos, onOpen }) {
  const prazo = classificarPrazo(procedimento);
  const investigados = envolvidos.filter((pessoa) => pessoa.papel === 'Investigado' && pessoa.nome);
  const encarregado = [procedimento.encarregado_posto, procedimento.encarregado_nome].filter(Boolean).join(' ');
  const numero = procedimento.numero_procedimento || procedimento.numero_portaria || 'Sem número';

  return (
    <tr className="align-top hover:bg-slate-50/80">
      <td className="px-4 py-3">
        <button type="button" className="text-left font-semibold text-[#1e3a5f] hover:underline" onClick={onOpen}>
          {numero}
        </button>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
          {procedimento.sigiloso && <Lock className="h-3 w-3 text-purple-700" aria-label="Sigiloso" />}
          {procedimento.tipo_procedimento}
        </div>
      </td>
      <td className="px-4 py-3 text-slate-700">{encarregado || '—'}</td>
      <td className="px-4 py-3 text-slate-700">
        {investigados.length ? investigados.map((pessoa) => pessoa.nome).join(', ') : '—'}
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <div className="text-slate-700">{formatarData(procedimento.prazo_final)}</div>
        <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-xs ${classePrazo(prazo.chave)}`}>{prazo.label}</span>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${classeStatus(procedimento.status)}`}>
          {procedimento.status}
        </span>
      </td>
      <td className="px-4 py-2 text-right">
        <Button variant="ghost" size="sm" onClick={onOpen} aria-label={`Abrir procedimento ${numero}`}>
          Abrir <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
}
