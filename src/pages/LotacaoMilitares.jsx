import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Search, CheckSquare, Square, Building2, GitMerge, MapPin, ChevronRight, ChevronDown, CheckCircle2 } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { useToast } from "@/components/ui/use-toast";
import {
  enriquecerMilitarComMatriculas,
  filtrarMilitaresOperacionais,
  militarCorrespondeBusca,
  montarIndiceMatriculas,
} from '@/services/matriculaMilitarViewService';

const normalizeTipo = (tipo) => {
  if (tipo === 'Grupamento') return 'Setor';
  if (tipo === 'Subgrupamento') return 'Subsetor';
  if (tipo === 'Unidade') return 'Unidade';
  return 'Subsetor';
};

const SEM_LOTACAO_VALUE = '__sem_lotacao__';
const TODAS_LOTACOES_VALUE = '__todas_lotacoes__';

const formatarLotacaoAtual = (militar) => {
  if (militar.subgrupamento_nome) {
    return `${militar.subgrupamento_nome}${militar.grupamento_nome && militar.grupamento_nome !== militar.subgrupamento_nome ? ` (${militar.grupamento_nome})` : ''}`;
  }
  return militar.grupamento_nome || 'Sem lotação';
};

export default function LotacaoMilitares() {
  const queryClient = useQueryClient();
  const { toast, dismiss } = useToast();
  const { canAccessAction, isLoading: loadingUser, isAccessResolved, canAccessModule } = useCurrentUser();
  const hasLotacaoAccess = canAccessModule('lotacao_militares');

  const [searchMilitar, setSearchMilitar] = useState('');
  const [lotacaoAtualFiltro, setLotacaoAtualFiltro] = useState(TODAS_LOTACOES_VALUE);
  const [selectedMilitares, setSelectedMilitares] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null); // Nó de destino selecionado na árvore
  const [expandedNodes, setExpandedNodes] = useState({});

  const { data: militares = [], isLoading: loadingMilitares } = useQuery({ 
    queryKey: ['militares-ativos'], 
    queryFn: () => base44.entities.Militar.filter({ status_cadastro: 'Ativo' }) 
  });

  const { data: matriculas = [], isLoading: loadingMatriculas } = useQuery({
    queryKey: ['lotacao-matriculas-militar'],
    queryFn: () => base44.entities.MatriculaMilitar.list('-created_date', 10000),
    enabled: hasLotacaoAccess,
  });
  
  const { data: estruturaRaw = [], isLoading: loadingEstrutura } = useQuery({
    queryKey: ['estruturaOrganizacional'],
    queryFn: () => base44.entities.Subgrupamento.list('nome'),
  });

  const estrutura = useMemo(() => {
    return estruturaRaw.map(item => ({ ...item, tipoNormalizado: normalizeTipo(item.tipo) }));
  }, [estruturaRaw]);

  const setores = estrutura.filter(s => s.tipoNormalizado === 'Setor');
  const getFilhos = (parentId, nivelTarget) => estrutura.filter(s => s.grupamento_id === parentId && s.tipoNormalizado === nivelTarget);

  const militaresComMatriculaAtual = useMemo(() => {
    const indiceMatriculas = montarIndiceMatriculas(matriculas);
    return militares.map((m) => enriquecerMilitarComMatriculas(m, indiceMatriculas));
  }, [matriculas, militares]);

  const militaresOperacionais = useMemo(() => {
    return filtrarMilitaresOperacionais(militaresComMatriculaAtual)
      .sort((a, b) => String(a?.nome_completo || '').localeCompare(String(b?.nome_completo || ''), 'pt-BR'));
  }, [militaresComMatriculaAtual]);

  const lotacoesAtuaisDisponiveis = useMemo(() => {
    const lotacoes = new Set();
    militaresOperacionais.forEach((militar) => {
      const lotacaoText = formatarLotacaoAtual(militar);
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
        const lotacaoText = formatarLotacaoAtual(militar);
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
      // Determinar o grupamento e subgrupamento baseado no nível do targetNode
      let updateData = {};
      
      if (targetNode.tipoNormalizado === 'Setor') {
        updateData = { 
          grupamento_id: targetNode.id, 
          grupamento_nome: targetNode.nome, 
          subgrupamento_id: '', 
          subgrupamento_nome: '' 
        };
      } else {
        // É Subsetor ou Unidade. Precisamos achar o Setor pai (Grupamento Nível 1)
        // Como a árvore pode ter 3 níveis, se for Unidade, o grupamento_id aponta pro Subsetor.
        // O ideal é que o banco guarde a cadeia. O backend legado espera grupamento_id = Nível 1.
        let setorPai = targetNode;
        if (targetNode.tipoNormalizado === 'Unidade') {
          const subsetorPaí = estrutura.find(e => e.id === targetNode.grupamento_id);
          if (subsetorPaí) setorPai = estrutura.find(e => e.id === subsetorPaí.grupamento_id) || subsetorPaí;
        } else if (targetNode.tipoNormalizado === 'Subsetor') {
          setorPai = estrutura.find(e => e.id === targetNode.grupamento_id) || targetNode;
        }
        
        // Aqui assumimos que o SGP já lida bem se enviarmos subgrupamento_id com a Unidade ou Subsetor
        updateData = { 
          grupamento_id: setorPai.id, 
          grupamento_nome: setorPai.nome, 
          subgrupamento_id: targetNode.id, 
          subgrupamento_nome: targetNode.nome 
        };
      }

      await Promise.all(militaresIds.map(id => base44.entities.Militar.update(id, updateData)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['militares-ativos'] });
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
                    const lotacaoText = formatarLotacaoAtual(m);
                    
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
      </div>
    </div>
  );
}
