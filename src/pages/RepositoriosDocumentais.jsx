import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Database, Check, X, Server, Wifi, RefreshCw, Radio } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { criarEscopado, atualizarEscopado, excluirEscopado } from '@/services/cudEscopadoClient';
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

export default function RepositoriosDocumentais() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRepo, setEditingRepo] = useState(null);
  const [testingId, setTestingId] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null });

  const { data: repositorios = [], isLoading } = useQuery({
    queryKey: ['repositorios-documentais'],
    queryFn: () => base44.entities.RepositorioDocumental.list('ordem_prioridade')
  });

  const [formData, setFormData] = useState({
    nome: '',
    tipo: 'GOOGLE_DRIVE',
    ativo: true,
    ordem_prioridade: 1,
    drive_root_folder_id: '',
    conta_responsavel: '',
    status: 'ATIVO',
    observacoes: ''
  });

  const mutation = useMutation({
    mutationFn: async (data) => {
      if (editingRepo) {
        return await atualizarEscopado('RepositorioDocumental', editingRepo.id, data);
      } else {
        return await criarEscopado('RepositorioDocumental', data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositorios-documentais'] });
      toast({ title: `Repositório ${editingRepo ? 'atualizado' : 'criado'} com sucesso!` });
      setIsModalOpen(false);
      setEditingRepo(null);
      resetForm();
    },
    onError: (error) => {
      toast({ title: 'Erro ao salvar repositório', description: error.message, variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => excluirEscopado('RepositorioDocumental', id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositorios-documentais'] });
      toast({ title: 'Repositório excluído com sucesso!' });
      setDeleteDialog({ open: false, id: null });
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir repositório', description: error.message, variant: 'destructive' });
    }
  });

  const resetForm = () => {
    setFormData({
      nome: '',
      tipo: 'GOOGLE_DRIVE',
      ativo: true,
      ordem_prioridade: 1,
      drive_root_folder_id: '',
      conta_responsavel: '',
      status: 'ATIVO',
      observacoes: ''
    });
  };

  const sincronizarMutation = useMutation({
    mutationFn: async (repositorio_id) => {
      const response = await base44.functions.invoke('sincronizarAcervoDrive', { repositorio_id });
      const body = response?.data ?? response;
      if (body?.error) throw new Error(body.error);
      return body;
    },
    onSuccess: (data) => {
      const resumo = (data?.resultados || []).map(r => r.erro
        ? `${r.repositorio}: erro - ${r.erro}`
        : r.inicializado
          ? `${r.repositorio}: inicializado`
          : `${r.repositorio}: ${r.aplicadas} aplicadas, ${r.ignoradas} ignoradas`
      ).join(' | ');
      toast({ title: 'Sincronização concluída', description: resumo || 'OK' });
    },
    onError: (error) => {
      toast({ title: 'Falha na sincronização', description: error.message, variant: 'destructive' });
    }
  });

  const ativarWatchMutation = useMutation({
    mutationFn: async (repositorio_id) => {
      const webhook_url = window.prompt(
        'Informe a URL pública da função sincronizarAcervoDrive (necessária para o Drive enviar push notifications). Encontre em Dashboard → Code → Functions → sincronizarAcervoDrive.'
      );
      if (!webhook_url) throw new Error('URL do webhook não informada.');
      const response = await base44.functions.invoke('gerirWatchDrive', {
        action: 'renovar',
        repositorio_id,
        webhook_url
      });
      const body = response?.data ?? response;
      if (body?.error) throw new Error(body.error);
      return body;
    },
    onSuccess: (data) => {
      const resumo = (data?.resultados || []).map(r => r.erro
        ? `${r.repositorio}: ${r.erro}`
        : `${r.repositorio}: watch ativo até ${new Date(r.expira).toLocaleString()}`
      ).join(' | ');
      toast({ title: 'Watch configurado', description: resumo || 'OK' });
    },
    onError: (error) => {
      toast({ title: 'Falha ao ativar watch', description: error.message, variant: 'destructive' });
    }
  });

  const testarConexaoMutation = useMutation({
    mutationFn: async (drive_root_folder_id) => {
      const response = await base44.functions.invoke('testarConexaoDrive', { drive_root_folder_id });
      const body = response?.data ?? response;
      if (body?.error) throw new Error(body.error);
      return body;
    },
    onSuccess: (data) => {
      toast({ title: 'Sucesso!', description: data.message });
    },
    onError: (error) => {
      toast({ title: 'Falha na conexão', description: error.message, variant: 'destructive' });
    }
  });

  const handleEdit = (repo) => {
    setEditingRepo(repo);
    setFormData({
      nome: repo.nome,
      tipo: repo.tipo,
      ativo: repo.ativo,
      ordem_prioridade: repo.ordem_prioridade,
      drive_root_folder_id: repo.drive_root_folder_id,
      conta_responsavel: repo.conta_responsavel,
      status: repo.status,
      observacoes: repo.observacoes
    });
    setIsModalOpen(true);
  };

  const handleTestarConexao = async (repoId) => {
    setTestingId(repoId);
    try {
      const response = await base44.functions.invoke('testarConexaoDrive', { repositorio_id: repoId });
      const data = response?.data || response;

      if (data.ok) {
        toast({
          title: 'Conexão OK!',
          description: `Acessado: ${data.details.folder_name} (${data.details.mime_type})`,
          variant: 'default'
        });
      } else {
        throw new Error(data.error || 'Falha desconhecida');
      }
    } catch (error) {
      toast({
        title: 'Erro na Conexão',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  const statusColors = {
    'ATIVO': 'bg-emerald-100 text-emerald-700',
    'RESERVA': 'bg-blue-100 text-blue-700',
    'CHEIO': 'bg-amber-100 text-amber-700',
    'INATIVO': 'bg-slate-100 text-slate-700'
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1e3a5f] flex items-center gap-2">
            <Database className="w-6 h-6" /> Repositórios Documentais
          </h1>
          <p className="text-slate-500">Gerencie os repositórios externos do Google Drive</p>
        </div>
        <Dialog open={isModalOpen} onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) {
            setEditingRepo(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
              <Plus className="w-4 h-4 mr-2" /> Novo Repositório
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingRepo ? 'Editar' : 'Novo'} Repositório</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label>Nome do Repositório</Label>
                  <Input
                    value={formData.nome}
                    onChange={e => setFormData({...formData, nome: e.target.value})}
                    placeholder="Ex: Drive Principal GGP"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={v => setFormData({...formData, status: v})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ATIVO">ATIVO</SelectItem>
                      <SelectItem value="RESERVA">RESERVA</SelectItem>
                      <SelectItem value="CHEIO">CHEIO</SelectItem>
                      <SelectItem value="INATIVO">INATIVO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ordem de Prioridade</Label>
                  <Input
                    type="number"
                    value={formData.ordem_prioridade}
                    onChange={e => setFormData({...formData, ordem_prioridade: parseInt(e.target.value)})}
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Drive Root Folder ID</Label>
                  <Input
                    value={formData.drive_root_folder_id}
                    onChange={e => setFormData({...formData, drive_root_folder_id: e.target.value})}
                    placeholder="ID da pasta raiz no Google Drive"
                    required
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Conta Responsável (E-mail)</Label>
                  <Input
                    value={formData.conta_responsavel}
                    onChange={e => setFormData({...formData, conta_responsavel: e.target.value})}
                    placeholder="ggp.acervo@exemplo.com"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Observações</Label>
                  <Input
                    value={formData.observacoes}
                    onChange={e => setFormData({...formData, observacoes: e.target.value})}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full bg-[#1e3a5f]" disabled={mutation.isPending}>
                  {mutation.isPending ? 'Salvando...' : 'Salvar Repositório'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prioridade</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Root Folder ID</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {repositorios.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                    Nenhum repositório cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                repositorios.map((repo) => (
                  <TableRow key={repo.id}>
                    <TableCell className="font-medium">#{repo.ordem_prioridade}</TableCell>
                    <TableCell>{repo.nome}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[repo.status] || ''}>
                        {repo.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-xs">
                        <Server className="w-3 h-3" /> {repo.tipo}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{repo.drive_root_folder_id}</TableCell>
                    <TableCell>
                      {repo.ativo ? <Check className="w-4 h-4 text-emerald-600" /> : <X className="w-4 h-4 text-red-600" />}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => testarConexaoMutation.mutate(repo.drive_root_folder_id)}
                          disabled={testarConexaoMutation.isPending}
                          title="Testar Conexão"
                        >
                          <Wifi className={`w-4 h-4 ${testarConexaoMutation.isPending ? 'animate-pulse' : ''}`} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => sincronizarMutation.mutate(repo.id)}
                          disabled={sincronizarMutation.isPending}
                          title="Sincronizar agora (Drive → SGP)"
                        >
                          <RefreshCw className={`w-4 h-4 ${sincronizarMutation.isPending ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => ativarWatchMutation.mutate(repo.id)}
                          disabled={ativarWatchMutation.isPending}
                          title="Ativar/Renovar Watch (push em tempo real)"
                        >
                          <Radio className={`w-4 h-4 ${ativarWatchMutation.isPending ? 'animate-pulse text-emerald-600' : ''}`} />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(repo)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este repositório? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(deleteDialog.id)}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}