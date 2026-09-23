import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function rotuloMes(mes) {
  return MESES[Number(mes) - 1] || mes;
}

function descreverPeriodo(periodo) {
  if (!periodo) return '—';
  const ref = periodo.ref || 'Período sem referência';
  const intervalo = periodo.inicio && periodo.fim ? `${periodo.inicio} a ${periodo.fim}` : '';
  return intervalo ? `${ref} (${intervalo})` : ref;
}

export default function SaneamentoOpcoesFeriasOrfasTabela({ casos = [], selecionados = [], onToggle }) {
  if (!casos.length) {
    return (
      <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Nenhuma opção vinculada a período inativado.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {casos.map((caso) => (
        <div key={caso.opcao_id} className="rounded-xl border border-slate-200 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-slate-900">{caso.militar_nome}</p>
              <p className="text-xs text-slate-500">
                {[caso.militar_posto, caso.militar_quadro, caso.militar_matricula].filter(Boolean).join(' • ')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {caso.meses_inelegiveis?.length > 0 && (
                <Badge variant="outline" className="border-amber-400 text-amber-800">
                  Reanálise necessária
                </Badge>
              )}
              <Checkbox
                checked={selecionados.includes(caso.opcao_id)}
                disabled={!caso.pode_corrigir}
                onCheckedChange={() => onToggle(caso.opcao_id)}
                aria-label={`Selecionar ${caso.militar_nome}`}
              />
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-rose-700">Período atual (inativado)</p>
              <p className="text-sm font-medium text-rose-900">{descreverPeriodo(caso.periodo_atual)}</p>
              <p className="text-xs text-rose-700">{caso.periodo_atual?.dias_direito ?? 0} dia(s) de direito</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-emerald-700">Período proposto</p>
              <p className="text-sm font-medium text-emerald-900">{descreverPeriodo(caso.periodo_sugerido)}</p>
              <p className="text-xs text-emerald-700">
                {caso.periodo_sugerido ? `${caso.periodo_sugerido.dias_sem_previsao} dia(s) disponível(is)` : 'Sem sugestão'}
              </p>
            </div>
          </div>

          {caso.meses_escolhidos?.length > 0 && (
            <p className="mt-3 text-xs text-slate-600">
              Meses escolhidos pelo militar: <strong>{caso.meses_escolhidos.map(rotuloMes).join(', ')}</strong>
            </p>
          )}

          {!caso.pode_corrigir && (
            <p className="mt-2 text-xs font-medium text-rose-700">{caso.motivo_bloqueio}</p>
          )}
        </div>
      ))}
    </div>
  );
}