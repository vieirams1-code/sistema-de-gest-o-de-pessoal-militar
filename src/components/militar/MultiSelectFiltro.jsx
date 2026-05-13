import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown, X } from 'lucide-react';

/**
 * Multisseleção padronizada para a tela Efetivo/Militares.
 *
 * Regras de resumo:
 *  - 0 selecionados → "Todos" (ou placeholder)
 *  - 1 selecionado → label do item
 *  - 2 selecionados → "A e B"
 *  - 3+ selecionados → "N selecionados"
 *
 * Nenhum item selecionado = "Todos" (NÃO é "Nenhum").
 */
export default function MultiSelectFiltro({
  label,
  placeholder = 'Todos',
  options = [],
  value = [],
  onChange,
  className = '',
  triggerClassName = '',
}) {
  const [open, setOpen] = useState(false);

  const optionsByValue = useMemo(() => {
    const map = new Map();
    options.forEach((opt) => map.set(opt.value, opt));
    return map;
  }, [options]);

  const resumo = useMemo(() => {
    if (!value || value.length === 0) return placeholder;
    if (value.length === 1) return optionsByValue.get(value[0])?.label || value[0];
    if (value.length === 2) {
      const a = optionsByValue.get(value[0])?.label || value[0];
      const b = optionsByValue.get(value[1])?.label || value[1];
      return `${a} e ${b}`;
    }
    return `${value.length} selecionados`;
  }, [value, optionsByValue, placeholder]);

  const toggle = (optValue) => {
    if (value.includes(optValue)) {
      onChange(value.filter((v) => v !== optValue));
    } else {
      onChange([...value, optValue]);
    }
  };

  const limpar = (e) => {
    e.stopPropagation();
    onChange([]);
  };

  return (
    <div className={className}>
      {label && <label className="text-xs font-medium text-slate-600 mb-1 block">{label}</label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={`justify-between font-normal ${triggerClassName}`}
          >
            <span className="truncate text-sm">{resumo}</span>
            <span className="flex items-center gap-1 shrink-0">
              {value.length > 0 && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={limpar}
                  onKeyDown={(e) => { if (e.key === 'Enter') limpar(e); }}
                  className="inline-flex items-center justify-center rounded hover:bg-slate-100 p-0.5"
                  aria-label="Limpar seleção"
                >
                  <X className="w-3.5 h-3.5 text-slate-400" />
                </span>
              )}
              <ChevronDown className="w-4 h-4 opacity-60" />
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="p-0 w-64 max-h-80 overflow-auto">
          <div className="py-1">
            {options.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-500">Nenhuma opção.</div>
            ) : (
              options.map((opt) => {
                const checked = value.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50 cursor-pointer"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggle(opt.value)}
                    />
                    <span className="truncate">{opt.label}</span>
                  </label>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}