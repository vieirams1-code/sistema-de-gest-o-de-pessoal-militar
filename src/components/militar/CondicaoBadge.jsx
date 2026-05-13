import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowRight, Check, AlertTriangle } from 'lucide-react';

function formatDateBR(dateStr) {
  if (!dateStr) return null;
  const d = new Date(`${String(dateStr).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Badge visual para a coluna Condição da listagem de militares.
 *
 * - Efetivo (ou vazio)            → badge verde discreta "✓ Efetivo".
 * - Movimento "entrada"           → verde, seta para a esquerda DENTRO do badge,
 *                                   linha abaixo: "Origem: <texto>".
 * - Movimento "saida"             → vermelho, seta para a direita DENTRO do badge,
 *                                   linha abaixo: "Destino: <texto>".
 * - LTIP                          → vermelho, tratado como saída,
 *                                   linha abaixo: "Retorno: dd/mm/aaaa".
 * - Condição != Efetivo sem movimento → âmbar com "Dados da condição incompletos".
 *
 * Componente puramente visual. Não altera dados.
 */
export default function CondicaoBadge({ militar = {} }) {
  const condicao = String(militar?.condicao || '').trim();

  // --- LTIP: tratado como saída fixa, mostra data de retorno ---
  if (condicao === 'LTIP') {
    const dataFim = formatDateBR(militar?.ltip_data_fim);
    return (
      <div className="flex flex-col gap-1 min-w-0">
        <Badge
          variant="outline"
          className="bg-rose-50 text-rose-700 border-rose-200 text-xs font-medium inline-flex items-center gap-1 w-fit"
        >
          LTIP · Saída
          <ArrowRight className="w-3 h-3" />
        </Badge>
        <span className="text-[11px] text-slate-500 truncate" title={dataFim ? `Retorno: ${dataFim}` : 'Retorno não informado'}>
          Retorno: {dataFim || '—'}
        </span>
      </div>
    );
  }

  if (!condicao || condicao === 'Efetivo') {
    return (
      <Badge
        variant="outline"
        className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-medium inline-flex items-center gap-1 w-fit"
      >
        <Check className="w-3 h-3" />
        Efetivo
      </Badge>
    );
  }

  const movimento = String(militar?.condicao_movimento || '').trim().toLowerCase();
  const origemDestino = String(militar?.condicao_origem_destino || militar?.destino || '').trim();

  if (movimento === 'entrada') {
    return (
      <div className="flex flex-col gap-1 min-w-0">
        <Badge
          variant="outline"
          className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-medium inline-flex items-center gap-1 w-fit"
        >
          <ArrowLeft className="w-3 h-3" />
          {condicao} · Entrada
        </Badge>
        <span className="text-[11px] text-slate-500 truncate" title={origemDestino ? `Origem: ${origemDestino}` : 'Origem não informada'}>
          Origem: {origemDestino || '—'}
        </span>
      </div>
    );
  }

  if (movimento === 'saida') {
    return (
      <div className="flex flex-col gap-1 min-w-0">
        <Badge
          variant="outline"
          className="bg-rose-50 text-rose-700 border-rose-200 text-xs font-medium inline-flex items-center gap-1 w-fit"
        >
          {condicao} · Saída
          <ArrowRight className="w-3 h-3" />
        </Badge>
        <span className="text-[11px] text-slate-500 truncate" title={origemDestino ? `Destino: ${origemDestino}` : 'Destino não informado'}>
          Destino: {origemDestino || '—'}
        </span>
      </div>
    );
  }

  // Condição diferente de Efetivo, mas sem movimento (registro antigo / dados incompletos)
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <Badge
        variant="outline"
        className="bg-amber-50 text-amber-700 border-amber-200 text-xs font-medium inline-flex items-center gap-1 w-fit"
      >
        <AlertTriangle className="w-3 h-3" />
        {condicao}
      </Badge>
      <span className="text-[11px] text-amber-600 truncate" title="Dados da condição incompletos">
        Dados da condição incompletos
      </span>
    </div>
  );
}