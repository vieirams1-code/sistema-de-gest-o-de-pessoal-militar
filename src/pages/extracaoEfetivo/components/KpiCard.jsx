import React from 'react';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatKpiValue, KPI_ICON_TONES } from '@/pages/extracaoEfetivo/extracaoState';

export default function KpiCard({
  title,
  value,
  description,
  icon: Icon,
  iconTone = 'slate',
  valueClassName,
}) {
  const iconToneClass = KPI_ICON_TONES[iconTone] || KPI_ICON_TONES.slate;

  return (
    <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
      <CardContent className="flex items-center gap-4 p-5">
        {Icon && (
          <div className={cn('rounded-xl p-3', iconToneClass)}>
            <Icon className="h-6 w-6" />
          </div>
        )}
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className={cn('text-3xl font-bold text-slate-800', valueClassName)}>
            {formatKpiValue(value)}
          </p>
          {description && <p className="text-xs text-slate-500">{description}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
