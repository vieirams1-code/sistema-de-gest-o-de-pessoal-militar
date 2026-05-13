import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowRight } from 'lucide-react';

/**
 * Badge visual para a coluna Condição da listagem de militares.
 *
 * - condicao "Efetivo" (ou vazio) → badge discreta neutra "Efetivo".
 * - condicao != Efetivo + movimento "entrada" → verde claro, seta à esquerda, exibe "Origem: ...".
 * - condicao != Efetivo + movimento "saida"   → vermelho discreto, seta à direita, exibe "Destino: ...".
 * - condicao != Efetivo sem movimento → badge âmbar neutra (caso legado).
 *
 * O componente é apenas visual. Não altera dados.
 */
export default function CondicaoBadge({ militar = {} }) {
  const condicao = String(militar?.condicao || '').trim();

  if (!condicao || condicao === 'Efetivo') {
    return (
      <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-xs font-medium">
        Efetivo
      </Badge>
    );
  }

  const movimento = String(militar?.condicao_movimento || '').trim().toLowerCase();
  const origemDestino =
    String(militar?.condicao_origem_destino || militar?.destino || '').trim();

  if (movimento === 'entrada') {
    return (
      <div className="flex flex-col gap-0.5 min-w-0">
        <Badge
          variant="outline"
          className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-medium inline-flex items-center gap-1 w-fit"
        >
          <ArrowLeft className="w-3 h-3" />
          {condicao} · Entrada
        </Badge>
        {origemDestino && (
          <span className="text-[11px] text-slate-500 truncate" title={`Origem: ${origemDestino}`}>
            Origem: {origemDestino}
          </span>
        )}
      </div>
    );
  }

  if (movimento === 'saida') {
    return (
      <div className="flex flex-col gap-0.5 min-w-0">
        <Badge
          variant="outline"
          className="bg-rose-50 text-rose-700 border-rose-200 text-xs font-medium inline-flex items-center gap-1 w-fit"
        >
          {condicao} · Saída
          <ArrowRight className="w-3 h-3" />
        </Badge>
        {origemDestino && (
          <span className="text-[11px] text-slate-500 truncate" title={`Destino: ${origemDestino}`}>
            Destino: {origemDestino}
          </span>
        )}
      </div>
    );
  }

  // Condição diferente de Efetivo, mas sem movimento (compatibilidade)
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <Badge
        variant="outline"
        className="bg-amber-50 text-amber-700 border-amber-200 text-xs font-medium w-fit"
      >
        {condicao}
      </Badge>
      {origemDestino && (
        <span className="text-[11px] text-slate-500 truncate" title={origemDestino}>
          {origemDestino}
        </span>
      )}
    </div>
  );
}