import React from 'react';
import { Eye, EyeOff, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

function formatarDataHora(valor) {
  if (!valor) return '—';
  const date = new Date(valor);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR');
}

function statusGeralClass(status) {
  if (status === 'Importação concluída') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (status === 'Importação parcial') return 'bg-amber-100 text-amber-800 border-amber-200';
  if (status === 'Importação com falha') return 'bg-rose-100 text-rose-800 border-rose-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function LinhaResumo({ label, valor }) {
  return (
    <div className="rounded-md border border-slate-200 px-2 py-1.5 bg-slate-50">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-700">{valor}</p>
    </div>
  );
}

export default function HistoricoImportacoesMilitaresLista({
  lotes,
  mostrarOcultadas = false,
  onAbrirDetalhe,
  onOcultarLote,
  onRestaurarLote,
}) {
  if (!lotes.length) {
    return <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 bg-white">Nenhum lote encontrado para os filtros selecionados.</div>;
  }

  return (
    <div className="space-y-3">
      {lotes.map((lote) => (
        <div key={lote.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
            <div>
              <p className="text-sm text-slate-500">Análise em {formatarDataHora(lote.dataHora)}</p>
              <h3 className="text-lg font-semibold text-[#1e3a5f]">{lote.nomeArquivo || 'Arquivo sem nome'}</h3>
              <p className="text-xs text-slate-500">Responsável: {lote.importadoPor || 'Não informado'}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={statusGeralClass(lote.statusGeral)}>{lote.statusGeral}</Badge>
              {lote.ocultoNoHistorico ? <Badge variant="secondary">Ocultado</Badge> : null}
              {mostrarOcultadas && lote.ocultoNoHistorico ? (
                <Button variant="outline" size="sm" onClick={() => onRestaurarLote?.(lote)}>
                  <RotateCcw className="w-4 h-4 mr-1" /> Restaurar
                </Button>
              ) : (
                <Button variant="ghost" size="sm" className="text-slate-600" onClick={() => onOcultarLote?.(lote)}>
                  <EyeOff className="w-4 h-4 mr-1" /> Ocultar do histórico
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => onAbrirDetalhe(lote)}>
                <Eye className="w-4 h-4 mr-1" /> Ver detalhe
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 xl:grid-cols-10 gap-2">
            <LinhaResumo label="Total" valor={lote.resumo.total_linhas} />
            <LinhaResumo label="APTO" valor={lote.resumo.total_aptas} />
            <LinhaResumo label="APTO_ALERTA" valor={lote.resumo.total_aptas_com_alerta} />
            <LinhaResumo label="REVISAR" valor={lote.resumo.total_revisar} />
            <LinhaResumo label="IGNORADO" valor={lote.resumo.total_ignoradas} />
            <LinhaResumo label="ERRO" valor={lote.resumo.total_erros} />
            <LinhaResumo label="Importadas" valor={lote.resumo.total_importadas} />
            <LinhaResumo label="Não importadas" valor={lote.resumo.total_nao_importadas} />
            <LinhaResumo label="Status técnico" valor={lote.statusImportacao || '—'} />
          </div>
        </div>
      ))}
    </div>
  );
}
