import React, { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Stethoscope, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import MedicoFormDialog from './MedicoFormDialog';
import { medicoDisplayName, normalizeCrm } from './medicoUtils';

const SEARCH_DEBOUNCE_MS = 300;
const MEDICOS_LIMIT = 200;

function uniqueById(list) {
  const seen = new Set();
  return list.filter((item) => {
    const key = item?.id || `${item?.nome || ''}-${item?.crm || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function matchesSearch(medico, search) {
  const term = String(search || '').trim().toLowerCase();
  if (!term) return true;
  const crmTerm = normalizeCrm(search).toLowerCase();
  return String(medico?.nome || '').toLowerCase().includes(term)
    || normalizeCrm(medico?.crm).toLowerCase().includes(crmTerm);
}


function MedicoSearchContent({ searchTerm, setSearchTerm, medicos, isLoading, isFetching, isError, onSelect, onCreate }) {
  return (
    <Command shouldFilter={false}>
      <CommandInput
        placeholder="Digite nome ou CRM..."
        value={searchTerm}
        onValueChange={setSearchTerm}
      />
      <CommandEmpty>Nenhum médico encontrado.</CommandEmpty>
      <CommandGroup className="max-h-64 overflow-auto">
        {isLoading || isFetching ? (
          <div className="px-3 py-4 text-sm text-slate-500">Buscando médicos...</div>
        ) : isError ? (
          <div className="px-3 py-4 text-sm text-red-600">Não foi possível carregar médicos.</div>
        ) : medicos.length === 0 ? (
          <div className="px-3 py-4 text-sm text-slate-500">Nenhum médico encontrado.</div>
        ) : (
          medicos.map((medico) => (
            <CommandItem key={medico.id} onSelect={() => onSelect(medico)} className="cursor-pointer py-3">
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">{medico.nome || 'Sem nome'}</span>
                <span className="truncate text-xs text-slate-500">CRM: {medico.crm || '—'}</span>
              </div>
            </CommandItem>
          ))
        )}
      </CommandGroup>
      <div className="border-t border-slate-100 p-2">
        <Button type="button" variant="ghost" className="w-full justify-start" onClick={onCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Cadastrar novo médico
        </Button>
      </div>
    </Command>
  );
}

export default function MedicoSelector({
  value,
  nomeSnapshot,
  crmSnapshot,
  legadoNome,
  legadoCrm,
  onMedicoSelect,
  onClear,
}) {
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const normalizedSearchCrm = useMemo(() => normalizeCrm(debouncedSearch), [debouncedSearch]);

  const { data: medicos = [], isLoading, isFetching, isError } = useQuery({
    queryKey: ['medicos-selector', { search: debouncedSearch, crm: normalizedSearchCrm }],
    queryFn: async () => {
      const [recent, exactCrm] = await Promise.all([
        base44.entities.Medico.list('-created_date', MEDICOS_LIMIT),
        normalizedSearchCrm ? base44.entities.Medico.filter({ crm: normalizedSearchCrm }) : Promise.resolve([]),
      ]);
      return uniqueById([...(exactCrm || []), ...(recent || [])])
        .filter((medico) => medico?.ativo !== false)
        .filter((medico) => matchesSearch(medico, debouncedSearch))
        .slice(0, 30);
    },
    enabled: open,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const selectedLabel = medicoDisplayName({
    nome: nomeSnapshot || legadoNome,
    crm: crmSnapshot || legadoCrm,
  });
  const hasSelection = !!value || !!selectedLabel;
  const isLegacyOnly = !value && !!selectedLabel;

  const handleSelect = (medico) => {
    onMedicoSelect?.(medico);
    setOpen(false);
    setSearchTerm('');
  };

  const handleSaved = (medico) => {
    queryClient.invalidateQueries({ queryKey: ['medicos-selector'] });
    handleSelect(medico);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">Médico responsável</label>

      {hasSelection ? (
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-50">
            <Stethoscope className="h-5 w-5 text-blue-700" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">{selectedLabel}</p>
            {isLegacyOnly ? (
              <p className="text-xs text-amber-700">Registro legado: selecione/cadastre um médico para estruturar o vínculo.</p>
            ) : (
              <p className="text-xs text-slate-500">Cadastro estruturado selecionado.</p>
            )}
          </div>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                Trocar
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <MedicoSearchContent
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                medicos={medicos}
                isLoading={isLoading}
                isFetching={isFetching}
                isError={isError}
                onSelect={handleSelect}
                onCreate={() => {
                  setDialogOpen(true);
                  setOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
          <Button type="button" variant="ghost" size="icon" onClick={onClear}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      {!hasSelection && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              className="h-auto w-full justify-start border-slate-200 py-3 text-left font-normal"
            >
              <Search className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
              <span className="text-slate-500">Buscar médico por nome ou CRM...</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start">
            <MedicoSearchContent
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              medicos={medicos}
              isLoading={isLoading}
              isFetching={isFetching}
              isError={isError}
              onSelect={handleSelect}
              onCreate={() => {
                setDialogOpen(true);
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      )}

      <MedicoFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialSearch={searchTerm || legadoNome || legadoCrm || ''}
        onMedicoSaved={handleSaved}
      />
    </div>
  );
}
