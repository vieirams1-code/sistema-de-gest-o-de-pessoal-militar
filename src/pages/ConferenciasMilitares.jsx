import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { atualizarEscopado } from '@/services/cudEscopadoClient';
import {
  ShieldCheck,
  Plus,
  MoreHorizontal,
  ExternalLink,
  ChevronRight,
  ClipboardCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Copy,
  RefreshCcw,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { conferenciaMilitarService } from '@/services/conferenciaMilitarService';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import GlobalMilitarSearch from '@/components/militar/GlobalMilitarSearch';
import { differenceInDays } from 'date-fns';

const STATUS_LABELS = {
  pendente: { label: 'Pendente', color: 'bg-slate-100 text-slate-700 border-slate-200', icon: Clock },
  em_andamento: { label: 'Em Andamento', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: RefreshCcw },
  concluida: { label: 'Concluída', color: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle2 },
  concluida_com_pendencias: { label: 'Com Pendências', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: AlertCircle },
  cancelada: { label: 'Cancelada', color: 'bg-red-50 text-red-700 border-red-200', icon: XCircle },
};

const ITEM_STATUS_LABELS = {
  pendente: { label: 'Pendente', variant: 'secondary' },
  em_andamento: { label: 'Em Andamento', variant: 'outline' },
  conferido: { label: 'Conferido', variant: 'default' },
  cadastrado: { label: 'Cadastrado', variant: 'default' },
  nao_possui: { label: 'Não Possui', variant: 'secondary' },
  nao_localizado: { label: 'Não Localizado', variant: 'destructive' },
  revisar: { label: 'Revisar', variant: 'outline' },
  pendente_justificado: { label: 'Justificado', variant: 'outline' },
};

const TIPO_LABELS = {
  ingresso: 'Ingresso',
  reativacao: 'Reativação',
  retorno_transferencia: 'Retorno de Transferência',
  saneamento_manual: 'Saneamento Manual',
};

export default function ConferenciasMilitares() {
  const { toast } = useToast();
  const { user, canAccessAction } = useCurrentUser();
  const queryClient = useQueryClient();

  const canManage = canAccessAction('perm_gerir_conferencias_militares');

  const [filtros, setFiltros] = useState({
    militarId: '',
    tipoConferencia: '',
    status: '',
    dataInicio: '',
    dataFim: '',
  });

  const [isNovaConferenciaOpen, setIsNovaConferenciaOpen] = useState(false);
  const [selectedConferenciaId, setSelectedConferenciaId] = useState(null);

  const { data: conferencias = [], isLoading } = useQuery({
    queryKey: ['conferencias-militares', filtros],
    queryFn: () => conferenciaMilitarService.listarConferencias(filtros),
  });

  const stats = useMemo(() => {
    const hoje = new Date();
    return {
      pendentes: conferencias.filter(c => c.status === 'pendente').length,
      emAndamento: conferencias.filter(c => c.status === 'em_andamento').length,
      concluidas: conferencias.filter(c => c.status === 'concluida').length,
      comPendencias: conferencias.filter(c => c.status === 'concluida_com_pendencias' || (c.status === 'em_andamento' && c.progresso_percentual > 0)).length,
      criticas: conferencias.filter(c =>
        ['pendente', 'em_andamento'].includes(c.status) &&
        differenceInDays(hoje, new Date(c.data_abertura)) > 30
      ).length,
    };
  }, [conferencias]);

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-blue-600" />
            Conferência Cadastral de Militar
          </h1>
          <p className="text-slate-500">
            Controle de saneamento cadastral de militares recém-cadastrados, reativados ou retornados.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setIsNovaConferenciaOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Conferência
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-50/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Pendentes</p>
                <p className="text-2xl font-bold text-slate-900">{stats.pendentes}</p>
              </div>
              <div className="p-3 bg-slate-100 rounded-xl">
                <Clock className="w-5 h-5 text-slate-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Em Andamento</p>
                <p className="text-2xl font-bold text-blue-900">{stats.emAndamento}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <RefreshCcw className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Concluídas</p>
                <p className="text-2xl font-bold text-green-900">{stats.concluidas}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-xl">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-600">Com Pendências</p>
                <p className="text-2xl font-bold text-amber-900">{stats.comPendencias}</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-xl">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {stats.criticas > 0 && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-xl text-red-800 animate-pulse">
          <div className="p-2 bg-red-100 rounded-full">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold">Atenção Gestor</p>
            <p className="text-xs opacity-90">Existem <strong>{stats.criticas}</strong> conferências abertas há mais de 30 dias aguardando conclusão.</p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3 border-b bg-slate-50/30">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="w-full md:w-80">
              <Label className="text-xs uppercase text-slate-500 font-bold mb-1.5 block">Militar</Label>
              <GlobalMilitarSearch
                onSelect={(m) => setFiltros(f => ({ ...f, militarId: m?.id || '' }))}
                placeholder="Filtrar por militar..."
              />
            </div>
            <div className="w-full md:w-48">
              <Label className="text-xs uppercase text-slate-500 font-bold mb-1.5 block">Tipo</Label>
              <Select
                value={filtros.tipoConferencia}
                onValueChange={(v) => setFiltros(f => ({ ...f, tipoConferencia: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="null">Todos os tipos</SelectItem>
                  {Object.entries(TIPO_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-48">
              <Label className="text-xs uppercase text-slate-500 font-bold mb-1.5 block">Status</Label>
              <Select
                value={filtros.status}
                onValueChange={(v) => setFiltros(f => ({ ...f, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="null">Todos os status</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([val, { label }]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-48">
              <Label className="text-xs uppercase text-slate-500 font-bold mb-1.5 block">Início</Label>
              <Input
                type="date"
                value={filtros.dataInicio}
                onChange={(e) => setFiltros(f => ({ ...f, dataInicio: e.target.value }))}
              />
            </div>
            <div className="w-full md:w-48">
              <Label className="text-xs uppercase text-slate-500 font-bold mb-1.5 block">Fim</Label>
              <Input
                type="date"
                value={filtros.dataFim}
                onChange={(e) => setFiltros(f => ({ ...f, dataFim: e.target.value }))}
              />
            </div>
            <div className="w-full md:w-auto">
              <Button
                variant="ghost"
                onClick={() => setFiltros({ militarId: '', tipoConferencia: '', status: '', dataInicio: '', dataFim: '' })}
                className="text-slate-500"
              >
                Limpar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead className="w-[300px]">Militar</TableHead>
                <TableHead>Tipo de Conferência</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[200px]">Progresso</TableHead>
                <TableHead>Data de Abertura</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-slate-500">
                    Carregando conferências...
                  </TableCell>
                </TableRow>
              ) : conferencias.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-slate-500">
                    Nenhuma conferência encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                conferencias.map((conferencia) => (
                  <TableRow key={conferencia.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-900">{conferencia.militar_nome}</span>
                        <span className="text-xs text-slate-500">{conferencia.militar_posto_graduacao} • Matrícula {conferencia.militar_matricula}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal border-slate-200">
                        {TIPO_LABELS[conferencia.tipo_conferencia]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {React.createElement(STATUS_LABELS[conferencia.status].icon, { className: "w-3.5 h-3.5" })}
                        <span className="text-sm font-medium">{STATUS_LABELS[conferencia.status].label}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500">
                          <span>Progresso</span>
                          <span>{conferencia.progresso_percentual}%</span>
                        </div>
                        <Progress value={conferencia.progresso_percentual} className="h-1.5" />
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">
                      {format(new Date(conferencia.data_abertura), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">
                      {conferencia.responsavel_nome || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => setSelectedConferenciaId(conferencia.id)}
                      >
                        Abrir
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <NovaConferenciaModal
        isOpen={isNovaConferenciaOpen}
        onClose={() => setIsNovaConferenciaOpen(false)}
        onSuccess={(id) => {
          setIsNovaConferenciaOpen(false);
          queryClient.invalidateQueries(['conferencias-militares']);
          setSelectedConferenciaId(id);
        }}
      />

      <ConferenciaDetalhesDrawer
        conferenciaId={selectedConferenciaId}
        onClose={() => {
          setSelectedConferenciaId(null);
          queryClient.invalidateQueries(['conferencias-militares']);
        }}
      />
    </div>
  );
}

function ConferenciaDetalhesDrawer({ conferenciaId, onClose }) {
  const { toast } = useToast();
  const { user, canAccessAction } = useCurrentUser();
  const queryClient = useQueryClient();

  const canManage = canAccessAction('perm_gerir_conferencias_militares');

  const { data: conferencia, isLoading } = useQuery({
    queryKey: ['conferencia-detalhada', conferenciaId],
    queryFn: () => conferenciaMilitarService.obterConferenciaDetalhada(conferenciaId),
    enabled: !!conferenciaId,
  });

  const mutationUpdateItem = useMutation({
    mutationFn: ({ itemId, dados }) => conferenciaMilitarService.atualizarItemConferencia(itemId, dados, user),
    onSuccess: () => {
      queryClient.invalidateQueries(['conferencia-detalhada', conferenciaId]);
      toast({ title: "Sucesso", description: "Item atualizado." });
    },
  });

  const mutationUpdateConferencia = useMutation({
    mutationFn: (dados) => atualizarEscopado('ConferenciaMilitar', conferenciaId, dados),
    onSuccess: () => {
      queryClient.invalidateQueries(['conferencia-detalhada', conferenciaId]);
    },
  });

  const mutationStatus = useMutation({
    mutationFn: (action) => {
      if (action === 'concluir') return conferenciaMilitarService.concluirConferencia(conferenciaId);
      if (action === 'reabrir') return conferenciaMilitarService.reabrirConferencia(conferenciaId);
      if (action === 'cancelar') return conferenciaMilitarService.cancelarConferencia(conferenciaId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['conferencia-detalhada', conferenciaId]);
      toast({ title: "Sucesso", description: "Status da conferência atualizado." });
    },
    onError: (err) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  });

  const copiarMissaoTrello = (conf) => {
    const dataInicio = conf.data_inicio_referencia ? format(new Date(conf.data_inicio_referencia), 'dd/MM/yyyy') : 'Não informada';
    const dataFim = conf.data_fim_referencia ? format(new Date(conf.data_fim_referencia), 'dd/MM/yyyy') : 'Não informada';

    const texto = `Título:
Conferência cadastral — ${conf.militar_posto_graduacao} ${conf.militar_nome}

Descrição:
Militar com conferência cadastral aberta no SGP.
Tipo: ${TIPO_LABELS[conf.tipo_conferencia]}
Período de referência: ${dataInicio} a ${dataFim}
A conferência oficial deve ser registrada no SGP.
Link da conferência: ${window.location.origin}/ConferenciasMilitares

Checklist:
- Conferir dados funcionais básicos
- Conferir promoções
- Conferir medalhas
- Conferir punições/elogios
- Conferir férias/períodos aquisitivos
- Conferir afastamentos/JISO
- Conferir cursos
- Conferir funções/designações/gratificações
- Conferir documentos
- Encerrar conferência no SGP`;

    navigator.clipboard.writeText(texto);
    toast({ title: "Copiado", description: "Texto da missão copiado para a área de transferência." });
  };

  if (!conferenciaId) return null;

  return (
    <Sheet open={!!conferenciaId} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-[800px] overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center">Carregando detalhes...</div>
        ) : conferencia && (
          <div className="space-y-6">
            <SheetHeader>
              <div className="flex justify-between items-start">
                <div>
                  <SheetTitle className="text-xl">Conferência Cadastral</SheetTitle>
                  <SheetDescription>
                    {conferencia.militar_nome} • {conferencia.militar_posto_graduacao}
                  </SheetDescription>
                </div>
                <Badge variant="outline" className={STATUS_LABELS[conferencia.status].color}>
                  {STATUS_LABELS[conferencia.status].label}
                </Badge>
              </div>
            </SheetHeader>

            <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="space-y-1">
                <p className="text-slate-500 font-medium">Tipo</p>
                <p className="font-semibold">{TIPO_LABELS[conferencia.tipo_conferencia]}</p>
              </div>
              <div className="space-y-1">
                <p className="text-slate-500 font-medium">Responsável</p>
                <p className="font-semibold">{conferencia.responsavel_nome || 'Não definido'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-slate-500 font-medium">Referência</p>
                <p className="font-semibold">
                  {conferencia.data_inicio_referencia ? format(new Date(conferencia.data_inicio_referencia), 'dd/MM/yyyy') : '—'}
                  {' até '}
                  {conferencia.data_fim_referencia ? format(new Date(conferencia.data_fim_referencia), 'dd/MM/yyyy') : '—'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-slate-500 font-medium">Data Abertura</p>
                <p className="font-semibold">{format(new Date(conferencia.data_abertura), 'dd/MM/yyyy HH:mm')}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold uppercase text-slate-500">
                <span>Progresso Geral</span>
                <span>{conferencia.progresso_percentual}%</span>
              </div>
              <Progress value={conferencia.progresso_percentual} className="h-2" />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-blue-600" />
                  Checklist de Conferência
                </h3>
              </div>

              <div className="border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Item / Categoria</TableHead>
                      <TableHead className="w-[180px]">Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conferencia.itens?.map((item) => (
                      <TableRow key={item.id} className="group">
                        <TableCell>
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-bold uppercase text-slate-400">{item.categoria}</span>
                            <p className="text-sm font-semibold text-slate-900">{item.titulo}</p>
                            <p className="text-xs text-slate-500 line-clamp-1">{item.descricao}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={item.status}
                            onValueChange={(v) => mutationUpdateItem.mutate({ itemId: item.id, dados: { status: v } })}
                            disabled={!canManage || ['concluida', 'concluida_com_pendencias', 'cancelada'].includes(conferencia.status)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(ITEM_STATUS_LABELS).map(([val, { label }]) => (
                                <SelectItem key={val} value={val}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                           <ItemObservacaoModal
                              item={item}
                              onSave={(obs) => mutationUpdateItem.mutate({ itemId: item.id, dados: { observacao: obs } })}
                              disabled={!canManage || ['concluida', 'concluida_com_pendencias', 'cancelada'].includes(conferencia.status)}
                           />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="space-y-2 border-t pt-6">
              <Label>Vínculo Trello (Opcional)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="URL do Card no Trello..."
                  value={conferencia.trello_card_url || ''}
                  onChange={(e) => mutationUpdateConferencia.mutate({ trello_card_url: e.target.value })}
                  disabled={!canManage}
                />
                <Button variant="outline" size="icon" onClick={() => window.open(conferencia.trello_card_url, '_blank')} disabled={!conferencia.trello_card_url}>
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap justify-between gap-3 pt-6 border-t">
              <div className="flex gap-3">
                {canManage && (
                  conferencia.status === 'em_andamento' || conferencia.status === 'pendente' ? (
                    <>
                      <Button onClick={() => mutationStatus.mutate('concluir')} className="gap-2 bg-green-600 hover:bg-green-700">
                        <CheckCircle2 className="w-4 h-4" />
                        Concluir Conferência
                      </Button>
                      <Button variant="destructive" onClick={() => mutationStatus.mutate('cancelar')} className="gap-2">
                        <XCircle className="w-4 h-4" />
                        Cancelar
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" onClick={() => mutationStatus.mutate('reabrir')} className="gap-2">
                      <RefreshCcw className="w-4 h-4" />
                      Reabrir Conferência
                    </Button>
                  )
                )}
              </div>

              <Button variant="outline" onClick={() => copiarMissaoTrello(conferencia)} className="gap-2">
                <Copy className="w-4 h-4" />
                Copiar missão para Trello
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ItemObservacaoModal({ item, onSave, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const [obs, setObs] = useState(item.observacao || '');

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <Button variant="ghost" size="icon" onClick={() => setIsOpen(true)} className="h-8 w-8 text-slate-400 hover:text-slate-900">
        <MoreHorizontal className="w-4 h-4" />
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Observações do Item</DialogTitle>
          <DialogDescription>{item.titulo}</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label>Texto da Observação / Justificativa</Label>
          <Textarea
            className="mt-2"
            rows={5}
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Descreva pendências, locais de busca ou justificativas..."
            disabled={disabled}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>Fechar</Button>
          {!disabled && (
            <Button onClick={() => { onSave(obs); setIsOpen(false); }}>Salvar Observação</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NovaConferenciaModal({ isOpen, onClose, onSuccess }) {
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const [loading, setLoading] = useState(false);
  const [dados, setDados] = useState({
    militar: null,
    tipo_conferencia: 'ingresso',
    data_inicio_referencia: '',
    data_fim_referencia: '',
    observacao_geral: '',
  });

  const handleCriar = async () => {
    if (!dados.militar) {
      toast({ title: "Erro", description: "Selecione um militar.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const nova = await conferenciaMilitarService.criarConferenciaMilitar({
        ...dados,
        usuario: user
      });
      toast({ title: "Sucesso", description: "Conferência criada com sucesso." });
      onSuccess(nova.id);
    } catch (err) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nova Conferência Cadastral</DialogTitle>
          <DialogDescription>
            Inicie um novo fluxo de saneamento cadastral para um militar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Militar</Label>
            <GlobalMilitarSearch onSelect={(m) => setDados({ ...dados, militar: m })} />
          </div>

          <div className="space-y-2">
            <Label>Tipo de Conferência</Label>
            <Select
              value={dados.tipo_conferencia}
              onValueChange={(v) => setDados({ ...dados, tipo_conferencia: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_LABELS).map(([val, label]) => (
                  <SelectItem key={val} value={val}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data Início (Referência)</Label>
              <Input
                type="date"
                value={dados.data_inicio_referencia}
                onChange={(e) => setDados({ ...dados, data_inicio_referencia: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Data Fim (Referência)</Label>
              <Input
                type="date"
                value={dados.data_fim_referencia}
                onChange={(e) => setDados({ ...dados, data_fim_referencia: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observação Geral</Label>
            <Textarea
              placeholder="Notas adicionais sobre esta conferência..."
              value={dados.observacao_geral}
              onChange={(e) => setDados({ ...dados, observacao_geral: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleCriar} disabled={loading}>
            {loading ? "Criando..." : "Criar Conferência"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
