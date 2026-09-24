import React from 'react';
import { Printer } from 'lucide-react';
import IconeCatalogo from '@/components/funcoes-tags/IconeCatalogo';
import { Button } from '@/components/ui/button';
import { isQuadroTemporario } from '@/services/controleAtestadosTemporariosService';

export default function DistribuicaoMensalFerias({ meses, distribuicao, totalPublico, militaresCov, onAbrirMilitar, onImprimir }) {
  return (
    <>
      {onImprimir && (
        <div className="mt-5 flex justify-end print:hidden">
          <Button
            type="button"
            variant="outline"
            onClick={onImprimir}
            className="h-10 border-slate-300 font-semibold text-slate-700"
          >
            <Printer className="w-4 h-4 mr-2" />
            Imprimir distribuição
          </Button>
        </div>
      )}

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-5">
        {meses.map((mes) => {
          const pessoas = distribuicao[mes.val] || [];
          const pct = totalPublico ? Math.min(100, Math.round((pessoas.length / totalPublico) * 100)) : 0;
          return (
            <div key={mes.val} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-black text-slate-900">{mes.nome}</h3>
                  <p className="text-xs text-slate-500 mt-1">{pessoas.length} militar(es) programado(s)</p>
                </div>
                <span className="text-xs font-bold text-blue-700 bg-blue-50 rounded-full px-2 py-1">{pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 mt-4 overflow-hidden">
                <div className="h-full rounded-full bg-blue-600" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-4 space-y-2">
                {pessoas.map((p) => (
                  <button key={p.id} type="button" onClick={() => onAbrirMilitar(p)} className="w-full flex items-center justify-between gap-3 text-left text-xs hover:text-blue-700">
                    <span className="flex min-w-0 items-center gap-1.5">
                      {isQuadroTemporario(p.quadro || p.militar_quadro) && <strong className="shrink-0 font-black">T</strong>}
                      <span className="truncate font-semibold">{p.militar_nome}</span>
                      {militaresCov.ids.has(String(p.militar_id || '')) && (
                        <span title="COV" className="shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5">
                          <IconeCatalogo value={militaresCov.icone} />
                        </span>
                      )}
                    </span>
                    <span className="text-slate-400 shrink-0">{p.militar_posto}</span>
                  </button>
                ))}
                {!pessoas.length && <p className="text-xs text-slate-400">Nenhuma definição neste mês.</p>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}