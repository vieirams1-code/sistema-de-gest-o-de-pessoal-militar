import React, { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
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
import { getMensagemSemElegibilidade } from '@/components/livro/feriasOperacaoUtils';
import { carregarMilitaresComMatriculas, filtrarMilitaresOperacionais, isMilitarMesclado, resolverMatriculaAtual } from '@/services/matriculaMilitarViewService';
import { fetchScopedMilitares, getEffectiveEmail } from '@/services/getScopedMilitaresClient';
import { useCurrentUser } from '@/components/auth/useCurrentUser';

const BACKEND_LIMIT = 100;
const SEARCH_DEBOUNCE_MS = 350;
// Desativado até existir um bundle/endpoint escopado de elegibilidade; evita Ferias.list() global e N+1 por militar.
const ELEGIBILIDADE_FERIAS_BUNDLE_DISPONIVEL = false;
const FERIAS_ELEGIBILIDADE_INDISPONIVEL = Object.freeze({ status: 'unavailable', militares: [] });

export default function MilitarSelector({ value, onChange, onMilitarSelect, livroOperacaoFerias = null, dataBase = '', somenteElegiveis = false }) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const effectiveEmail = getEffectiveEmail();
  const {
    isAccessResolved,
    isAccessError,
    modoAcesso,
    subgrupamentoId,
    linkedMilitarId,
    resolvedAccessContext,
  } = useCurrentUser();

  const accessContextKey = useMemo(() => ({
    effectiveEmail: resolvedAccessContext?.effectiveEmail || effectiveEmail || 'self',
    modoAcesso: modoAcesso || 'indefinido',
    subgrupamentoId: subgrupamentoId || null,
    linkedMilitarId: linkedMilitarId || null,
    isAdmin: resolvedAccessContext?.isAdmin === true,
    hasAcessoRecord: resolvedAccessContext?.hasAcessoRecord === true,
  }), [effectiveEmail, linkedMilitarId, modoAcesso, resolvedAccessContext, subgrupamentoId]);
  const canRunScopedQueries = isAccessResolved && !isAccessError;

  const {
    data: militares = [],
    isLoading: isLoadingMilitares,
    isFetching: isFetchingMilitares,
    isError: isErrorMilitares,
  } = useQuery({
    queryKey: ['militares-ativos-selector', 'buscar-ativos-operacionais', accessContextKey, { search: debouncedSearch, limit: BACKEND_LIMIT, offset: 0 }],
    queryFn: async () => {
      const { militares: lista } = await fetchScopedMilitares({
        search: debouncedSearch,
        statusCadastro: 'Ativo',
        limit: BACKEND_LIMIT,
        offset: 0,
        includeFoto: false,
      });
      const enriquecidos = await carregarMilitaresComMatriculas(lista);
      return filtrarMilitaresOperacionais(enriquecidos, { incluirInativos: false });
    },
    enabled: canRunScopedQueries,
    placeholderData: keepPreviousData,
    staleTime: 2 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const militarIdsKey = useMemo(() => militares.map((m) => m.id).filter(Boolean).sort().join('|'), [militares]);
  const shouldLoadElegibilidade = ELEGIBILIDADE_FERIAS_BUNDLE_DISPONIVEL
    && canRunScopedQueries
    && somenteElegiveis
    && !!livroOperacaoFerias
    && !isLoadingMilitares
    && !isFetchingMilitares
    && !isErrorMilitares
    && militares.length > 0;

  const {
    data: feriasElegibilidade = FERIAS_ELEGIBILIDADE_INDISPONIVEL,
    isLoading: isLoadingElegibilidade,
    isFetching: isFetchingElegibilidade,
    isError: isErrorElegibilidade,
    error: erroElegibilidade,
  } = useQuery({
    queryKey: [
      'militares-ativos-selector-ferias-elegibilidade',
      'calcular-elegiveis-por-operacao',
      accessContextKey,
      { somenteElegiveis, livroOperacaoFerias: livroOperacaoFerias || null, dataBase: dataBase || null, militarIds: militarIdsKey },
    ],
    queryFn: async () => FERIAS_ELEGIBILIDADE_INDISPONIVEL,
    enabled: shouldLoadElegibilidade,
    placeholderData: keepPreviousData,
    staleTime: 2 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Hidratação do militar selecionado via getScopedMilitares (Lote 1B.1).
  // Usa o payload `militarIds` que aplica interseção com o escopo do usuário
  // efetivo no backend — IDs fora do escopo são silenciosamente descartados.
  const { data: selectedMilitar } = useQuery({
    queryKey: ['militar-selected', 'hidratar-selecionado', accessContextKey, { militarId: value || null }],
    queryFn: async () => {
      if (!value) return null;
      const { militares: lista } = await fetchScopedMilitares({
        militarIds: [value],
        includeFoto: true,
        limit: 1,
        offset: 0,
      });
      const [militar] = lista;
      if (!militar) return null;
      const [enriquecido] = await carregarMilitaresComMatriculas([militar]);
      return enriquecido || militar;
    },
    enabled: canRunScopedQueries && !!value,
    staleTime: 2 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const isModoElegibilidade = somenteElegiveis && !!livroOperacaoFerias;
  const isElegibilidadeIndisponivel = isModoElegibilidade && feriasElegibilidade?.status === 'unavailable';
  const militaresElegiveis = Array.isArray(feriasElegibilidade?.militares) ? feriasElegibilidade.militares : [];
  const isLoadingElegibilidadeEfetivo = isModoElegibilidade && !isElegibilidadeIndisponivel && (isLoadingElegibilidade || isFetchingElegibilidade);
  const isLoadingMilitaresEfetivo = (!isAccessResolved && !isAccessError) || isLoadingMilitares || (isFetchingMilitares && militares.length === 0);
  const nenhumMilitarEncontrado = canRunScopedQueries && !isLoadingMilitaresEfetivo && !isErrorMilitares && militares.length === 0;
  const nenhumMilitarElegivel = isModoElegibilidade
    && !isLoadingMilitaresEfetivo
    && !isLoadingElegibilidadeEfetivo
    && !isErrorElegibilidade
    && !isElegibilidadeIndisponivel
    && militares.length > 0
    && militaresElegiveis.length === 0;

  const militaresDisponiveis = useMemo(() => {
    if (!isModoElegibilidade) return militares;
    if (isErrorElegibilidade || isElegibilidadeIndisponivel) return militares;
    return militaresElegiveis;
  }, [isElegibilidadeIndisponivel, isErrorElegibilidade, isModoElegibilidade, militares, militaresElegiveis]);

  // O backend já aplica o filtro de busca; exibimos a lista como vem.
  const filteredMilitares = militaresDisponiveis;
  const bloqueiaSelecaoPorErroElegibilidade = isModoElegibilidade && isErrorElegibilidade;

  const handleSelect = (militar) => {
    if (isMilitarMesclado(militar)) return;
    const matriculaAtual = resolverMatriculaAtual(militar, militar?.matriculas_historico || []);
    onChange('militar_id', militar.id);
    if (onMilitarSelect) {
      onMilitarSelect({
        id: militar.id,
        militar_nome: militar.nome_completo,
        militar_posto: militar.posto_graduacao,
        militar_matricula: matriculaAtual,
        militar_matricula_atual: matriculaAtual,
        militar_matricula_vinculo: matriculaAtual,
        nome_completo: militar.nome_completo,
        posto_graduacao: militar.posto_graduacao,
        matricula: matriculaAtual
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
              Mat: {resolverMatriculaAtual(selectedMilitar, selectedMilitar?.matriculas_historico || []) || '—'}
            </p>
            {isMilitarMesclado(selectedMilitar) && <p className="text-[11px] text-amber-700">Militar mesclado (apenas histórico).</p>}
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
      ) : nenhumMilitarElegivel ? (
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
            <Command shouldFilter={false}>
              <CommandInput 
                placeholder="Buscar por nome, nome de guerra ou matrícula..." 
                value={searchTerm}
                onValueChange={setSearchTerm}
              />
              <CommandEmpty>{isModoElegibilidade ? emptyState.titulo : 'Nenhum militar encontrado.'}</CommandEmpty>
              <CommandGroup className="max-h-64 overflow-auto">
                {isAccessError ? (
                  <div className="px-3 py-4 text-sm text-red-600">Acesso não permitido para consultar militares.</div>
                ) : isLoadingMilitaresEfetivo ? (
                  <div className="px-3 py-4 text-sm text-slate-500">Carregando militares...</div>
                ) : isErrorMilitares ? (
                  <div className="px-3 py-4 text-sm text-red-600">Não foi possível carregar militares.</div>
                ) : nenhumMilitarEncontrado ? (
                  <div className="px-3 py-4 text-sm text-slate-500">Nenhum militar encontrado.</div>
                ) : isLoadingElegibilidadeEfetivo ? (
                  <div className="px-3 py-4 text-sm text-slate-500">Calculando elegibilidade de férias...</div>
                ) : (
                  <>
                    {isElegibilidadeIndisponivel && (
                      <div className="mx-2 my-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        A elegibilidade de férias não foi calculada nesta lista para evitar consulta global. A lista base foi mantida e a validação deve ocorrer na seleção das férias.
                      </div>
                    )}
                    {isErrorElegibilidade && (
                      <div className="mx-2 my-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        Não foi possível calcular a elegibilidade de férias. A lista base foi mantida, mas a seleção fica indisponível até tentar novamente.
                        {erroElegibilidade?.message ? ` Detalhe: ${erroElegibilidade.message}` : ''}
                      </div>
                    )}
                    {filteredMilitares.map((militar) => (
                  <CommandItem
                    key={militar.id}
                    disabled={bloqueiaSelecaoPorErroElegibilidade}
                    onSelect={bloqueiaSelecaoPorErroElegibilidade ? undefined : () => handleSelect(militar)}
                    className={`flex items-center gap-3 py-3 ${bloqueiaSelecaoPorErroElegibilidade ? 'cursor-not-allowed' : 'cursor-pointer'}`}
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
                        Mat: {resolverMatriculaAtual(militar, militar?.matriculas_historico || []) || '—'}
                      </p>
                    </div>
                  </CommandItem>
                    ))}
                  </>
                )}
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}