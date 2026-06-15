import React, { useState, useMemo } from 'react';
import {
  ClipboardList,
  History,
  Settings,
  Plus,
  Play,
  CheckCircle,
  XCircle,
  Copy,
  Search,
  AlertCircle,
  Trash2,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { useToast } from '@/components/ui/use-toast';
import { Paperclip } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  getRotinasAdministrativas,
  getExecucoesRotina,
  salvarRotina,
  excluirRotina,
  executarMemorandoTars,
  atualizarStatusExecucao,
  getItensExecucao
} from '@/services/rotinasAdministrativasService';

const TEMPLATE_DEFAULT_TARS = `Ao Senhor Diretor de Inteligência,

Encaminho, para fins de registro e providências cabíveis no sistema TARS, a relação dos atestados médicos apresentados no âmbito desta Unidade no período de {{data_inicio}} a {{data_fim}}.

{{tabela_atestados}}

Informo que os respectivos documentos comprobatórios encontram-se anexos à presente remessa.

Respeitosamente,

{{usuario_nome}}
{{usuario_funcao}}
{{unidade_nome}}`;

export default function RotinasAdministrativas() {
  const { user, isAdmin, canAccessAction, subgrupamentoId, isAccessResolved } = useCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const hasGlobalAccess = isAdmin || canAccessAction('perm_visualizar_rotinas_globais_administrativas');
  const [activeTab, setActiveTab] = useState('rotinas');

  // Busca o nome da unidade (Subgrupamento) pelo subgrupamentoId resolvido pelo useCurrentUser
  const { data: unidadeData } = useQuery({
    queryKey: ['subgrupamento', subgrupamentoId],
    queryFn: () => base44.entities.Subgrupamento.get(subgrupamentoId),
    enabled: !!subgrupamentoId
  });

  const unidadeNome = unidadeData?.nome || '';

  // Contexto consolidado para ser passado aos services
  const userContext = useMemo(() => ({
    unidade_id: subgrupamentoId,
    unidade_nome: unidadeNome,
    usuario_id: user?.id,
    usuario_nome: user?.full_name
  }), [subgrupamentoId, unidadeNome, user]);

  // States para modais
  const [isExecutarModalOpen, setIsExecutarModalOpen] = useState(false);
  const [selectedRotina, setSelectedRotina] = useState(null);
  const [execParams, setExecParams] = useState({
    data_inicio: '',
    data_fim: '',
    incluir_anexos: false,
    observacoes: ''
  });

  const [isConfirmConcludeOpen, setIsConfirmConcludeOpen] = useState(false);
  const [isViewExecucaoOpen, setIsViewExecucaoOpen] = useState(false);
  const [viewExecucao, setViewExecucao] = useState(null);
  const [viewItens, setViewItens] = useState([]);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    nome: '',
    tipo_rotina: 'memorando_tars',
    periodicidade: 'semanal',
    template_texto: TEMPLATE_DEFAULT_TARS,
    ativo: true
  });

  // Queries
  const { data: rotinas = [], isLoading: loadingRotinas } = useQuery({
    queryKey: ['rotinas-administrativas', subgrupamentoId, hasGlobalAccess],
    queryFn: () => getRotinasAdministrativas(subgrupamentoId, hasGlobalAccess),
    enabled: isAccessResolved
  });

  const { data: execucoes = [], isLoading: loadingExecucoes } = useQuery({
    queryKey: ['execucoes-rotinas', subgrupamentoId, hasGlobalAccess],
    queryFn: () => getExecucoesRotina(subgrupamentoId, {}, hasGlobalAccess),
    enabled: isAccessResolved
  });

  // Mutations
  const mutationSalvar = useMutation({
    mutationFn: (vars) => salvarRotina(vars.rotina, vars.context),
    onSuccess: (data) => {
      console.log('[RotinasAdministrativas] mutationSalvar sucesso:', data);
      queryClient.invalidateQueries({ queryKey: ['rotinas-administrativas'] });
      setIsEditModalOpen(false);
      setActiveTab('rotinas');
      toast({ title: 'Sucesso', description: 'Rotina salva com sucesso.' });
    },
    onError: (error) => {
      console.error('[RotinasAdministrativas] erro ao salvar rotina:', error);
      toast({
        title: 'Erro ao Salvar',
        description: error.message || 'Não foi possível salvar a rotina.',
        variant: 'destructive'
      });
    }
  });

  const mutationExcluir = useMutation({
    mutationFn: (id) => excluirRotina(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['rotinas-administrativas']);
      toast({ title: 'Sucesso', description: 'A rotina foi inativada ou excluída.' });
    }
  });

  const mutationExecutar = useMutation({
    mutationFn: (vars) => executarMemorandoTars(vars.rotina, vars.params, vars.context),
    onSuccess: (data) => {
      queryClient.invalidateQueries(['execucoes-rotinas']);
      setIsExecutarModalOpen(false);
      setViewExecucao(data);
      setViewItens(data.itens || []);
      setIsViewExecucaoOpen(true);
      toast({
        title: 'Execução Gerada',
        description: 'A execução foi gerada como pendente. Verifique o texto e os itens.'
      });
    }
  });

  const mutationStatus = useMutation({
    mutationFn: (vars) => atualizarStatusExecucao(vars.id, vars.status, vars.context, vars.extra),
    onSuccess: () => {
      queryClient.invalidateQueries(['execucoes-rotinas']);
      setIsViewExecucaoOpen(false);
      toast({ title: 'Sucesso', description: 'Status da execução atualizado.' });
    }
  });

  // Stats calculados
  const stats = useMemo(() => {
    const ativas = rotinas.filter(r => r.ativo).length;
    const pendentes = execucoes.filter(e => e.status === 'pendente' || e.status === 'em_conferencia').length;
    const concluidasMes = execucoes.filter(e => {
      if (e.status !== 'concluida') return false;
      const data = new Date(e.data_conclusao || e.data_geracao);
      const agora = new Date();
      return data.getMonth() === agora.getMonth() && data.getFullYear() === agora.getFullYear();
    }).length;

    return { ativas, pendentes, concluidasMes };
  }, [rotinas, execucoes]);

  const handleOpenExecutar = (rotina) => {
    setSelectedRotina(rotina);

    // Sugerir segunda a sexta da semana atual
    const hoje = new Date();
    const diaSemana = hoje.getDay(); // 0 (Dom) a 6 (Sab)
    const diffSeg = diaSemana === 0 ? -6 : 1 - diaSemana;
    const segunda = new Date(hoje);
    segunda.setDate(hoje.getDate() + diffSeg);
    const sexta = new Date(segunda);
    sexta.setDate(segunda.getDate() + 4);

    setExecParams({
      data_inicio: segunda.toISOString().split('T')[0],
      data_fim: sexta.toISOString().split('T')[0],
      incluir_anexos: rotina.incluir_anexos,
      observacoes: ''
    });
    setIsExecutarModalOpen(true);
  };

  const handleOpenEdit = (rotina = null) => {
    if (rotina) {
      setEditFormData({
        ...rotina,
        destinatario: rotina.configuracao_json?.destinatario || 'Sr. Diretor de Inteligência',
        orgao_destino: rotina.configuracao_json?.orgao_destino || 'DINTEL',
        assunto: rotina.configuracao_json?.assunto || 'Remessa de TARS - Atestados Médicos'
      });
    } else {
      setEditFormData({
        nome: '',
        tipo_rotina: 'memorando_tars',
        periodicidade: 'semanal',
        template_texto: TEMPLATE_DEFAULT_TARS,
        ativo: true,
        unidade_id: subgrupamentoId,
        unidade_nome: unidadeNome,
        escopo_tipo: 'unidade',
        destinatario: 'Sr. Diretor de Inteligência',
        orgao_destino: 'DINTEL',
        assunto: 'Remessa de TARS - Atestados Médicos'
      });
    }
    setIsEditModalOpen(true);
  };

  const handleSalvarRotina = () => {
    console.log('[RotinasAdministrativas] clique salvar rotina');
    try {
      const { destinatario, orgao_destino, assunto, ...rest } = editFormData;

      // Sanitizar: remover undefined por string vazia e garantir campos básicos
      const sanitizedData = Object.keys(rest).reduce((acc, key) => {
        acc[key] = rest[key] === undefined ? '' : rest[key];
        return acc;
      }, {});

      const payload = {
        ...sanitizedData,
        configuracao_json: {
          destinatario: destinatario || '',
          orgao_destino: orgao_destino || '',
          assunto: assunto || ''
        }
      };

      console.log('[RotinasAdministrativas] payload salvar rotina', payload);
      mutationSalvar.mutate({ rotina: payload, context: userContext });
    } catch (error) {
      console.error('[RotinasAdministrativas] erro ao montar payload:', error);
      toast({
        title: 'Erro de Validação',
        description: 'Ocorreu um erro ao preparar os dados da rotina.',
        variant: 'destructive'
      });
    }
  };

  const handleViewExecucao = async (exec) => {
    setViewExecucao(exec);
    const itens = await getItensExecucao(exec.id, subgrupamentoId, hasGlobalAccess);
    setViewItens(itens);
    setIsViewExecucaoOpen(true);
  };

  const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado', description: 'Texto copiado para a área de transferência.' });
  };

  if (!isAccessResolved) return null;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Rotinas Administrativas</h1>
        <p className="text-muted-foreground font-medium text-blue-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          O SGP não envia dados ao TARS. A remessa final deve ser feita manualmente no sistema externo.
        </p>
      </div>

      {/* Cards Superiores */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rotinas Ativas</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.ativas}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Execuções Pendentes</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendentes}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Concluídas no Mês</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.concluidasMes}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="rotinas" className="flex gap-2">
            <ClipboardList className="w-4 h-4" /> Minhas Rotinas
          </TabsTrigger>
          <TabsTrigger value="execucoes" className="flex gap-2">
            <History className="w-4 h-4" /> Execuções
          </TabsTrigger>
          {canAccessAction('perm_gerir_rotinas_administrativas') && (
            <TabsTrigger value="config" className="flex gap-2">
              <Settings className="w-4 h-4" /> Configurações
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="rotinas" className="space-y-4">
           <Card>
             <CardHeader>
               <CardTitle>Minhas Rotinas</CardTitle>
               <CardDescription>Visualize e execute as rotinas configuradas para sua unidade.</CardDescription>
             </CardHeader>
             <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Periodicidade</TableHead>
                      <TableHead>Escopo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rotinas.map(rotina => (
                      <TableRow key={rotina.id}>
                        <TableCell className="font-medium">{rotina.nome}</TableCell>
                        <TableCell className="capitalize">{rotina.tipo_rotina?.replace('_', ' ')}</TableCell>
                        <TableCell className="capitalize">{rotina.periodicidade}</TableCell>
                        <TableCell className="capitalize">{rotina.escopo_tipo}</TableCell>
                        <TableCell>
                          <Badge variant={rotina.ativo ? "success" : "secondary"}>
                            {rotina.ativo ? "Ativa" : "Inativa"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          {canAccessAction('perm_executar_rotinas_administrativas') && (
                            <Button size="sm" variant="outline" onClick={() => handleOpenExecutar(rotina)}>
                              <Play className="w-4 h-4 mr-2" /> Executar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {rotinas.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Nenhuma rotina configurada. Vá em Configurações para criar a primeira.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
             </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="execucoes">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Execuções</CardTitle>
              <CardDescription>Acompanhe o andamento das tarefas administrativas geradas.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Rotina</TableHead>
                    <TableHead>Competência</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {execucoes.map(exec => (
                    <TableRow key={exec.id}>
                      <TableCell>{new Date(exec.data_geracao).toLocaleDateString()}</TableCell>
                      <TableCell>{exec.rotina_nome}</TableCell>
                      <TableCell>{exec.competencia_inicio} a {exec.competencia_fim}</TableCell>
                      <TableCell>{exec.responsavel_nome}</TableCell>
                      <TableCell>
                        <Badge variant={exec.status === 'concluida' ? 'success' : exec.status === 'cancelada' ? 'destructive' : 'default'}>
                          {exec.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleViewExecucao(exec)}>
                          <Search className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {execucoes.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhuma execução registrada.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Configurações de Rotinas</CardTitle>
                  <CardDescription>Gerencie as definições das rotinas automáticas e templates.</CardDescription>
                </div>
                <Button onClick={() => handleOpenEdit()}>
                  <Plus className="w-4 h-4 mr-2" /> Nova Rotina
                </Button>
              </div>
            </CardHeader>
            <CardContent>
               <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Periodicidade</TableHead>
                      <TableHead>Ativo</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rotinas.map(rotina => (
                      <TableRow key={rotina.id}>
                        <TableCell className="font-medium">{rotina.nome}</TableCell>
                        <TableCell className="capitalize">{rotina.tipo_rotina?.replace('_', ' ')}</TableCell>
                        <TableCell className="capitalize">{rotina.periodicidade}</TableCell>
                        <TableCell>{rotina.ativo ? 'Sim' : 'Não'}</TableCell>
                        <TableCell className="text-right space-x-2">
                          {canAccessAction('perm_gerir_rotinas_administrativas') && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(rotina)}>
                                Editar
                              </Button>
                              <Button variant="ghost" size="sm" className="text-red-500" title="Inativar Rotina" onClick={() => {
                                if (confirm('Deseja realmente inativar/excluir esta rotina?')) {
                                  mutationExcluir.mutate(rotina.id);
                                }
                              }}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
               </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal Executar */}
      <Dialog open={isExecutarModalOpen} onOpenChange={setIsExecutarModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Executar Rotina: {selectedRotina?.nome}</DialogTitle>
            <DialogDescription>
              Selecione o período de competência para processar os dados.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input type="date" value={execParams.data_inicio} onChange={e => setExecParams({...execParams, data_inicio: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input type="date" value={execParams.data_fim} onChange={e => setExecParams({...execParams, data_fim: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={execParams.observacoes} onChange={e => setExecParams({...execParams, observacoes: e.target.value})} placeholder="Opcional..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExecutarModalOpen(false)}>Cancelar</Button>
            <Button onClick={() => mutationExecutar.mutate({ rotina: selectedRotina, params: execParams, context: userContext })}>
              <Play className="w-4 h-4 mr-2" /> Gerar Agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Visualizar Execução */}
      <Dialog open={isViewExecucaoOpen} onOpenChange={setIsViewExecucaoOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex justify-between items-start">
              <div>
                <DialogTitle>Execução: {viewExecucao?.rotina_nome}</DialogTitle>
                <DialogDescription>
                  Gerada em {viewExecucao?.data_geracao && new Date(viewExecucao.data_geracao).toLocaleString()}
                </DialogDescription>
              </div>
              <Badge variant={viewExecucao?.status === 'concluida' ? 'success' : 'default'}>
                {viewExecucao?.status}
              </Badge>
            </div>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex gap-3 text-amber-800 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>O envio final deve ser realizado manualmente no sistema externo <strong>TARS</strong>. Este módulo serve apenas para organização e registro.</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-lg font-bold">Texto Gerado (Minuta)</Label>
                <Button variant="outline" size="sm" onClick={() => copyToClipboard(viewExecucao?.texto_gerado)}>
                  <Copy className="w-4 h-4 mr-2" /> Copiar Texto
                </Button>
              </div>
              <div className="bg-slate-50 p-4 rounded border whitespace-pre-wrap font-mono text-sm max-h-60 overflow-y-auto">
                {viewExecucao?.texto_gerado}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-lg font-bold">Itens Processados ({viewExecucao?.quantidade_itens})</Label>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Militar</TableHead>
                      <TableHead>Matrícula</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead className="text-center">Anexo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewItens.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="text-xs font-medium">{item.militar_posto_graduacao} {item.militar_nome}</TableCell>
                        <TableCell className="text-xs">{item.militar_matricula}</TableCell>
                        <TableCell className="text-xs">{item.descricao}</TableCell>
                        <TableCell className="text-xs">{item.data_inicio} a {item.data_fim}</TableCell>
                        <TableCell className="text-center">
                          {item.possui_anexo && (
                            <div className="flex justify-center gap-2">
                              <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
                                <Paperclip className="w-3 h-3 mr-1" /> Sim
                              </Badge>
                              <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                                <a href={item.origem_id ? `#/VerAtestado?id=${item.origem_id}` : '#'} target="_blank" rel="noreferrer">
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <DialogFooter className="flex justify-between sm:justify-between items-center w-full">
             <div className="flex gap-2">
                {viewExecucao?.status !== 'concluida' && viewExecucao?.status !== 'cancelada' && (
                  <>
                    <Button variant="destructive" onClick={() => mutationStatus.mutate({ id: viewExecucao.id, status: 'cancelada', context: userContext })}>
                      <XCircle className="w-4 h-4 mr-2" /> Cancelar
                    </Button>
                    <Button variant="success" onClick={() => setIsConfirmConcludeOpen(true)}>
                      <CheckCircle className="w-4 h-4 mr-2" /> Marcar como Concluída
                    </Button>
                  </>
                )}
             </div>
             <Button variant="outline" onClick={() => setIsViewExecucaoOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmação Conclusão */}
      <Dialog open={isConfirmConcludeOpen} onOpenChange={setIsConfirmConcludeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Conclusão</DialogTitle>
            <DialogDescription>
              Confirma que o envio dos dados foi realizado manualmente no sistema <strong>TARS</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmConcludeOpen(false)}>Ainda não enviei</Button>
            <Button variant="success" onClick={() => {
              mutationStatus.mutate({
                id: viewExecucao.id,
                status: 'concluida',
                context: userContext
              });
              setIsConfirmConcludeOpen(false);
            }}>
              Sim, Confirmo o Envio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar/Criar Rotina */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editFormData.id ? 'Editar Rotina' : 'Nova Rotina'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome da Rotina</Label>
                <Input value={editFormData.nome} onChange={e => setEditFormData({...editFormData, nome: e.target.value})} placeholder="Ex: Memorando TARS Semanal" />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Rotina</Label>
                <Select value={editFormData.tipo_rotina} onValueChange={v => setEditFormData({...editFormData, tipo_rotina: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="memorando_tars">Memorando TARS</SelectItem>
                    <SelectItem value="relatorio">Relatório</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {editFormData.tipo_rotina === 'memorando_tars' && (
              <div className="p-4 border rounded-lg bg-blue-50/30 space-y-4">
                <p className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                  <Settings className="w-4 h-4" /> Configuração Memorando TARS
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Destinatário</Label>
                    <Input value={editFormData.destinatario} onChange={e => setEditFormData({...editFormData, destinatario: e.target.value})} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Órgão Destino</Label>
                    <Input value={editFormData.orgao_destino} onChange={e => setEditFormData({...editFormData, orgao_destino: e.target.value})} className="h-8 text-xs" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Assunto Padrão</Label>
                  <Input value={editFormData.assunto} onChange={e => setEditFormData({...editFormData, assunto: e.target.value})} className="h-8 text-xs" />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Periodicidade</Label>
                <Select value={editFormData.periodicidade} onValueChange={v => setEditFormData({...editFormData, periodicidade: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="diaria">Diária</SelectItem>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2 pt-8">
                 <input type="checkbox" id="ativo" checked={editFormData.ativo} onChange={e => setEditFormData({...editFormData, ativo: e.target.checked})} />
                 <Label htmlFor="ativo">Ativo</Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Template de Texto</Label>
              <Textarea
                value={editFormData.template_texto}
                onChange={e => setEditFormData({...editFormData, template_texto: e.target.value})}
                className="font-mono text-xs h-64"
                placeholder="Use placeholders como {{data_inicio}}, {{tabela_atestados}}, etc."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancelar</Button>
            <Button
              type="button"
              onClick={handleSalvarRotina}
              disabled={mutationSalvar.isPending}
            >
              Salvar Rotina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
