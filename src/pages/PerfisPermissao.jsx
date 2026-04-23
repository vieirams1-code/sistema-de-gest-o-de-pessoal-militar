import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { permissionStructure, modulosList, acoesSensiveis } from '@/config/permissionStructure';
import {
  buildPermissionPayload,
  buildPermissionsFromSource,
  getPermissionMismatches,
  resolveProfilePermissionsWithSnapshot,
  upsertProfileSnapshot,
} from '@/services/permissionMatrixService';
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
import { Textarea } from "@/components/ui/textarea";

const initialForm = {
  nome_perfil: '',
  descricao: '',
  ativo: true,
  ...modulosList.reduce((acc, m) => ({ ...acc, [m.key]: false }), {}),
  ...acoesSensiveis.reduce((acc, a) => ({ ...acc, [a.key]: false }), {})
};

export default function PerfisPermissao() {
  const queryClient = useQueryClient();
  const { canAccessAction, isLoading: loadingUser } = useCurrentUser();
  
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(initialForm);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null });

  const { data: perfis = [], isLoading } = useQuery({
    queryKey: ['perfisPermissao'],
    queryFn: () => base44.entities.PerfilPermissao.list('nome_perfil'),
  });

  const ensurePersistedProfilePermissions = async (expectedPermissions, persistedPerfil) => {
    const { permissions: persistedResolved } = await resolveProfilePermissionsWithSnapshot({
      base44,
      profileSource: persistedPerfil || {},
    });
    const mismatches = getPermissionMismatches(expectedPermissions, persistedResolved || {});
    if (mismatches.length > 0) {
      throw new Error(`Falha de persistência de permissões: ${mismatches.join(', ')}`);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const saved = await base44.entities.PerfilPermissao.create(data);
      await upsertProfileSnapshot({
        base44,
        perfilId: saved.id,
        matrizPermissoes: data.matriz_permissoes || data,
        updatedBy: data.updated_by || '',
      });
      const reloaded = await base44.entities.PerfilPermissao.get(saved.id);
      await ensurePersistedProfilePermissions(data.matriz_permissoes || data, reloaded);
      return reloaded;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['perfisPermissao'] });
      closeForm();
    },
    onError: (error) => {
      alert(error?.message || 'Erro ao salvar perfil de permissão.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      await base44.entities.PerfilPermissao.update(id, data);
      await upsertProfileSnapshot({
        base44,
        perfilId: id,
        matrizPermissoes: data.matriz_permissoes || data,
        updatedBy: data.updated_by || '',
      });
      const reloaded = await base44.entities.PerfilPermissao.get(id);
      await ensurePersistedProfilePermissions(data.matriz_permissoes || data, reloaded);
      return reloaded;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['perfisPermissao'] });
      closeForm();
    },
    onError: (error) => {
      alert(error?.message || 'Erro ao atualizar perfil de permissão.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PerfilPermissao.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['perfisPermissao'] });
      setDeleteDialog({ open: false, id: null });
    },
  });

  if (loadingUser) return null;
  if (!canAccessAction('gerir_permissoes')) {
    return <AccessDenied modulo="Perfis de Permissão" />;
  }

  const handleCreateNew = () => {
    setFormData(initialForm);
    setEditingId(null);
    setShowForm(true);
  };

  const handleEdit = async (p) => {
    let fullPerfil = p;
    try {
      fullPerfil = await base44.entities.PerfilPermissao.get(p.id);
    } catch {
      // fallback para registro parcial da listagem
    }

    const { permissions: resolvedPermissions, snapshot } = await resolveProfilePermissionsWithSnapshot({
      base44,
      profileSource: fullPerfil,
    });
    if (!snapshot && fullPerfil?.id) {
      await upsertProfileSnapshot({
        base44,
        perfilId: fullPerfil.id,
        matrizPermissoes: resolvedPermissions,
      });
    }

    setFormData({
      nome_perfil: fullPerfil.nome_perfil || '',
      descricao: fullPerfil.descricao || '',
      ativo: fullPerfil.ativo !== false,
      ...buildPermissionsFromSource(resolvedPermissions)
    });
    setEditingId(fullPerfil.id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
  };

  const handleSave = () => {
    if (!formData.nome_perfil.trim()) return;
    // Revalidação explícita no handler
    if (!canAccessAction('gerir_permissoes')) {
      alert('Ação negada: você não tem permissão para salvar perfis de permissão.');
      return;
    }
    const normalizedPermissions = buildPermissionsFromSource(formData);
    const payload = {
      ...formData,
      ...buildPermissionPayload(normalizedPermissions),
      matriz_permissoes: normalizedPermissions,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = () => {
    // Revalidação explícita no handler
    if (!canAccessAction('gerir_permissoes')) {
      alert('Ação negada: você não tem permissão para excluir perfis de permissão.');
      setDeleteDialog({ open: false, id: null });
      return;
    }
    if (deleteDialog.id) {
      deleteMutation.mutate(deleteDialog.id);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#1e3a5f]">Perfis de Permissão</h1>
              <p className="text-sm text-slate-500">Gerencie modelos padronizados de acessos e ações no sistema</p>
            </div>
          </div>
          {!showForm && (
            <Button onClick={handleCreateNew} className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white">
              <Plus className="w-4 h-4 mr-2" /> Novo Perfil
            </Button>
          )}
        </div>

        {showForm ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#1e3a5f]">
                {editingId ? 'Editando Perfil' : 'Criar Novo Perfil'}
              </h2>
              <Button variant="ghost" size="sm" onClick={closeForm}><X className="w-5 h-5" /></Button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-slate-800 block mb-1.5">Nome do Perfil <span className="text-red-500">*</span></label>
                  <Input 
                    value={formData.nome_perfil} 
                    onChange={e => setFormData(d => ({ ...d, nome_perfil: e.target.value }))} 
                    placeholder="Ex: Gestor de Pessoal, Assistente, etc." 
                  />
                </div>
                <div className="flex items-center gap-2 mt-7">
                  <input 
                    type="checkbox" 
                    id="perfAtivo" 
                    checked={formData.ativo} 
                    onChange={e => setFormData(d => ({ ...d, ativo: e.target.checked }))} 
                    className="rounded border-slate-300 w-5 h-5 text-indigo-600" 
                  />
                  <label htmlFor="perfAtivo" className="text-sm font-semibold text-slate-800 cursor-pointer">Perfil Ativo</label>
                </div>
                <div className="col-span-1 md:col-span-2">
                  <label className="text-sm font-semibold text-slate-800 block mb-1.5">Descrição</label>
                  <Textarea 
                    value={formData.descricao} 
                    onChange={e => setFormData(d => ({ ...d, descricao: e.target.value }))} 
                    placeholder="Para que serve este perfil?" 
                    rows={2}
                  />
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-5">
                <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                  Matriz de Permissões por Categoria e Módulo
                </h3>
                <div className="space-y-4">
                  {permissionStructure.map((categoryGroup) => (
                    <div key={categoryGroup.category} className="bg-white p-4 rounded-lg border border-slate-200">
                      <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">{categoryGroup.category}</h4>
                      <div className="space-y-3">
                        {categoryGroup.modules.map((mod) => {
                          const isModuleEnabled = formData[mod.key] === true;

                          return (
                            <div key={mod.key} className={`rounded-lg border ${isModuleEnabled ? 'border-blue-200 bg-blue-50/40' : 'border-slate-200 bg-slate-50'}`}>
                              <div
                                className="p-3 flex flex-wrap items-center gap-2 justify-between cursor-pointer"
                                onClick={() => setFormData((prev) => ({ ...prev, [mod.key]: !prev[mod.key] }))}
                              >
                                <div className="flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    checked={isModuleEnabled}
                                    readOnly
                                    className="rounded border-slate-300 w-4 h-4 text-blue-600 pointer-events-none"
                                  />
                                  <label className="text-sm font-semibold text-slate-800 pointer-events-none">{mod.label}</label>
                                </div>
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isModuleEnabled ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'}`}>
                                  {isModuleEnabled ? 'Ativo' : 'Inativo'}
                                </span>
                              </div>

                              {mod.actions.length > 0 && isModuleEnabled && (
                                <div className="px-3 pb-3">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 border-t border-blue-100 pt-3">
                                    {mod.actions.map((act) => {
                                      const isActionEnabled = formData[act.key] === true;

                                      return (
                                        <div
                                          key={act.key}
                                          className={`flex items-center justify-between gap-3 p-2 rounded-md border cursor-pointer ${isActionEnabled ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-200'} ${act.sensitive ? 'ring-1 ring-orange-100' : ''}`}
                                          onClick={() => setFormData((prev) => ({ ...prev, [act.key]: !prev[act.key] }))}
                                        >
                                          <div className="flex items-center gap-2">
                                            <input
                                              type="checkbox"
                                              checked={isActionEnabled}
                                              readOnly
                                              className="rounded border-orange-300 w-4 h-4 text-orange-600 pointer-events-none"
                                            />
                                            <span className="text-sm text-slate-700">{act.label}</span>
                                          </div>

                                          {act.sensitive && (
                                            <span className="text-[10px] font-bold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded">Sensível</span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-6 flex justify-end gap-3">
                <Button variant="outline" onClick={closeForm}>Cancelar</Button>
                <Button 
                  onClick={handleSave} 
                  disabled={!formData.nome_perfil.trim() || createMutation.isPending || updateMutation.isPending}
                  className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white px-6"
                >
                  <Check className="w-4 h-4 mr-2" />
                  {createMutation.isPending || updateMutation.isPending ? 'Salvando...' : 'Salvar Perfil'}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {isLoading ? (
              <div className="flex justify-center p-12">
                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
              </div>
            ) : perfis.length === 0 ? (
              <div className="text-center py-16 px-4">
                <Shield className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-1">Nenhum perfil encontrado</h3>
                <p className="text-slate-500 mb-6">Crie perfis de permissão para aplicá-los facilmente aos usuários.</p>
                <Button onClick={handleCreateNew} className="bg-[#1e3a5f] text-white">Criar Primeiro Perfil</Button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {perfis.map(p => {
                  const modsAcessiveis = modulosList.filter(m => p[m.key]).length;
                  const actsAcessiveis = acoesSensiveis.filter(a => p[a.key]).length;

                  return (
                    <div key={p.id} className="p-5 flex items-start sm:items-center justify-between flex-col sm:flex-row gap-4 hover:bg-slate-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-bold text-slate-800 text-lg">{p.nome_perfil}</h3>
                          {!p.ativo && <Badge variant="destructive" className="text-[10px] uppercase">Inativo</Badge>}
                        </div>
                        {p.descricao && <p className="text-sm text-slate-500 mb-2 truncate">{p.descricao}</p>}
                        
                        <div className="flex gap-2 text-xs font-medium">
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{modsAcessiveis} {modsAcessiveis === 1 ? 'módulo' : 'módulos'}</Badge>
                          {actsAcessiveis > 0 && <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">{actsAcessiveis} ações críticas</Badge>}
                        </div>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto shrink-0 border-t sm:border-0 pt-3 sm:pt-0">
                        <Button variant="outline" size="sm" className="w-full sm:w-auto bg-white" onClick={() => handleEdit(p)}>
                          <Pencil className="w-4 h-4 mr-1 sm:mr-0" /> <span className="sm:hidden">Editar</span>
                        </Button>
                        <Button variant="outline" size="sm" className="w-full sm:w-auto text-red-600 hover:text-red-700 hover:bg-red-50 bg-white" onClick={() => setDeleteDialog({ open: true, id: p.id })}>
                          <Trash2 className="w-4 h-4 mr-1 sm:mr-0" /> <span className="sm:hidden">Excluir</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Perfil</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este perfil? Os usuários que já possuem este perfil aplicado não terão suas permissões afetadas, mas não será mais possível selecionar este perfil.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
                {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
