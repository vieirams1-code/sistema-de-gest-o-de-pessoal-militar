import React, { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, Trash2, Plus, Sliders } from 'lucide-react';
import TiposPublicacaoManager from '@/components/configuracoes/TiposPublicacaoManager';
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

export default function Configuracoes() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { canAccessModule, canAccessAction, isLoading: loadingUser, isAccessResolved } = useCurrentUser();
  const hasConfiguracoesAccess = canAccessModule('configuracoes');

  const [novaLotacao, setNovaLotacao] = useState('');
  const [novaFuncao, setNovaFuncao] = useState('');
  const [deleteDialog, setDeleteDialog] = useState({ open: false, type: null, id: null });

  const selectedTab = searchParams.get('tab') || 'adicoes';

  const { data: lotacoes = [] } = useQuery({ queryKey: ['lotacoes'], queryFn: () => base44.entities.Lotacao.list('-created_date'), enabled: isAccessResolved && hasConfiguracoesAccess });
  const { data: funcoes = [] } = useQuery({ queryKey: ['funcoes'], queryFn: () => base44.entities.Funcao.list('-created_date'), enabled: isAccessResolved && hasConfiguracoesAccess });

  const createLotacaoMutation = useMutation({ mutationFn: (nome) => base44.entities.Lotacao.create({ nome, ativa: true }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['lotacoes'] }); setNovaLotacao(''); } });
  const createFuncaoMutation = useMutation({ mutationFn: (nome) => base44.entities.Funcao.create({ nome, ativa: true }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['funcoes'] }); setNovaFuncao(''); } });
  const deleteLotacaoMutation = useMutation({ mutationFn: (id) => base44.entities.Lotacao.delete(id), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['lotacoes'] }); setDeleteDialog({ open: false, type: null, id: null }); } });
  const deleteFuncaoMutation = useMutation({ mutationFn: (id) => base44.entities.Funcao.delete(id), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['funcoes'] }); setDeleteDialog({ open: false, type: null, id: null }); } });

  const handleDelete = () => {
    if (!canAccessAction('gerir_configuracoes')) return;
    if (deleteDialog.type === 'lotacao') deleteLotacaoMutation.mutate(deleteDialog.id);
    else deleteFuncaoMutation.mutate(deleteDialog.id);
  };

  const handleCreateLotacao = () => {
    if (canAccessAction('gerir_configuracoes') && novaLotacao.trim()) {
      createLotacaoMutation.mutate(novaLotacao.trim());
    }
  };

  const handleCreateFuncao = () => {
    if (canAccessAction('gerir_configuracoes') && novaFuncao.trim()) {
      createFuncaoMutation.mutate(novaFuncao.trim());
    }
  };

  if (loadingUser || !isAccessResolved) return null;
  if (!hasConfiguracoesAccess) return <AccessDenied modulo="Configurações" />;

  if (selectedTab === 'adicoes' && !canAccessAction('gerir_configuracoes')) {
    return <AccessDenied modulo="Adições e Personalizações" />;
  }

  if (selectedTab === 'permissoes') {
    return <Navigate to="/PermissoesUsuarios" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Settings className="w-8 h-8 text-[#1e3a5f]" />
          <div>
            <h1 className="text-3xl font-bold text-[#1e3a5f]">Configurações Gerais</h1>
            <p className="text-slate-500">Gerencie lotações de trabalho, funções e personalizações avançadas do sistema</p>
          </div>
        </div>

        <div className="flex gap-2 mb-6 border-b border-slate-200">
          <div className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 border-[#1e3a5f] text-[#1e3a5f] -mb-px">
            <Sliders className="w-4 h-4" />
            Adições e Personalizações
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-semibold text-[#1e3a5f] mb-4">Lotações / Setores Operacionais</h2>
            <div className="flex gap-2 mb-6">
              <Input value={novaLotacao} onChange={(e) => setNovaLotacao(e.target.value)} placeholder="Nova lotação..." onKeyDown={(e) => { if (e.key === 'Enter' && canAccessAction('gerir_configuracoes')) handleCreateLotacao(); }} disabled={!canAccessAction('gerir_configuracoes')} />
              <Button onClick={handleCreateLotacao} disabled={!novaLotacao.trim() || !canAccessAction('gerir_configuracoes')} className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white">
                <Plus className="w-4 h-4 mr-2" /> Adicionar
              </Button>
            </div>
            <div className="space-y-2">
              {lotacoes.map((lot) => (
                <div key={lot.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                  <span className="font-medium">{lot.nome}</span>
                  {canAccessAction('gerir_configuracoes') && (
                    <Button variant="ghost" size="icon" onClick={() => setDeleteDialog({ open: true, type: 'lotacao', id: lot.id })} className="text-red-600 hover:text-red-700 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                  )}
                </div>
              ))}
              {lotacoes.length === 0 && <p className="text-center text-slate-500 py-8">Nenhuma lotação cadastrada</p>}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-semibold text-[#1e3a5f] mb-4">Funções</h2>
            <div className="flex gap-2 mb-6">
              <Input value={novaFuncao} onChange={(e) => setNovaFuncao(e.target.value)} placeholder="Nova função..." onKeyDown={(e) => { if (e.key === 'Enter' && canAccessAction('gerir_configuracoes')) handleCreateFuncao(); }} disabled={!canAccessAction('gerir_configuracoes')} />
              <Button onClick={handleCreateFuncao} disabled={!novaFuncao.trim() || !canAccessAction('gerir_configuracoes')} className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white">
                <Plus className="w-4 h-4 mr-2" /> Adicionar
              </Button>
            </div>
            <div className="space-y-2">
              {funcoes.map((func) => (
                <div key={func.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                  <span className="font-medium">{func.nome}</span>
                  {canAccessAction('gerir_configuracoes') && (
                    <Button variant="ghost" size="icon" onClick={() => setDeleteDialog({ open: true, type: 'funcao', id: func.id })} className="text-red-600 hover:text-red-700 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                  )}
                </div>
              ))}
              {funcoes.length === 0 && <p className="text-center text-slate-500 py-8">Nenhuma função cadastrada</p>}
            </div>
          </div>

          <TiposPublicacaoManager />
        </div>

        <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir esta {deleteDialog.type === 'lotacao' ? 'lotação' : 'função'}? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
