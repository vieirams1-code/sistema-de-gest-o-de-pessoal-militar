import React, { useState } from 'react';
import { Eye, Trash2, ChevronDown, ChevronUp, CalendarClock, UserRound, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { STATUS_GERAL_BADGE_CLASS } from '@/services/historicoImportacoesMilitaresService';

function formatarDataHora(valor) {
  if (!valor) return '—';
  const date = new Date(valor);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR');
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-base font-semibold text-slate-700">{value}</p>
    </div>
  );
}

export default function HistoricoImportacoesMilitaresLista({
  lotes,
  lotesExcluindo = {},
  onAbrirDetalhe,
  onExcluirLote,
}) {
  const [expandidos, setExpandidos] = useState({});

  if (!lotes.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center bg-white">
        <p className="text-slate-700 font-medium">Nenhum lote encontrado</p>
        <p className="text-sm text-slate-500 mt-1">Ajuste os filtros ou realize uma nova importação para visualizar o histórico.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {lotes.map((lote) => {
        const excluindo = Boolean(lotesExcluindo[lote.id]);
        const expandido = Boolean(expandidos[lote.id]);

        return (
          <article key={lote.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-3">
              <div className="space-y-2 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={STATUS_GERAL_BADGE_CLASS[lote.statusGeral] || 'bg-slate-100 text-slate-700 border-slate-200'}>{lote.statusGeral}</Badge>
                  <Badge variant="outline" className="text-slate-600">{lote.tipoImportacao}</Badge>
                </div>

                <h3 className="text-lg font-semibold text-[#1e3a5f] truncate">{lote.nomeArquivo || 'Arquivo sem nome'}</h3>

                <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                  <span className="inline-flex items-center gap-1"><CalendarClock className="w-4 h-4" /> {formatarDataHora(lote.dataHora)}</span>
                  <span className="inline-flex items-center gap-1"><UserRound className="w-4 h-4" /> {lote.importadoPor || 'Executor não informado'}</span>
                  {lote.referencia ? <span className="inline-flex items-center gap-1"><FileText className="w-4 h-4" /> Ref: {lote.referencia}</span> : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                <Button variant="outline" size="sm" onClick={() => setExpandidos((prev) => ({ ...prev, [lote.id]: !expandido }))}>
                  {expandido ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                  {expandido ? 'Ocultar resumo' : 'Resumo rápido'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => onAbrirDetalhe(lote)}>
                  <Eye className="w-4 h-4 mr-1" /> Ver detalhe
                </Button>
                <Button variant="destructive" size="sm" onClick={() => onExcluirLote?.(lote)} disabled={excluindo}>
                  <Trash2 className="w-4 h-4 mr-1" /> {excluindo ? 'Excluindo...' : 'Excluir'}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2 mt-3">
              <MiniStat label="Total processado" value={lote.resumo.total_linhas} />
              <MiniStat label="Sucesso" value={lote.resumo.total_importadas} />
              <MiniStat label="Com erro" value={lote.resumo.total_erros} />
              <MiniStat label="Parcial/Revisar" value={lote.resumo.total_revisar} />
              <MiniStat label="Apto alerta" value={lote.resumo.total_aptas_com_alerta} />
              <MiniStat label="Não importadas" value={lote.resumo.total_nao_importadas} />
              <MiniStat label="Status técnico" value={lote.statusImportacao || '—'} />
            </div>

            {expandido ? (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                <p className="text-sm font-medium text-slate-700">Resumo do lote</p>
                <p className="text-sm text-slate-600">{lote.observacoes || 'Sem observações registradas para este lote.'}</p>
                {lote.linhas?.length ? (
                  <p className="text-xs text-slate-500">Principal erro identificado: {lote.linhas.find((linha) => linha.erros?.length)?.erros?.[0] || 'Nenhum erro crítico mapeado.'}</p>
                ) : null}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
