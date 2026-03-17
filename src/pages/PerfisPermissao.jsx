import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";

const modulosList = [
  { key: 'acesso_militares', label: 'Militares' },
  { key: 'acesso_ferias', label: 'Férias' },
  { key: 'acesso_livro', label: 'Livro' },
  { key: 'acesso_publicacoes', label: 'Publicações' },
  { key: 'acesso_atestados', label: 'Atestados' },
  { key: 'acesso_armamentos', label: 'Armamentos' },
  { key: 'acesso_medalhas', label: 'Medalhas' },
  { key: 'acesso_templates', label: 'Templates' },
  { key: 'acesso_configuracoes', label: 'Configurações' },
  { key: 'acesso_quadro_operacional', label: 'Quadro Operacional' }
];

const acoesSensiveis = [
  { key: 'perm_admin_mode', label: 'Pode Ativar Modo Admin' },
  { key: 'perm_gerir_cadeia_ferias', label: 'Gerir Cadeia de Férias' },
  { key: 'perm_excluir_ferias', label: 'Excluir Férias' },
  { key: 'perm_recalcular_ferias', label: 'Recalcular Férias' },
  { key: 'perm_gerir_templates', label: 'Gerir Templates' },
  { key: 'perm_gerir_permissoes', label: 'Gerir Permissões' },
  { key: 'perm_gerir_estrutura', label: 'Gerir Estrutura Org.' },
  { key: 'perm_gerir_configuracoes', label: 'Gerir Configurações' },
  { key: 'perm_editar_publicacoes', label: 'Editar Publicações' },
  { key: 'perm_publicar_bg', label: 'Publicar em BG' },
  { key: 'perm_tornar_sem_efeito_publicacao', label: 'Tornar s/ Efeito Pub.' },
  { key: 'perm_apostilar_publicacao', label: 'Apostilar Pub.' },
  { key: 'perm_publicar_ata_jiso', label: 'Publicar Ata JISO' },
  { key: 'perm_publicar_homologacao', label: 'Publicar Homologação' },
  { key: 'perm_gerir_jiso', label: 'Gerir JISO' },
  { key: 'perm_registrar_decisao_jiso', label: 'Registrar Decisão JISO' },
  { key: 'perm_excluir_atestado', label: 'Excluir Atestado' },
  { key: 'perm_gerir_quadro', label: 'Gerir Quadro Op.' },
  { key: 'perm_mover_card', label: 'Mover Card' },
  { key: 'perm_gerir_colunas', label: 'Gerir Colunas Quadro' },
  { key: 'perm_arquivar_card', label: 'Arquivar Card' },
  { key: 'perm_gerir_acoes_operacionais', label: 'Gerir Ações Op.' },
  { key: 'perm_excluir_acao_operacional', label: 'Excluir Ação Op.' },
  { key: 'perm_criar_processo', label: 'Criar Processo' },
  { key: 'perm_editar_processo', label: 'Editar Processo' },
  { key: 'perm_excluir_processo', label: 'Excluir Processo' }
];

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

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PerfilPermissao.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['perfisPermissao'] });
      closeForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PerfilPermissao.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['perfisPermissao'] });
      closeForm();
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

  const handleEdit = (p) => {
    setFormData({
      nome_perfil: p.nome_perfil || '',
      descricao: p.descricao || '',
      ativo: p.ativo !== false,
      ...modulosList.reduce((acc, m) => ({ ...acc, [m.key]: p[m.key] === true }), {}),
      ...acoesSensiveis.reduce((acc, a) => ({ ...acc, [a.key]: p[a.key] === true }), {})
    });
    setEditingId(p.id);
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
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
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

              <div className="border-t border-slate-100 pt-6">
                <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  Módulos Permitidos
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {modulosList.map(mod => (
                    <div key={mod.key} className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 hover:border-blue-300 transition-colors cursor-pointer" onClick={() => setFormData(d => ({ ...d, [mod.key]: !d[mod.key] }))}>
                      <input 
                        type="checkbox" 
                        id={`m_${mod.key}`}
                        checked={formData[mod.key]}
                        readOnly
                        className="rounded border-slate-300 w-4 h-4 text-blue-600 pointer-events-none"
                      />
                      <label className="text-sm font-medium text-slate-700 pointer-events-none">{mod.label}</label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-6">
                <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                  Ações Sensíveis
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {acoesSensiveis.map(act => (
                    <div key={act.key} className="flex items-center gap-3 bg-orange-50/30 p-3 rounded-lg border border-orange-100 hover:border-orange-300 transition-colors cursor-pointer" onClick={() => setFormData(d => ({ ...d, [act.key]: !d[act.key] }))}>
                      <input 
                        type="checkbox" 
                        id={`a_${act.key}`}
                        checked={formData[act.key]}
                        readOnly
                        className="rounded border-orange-300 w-4 h-4 text-orange-600 pointer-events-none"
                      />
                      <label className="text-sm font-medium text-orange-900 pointer-events-none">{act.label}</label>
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
