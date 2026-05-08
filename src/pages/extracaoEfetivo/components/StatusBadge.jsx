import React from 'react';

import { cn } from '@/lib/utils';
import {
  getStatusBadgeVariant,
  STATUS_BADGE_VARIANTS,
  STATUS_DOT_VARIANTS,
} from '@/pages/extracaoEfetivo/extracaoState';

export default function StatusBadge({ status, children, variant, className }) {
  const resolvedVariant = variant || getStatusBadgeVariant(status);
  const badgeClass = STATUS_BADGE_VARIANTS[resolvedVariant] || STATUS_BADGE_VARIANTS.neutral;
  const dotClass = STATUS_DOT_VARIANTS[resolvedVariant] || STATUS_DOT_VARIANTS.neutral;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        badgeClass,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', dotClass)} aria-hidden="true" />
      {children || status}
    </span>
  );
}
