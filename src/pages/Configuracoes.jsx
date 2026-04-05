import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Trash2, Plus, Sliders } from 'lucide-react';
import TiposPublicacaoManager from '@/components/configuracoes/TiposPublicacaoManager';
import FolhaAlteracoesConfigManager from '@/components/configuracoes/FolhaAlteracoesConfigManager';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { CATEGORIA_QUADRO_OFICIAL, CATEGORIA_QUADRO_PRACA } from '@/utils/postoGraduacaoClassificacao';
import {
  createQuadroMilitar,
  deleteQuadroMilitar,
  getMensagemErroQuadro,
  listQuadrosMilitares,
  updateQuadroMilitar,
  getQuadroMilitarEntityInfo,
} from '@/services/quadroMilitarEntityService';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const [novoQuadro, setNovoQuadro] = useState({ nome: '', sigla: '', categoria: CATEGORIA_QUADRO_OFICIAL, ativo: true });
  const [quadroEmEdicao, setQuadroEmEdicao] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, type: null, id: null });
  const [addQuadroDialogOpen, setAddQuadroDialogOpen] = useState(false);
  const [erroCadastroQuadro, setErroCadastroQuadro] = useState('');
  const [editConfirmStep, setEditConfirmStep] = useState(0);
  const [editImpactCount, setEditImpactCount] = useState(0);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(0);
  const [deleteImpactData, setDeleteImpactData] = useState({ id: null, nome: '', quantidade: 0 });
  const [quadroFeedback, setQuadroFeedback] = useState({ type: '', message: '' });
  const [entityQuadroEmUso, setEntityQuadroEmUso] = useState('detectando...');

  const selectedTab = searchParams.get('tab') || 'adicoes';

  useEffect(() => {
    let ativo = true;

    const detectarEntity = async () => {
      try {
        const info = await getQuadroMilitarEntityInfo();
        if (ativo) setEntityQuadroEmUso(info?.entityName || 'indisponível');
      } catch {
        if (ativo) setEntityQuadroEmUso('indisponível');
      }
    };

    detectarEntity();
    return () => {
      ativo = false;
    };
  }, []);

  const { data: lotacoes = [] } = useQuery({ queryKey: ['lotacoes'], queryFn: () => base44.entities.Lotacao.list('-created_date'), enabled: isAccessResolved && hasConfiguracoesAccess });
  const { data: funcoes = [] } = useQuery({ queryKey: ['funcoes'], queryFn: () => base44.entities.Funcao.list('-created_date'), enabled: isAccessResolved && hasConfiguracoesAccess });
  const { data: quadros = [] } = useQuery({
    queryKey: ['quadros-militares'],
    queryFn: () => listQuadrosMilitares('nome'),
    enabled: isAccessResolved && hasConfiguracoesAccess
  });

  const createLotacaoMutation = useMutation({ mutationFn: (nome) => base44.entities.Lotacao.create({ nome, ativa: true }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['lotacoes'] }); setNovaLotacao(''); } });
  const createFuncaoMutation = useMutation({ mutationFn: (nome) => base44.entities.Funcao.create({ nome, ativa: true }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['funcoes'] }); setNovaFuncao(''); } });
  const createQuadroMutation = useMutation({
    mutationFn: (payload) => createQuadroMilitar(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quadros-militares'] });
      setNovoQuadro({ nome: '', sigla: '', categoria: CATEGORIA_QUADRO_OFICIAL, ativo: true });
      setErroCadastroQuadro('');
      setQuadroFeedback({ type: 'success', message: 'Quadro cadastrado com sucesso.' });
      setAddQuadroDialogOpen(false);
    },
    onError: (error) => {
      const message = getMensagemErroQuadro(error, 'Não foi possível salvar o quadro. Verifique os dados e tente novamente.');
      setErroCadastroQuadro(message);
      setQuadroFeedback({ type: 'error', message });
    },
  });
  const updateQuadroMutation = useMutation({
    mutationFn: ({ id, payload }) => updateQuadroMilitar(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quadros-militares'] });
      setQuadroEmEdicao(null);
      setQuadroFeedback({ type: 'success', message: 'Quadro atualizado com sucesso.' });
    },
    onError: (error) => {
      setQuadroFeedback({
        type: 'error',
        message: getMensagemErroQuadro(error, 'Não foi possível atualizar o quadro no momento.')
      });
    }
  });
  const deleteLotacaoMutation = useMutation({ mutationFn: (id) => base44.entities.Lotacao.delete(id), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['lotacoes'] }); setDeleteDialog({ open: false, type: null, id: null }); } });
  const deleteFuncaoMutation = useMutation({ mutationFn: (id) => base44.entities.Funcao.delete(id), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['funcoes'] }); setDeleteDialog({ open: false, type: null, id: null }); } });
  const deleteQuadroMutation = useMutation({
    mutationFn: async (id) => {
      const quadro = quadros.find((item) => item.id === id);
      const militaresPorId = await base44.entities.Militar.filter({ quadro_id: id });
      const militaresPorNome = quadro?.nome ? await base44.entities.Militar.filter({ quadro: quadro.nome }) : [];

      const militaresVinculados = [...new Map([...militaresPorId, ...militaresPorNome].map((m) => [m.id, m])).values()];
      if (militaresVinculados.length > 0) {
        throw new Error(`Exclusão bloqueada: o quadro está vinculado a ${militaresVinculados.length} militar(es). Regra adotada: não permitir exclusão com dependências.`); // regra explícita
      }

      await deleteQuadroMilitar(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quadros-militares'] });
      setDeleteDialog({ open: false, type: null, id: null });
      setQuadroFeedback({
        type: 'success',
        message: 'Quadro excluído com sucesso. Regra aplicada: exclusão apenas sem dependências.'
      });
    },
    onError: (error) => {
      setQuadroFeedback({
        type: 'error',
        message: getMensagemErroQuadro(error, 'Não foi possível excluir o quadro.')
      });
      setDeleteDialog({ open: false, type: null, id: null });
    }
  });

  const handleDelete = () => {
    if (!canAccessAction('gerir_configuracoes')) return;
    if (deleteDialog.type === 'lotacao') deleteLotacaoMutation.mutate(deleteDialog.id);
    else if (deleteDialog.type === 'funcao') deleteFuncaoMutation.mutate(deleteDialog.id);
    else {
      deleteQuadroMutation.mutate(deleteDialog.id);
      setDeleteConfirmStep(0);
      setDeleteImpactData({ id: null, nome: '', quantidade: 0 });
    }
  };

  const quadrosPorNomeNormalizado = useMemo(() => (
    quadros.reduce((acc, item) => {
      const key = (item?.nome || '').trim().toUpperCase();
      if (!key) return acc;
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {})
  ), [quadros]);

  const countMilitaresVinculadosAoQuadro = async (quadro) => {
    if (!quadro?.id) return 0;

    const militaresPorId = await base44.entities.Militar.filter({ quadro_id: quadro.id });
    const militaresPorNome = quadro?.nome ? await base44.entities.Militar.filter({ quadro: quadro.nome }) : [];
    const militaresVinculados = [...new Map([...militaresPorId, ...militaresPorNome].map((m) => [m.id, m])).values()];
    return militaresVinculados.length;
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

  const handleCreateQuadro = (event) => {
    event?.preventDefault();
    setQuadroFeedback({ type: '', message: '' });

    if (!canAccessAction('gerir_configuracoes')) return;

    const nomeNormalizado = novoQuadro.nome.trim().toUpperCase();
    if (!nomeNormalizado) {
      setErroCadastroQuadro('Informe o nome do quadro para salvar.');
      return;
    }

    if (quadrosPorNomeNormalizado[nomeNormalizado]?.length) {
      setErroCadastroQuadro('Já existe um quadro com este nome. Use outro nome para continuar.');
      return;
    }

    setErroCadastroQuadro('');
    createQuadroMutation.mutate({
      nome: novoQuadro.nome.trim(),
      sigla: novoQuadro.sigla.trim(),
      categoria: novoQuadro.categoria,
      ativo: novoQuadro.ativo,
    });
  };

  const handleUpdateQuadro = async () => {
    if (!canAccessAction('gerir_configuracoes') || !quadroEmEdicao?.id) return;
    if (!quadroEmEdicao.nome?.trim()) return;
    const militaresImpactados = await countMilitaresVinculadosAoQuadro(quadroEmEdicao);
    setEditImpactCount(militaresImpactados);
    setEditConfirmStep(1);
  };

  const confirmUpdateQuadro = () => {
    if (!canAccessAction('gerir_configuracoes') || !quadroEmEdicao?.id) return;
    updateQuadroMutation.mutate({
      id: quadroEmEdicao.id,
      payload: {
        nome: quadroEmEdicao.nome.trim(),
        sigla: (quadroEmEdicao.sigla || '').trim(),
        categoria: quadroEmEdicao.categoria,
        ativo: quadroEmEdicao.ativo,
      }
    });
    setEditConfirmStep(0);
    setEditImpactCount(0);
  };

  const abrirExclusaoQuadroComConfirmacao = async (quadro) => {
    const quantidade = await countMilitaresVinculadosAoQuadro(quadro);
    setDeleteImpactData({ id: quadro.id, nome: quadro.nome, quantidade });
    setDeleteConfirmStep(1);
  };

  const iniciarConfirmacaoFinalExclusao = () => {
    setDeleteDialog({ open: true, type: 'quadro', id: deleteImpactData.id });
    setDeleteConfirmStep(2);
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

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-semibold text-[#1e3a5f] mb-4">Quadros</h2>
            <p className="text-sm text-slate-500 mb-4">Cadastre quadros com categoria obrigatória (Oficial/Praça) para uso no cadastro de militar.</p>
            {quadroFeedback.message && (
              <p className={`text-sm mb-4 ${quadroFeedback.type === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>
                {quadroFeedback.message}
              </p>
            )}
            <p className="text-xs text-slate-500 mb-4">
              Entidade de quadros em uso: <strong>{entityQuadroEmUso}</strong>
            </p>
            <div className="mb-6">
              <Button onClick={() => { setErroCadastroQuadro(''); setQuadroFeedback({ type: '', message: '' }); setAddQuadroDialogOpen(true); }} disabled={!canAccessAction('gerir_configuracoes')} className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white">
                <Plus className="w-4 h-4 mr-2" /> Adicionar Quadro
              </Button>
            </div>

            <div className="space-y-2">
              {quadros.map((quadro) => {
                const editando = quadroEmEdicao?.id === quadro.id;
                return (
                  <div key={quadro.id} className="p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                    {editando ? (
                      <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-center">
                        <Input value={quadroEmEdicao.nome} onChange={(e) => setQuadroEmEdicao((prev) => ({ ...prev, nome: e.target.value }))} className="md:col-span-2" />
                        <Input value={quadroEmEdicao.sigla || ''} onChange={(e) => setQuadroEmEdicao((prev) => ({ ...prev, sigla: e.target.value }))} />
                        <Select value={quadroEmEdicao.categoria} onValueChange={(value) => setQuadroEmEdicao((prev) => ({ ...prev, categoria: value }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={CATEGORIA_QUADRO_OFICIAL}>{CATEGORIA_QUADRO_OFICIAL}</SelectItem>
                            <SelectItem value={CATEGORIA_QUADRO_PRACA}>{CATEGORIA_QUADRO_PRACA}</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={quadroEmEdicao.ativo ? 'ativo' : 'inativo'} onValueChange={(value) => setQuadroEmEdicao((prev) => ({ ...prev, ativo: value === 'ativo' }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ativo">Ativo</SelectItem>
                            <SelectItem value="inativo">Inativo</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" onClick={handleUpdateQuadro} className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white">Salvar</Button>
                          <Button size="sm" variant="outline" onClick={() => setQuadroEmEdicao(null)}>Cancelar</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-800">{quadro.nome}{quadro.sigla ? ` (${quadro.sigla})` : ''}</p>
                          <p className="text-xs text-slate-500">Categoria: {quadro.categoria} • Status: {quadro.ativo ? 'Ativo' : 'Inativo'}</p>
                        </div>
                        {canAccessAction('gerir_configuracoes') && (
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setQuadroEmEdicao({ ...quadro })}>Editar</Button>
                            <Button variant="ghost" size="icon" onClick={() => abrirExclusaoQuadroComConfirmacao(quadro)} className="text-red-600 hover:text-red-700 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {quadros.length === 0 && <p className="text-center text-slate-500 py-8">Nenhum quadro cadastrado</p>}
            </div>
          </div>

          <TiposPublicacaoManager />

          <FolhaAlteracoesConfigManager canEdit={canAccessAction('gerir_configuracoes')} />
        </div>

        <Dialog open={addQuadroDialogOpen} onOpenChange={(open) => { setAddQuadroDialogOpen(open); if (!open) setErroCadastroQuadro(''); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo quadro</DialogTitle>
              <DialogDescription>Preencha os dados para cadastrar um novo quadro.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateQuadro} className="grid grid-cols-1 gap-3">
              <Input
                value={novoQuadro.nome}
                onChange={(e) => {
                  setNovoQuadro((prev) => ({ ...prev, nome: e.target.value }));
                  if (erroCadastroQuadro) setErroCadastroQuadro('');
                }}
                placeholder="Nome do quadro"
                disabled={!canAccessAction('gerir_configuracoes') || createQuadroMutation.isPending}
              />
              <Input
                value={novoQuadro.sigla}
                onChange={(e) => setNovoQuadro((prev) => ({ ...prev, sigla: e.target.value }))}
                placeholder="Sigla (opcional)"
                disabled={!canAccessAction('gerir_configuracoes') || createQuadroMutation.isPending}
              />
              <Select
                value={novoQuadro.categoria}
                onValueChange={(value) => setNovoQuadro((prev) => ({ ...prev, categoria: value }))}
                disabled={!canAccessAction('gerir_configuracoes') || createQuadroMutation.isPending}
              >
                <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={CATEGORIA_QUADRO_OFICIAL}>{CATEGORIA_QUADRO_OFICIAL}</SelectItem>
                  <SelectItem value={CATEGORIA_QUADRO_PRACA}>{CATEGORIA_QUADRO_PRACA}</SelectItem>
                </SelectContent>
              </Select>
              {erroCadastroQuadro && (
                <p className="text-sm text-red-600">{erroCadastroQuadro}</p>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setAddQuadroDialogOpen(false); setErroCadastroQuadro(''); }}>Cancelar</Button>
                <Button type="submit" disabled={!canAccessAction('gerir_configuracoes') || createQuadroMutation.isPending} className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white">
                  {createQuadroMutation.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={editConfirmStep === 1} onOpenChange={(open) => { if (!open) setEditConfirmStep(0); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Impacto da edição de quadro</AlertDialogTitle>
              <AlertDialogDescription>
                Alterar este quadro pode impactar militares já vinculados a ele. Revise com atenção antes de continuar.
                {editImpactCount > 0 && ` Há ${editImpactCount} militar(es) potencialmente impactado(s).`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setEditConfirmStep(0)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => setEditConfirmStep(2)} className="bg-amber-600 hover:bg-amber-700 text-white">Continuar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={editConfirmStep === 2} onOpenChange={(open) => { if (!open) setEditConfirmStep(0); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmação final da edição</AlertDialogTitle>
              <AlertDialogDescription>
                Esta é a segunda confirmação obrigatória. Confirme apenas se tiver certeza de que deseja salvar as alterações deste quadro.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setEditConfirmStep(0)}>Voltar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmUpdateQuadro} className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white">Confirmar e salvar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={deleteConfirmStep === 1} onOpenChange={(open) => { if (!open) setDeleteConfirmStep(0); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Impacto da exclusão de quadro</AlertDialogTitle>
              <AlertDialogDescription>
                Excluir este quadro pode deixar militares com quadro desatualizado ou sem vínculo válido. Confirme apenas se tiver certeza.
                {deleteImpactData.quantidade > 0 && ` Há ${deleteImpactData.quantidade} militar(es) vinculado(s) no momento.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteConfirmStep(0)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={iniciarConfirmacaoFinalExclusao} className="bg-amber-600 hover:bg-amber-700 text-white">Continuar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={deleteDialog.open} onOpenChange={(open) => {
          setDeleteDialog({ ...deleteDialog, open });
          if (!open && deleteDialog.type === 'quadro') {
            setDeleteConfirmStep(0);
            setDeleteImpactData({ id: null, nome: '', quantidade: 0 });
          }
        }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir {deleteDialog.type === 'lotacao' ? 'esta lotação' : deleteDialog.type === 'funcao' ? 'esta função' : 'este quadro'}? Esta ação não pode ser desfeita.
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
