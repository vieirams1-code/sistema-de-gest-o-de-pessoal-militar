import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Eye, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { STATUS_LOTE_BADGE_CLASS } from '@/services/historicoImportacoesMilitaresService';

function formatarDataHora(valor) {
  if (!valor) return '—';
  const date = new Date(valor);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR');
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
  lotesExcluindo = {},
  onAbrirDetalhe,
  onExcluirLote,
  semResultadosPorFiltro = false,
}) {
  const [loteExpandido, setLoteExpandido] = useState(null);

  if (!lotes.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500 bg-white">
        <p className="text-base font-semibold text-slate-700">
          {semResultadosPorFiltro ? 'Nenhum lote encontrado para os filtros aplicados.' : 'Ainda não há importações registradas.'}
        </p>
        <p className="text-sm mt-1">
          {semResultadosPorFiltro
            ? 'Ajuste os filtros para ampliar o resultado da pesquisa.'
            : 'Quando novos arquivos forem processados, os lotes aparecerão aqui com status e detalhes.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {lotes.map((lote) => {
        const excluindo = Boolean(lotesExcluindo[lote.id]);
        const expandido = loteExpandido === lote.id;

        return (
          <div key={lote.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
              <div>
                <p className="text-sm text-slate-500">Importação em {formatarDataHora(lote.dataHora)}</p>
                <h3 className="text-lg font-semibold text-[#1e3a5f]">{lote.nomeArquivo || 'Arquivo sem nome'}</h3>
                <p className="text-xs text-slate-500">Tipo: {lote.tipoImportacao || 'Não informado'} • Executor: {lote.importadoPor || 'Não informado'}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={STATUS_LOTE_BADGE_CLASS[lote.statusGeral] || 'bg-slate-100 text-slate-700 border-slate-200'}>{lote.statusGeral}</Badge>
                <Button variant="destructive" size="sm" onClick={() => onExcluirLote?.(lote)} disabled={excluindo}>
                  <Trash2 className="w-4 h-4 mr-1" /> {excluindo ? 'Excluindo...' : 'Excluir'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => onAbrirDetalhe(lote)}>
                  <Eye className="w-4 h-4 mr-1" /> Ver detalhe
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 xl:grid-cols-10 gap-2">
              <LinhaResumo label="Total processado" valor={lote.resumo.total_linhas} />
              <LinhaResumo label="Com sucesso" valor={lote.resumo.total_importadas} />
              <LinhaResumo label="Com erro" valor={lote.resumo.total_erros} />
              <LinhaResumo label="Pend. revisão" valor={lote.resumo.total_revisar} />
              <LinhaResumo label="Apto c/ alerta" valor={lote.resumo.total_aptas_com_alerta} />
              <LinhaResumo label="Ignorados" valor={lote.resumo.total_ignoradas} />
              <LinhaResumo label="Importadas" valor={lote.resumo.total_importadas} />
              <LinhaResumo label="Não importadas" valor={lote.resumo.total_nao_importadas} />
              <LinhaResumo label="Status técnico" valor={lote.statusImportacao || '—'} />
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-600">Referência do lote: <span className="font-medium">{lote.referenciaLote || 'Não informada'}</span></p>
                <Button variant="ghost" size="sm" onClick={() => setLoteExpandido(expandido ? null : lote.id)}>
                  {expandido ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                  {expandido ? 'Ocultar resumo rápido' : 'Resumo rápido'}
                </Button>
              </div>
              {expandido ? (
                <div className="mt-2 space-y-1 text-sm text-slate-700">
                  <p><span className="font-medium">Observações:</span> {lote.observacoes || 'Sem observações registradas.'}</p>
                  <p><span className="font-medium">Resultado:</span> {lote.statusGeral} ({lote.statusImportacao || 'sem status técnico'})</p>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
