import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Pencil, Trash2, Building2, Check, X, ChevronRight, ChevronDown, GitMerge, GitBranch, MapPin } from 'lucide-react';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const TIPO_CONFIG = {
  'Setor': { icone: Building2, cor: 'text-blue-700', bgIcone: 'bg-blue-100', bgCard: 'bg-white', label: 'Setor (Nível 1)' },
  'Subsetor': { icone: GitMerge, cor: 'text-indigo-600', bgIcone: 'bg-indigo-50', bgCard: 'bg-slate-50', label: 'Subsetor (Nível 2)' },
  'Unidade': { icone: MapPin, cor: 'text-emerald-600', bgIcone: 'bg-emerald-50', bgCard: 'bg-slate-50/50', label: 'Unidade (Nível 3)' }
};

// Aliases para fallback caso ainda existam dados com 'Grupamento' ou 'Subgrupamento'
const normalizeTipo = (tipo) => {
  if (tipo === 'Grupamento') return 'Setor';
  if (tipo === 'Subgrupamento') return 'Subsetor';
  if (tipo === 'Unidade') return 'Unidade';
  return 'Subsetor'; // default
};

export default function EstruturaOrganizacional() {
  const queryClient = useQueryClient();
  const { canAccessAction, isLoading: loadingUser, isAccessResolved, canAccessModule } = useCurrentUser();
  const hasMilitaresAccess = canAccessModule('militares');

  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [showNew, setShowNew] = useState(false);
  const [newData, setNewData] = useState({ nome: '', sigla: '', descricao: '', tipo: 'Setor', grupamento_id: '' });
  const [expandedNodes, setExpandedNodes] = useState({});
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null });

  const { data: todos = [], isLoading } = useQuery({
    queryKey: ['estruturaOrganizacional'],
    queryFn: () => base44.entities.Subgrupamento.list('nome'),
  });

  const estrutura = useMemo(() => {
    return todos.map(item => ({ ...item, tipoNormalizado: normalizeTipo(item.tipo) }));
  }, [todos]);

  if (loadingUser || !isAccessResolved) return null;
  if (!hasMilitaresAccess) return <AccessDenied modulo="Efetivo" />;
  if (!canAccessAction('gerir_estrutura')) {
    return <AccessDenied modulo="Estrutura Organizacional" />;
  }

  const setores = estrutura.filter(s => s.tipoNormalizado === 'Setor');
  const subsetores = estrutura.filter(s => s.tipoNormalizado === 'Subsetor');
  const unidades = estrutura.filter(s => s.tipoNormalizado === 'Unidade');

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Subgrupamento.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estruturaOrganizacional'] });
      setNewData({ nome: '', sigla: '', descricao: '', tipo: 'Setor', grupamento_id: '' });
      setShowNew(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Subgrupamento.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estruturaOrganizacional'] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Subgrupamento.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estruturaOrganizacional'] });
      setDeleteDialog({ open: false, id: null });
    },
  });

  const startEdit = (s) => {
    setEditingId(s.id);
    setEditData({ nome: s.nome, sigla: s.sigla || '', descricao: s.descricao || '', tipo: normalizeTipo(s.tipo), grupamento_id: s.grupamento_id || '' });
  };

  const saveEdit = (id) => {
    const parent = estrutura.find(g => g.id === editData.grupamento_id);
    updateMutation.mutate({
      id,
      data: {
        ...editData,
        grupamento_nome: parent?.nome || '', // Mapeando parent para manter retrocompatibilidade
      }
    });
  };

  const handleCreate = () => {
    const parent = estrutura.find(g => g.id === newData.grupamento_id);
    createMutation.mutate({
      ...newData,
      ativo: true,
      grupamento_nome: parent?.nome || '',
    });
  };

  const toggleExpand = (id) => {
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDelete = () => {
    if (deleteDialog.id) deleteMutation.mutate(deleteDialog.id);
  };

  const getFilhos = (parentId, nivelTarget) => 
    estrutura.filter(s => s.grupamento_id === parentId && s.tipoNormalizado === nivelTarget);

  const getParentOptions = (tipoFilho) => {
    if (tipoFilho === 'Subsetor') return setores; // Subsetor -> Pai é Setor
    if (tipoFilho === 'Unidade') return subsetores; // Unidade -> Pai é Subsetor
    return []; // Setor não tem pai
  };

  const renderEditForm = (data, setData, parentOptions, onSave, onCancel) => (
    <div className="bg-white border-2 border-indigo-200 rounded-xl p-4 shadow-sm my-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <Input placeholder="Nome *" value={data.nome} onChange={e => setData(d => ({ ...d, nome: e.target.value }))} className="bg-slate-50" />
        <Input placeholder="Sigla" value={data.sigla} onChange={e => setData(d => ({ ...d, sigla: e.target.value }))} className="bg-slate-50" />
        <Input placeholder="Descrição" value={data.descricao} onChange={e => setData(d => ({ ...d, descricao: e.target.value }))} className="col-span-1 md:col-span-2 bg-slate-50" />
        
        {data.tipo !== 'Setor' && (
          <div className="col-span-1 md:col-span-2 mt-2">
            <label className="text-xs font-semibold text-slate-600 block mb-1">Unidade Pai ({data.tipo === 'Subsetor' ? 'Vincular a um Setor' : 'Vincular a um Subsetor'}) *</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none"
              value={data.grupamento_id}
              onChange={e => setData(d => ({ ...d, grupamento_id: e.target.value }))}
            >
              <option value="">Selecione o Pai...</option>
              {parentOptions.map(p => (
                <option key={p.id} value={p.id}>{p.nome} {p.sigla && `(${p.sigla})`}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="flex gap-2 justify-end mt-2">
        <Button variant="outline" size="sm" onClick={onCancel}><X className="w-4 h-4 mr-1" /> Cancelar</Button>
        <Button size="sm" className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white" disabled={!data.nome || (data.tipo !== 'Setor' && !data.grupamento_id)} onClick={onSave}><Check className="w-4 h-4 mr-1" /> Salvar</Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center">
              <GitBranch className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#1e3a5f]">Estrutura Organizacional</h1>
              <p className="text-sm text-slate-500">Árvore hierárquica em 3 níveis (Setor {'>'} Subsetor {'>'} Unidade)</p>
            </div>
          </div>
          <Button onClick={() => setShowNew(true)} className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white shadow-sm">
            <Plus className="w-4 h-4 mr-2" /> Nova Unidade
          </Button>
        </div>

        {/* Formulário de Criação Global */}
        {showNew && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6 shadow-sm ring-1 ring-[#1e3a5f]/5">
            <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-500" /> Cadastrar Novo Nó na Estrutura
            </h2>
            
            <div className="mb-4">
              <label className="text-xs font-semibold text-slate-600 block mb-2 uppercase tracking-wide">Nível Hierárquico *</label>
              <div className="flex flex-col sm:flex-row gap-2">
                {['Setor', 'Subsetor', 'Unidade'].map(tipo => {
                  const isSelected = newData.tipo === tipo;
                  const Cfg = TIPO_CONFIG[tipo];
                  const Icon = Cfg.icone;
                  return (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => setNewData(d => ({ ...d, tipo, grupamento_id: '' }))}
                      className={`flex-1 py-3 px-4 rounded-xl border flex items-center gap-3 transition-all ${isSelected ? 'bg-[#1e3a5f] border-[#1e3a5f] text-white shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                    >
                      <div className={`p-1.5 rounded-md ${isSelected ? 'bg-white/20' : Cfg.bgIcone} ${isSelected ? 'text-white' : Cfg.cor}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold leading-tight">{tipo}</p>
                        <p className={`text-[10px] ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                          {tipo === 'Setor' ? 'Nível 1' : tipo === 'Subsetor' ? 'Nível 2' : 'Nível 3'}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {renderEditForm(newData, setNewData, getParentOptions(newData.tipo), handleCreate, () => setShowNew(false))}
          </div>
        )}

        {/* Árvore Hierárquica */}
        {isLoading ? (
          <div className="flex justify-center p-12">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
        ) : setores.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-700">Estrutura Vazia</h3>
            <p className="text-slate-500 mb-6">Nenhum Setor de Nível 1 cadastrado ainda.</p>
            <Button onClick={() => setShowNew(true)} className="bg-[#1e3a5f] text-white">Criar Primeiro Setor</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {setores.map(setor => {
              const mySubsetores = getFilhos(setor.id, 'Subsetor');
              const expandedSetor = expandedNodes[setor.id] !== false; // Expande os setores primários por padrão
              
              const CfgSetor = TIPO_CONFIG['Setor'];
              const IconSetor = CfgSetor.icone;

              return (
                <div key={setor.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden transition-all hover:shadow-md">
                  {editingId === setor.id ? (
                    <div className="p-2 bg-slate-50 border-b border-slate-100">
                      {renderEditForm(editData, setEditData, [], () => saveEdit(setor.id), () => setEditingId(null))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-4 bg-white border-b border-slate-100 group relative">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>
                      <div className="flex items-center gap-3 ml-2">
                        <button onClick={() => toggleExpand(setor.id)} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-500 transition-colors">
                          {expandedSetor ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                        </button>
                        <div className={`w-10 h-10 rounded-lg ${CfgSetor.bgIcone} flex items-center justify-center shrink-0`}>
                          <IconSetor className={`w-5 h-5 ${CfgSetor.cor}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="font-bold text-slate-800 text-lg">{setor.nome}</h2>
                            {setor.sigla && <span className="text-sm font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{setor.sigla}</span>}
                          </div>
                          {setor.descricao && <p className="text-xs text-slate-500 mt-0.5">{setor.descricao}</p>}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">{mySubsetores.length} subsetores</span>
                        <div className="flex gap-1 opacity-20 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" onClick={() => startEdit(setor)} className="h-8 w-8 text-slate-500 hover:text-[#1e3a5f]"><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteDialog({ open: true, id: setor.id })} className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* NÍVEL 2 - SUBSETORES */}
                  {expandedSetor && mySubsetores.length > 0 && (
                    <div className="bg-slate-50/50 pb-2">
                      {mySubsetores.map(sub => {
                        const myUnidades = getFilhos(sub.id, 'Unidade');
                        const expandedSub = expandedNodes[sub.id]; // Subsetores colapsados por padrão
                        const CfgSub = TIPO_CONFIG['Subsetor'];
                        const IconSub = CfgSub.icone;

                        return (
                          <div key={sub.id} className="relative">
                            {/* Linha de conexão do setor pro subsetor */}
                            <div className="absolute left-8 top-0 bottom-0 w-[2px] bg-slate-200"></div>
                            
                            {editingId === sub.id ? (
                              <div className="ml-14 mr-4 mt-2">
                                {renderEditForm(editData, setEditData, getParentOptions('Subsetor'), () => saveEdit(sub.id), () => setEditingId(null))}
                              </div>
                            ) : (
                              <div className="flex items-center justify-between ml-14 mr-4 mt-2 p-3 bg-white border border-slate-200 rounded-lg shadow-sm group">
                                <div className="absolute -left-6 top-6 w-6 h-[2px] bg-slate-200"></div>

                                <div className="flex items-center gap-3">
                                  {myUnidades.length > 0 ? (
                                    <button onClick={() => toggleExpand(sub.id)} className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-500">
                                      {expandedSub ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                    </button>
                                  ) : <div className="w-5 h-5"></div>}
                                  
                                  <div className={`w-8 h-8 rounded-md ${CfgSub.bgIcone} flex items-center justify-center shrink-0`}>
                                    <IconSub className={`w-4 h-4 ${CfgSub.cor}`} />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h3 className="font-semibold text-slate-700">{sub.nome}</h3>
                                      {sub.sigla && <span className="text-xs font-medium text-slate-400">({sub.sigla})</span>}
                                    </div>
                                    {sub.descricao && <p className="text-[10px] text-slate-500 line-clamp-1 truncate max-w-sm">{sub.descricao}</p>}
                                  </div>
                                </div>

                                <div className="flex items-center gap-3">
                                  {myUnidades.length > 0 && <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">{myUnidades.length} uni.</span>}
                                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="icon" onClick={() => startEdit(sub)} className="h-7 w-7 text-slate-400 hover:text-indigo-600"><Pencil className="w-3.5 h-3.5" /></Button>
                                    <Button variant="ghost" size="icon" onClick={() => setDeleteDialog({ open: true, id: sub.id })} className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></Button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* NÍVEL 3 - UNIDADES */}
                            {expandedSub && myUnidades.length > 0 && (
                              <div className="relative mt-2">
                                {/* Linha de conexão do subsetor pra unidade */}
                                <div className="absolute left-20 top-0 bottom-0 w-[2px] bg-slate-100"></div>
                                
                                {myUnidades.map(uni => {
                                  const CfgUni = TIPO_CONFIG['Unidade'];
                                  const IconUni = CfgUni.icone;

                                  return (
                                    <div key={uni.id} className="relative">
                                      {editingId === uni.id ? (
                                        <div className="ml-28 mr-4 mb-2">
                                          {renderEditForm(editData, setEditData, getParentOptions('Unidade'), () => saveEdit(uni.id), () => setEditingId(null))}
                                        </div>
                                      ) : (
                                        <div className="flex items-center justify-between ml-28 mr-4 mb-2 p-2.5 bg-slate-50 border border-slate-100 rounded-lg group hover:border-emerald-200 transition-colors">
                                          <div className="absolute -left-8 top-5 w-8 h-[2px] bg-slate-100"></div>

                                          <div className="flex items-center gap-3">
                                            <div className={`w-7 h-7 rounded-md ${CfgUni.bgIcone} flex items-center justify-center shrink-0`}>
                                              <IconUni className={`w-3.5 h-3.5 ${CfgUni.cor}`} />
                                            </div>
                                            <div>
                                              <p className="font-medium text-sm text-slate-600">{uni.nome} {uni.sigla && <span className="text-xs text-slate-400 ml-1">({uni.sigla})</span>}</p>
                                            </div>
                                          </div>

                                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" onClick={() => startEdit(uni)} className="h-6 w-6 text-slate-400 hover:text-emerald-600"><Pencil className="w-3 h-3" /></Button>
                                            <Button variant="ghost" size="icon" onClick={() => setDeleteDialog({ open: true, id: uni.id })} className="h-6 w-6 text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-3 h-3" /></Button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {expandedSetor && mySubsetores.length === 0 && editingId !== setor.id && (
                    <div className="p-4 bg-slate-50 text-center border-t border-slate-100">
                      <p className="text-xs font-medium text-slate-400">Nenhum subsetor atrelado a este Setor</p>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Órfãos / Mal formatados (Caso o banco venha sujo) */}
            {estrutura.filter(e => e.tipoNormalizado === 'Subsetor' && !e.grupamento_id).length > 0 && (
              <div className="mt-8 pt-4 border-t-2 border-dashed border-red-200">
                <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-3">⚠️ Subsetores Órfãos (Sem Setor Pai)</p>
                <div className="space-y-2">
                  {estrutura.filter(e => e.tipoNormalizado === 'Subsetor' && !e.grupamento_id).map(sub => (
                    <div key={sub.id} className="bg-red-50 border border-red-100 p-3 rounded-lg flex items-center justify-between">
                       {editingId === sub.id ? (
                        <div className="w-full">{renderEditForm(editData, setEditData, getParentOptions('Subsetor'), () => saveEdit(sub.id), () => setEditingId(null))}</div>
                       ) : (
                         <>
                           <div className="flex items-center gap-2 text-red-700">
                             <GitMerge className="w-4 h-4" />
                             <span className="font-semibold">{sub.nome}</span>
                           </div>
                           <div className="flex gap-1">
                             <Button variant="ghost" size="icon" onClick={() => startEdit(sub)} className="h-7 w-7 text-red-500 hover:bg-red-100"><Pencil className="w-3.5 h-3.5" /></Button>
                             <Button variant="ghost" size="icon" onClick={() => setDeleteDialog({ open: true, id: sub.id })} className="h-7 w-7 text-red-500 hover:bg-red-100"><Trash2 className="w-3.5 h-3.5" /></Button>
                           </div>
                         </>
                       )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal de Exclusão */}
        <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmação de Exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir esta unidade organizacional? Nós filhos (se houverem) deverão ser realocados. Esta ação não poderá ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">Sim, excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </div>
  );
}