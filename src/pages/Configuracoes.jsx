import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, Trash2, Plus, Crown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [novaLotacao, setNovaLotacao] = useState('');
  const [novaFuncao, setNovaFuncao] = useState('');
  const [deleteDialog, setDeleteDialog] = useState({ open: false, type: null, id: null });

  const { data: lotacoes = [] } = useQuery({
    queryKey: ['lotacoes'],
    queryFn: () => base44.entities.Lotacao.list('-created_date')
  });

  const { data: funcoes = [] } = useQuery({
    queryKey: ['funcoes'],
    queryFn: () => base44.entities.Funcao.list('-created_date')
  });

  const { data: militares = [] } = useQuery({
    queryKey: ['militares-ativos'],
    queryFn: () => base44.entities.Militar.filter({ status_cadastro: 'Ativo' })
  });

  const { data: configs = [] } = useQuery({
    queryKey: ['config-unidade'],
    queryFn: () => base44.entities.ConfiguracaoUnidade.list()
  });

  const comandanteConfig = configs.find(c => c.chave === 'comandante_id');
  const comandanteId = comandanteConfig?.valor || '';

  const saveComandanteMutation = useMutation({
    mutationFn: async (militarId) => {
      if (comandanteConfig) {
        await base44.entities.ConfiguracaoUnidade.update(comandanteConfig.id, { valor: militarId });
      } else {
        await base44.entities.ConfiguracaoUnidade.create({ chave: 'comandante_id', valor: militarId, descricao: 'ID do Comandante da Unidade' });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['config-unidade'] })
  });

  const createLotacaoMutation = useMutation({
    mutationFn: (nome) => base44.entities.Lotacao.create({ nome, ativa: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lotacoes'] });
      setNovaLotacao('');
    }
  });

  const createFuncaoMutation = useMutation({
    mutationFn: (nome) => base44.entities.Funcao.create({ nome, ativa: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funcoes'] });
      setNovaFuncao('');
    }
  });

  const deleteLotacaoMutation = useMutation({
    mutationFn: (id) => base44.entities.Lotacao.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lotacoes'] });
      setDeleteDialog({ open: false, type: null, id: null });
    }
  });

  const deleteFuncaoMutation = useMutation({
    mutationFn: (id) => base44.entities.Funcao.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funcoes'] });
      setDeleteDialog({ open: false, type: null, id: null });
    }
  });

  const handleCreateLotacao = () => {
    if (novaLotacao.trim()) {
      createLotacaoMutation.mutate(novaLotacao.trim());
    }
  };

  const handleCreateFuncao = () => {
    if (novaFuncao.trim()) {
      createFuncaoMutation.mutate(novaFuncao.trim());
    }
  };

  const handleDelete = () => {
    if (deleteDialog.type === 'lotacao') {
      deleteLotacaoMutation.mutate(deleteDialog.id);
    } else {
      deleteFuncaoMutation.mutate(deleteDialog.id);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Settings className="w-8 h-8 text-[#1e3a5f]" />
          <div>
            <h1 className="text-3xl font-bold text-[#1e3a5f]">Configurações</h1>
            <p className="text-slate-500">Gerenciar lotações, funções e configurações da unidade</p>
          </div>
        </div>

        {/* Comandante */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Crown className="w-5 h-5 text-amber-600" />
            <h2 className="text-xl font-semibold text-[#1e3a5f]">Comandante da Unidade</h2>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            O sexo do(a) comandante definido aqui será usado nos textos gerados para publicação (ex: "O Comandante" ou "A Comandante").
          </p>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium text-slate-700 block mb-1.5">Comandante</label>
              <Select value={comandanteId} onValueChange={v => saveComandanteMutation.mutate(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o(a) Comandante..." />
                </SelectTrigger>
                <SelectContent>
                  {militares.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.posto_graduacao} {m.nome_completo} — {m.sexo === 'Feminino' ? '♀ Feminino' : '♂ Masculino'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {comandanteId && (() => {
            const cmd = militares.find(m => m.id === comandanteId);
            return cmd ? (
              <p className="text-sm text-emerald-600 mt-3">
                ✓ Textos gerados com: "{cmd.sexo === 'Feminino' ? 'A Comandante' : 'O Comandante'}"
              </p>
            ) : null;
          })()}
        </div>

        {/* Lotações */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-[#1e3a5f] mb-4">Lotações</h2>
          
          <div className="flex gap-2 mb-6">
            <Input
              value={novaLotacao}
              onChange={(e) => setNovaLotacao(e.target.value)}
              placeholder="Nova lotação..."
              onKeyDown={(e) => e.key === 'Enter' && handleCreateLotacao()}
            />
            <Button
              onClick={handleCreateLotacao}
              disabled={!novaLotacao.trim()}
              className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar
            </Button>
          </div>

          <div className="space-y-2">
            {lotacoes.map((lot) => (
              <div
                key={lot.id}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <span className="font-medium">{lot.nome}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteDialog({ open: true, type: 'lotacao', id: lot.id })}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            {lotacoes.length === 0 && (
              <p className="text-center text-slate-500 py-8">Nenhuma lotação cadastrada</p>
            )}
          </div>
        </div>

        {/* Funções */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-semibold text-[#1e3a5f] mb-4">Funções</h2>
          
          <div className="flex gap-2 mb-6">
            <Input
              value={novaFuncao}
              onChange={(e) => setNovaFuncao(e.target.value)}
              placeholder="Nova função..."
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFuncao()}
            />
            <Button
              onClick={handleCreateFuncao}
              disabled={!novaFuncao.trim()}
              className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar
            </Button>
          </div>

          <div className="space-y-2">
            {funcoes.map((func) => (
              <div
                key={func.id}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <span className="font-medium">{func.nome}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteDialog({ open: true, type: 'funcao', id: func.id })}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            {funcoes.length === 0 && (
              <p className="text-center text-slate-500 py-8">Nenhuma função cadastrada</p>
            )}
          </div>
        </div>

        <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir esta {deleteDialog.type === 'lotacao' ? 'lotação' : 'função'}?
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}