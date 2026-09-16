import React from 'react';
import { AlertCircle } from 'lucide-react';

/**
 * Alerta exibido no modal de Saída de Férias quando o saldo líquido do período
 * aquisitivo (considerando descontos publicados e pendentes) é menor que os
 * dias previstos na férias. Informa o gestor do ajuste automático aplicado.
 */
export default function AjusteDescontoFeriasAlert({ detalhe }) {
  if (!detalhe) return null;

  const {
    diasOriginais,
    diasAjustados,
    direito,
    descontosAtivos = 0,
    descontosPendentes = 0,
    saldoLiquido,
  } = detalhe;

  const partesDesconto = [];
  if (descontosAtivos > 0) partesDesconto.push(`${descontosAtivos} publicado`);
  if (descontosPendentes > 0) partesDesconto.push(`${descontosPendentes} pendente`);
  const descontoTexto = partesDesconto.length > 0 ? ` − ${partesDesconto.join(' + ')}` : '';

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 flex gap-2">
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="space-y-0.5">
        <div className="font-semibold">
          Saldo líquido: {saldoLiquido} dias ({direito} direito{descontoTexto}). Ajustando dias e retorno.
        </div>
        <div className="text-xs text-amber-700">
          Férias original: {diasOriginais}d → ajustada: {diasAjustados}d
        </div>
      </div>
    </div>
  );
}