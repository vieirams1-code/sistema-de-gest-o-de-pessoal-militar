import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Search, CheckSquare, Square, Building2, GitMerge, MapPin, ChevronRight, ChevronDown, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { useToast } from "@/components/ui/use-toast";
import {
  carregarMilitaresComMatriculas,
  filtrarMilitaresOperacionais,
  getLotacaoAtualMilitar,
  militarCorrespondeBusca,
} from '@/services/matriculaMilitarViewService';
import { fetchScopedMilitares, getEffectiveEmail as getEffectiveEmailMilitares } from '@/services/getScopedMilitaresClient';
import { fetchScopedLotacoes } from '@/services/getScopedLotacoesClient';
import DataDebugPanel from '@/components/debug/DataDebugPanel';

const normalizeTipo = (tipo) => {
  if (tipo === 'Grupamento') return 'Setor';
  if (tipo === 'Subgrupamento') return 'Subsetor';
  if (tipo === 'Unidade') return 'Unidade';
  return 'Subsetor';
};

const SEM_LOTACAO_VALUE = '__sem_lotacao__';
const TODAS_LOTACOES_VALUE = '__todas_lotacoes__';

export default function LotacaoMilitares() {
  const queryClient = useQueryClient();
  const { toast, dismiss } = useToast();
  const { canAccessAction, isLoading: loadingUser, isAccessResolved, canAccessModule, isAdmin } = useCurrentUser();
  const hasLotacaoAccess = canAccessModule('lotacao_militares');
  const effectiveEmail = getEffectiveEmailMilitares() || 'self';

  const [searchMilitar, setSearchMilitar] = useState('');
  const [lotacaoAtualFiltro, setLotacaoAtualFiltro] = useState(TODAS_LOTACOES_VALUE);
  const [selectedMilitares, setSelectedMilitares] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null); // Nó de destino selecionado na árvore
  const [expandedNodes, setExpandedNodes] = useState({});

  // Lote 1C-B: militares via Deno Function getScopedMilitares (escopo resolvido no backend).
  const militaresQueryKey = ['lotacao-militares-ativos', effectiveEmail];
  const {
    data: militaresData = { militares: [], partialFailures: 0 },
    isLoading: loadingMilitares,
    isFetching: fetchingMilitares,
    isSuccess: isMilitaresSuccess,
    isError: isMilitaresError,
    error: militaresError,
    refetch: refetchMilitares,
  } = useQuery({
    queryKey: militaresQueryKey,
    queryFn: async () => {
      const { militares } = await fetchScopedMilitares({
        statusCadastro: 'Ativo',
        limit: 300,
        offset: 0,
        includeFoto: false,
      });
      return { militares: militares || [], partialFailures: 0 };
    },
    enabled: hasLotacaoAccess && isAccessResolved,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const militares = militaresData?.militares || [];
  const militaresPartialFailures = Number(militaresData?.partialFailures || 0);

  // Lote 1C-B: enriquecimento de matrículas por IDs dos militares carregados.
  // Substitui MatriculaMilitar.list('-created_date', 10000) global, usando
  // carregarMilitaresComMatriculas, que filtra por militar_id (IN) com fallback em lotes.
  const militaresIdsKey = useMemo(() => (
    militares.map((m) => m?.id).filter(Boolean).sort().join(',')
  ), [militares]);
  const matriculasQueryKey = ['lotacao-militares-com-matriculas', effectiveEmail, militaresIdsKey];
  const {
    data: matriculasData = { militaresEnriquecidos: [], partialFailures: 0 },
    isLoading: loadingMatriculas,
    isFetching: fetchingMatriculas,
    isSuccess: isMatriculasSuccess,
    isError: isMatriculasError,
    error: matriculasError,
  } = useQuery({
    queryKey: matriculasQueryKey,
    queryFn: async () => {
      if (!militares.length) return { militaresEnriquecidos: [], partialFailures: 0 };
      try {
        const enriquecidos = await carregarMilitaresComMatriculas(militares);
        return { militaresEnriquecidos: enriquecidos, partialFailures: 0 };
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('[LotacaoMilitares] Falha ao enriquecer com matrículas.', error);
        }
        return { militaresEnriquecidos: militares, partialFailures: 1 };
      }
    },
    enabled: hasLotacaoAccess && isMilitaresSuccess && militares.length > 0,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const militaresEnriquecidos = matriculasData?.militaresEnriquecidos?.length
    ? matriculasData.militaresEnriquecidos
    : militares;
  const matriculasPartialFailures = Number(matriculasData?.partialFailures || 0);

  // Lote 1C-B: estrutura via Deno Function getScopedLotacoes (escopo resolvido no backend).
  const estruturaQueryKey = ['lotacao-estrutura', effectiveEmail];
  const {
    data: estruturaData = { estrutura: [], partialFailures: 0 },
    isLoading: loadingEstrutura,
    isFetching: fetchingEstrutura,
    isSuccess: isEstruturaSuccess,
    isError: isEstruturaError,
    error: estruturaError,
    refetch: refetchEstrutura,
  } = useQuery({
    queryKey: estruturaQueryKey,
    queryFn: async () => {
      const { lotacoes } = await fetchScopedLotacoes({});
      return { estrutura: lotacoes || [], partialFailures: 0 };
    },
    enabled: hasLotacaoAccess && isAccessResolved,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const estruturaRaw = estruturaData?.estrutura || [];
  const estruturaPartialFailures = Number(estruturaData?.partialFailures || 0);
  const hasPartialDataWarning = militaresPartialFailures > 0 || matriculasPartialFailures > 0 || estruturaPartialFailures > 0;
  const showTotalError = !loadingMilitares && isMilitaresError;

  const getEstagioProvavel = () => {
    if (isMilitaresError) return 'getScopedMilitares';
    if (isEstruturaError || estruturaPartialFailures > 0) return 'getScopedLotacoes';
    if (isMatriculasError || matriculasPartialFailures > 0) return 'carregarMilitaresComMatriculas';
    return hasPartialDataWarning ? 'carregarMilitaresComMatriculas' : null;
  };

  const lotacaoDebugData = (showTotalError || hasPartialDataWarning)
    ? {
      pagina: 'LotacaoMilitares',
      usuario: null,
      isAdmin,
      queryKeyMilitares: militaresQueryKey,
      queryKeyEstrutura: estruturaQueryKey,
      queryKeyMatriculas: matriculasQueryKey,
      status: {
        militares: {
          loading: loadingMilitares,
          fetching: fetchingMilitares,
          isError: isMilitaresError,
          isSuccess: isMilitaresSuccess,
        },
        estrutura: {
          loading: loadingEstrutura,
          fetching: fetchingEstrutura,
          isError: isEstruturaError,
          isSuccess: isEstruturaSuccess,
        },
        matriculas: {
          loading: loadingMatriculas,
          fetching: fetchingMatriculas,
          isError: isMatriculasError,
          isSuccess: isMatriculasSuccess,
        },
      },
      erroPrincipal: militaresError || estruturaError || matriculasError
        ? {
          message: militaresError?.message || estruturaError?.message || matriculasError?.message || null,
          name: militaresError?.name || estruturaError?.name || matriculasError?.name || null,
          stack: (militaresError?.stack || estruturaError?.stack || matriculasError?.stack)
            ? String(militaresError?.stack || estruturaError?.stack || matriculasError?.stack).split('\n').slice(0, 5).join('\n')
            : null,
        }
        : null,
      partialFailures: {
        militares: militaresPartialFailures,
        estrutura: estruturaPartialFailures,
        matriculas: matriculasPartialFailures,
      },
      quantidades: {
        militares: militares.length,
        estrutura: estruturaRaw.length,
        militaresEnriquecidos: militaresEnriquecidos.length,
      },
      estagioProvavel: getEstagioProvavel(),
      timestamps: {
        generatedAt: new Date().toISOString(),
      },
    }
    : null;

  const estrutura = useMemo(() => {
    return estruturaRaw.map(item => ({ ...item, tipoNormalizado: normalizeTipo(item.tipo) }));
  }, [estruturaRaw]);

  const setores = estrutura.filter(s => s.tipoNormalizado === 'Setor');
  const getFilhos = (parentId, nivelTarget) => estrutura.filter(s => s.grupamento_id === parentId && s.tipoNormalizado === nivelTarget);

  const militaresOperacionais = useMemo(() => {
    return filtrarMilitaresOperacionais(militaresEnriquecidos)
      .sort((a, b) => String(a?.nome_completo || '').localeCompare(String(b?.nome_completo || ''), 'pt-BR'));
  }, [militaresEnriquecidos]);

  const lotacoesAtuaisDisponiveis = useMemo(() => {
    const lotacoes = new Set();
    militaresOperacionais.forEach((militar) => {
      const lotacaoText = getLotacaoAtualMilitar(militar);
      if (lotacaoText !== 'Sem lotação') {
        lotacoes.add(lotacaoText);
      }
    });
    return Array.from(lotacoes).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [militaresOperacionais]);

  // Filtragem de militares (busca + lotação atual)
  const militaresFiltrados = useMemo(() => {
    return militaresOperacionais
      .filter(m => {
        if (!searchMilitar?.trim()) return true;
        return militarCorrespondeBusca(m, searchMilitar);
      })
      .filter((militar) => {
        if (lotacaoAtualFiltro === TODAS_LOTACOES_VALUE) return true;
        const lotacaoText = getLotacaoAtualMilitar(militar);
        if (lotacaoAtualFiltro === SEM_LOTACAO_VALUE) {
          return lotacaoText === 'Sem lotação';
        }
        return lotacaoText === lotacaoAtualFiltro;
      });
  }, [militaresOperacionais, searchMilitar, lotacaoAtualFiltro]);

  const toggleExpand = (id, e) => {
    e.stopPropagation();
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSelectNode = (node) => {
    setSelectedNode(node);
  };

  const toggleMilitar = (id) => {
    setSelectedMilitares(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleTodos = () => {
    const ids = militaresFiltrados.map(m => m.id);
    const todosSelecionados = ids.every(id => selectedMilitares.includes(id));
    if (todosSelecionados) {
      setSelectedMilitares(prev => prev.filter(id => !ids.includes(id)));
    } else {
      setSelectedMilitares(prev => [...new Set([...prev, ...ids])]);
    }
  };

  const moveMutation = useMutation({
    mutationFn: async ({ militaresIds, targetNode }) => {
      // Lote 1C-B.2: a movimentação foi migrada para a Deno Function
      // `moverMilitaresLotacao`, que valida autenticação/permissão, hidrata o
      // nó destino com dado real do banco, calcula o setor-pai e aplica os
      // campos modernos (estrutura_*) + legados (grupamento_*/subgrupamento_*)
      // com retry/backoff e service role.
      const payload = {
        militaresIds,
        targetNode: {
          id: targetNode.id,
          nome: targetNode.nome,
          sigla: targetNode.sigla,
          tipo: targetNode.tipo,
          tipoNormalizado: targetNode.tipoNormalizado,
          parent_id: targetNode.parent_id,
          grupamento_id: targetNode.grupamento_id,
          grupamento_raiz_id: targetNode.grupamento_raiz_id,
        },
      };
      const emailEfetivo = getEffectiveEmailMilitares();
      if (emailEfetivo) payload.effectiveEmail = emailEfetivo;

      const response = await base44.functions.invoke('moverMilitaresLotacao', payload);
      const data = response?.data || {};
      if (data?.error) {
        throw new Error(data.error);
      }
      if (Array.isArray(data?.erros) && data.erros.length > 0) {
        const primeiro = data.erros[0];
        throw new Error(primeiro?.message || 'Falha ao atualizar parte dos militares.');
      }
      return data;
    },
    onSuccess: (data, variables) => {
      // Lote 1C-B.3: atualização local IMEDIATA do cache antes de qualquer refetch.
      // O backend confirmou a movimentação e devolveu `camposAplicados` (campos modernos
      // estrutura_* + legados grupamento_*/subgrupamento_* + lotacao). Aplicamos esses
      // campos diretamente no cache das queries que alimentam a renderização desta tela,
      // de modo que a UI reflete a nova lotação na hora, sem depender do refetch.
      const militaresIdsAlterados = Array.isArray(variables?.militaresIds) ? variables.militaresIds : [];
      const camposAplicados = data?.camposAplicados || null;

      if (camposAplicados && militaresIdsAlterados.length > 0) {
        const idsSet = new Set(militaresIdsAlterados.map(String));

        const aplicarCamposNoMilitar = (militar) => {
          if (!militar?.id || !idsSet.has(String(militar.id))) return militar;
          return { ...militar, ...camposAplicados };
        };

        // ['lotacao-militares-ativos', ...] -> { militares: [...] }
        queryClient.setQueriesData(
          { queryKey: ['lotacao-militares-ativos'] },
          (oldData) => {
            if (!oldData || !Array.isArray(oldData.militares)) return oldData;
            return {
              ...oldData,
              militares: oldData.militares.map(aplicarCamposNoMilitar),
            };
          }
        );

        // ['lotacao-militares-com-matriculas', ...] -> { militaresEnriquecidos: [...] }
        queryClient.setQueriesData(
          { queryKey: ['lotacao-militares-com-matriculas'] },
          (oldData) => {
            if (!oldData || !Array.isArray(oldData.militaresEnriquecidos)) return oldData;
            return {
              ...oldData,
              militaresEnriquecidos: oldData.militaresEnriquecidos.map(aplicarCamposNoMilitar),
            };
          }
        );
      }

      // Lote 1C-B.4: NÃO invalidar/refetchar imediatamente as queries que alimentam ESTA tela.
      // O refetch imediato corria contra a indexação do backend e podia sobrescrever o cache
      // local recém-atualizado pelo setQueriesData com a lotação anterior, deixando a tela
      // sempre uma movimentação atrasada. A reconciliação fica adiada por ~2s, dando tempo
      // do backend indexar a escrita feita pela Deno Function.
      // - lotacao-estrutura NÃO é refetchada: a estrutura organizacional não mudou.
      // - militares-consulta-rapida-scoped (outras telas) entra junto no refetch adiado.
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['lotacao-militares-ativos'] });
        queryClient.invalidateQueries({ queryKey: ['lotacao-militares-com-matriculas'] });
        queryClient.invalidateQueries({ queryKey: ['militares-consulta-rapida-scoped'] });
        queryClient.refetchQueries({ queryKey: ['lotacao-militares-ativos'] });
        queryClient.refetchQueries({ queryKey: ['lotacao-militares-com-matriculas'] });
      }, 2000);

      dismiss();
      toast({
        title: "Lotação Atualizada",
        description: `${selectedMilitares.length} militares movidos com sucesso para ${selectedNode.nome}.`,
        className: "bg-emerald-50 border-emerald-200 text-emerald-800",
        duration: 3000,
      });
      setSelectedMilitares([]); // Limpa a seleção
    },
    onError: () => {
      dismiss();
      toast({
        title: "Erro",
        description: "Falha ao atualizar a lotação dos militares.",
        variant: "destructive",
        duration: 3000,
      });
    }
  });

  const handleMove = () => {
    if (!selectedNode || selectedMilitares.length === 0) return;

    if (!canAccessAction('gerir_estrutura') && !canAccessAction('gerir_permissoes')) {
      dismiss();
      toast({ title: "Ação negada", description: "Permissão insuficiente para mover militares.", variant: "destructive", duration: 3000 });
      return;
    }
    moveMutation.mutate({ militaresIds: selectedMilitares, targetNode: selectedNode });
  };

  if (loadingUser || !isAccessResolved) return null;
  if (!hasLotacaoAccess) return <AccessDenied modulo="Lotação de Militares" />;

  // Acesso à página: gerir_estrutura (ação correta para mover lotação) ou gerir_permissoes (acesso legado)
  const canAccess = canAccessAction('gerir_estrutura') || canAccessAction('gerir_permissoes');
  if (!canAccess) {
    return <AccessDenied modulo="Lotação de Militares" />;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto flex flex-col h-[calc(100vh-6rem)]">
        <div className="flex items-center gap-3 mb-6 shrink-0">
          <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1e3a5f]">Lotação de Militares</h1>
            <p className="text-sm text-slate-500">Selecione militares na lista e atribua a uma unidade da estrutura visualmente.</p>
          </div>
        </div>

        {hasPartialDataWarning && !showTotalError && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Alguns dados não puderam ser carregados. Tente novamente para atualizar.
            <DataDebugPanel debugData={lotacaoDebugData} />
          </div>
        )}
        {showTotalError ? (
          <div className="bg-white rounded-xl shadow-sm border border-red-200 p-12 text-center">
            <Users className="w-16 h-16 mx-auto text-red-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">Falha ao carregar dados</h3>
            <div className="flex items-center justify-center gap-3">
              <Button onClick={() => refetchMilitares()} className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white">Tentar novamente</Button>
              <Button variant="outline" onClick={() => refetchEstrutura()}>Recarregar estrutura</Button>
            </div>
            <DataDebugPanel debugData={lotacaoDebugData} className="text-left" />
          </div>
        ) : (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
          
          {/* COLUNA ESQUERDA: Árvore Organizacional */}
          <div className="lg:col-span-5 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 bg-[#1e3a5f]/5 border-b border-slate-100 shrink-0">
              <h2 className="font-bold text-[#1e3a5f] flex items-center gap-2">
                1. Selecione o Destino na Estrutura
              </h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
              {loadingEstrutura ? (
                <p className="text-center text-slate-400 py-10">Carregando estrutura...</p>
              ) : setores.length === 0 ? (
                <div className="text-center text-slate-500 py-10">
                  <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-amber-500" />
                  Estrutura indisponível no momento.
                </div>
              ) : (
                <div className="space-y-1">
                  {setores.map(setor => {
                    const subsetores = getFilhos(setor.id, 'Subsetor');
                    const isSetorSelected = selectedNode?.id === setor.id;
                    const isSetorExpanded = expandedNodes[setor.id] !== false; // Expanded by default

                    return (
                      <div key={setor.id}>
                        {/* NÓ SETOR */}
                        <div 
                          className={`flex items-center p-2 rounded-lg cursor-pointer transition-colors border-2 ${isSetorSelected ? 'bg-blue-50 border-blue-400 shadow-sm' : 'border-transparent hover:bg-slate-200/50'}`}
                          onClick={() => handleSelectNode(setor)}
                        >
                          <button onClick={(e) => toggleExpand(setor.id, e)} className="w-6 h-6 shrink-0 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
                            {subsetores.length > 0 ? (isSetorExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />) : null}
                          </button>
                          <Building2 className={`w-4 h-4 shrink-0 mx-2 ${isSetorSelected ? 'text-blue-600' : 'text-slate-500'}`} />
                          <span className={`font-semibold text-sm truncate ${isSetorSelected ? 'text-blue-900' : 'text-slate-700'}`}>{setor.nome} {setor.sigla && `(${setor.sigla})`}</span>
                        </div>

                        {/* NÓ SUBSETOR */}
                        {isSetorExpanded && subsetores.map(sub => {
                          const unidades = getFilhos(sub.id, 'Unidade');
                          const isSubSelected = selectedNode?.id === sub.id;
                          const isSubExpanded = expandedNodes[sub.id]; // Colapsado by default

                          return (
                            <div key={sub.id}>
                              <div 
                                className={`flex items-center p-2 pl-8 rounded-lg cursor-pointer transition-colors border-2 mt-1 ${isSubSelected ? 'bg-indigo-50 border-indigo-400 shadow-sm' : 'border-transparent hover:bg-slate-200/50'}`}
                                onClick={() => handleSelectNode(sub)}
                              >
                                <button onClick={(e) => toggleExpand(sub.id, e)} className="w-6 h-6 shrink-0 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
                                  {unidades.length > 0 ? (isSubExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />) : null}
                                </button>
                                <GitMerge className={`w-4 h-4 shrink-0 mx-2 ${isSubSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                                <span className={`font-medium text-sm truncate ${isSubSelected ? 'text-indigo-900' : 'text-slate-600'}`}>{sub.nome} {sub.sigla && `(${sub.sigla})`}</span>
                              </div>

                              {/* NÓ UNIDADE */}
                              {isSubExpanded && unidades.map(uni => {
                                const isUniSelected = selectedNode?.id === uni.id;
                                return (
                                  <div 
                                    key={uni.id}
                                    className={`flex items-center p-2 pl-16 rounded-lg cursor-pointer transition-colors border-2 mt-1 ${isUniSelected ? 'bg-emerald-50 border-emerald-400 shadow-sm' : 'border-transparent hover:bg-slate-200/50'}`}
                                    onClick={() => handleSelectNode(uni)}
                                  >
                                    <div className="w-6 h-6 shrink-0"></div>
                                    <MapPin className={`w-3.5 h-3.5 shrink-0 mx-2 ${isUniSelected ? 'text-emerald-600' : 'text-slate-300'}`} />
                                    <span className={`text-sm truncate ${isUniSelected ? 'text-emerald-900 font-medium' : 'text-slate-500'}`}>{uni.nome} {uni.sigla && `(${uni.sigla})`}</span>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* COLUNA DIREITA: Lista de Militares */}
          <div className="lg:col-span-7 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 bg-[#1e3a5f]/5 border-b border-slate-100 shrink-0">
              <h2 className="font-bold text-[#1e3a5f] flex items-center justify-between">
                <span>2. Selecione os Militares a Mover</span>
                <Badge variant="outline" className="bg-white">{selectedMilitares.length} selecionados • {militaresFiltrados.length} na lista</Badge>
              </h2>
            </div>
            
            <div className="p-4 border-b border-slate-100 flex gap-2 shrink-0 bg-white">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <Input 
                  placeholder="Buscar militar por nome, matrícula..." 
                  value={searchMilitar} 
                  onChange={e => setSearchMilitar(e.target.value)} 
                  className="pl-9 bg-slate-50" 
                />
              </div>
              <div className="w-[260px] shrink-0">
                <Select value={lotacaoAtualFiltro} onValueChange={setLotacaoAtualFiltro}>
                  <SelectTrigger className="bg-slate-50">
                    <SelectValue placeholder="Lotação atual: Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TODAS_LOTACOES_VALUE}>Lotação atual: Todas</SelectItem>
                    <SelectItem value={SEM_LOTACAO_VALUE}>Lotação atual: Sem lotação</SelectItem>
                    {lotacoesAtuaisDisponiveis.map((lotacao) => (
                      <SelectItem key={lotacao} value={lotacao}>
                        {`Lotação atual: ${lotacao}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" onClick={toggleTodos} className="shrink-0 bg-slate-50">
                {militaresFiltrados.every(m => selectedMilitares.includes(m.id)) ? (
                  <><CheckSquare className="w-4 h-4 mr-2" /> Desmarcar todos da busca</>
                ) : (
                  <><Square className="w-4 h-4 mr-2" /> Marcar todos da busca</>
                )}
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-0">
              {loadingMilitares || loadingMatriculas ? (
                <p className="text-center text-slate-400 py-10">Carregando militares...</p>
              ) : militaresFiltrados.length === 0 ? (
                <p className="text-center text-slate-400 py-10">Nenhum militar encontrado com os filtros selecionados.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {militaresFiltrados.map(m => {
                    const isSelected = selectedMilitares.includes(m.id);
                    const matriculaAtual = m.matricula_atual || m.matricula || 'N/I';
                    const lotacaoText = getLotacaoAtualMilitar(m);
                    
                    return (
                      <div 
                        key={m.id} 
                        onClick={() => toggleMilitar(m.id)} 
                        className={`flex justify-between items-center p-3 sm:px-4 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-slate-50'}`}
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-4">
                          {isSelected ? <CheckSquare className="w-5 h-5 text-blue-600 shrink-0" /> : <Square className="w-5 h-5 text-slate-300 shrink-0" />}
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">
                              <span className="text-blue-700/80 mr-1">{m.posto_graduacao}</span>
                              {m.nome_completo}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-xs text-slate-500 font-medium truncate">Mat. {matriculaAtual}</p>
                            </div>
                          </div>
                        </div>
                        <div className="shrink-0 max-w-[40%] text-right bg-slate-50 px-2.5 py-1 rounded border border-slate-100">
                          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mb-0.5">Lotação Atual</p>
                          <p className="text-xs text-slate-700 font-medium truncate" title={lotacaoText}>{lotacaoText}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* BARRA INFERIOR DE AÇÃO */}
            <div className="p-4 bg-white border-t border-slate-200 shrink-0 shadow-[0_-4px_10px_-5px_rgba(0,0,0,0.05)]">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex-1 min-w-0 mr-4">
                  {selectedNode ? (
                    <p className="text-sm text-slate-700 flex items-center gap-2 truncate">
                      Destino: <strong className="text-[#1e3a5f] bg-white px-2 py-0.5 rounded border shadow-sm truncate">{selectedNode.nome}</strong>
                    </p>
                  ) : (
                    <p className="text-sm text-slate-400 italic">Nenhum nó de destino selecionado na árvore.</p>
                  )}
                </div>
                
                <Button 
                  onClick={handleMove} 
                  disabled={moveMutation.isPending || selectedMilitares.length === 0 || !selectedNode}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 shadow-sm"
                >
                  {moveMutation.isPending ? 'Movendo...' : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Mover {selectedMilitares.length} {selectedMilitares.length === 1 ? 'Militar' : 'Militares'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

        </div>
        )}
      </div>
    </div>
  );
}