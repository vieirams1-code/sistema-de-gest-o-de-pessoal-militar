import React, { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search, User, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { fetchScopedMilitares } from '@/services/getScopedMilitaresClient';

const SEARCH_DEBOUNCE_MS = 350;

// Seletor múltiplo de militares interessados num processo.
// value: array de { id, nome }. onChange recebe o array atualizado.
export default function InteressadosSelector({ value = [], onChange }) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(searchTerm.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const { data: militares = [], isLoading } = useQuery({
    queryKey: ['interessados-selector', { search: debounced }],
    queryFn: async () => {
      const { militares: lista } = await fetchScopedMilitares({
        search: debounced,
        statusCadastro: 'Ativo',
        limit: 50,
        offset: 0,
        includeFoto: false,
      });
      return lista;
    },
    enabled: open,
    placeholderData: keepPreviousData,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const selecionadosIds = useMemo(() => new Set(value.map((v) => v.id)), [value]);

  const toggle = (militar) => {
    if (selecionadosIds.has(militar.id)) {
      onChange(value.filter((v) => v.id !== militar.id));
    } else {
      const nome = [militar.posto_graduacao, militar.nome_guerra || militar.nome_completo]
        .filter(Boolean)
        .join(' ');
      onChange([...value, { id: militar.id, nome }]);
    }
  };

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((m) => (
            <Badge key={m.id} variant="secondary" className="gap-1">
              {m.nome}
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v.id !== m.id))}
                className="ml-0.5 text-slate-500 hover:text-slate-800"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start font-normal border-slate-200">
            <Search className="mr-2 h-4 w-4 text-slate-400" />
            <span className="text-slate-500">Adicionar militar interessado...</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Buscar por nome ou matrícula..."
              value={searchTerm}
              onValueChange={setSearchTerm}
            />
            <CommandEmpty>{isLoading ? 'Carregando...' : 'Nenhum militar encontrado.'}</CommandEmpty>
            <CommandGroup className="max-h-64 overflow-auto">
              {militares.map((militar) => {
                const selecionado = selecionadosIds.has(militar.id);
                return (
                  <CommandItem
                    key={militar.id}
                    onSelect={() => toggle(militar)}
                    className={`flex items-center gap-3 py-2 cursor-pointer ${selecionado ? 'bg-slate-50' : ''}`}
                  >
                    <div className="w-7 h-9 rounded bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <User className="w-3 h-3 text-slate-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {[militar.posto_graduacao, militar.nome_guerra || militar.nome_completo].filter(Boolean).join(' ')}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{militar.nome_completo}</p>
                    </div>
                    {selecionado && <span className="text-xs text-blue-600 font-medium">Selecionado</span>}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}