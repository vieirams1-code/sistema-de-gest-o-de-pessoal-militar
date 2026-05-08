import React from 'react';

import { cn } from '@/lib/utils';
import { getMilitarInitials } from '@/pages/extracaoEfetivo/extracaoState';

export default function MilitarAvatar({ nome, className }) {
  return (
    <div
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-700',
        className,
      )}
      title={nome || 'Militar'}
      aria-label={nome ? `Iniciais de ${nome}` : 'Iniciais do militar'}
    >
      {getMilitarInitials(nome)}
    </div>
  );
}
