import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function EfetivoFuncoesTagsCompactas({ itens = [], textoExcesso = '' }) {
  if (!Array.isArray(itens) || itens.length === 0) return null;

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="text-xs text-slate-500 mt-0.5 inline-flex items-center gap-1 cursor-default max-w-full overflow-hidden">
            {itens.map((item, index) => (
              <span key={`${item.tipo}-${item.nome}-${index}`} aria-label={item.nome}>
                {item.emoji}
              </span>
            ))}
            {textoExcesso ? <span className="text-[11px] text-slate-400">{textoExcesso}</span> : null}
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-[260px] p-2 text-xs bg-slate-50 border border-slate-200 text-slate-700 shadow-lg">
          <div className="space-y-1">
            {itens.map((item, index) => (
              <div key={`tooltip-${item.tipo}-${item.nome}-${index}`}>
                {item.emoji} {item.nome}
              </div>
            ))}
            {textoExcesso ? <div className="text-slate-500">{textoExcesso} adicionais</div> : null}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
