import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Search, User, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { getFeriasElegiveisPorOperacao, getMensagemSemElegibilidade } from '@/components/livro/feriasOperacaoUtils';

export default function MilitarSelector({ value, onChange, onMilitarSelect, livroOperacaoFerias = null, dataBase = '', somenteElegiveis = false }) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { isAdmin, modoAcesso, subgrupamentoId, userEmail, linkedMilitarId, linkedMilitarEmail, hasAccess, hasSelfAccess } = useCurrentUser();

  const { data: militares = [] } = useQuery({
    queryKey: ['militares-ativos-selector', isAdmin, modoAcesso, subgrupamentoId, userEmail, linkedMilitarId, linkedMilitarEmail],
    queryFn: async () => {
      if (isAdmin) {
        const all = await base44.entities.Militar.list('-nome_completo');
        return all.filter((m) => m.status_cadastro !== 'Inativo');
      }

      if (modoAcesso === 'setor') {
        const [porGrupamento, porSubgrupamento] = await Promise.all([
          base44.entities.Militar.filter({ grupamento_id: subgrupamentoId }, '-nome_completo'),
          base44.entities.Militar.filter({ subgrupamento_id: subgrupamentoId }, '-nome_completo'),
        ]);
        const ids = new Set();
        return [...porGrupamento, ...porSubgrupamento]
          .filter((m) => m.status_cadastro !== 'Inativo')
          .filter((m) => {
            if (!hasAccess(m) || ids.has(m.id)) return false;
            ids.add(m.id);
            return true;
          });
      }

      if (modoAcesso === 'subsetor' && subgrupamentoId) {
        const list = await base44.entities.Militar.filter({ subgrupamento_id: subgrupamentoId }, '-nome_completo');
        return list.filter((m) => m.status_cadastro !== 'Inativo').filter(hasAccess);
      }

      if (modoAcesso === 'proprio') {
        const knownEmails = [userEmail, linkedMilitarEmail].filter(Boolean);
        if (!linkedMilitarId && knownEmails.length === 0) return [];

        const requests = [];
        if (linkedMilitarId) requests.push(base44.entities.Militar.filter({ id: linkedMilitarId }, '-nome_completo'));
        for (const email of knownEmails) {
          requests.push(base44.entities.Militar.filter({ email }, '-nome_completo'));
          requests.push(base44.entities.Militar.filter({ email_particular: email }, '-nome_completo'));
          requests.push(base44.entities.Militar.filter({ email_funcional: email }, '-nome_completo'));
          requests.push(base44.entities.Militar.filter({ created_by: email }, '-nome_completo'));
          requests.push(base44.entities.Militar.filter({ militar_email: email }, '-nome_completo'));
        }

        const batches = await Promise.all(requests);
        const ids = new Set();
        return batches
          .flat()
          .filter((m) => m.status_cadastro !== 'Inativo')
          .filter((m) => {
            if (!hasSelfAccess(m) || ids.has(m.id)) return false;
            ids.add(m.id);
            return true;
          });
      }

      return [];
    }
  });

  const { data: feriasElegibilidade = [], isLoading: isLoadingElegibilidade } = useQuery({
    queryKey: ['militares-ativos-selector-ferias-elegibilidade', somenteElegiveis, livroOperacaoFerias, dataBase, militares.map((m) => m.id).join('|')],
    queryFn: async () => {
      if (!somenteElegiveis || !livroOperacaoFerias || militares.length === 0) return [];
      const lotes = await Promise.all(militares.map((militar) => base44.entities.Ferias.filter({ militar_id: militar.id })));
      return militares.filter((militar, index) => getFeriasElegiveisPorOperacao(lotes[index] || [], livroOperacaoFerias).length > 0);
    },
    enabled: somenteElegiveis && !!livroOperacaoFerias && militares.length > 0,
  });

  const { data: selectedMilitar } = useQuery({
    queryKey: ['militar-selected', value],
    queryFn: async () => {
      if (!value) return null;
      const list = await base44.entities.Militar.filter({ id: value });
      return list[0] || null;
    },
    enabled: !!value
  });

  const militaresDisponiveis = useMemo(() => (somenteElegiveis && livroOperacaoFerias ? feriasElegibilidade : militares), [feriasElegibilidade, livroOperacaoFerias, militares, somenteElegiveis]);

  const filteredMilitares = militaresDisponiveis.filter(m => 
    m.nome_completo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.nome_guerra?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.matricula?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (militar) => {
    onChange('militar_id', militar.id);
    if (onMilitarSelect) {
      onMilitarSelect({
        id: militar.id,
        militar_nome: militar.nome_completo,
        militar_posto: militar.posto_graduacao,
        militar_matricula: militar.matricula,
        nome_completo: militar.nome_completo,
        posto_graduacao: militar.posto_graduacao,
        matricula: militar.matricula
      });
    }
    setOpen(false);
  };

  const handleClear = () => {
    onChange('militar_id', '');
    if (onMilitarSelect) {
      onMilitarSelect({
        militar_nome: '',
        militar_posto: '',
        militar_matricula: ''
      });
    }
  };

  const emptyState = getMensagemSemElegibilidade(livroOperacaoFerias);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">
        Militar <span className="text-red-500">*</span>
      </label>
      
      {selectedMilitar ? (
        <div className="flex items-center gap-2 p-3 border border-slate-200 rounded-lg bg-white">
          <div className="w-10 h-12 rounded bg-slate-100 flex-shrink-0 overflow-hidden">
            {selectedMilitar.foto ? (
              <img src={selectedMilitar.foto} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <User className="w-4 h-4 text-slate-300" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-slate-900 truncate">
              {selectedMilitar.posto_graduacao && `${selectedMilitar.posto_graduacao} `}
              {selectedMilitar.nome_guerra || selectedMilitar.nome_completo}
            </p>
            <p className="text-xs text-slate-500 truncate">
              Mat: {selectedMilitar.matricula}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClear}
            className="flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : somenteElegiveis && livroOperacaoFerias && !isLoadingElegibilidade && militaresDisponiveis.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">{emptyState.titulo}</p>
          <p className="mt-1 text-xs text-amber-700">{emptyState.texto}</p>
        </div>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className="w-full justify-start text-left font-normal h-auto py-3 border-slate-200"
            >
              <Search className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
              <span className="text-slate-500">Selecione um militar...</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start">
            <Command>
              <CommandInput 
                placeholder="Buscar por nome, nome de guerra ou matrícula..." 
                value={searchTerm}
                onValueChange={setSearchTerm}
              />
              <CommandEmpty>{somenteElegiveis && livroOperacaoFerias ? emptyState.titulo : 'Nenhum militar encontrado.'}</CommandEmpty>
              <CommandGroup className="max-h-64 overflow-auto">
                {isLoadingElegibilidade ? (
                  <div className="px-3 py-4 text-sm text-slate-500">Carregando militares elegíveis...</div>
                ) : filteredMilitares.map((militar) => (
                  <CommandItem
                    key={militar.id}
                    onSelect={() => handleSelect(militar)}
                    className="flex items-center gap-3 py-3 cursor-pointer"
                  >
                    <div className="w-8 h-10 rounded bg-slate-100 flex-shrink-0 overflow-hidden">
                      {militar.foto ? (
                        <img src={militar.foto} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <User className="w-3 h-3 text-slate-300" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {militar.posto_graduacao && `${militar.posto_graduacao} `}
                        {militar.nome_guerra || militar.nome_completo}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        Mat: {militar.matricula}
                      </p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
