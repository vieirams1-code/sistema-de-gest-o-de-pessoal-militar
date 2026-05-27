import React from 'react';
import { Button } from '@/components/ui/button';

export default function SelectionActionBar({
  count = 0,
  label,
  onManageTags,
  onClear,
  helperText,
  manageTagsLabel = 'Gerenciar tags',
}) {
  return (
    <div className="border-b bg-indigo-50 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-indigo-900">{count} {label}</p>
        <div className="flex items-center gap-6">
          <Button size="sm" variant="outline" onClick={onManageTags}>
            {manageTagsLabel}
          </Button>
          <button
            type="button"
            className="text-sm text-indigo-900 hover:underline focus:outline-none focus:underline"
            onClick={onClear}
          >
            Limpar seleção
          </button>
        </div>
      </div>
      {helperText ? <p className="mt-1 text-xs text-indigo-700">{helperText}</p> : null}
    </div>
  );
}
