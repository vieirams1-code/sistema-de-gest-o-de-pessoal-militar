import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Edit3, Loader2, Plus, Search } from 'lucide-react';
import AccessDenied from '@/components/auth/AccessDenied';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import {
  alternarStatusClassificacaoHistoricaAlteracao,
  garantirClassificacoesHistoricasIniciais,
  normalizarClassificacaoHistoricaForm,
  salvarClassificacaoHistoricaAlteracao,
  validarClassificacaoHistoricaForm,
} from '@/services/classificacoesHistoricasAlteracoesService';

const EMPTY_FORM = {
  nome: '',
  grupo: '',
  descricao: '',
  ativo: true,
  ordem: '',
  uso_migracao: true,
  legado: true,
};

const STATUS_FILTERS = {
  todos: 'todos',
  ativos: 'ativos',
  inativos: 'inativos',
};

function StatusBadge({ ativo }) {
  return (
    <Badge variant="outline" className={ativo !== false ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'}>
      {ativo !== false ? 'Ativa' : 'Inativa'}
    </Badge>
  );
}

function ClassificacaoHistoricaDialog({ open, classificacao, saving, onOpenChange, onSubmit }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (!open) return;
    setForm({
      nome: classificacao?.nome || '',
      grupo: classificacao?.grupo || '',
      descricao: classificacao?.descricao || '',
      ativo: classificacao?.ativo !== false,
      ordem: classificacao?.ordem === null || classificacao?.ordem === undefined ? '' : String(classificacao.ordem),
      uso_migracao: classificacao?.uso_migracao !== false,
      legado: classificacao?.legado !== false,
    });
    setError('');
  }, [classificacao, open]);

  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const handleSubmit = (event) => {
    event.preventDefault();
    const payload = normalizarClassificacaoHistoricaForm(form);
    const validationError = validarClassificacaoHistoricaForm(payload);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    onSubmit(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{classificacao ? 'Editar classificação histórica' : 'Nova classificação histórica'}</DialogTitle>
          <DialogDescription>
            Use este cadastro apenas para organizar alterações funcionais históricas do legado.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="classificacao-historica-nome">Nome *</Label>
            <Input
              id="classificacao-historica-nome"
              value={form.nome}
              onChange={(event) => updateForm('nome', event.target.value)}
              placeholder="Ex.: Concessão de Férias"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
            <div className="space-y-1.5">
              <Label htmlFor="classificacao-historica-grupo">Grupo</Label>
              <Input
                id="classificacao-historica-grupo"
                value={form.grupo}
                onChange={(event) => updateForm('grupo', event.target.value)}
                placeholder="Ex.: Férias"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="classificacao-historica-ordem">Ordem</Label>
              <Input
                id="classificacao-historica-ordem"
                type="number"
                value={form.ordem}
                onChange={(event) => updateForm('ordem', event.target.value)}
                placeholder="10"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="classificacao-historica-descricao">Descrição</Label>
            <Textarea
              id="classificacao-historica-descricao"
              value={form.descricao}
              onChange={(event) => updateForm('descricao', event.target.value)}
              placeholder="Observação administrativa opcional"
              className="min-h-[82px]"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
            <div>
              <Label htmlFor="classificacao-historica-ativo">Classificação ativa</Label>
              <p className="text-xs text-slate-500">Inative para esconder em seleções futuras sem apagar o histórico.</p>
            </div>
            <Switch id="classificacao-historica-ativo" checked={form.ativo} onCheckedChange={(checked) => updateForm('ativo', checked)} />
          </div>

          {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" className="bg-[#1e3a5f] hover:bg-[#2d4a6f]" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ClassificacoesHistoricasAlteracoes() {
  const { isLoading, isAccessResolved, canAccessModule, canAccessAction } = useCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(STATUS_FILTERS.ativos);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClassificacao, setSelectedClassificacao] = useState(null);

  const hasAccess = canAccessModule('migracao_alteracoes_legado') && canAccessAction('gerir_classificacoes_historicas');

  const { data: classificacoes = [], isFetching, isError } = useQuery({
    queryKey: ['classificacoes-historicas-alteracoes'],
    queryFn: async () => {
      const resultado = await garantirClassificacoesHistoricasIniciais();
      return resultado.registros;
    },
    enabled: isAccessResolved && hasAccess,
    staleTime: 30 * 1000,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['classificacoes-historicas-alteracoes'] });

  const saveMutation = useMutation({
    mutationFn: ({ id, data }) => salvarClassificacaoHistoricaAlteracao(id, data),
    onSuccess: (_, variables) => {
      refresh();
      setDialogOpen(false);
      setSelectedClassificacao(null);
      toast({ title: variables.id ? 'Classificação histórica atualizada.' : 'Classificação histórica criada.' });
    },
    onError: (error) => toast({ title: 'Não foi possível salvar a classificação.', description: error?.message, variant: 'destructive' }),
  });

  const statusMutation = useMutation({
    mutationFn: alternarStatusClassificacaoHistoricaAlteracao,
    onSuccess: (_, classificacao) => {
      refresh();
      toast({ title: classificacao.ativo === false ? 'Classificação ativada.' : 'Classificação inativada.' });
    },
    onError: (error) => toast({ title: 'Não foi possível alterar o status.', description: error?.message, variant: 'destructive' }),
  });

  const classificacoesFiltradas = useMemo(() => {
    const termo = search.trim().toLowerCase();
    return (classificacoes || []).filter((item) => {
      const matchesStatus = statusFilter === STATUS_FILTERS.todos
        || (statusFilter === STATUS_FILTERS.ativos && item.ativo !== false)
        || (statusFilter === STATUS_FILTERS.inativos && item.ativo === false);
      if (!matchesStatus) return false;
      if (!termo) return true;
      return String(item.nome || '').toLowerCase().includes(termo);
    });
  }, [classificacoes, search, statusFilter]);

  const openCreate = () => {
    setSelectedClassificacao(null);
    setDialogOpen(true);
  };

  const openEdit = (classificacao) => {
    setSelectedClassificacao(classificacao);
    setDialogOpen(true);
  };

  if (isLoading || !isAccessResolved) return null;
  if (!hasAccess) return <AccessDenied modulo="Classificações Históricas de Alterações" />;

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-100 p-2.5"><Archive className="h-6 w-6 text-[#1e3a5f]" /></div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Classificações Históricas</h1>
              <p className="text-sm text-slate-600">Catálogo separado para futuras migrações de alterações funcionais do legado.</p>
            </div>
          </div>
          <Button onClick={openCreate} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
            <Plus className="mr-2 h-4 w-4" /> Nova Classificação Histórica
          </Button>
        </header>

        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Este catálogo não substitui tipos operacionais de Férias, Atestados, Promoções, Gratificações, Publicações/RP ou Registro em Livro.
        </section>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-xl">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome..." className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[190px]">
                <SelectValue placeholder="Filtrar status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={STATUS_FILTERS.ativos}>Somente ativas</SelectItem>
                <SelectItem value={STATUS_FILTERS.inativos}>Somente inativas</SelectItem>
                <SelectItem value={STATUS_FILTERS.todos}>Todas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isFetching ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-12 w-full" />)}
            </div>
          ) : isError ? (
            <div className="p-8 text-center text-sm text-red-600">Não foi possível carregar as classificações históricas.</div>
          ) : classificacoesFiltradas.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">Nenhuma classificação histórica encontrada.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Grupo</TableHead>
                  <TableHead>Ordem</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classificacoesFiltradas.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-slate-700">{item.grupo || '—'}</TableCell>
                    <TableCell className="text-slate-600">{Number.isFinite(Number(item.ordem)) ? item.ordem : '—'}</TableCell>
                    <TableCell className="font-medium text-slate-900">{item.nome || '—'}</TableCell>
                    <TableCell className="max-w-md truncate text-slate-600" title={item.descricao || ''}>{item.descricao || '—'}</TableCell>
                    <TableCell><StatusBadge ativo={item.ativo} /></TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(item)}>
                          <Edit3 className="mr-1.5 h-3.5 w-3.5" /> Editar
                        </Button>
                        <Button variant={item.ativo === false ? 'outline' : 'ghost'} size="sm" onClick={() => statusMutation.mutate(item)} disabled={statusMutation.isPending}>
                          {item.ativo === false ? 'Ativar' : 'Inativar'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </div>

      <ClassificacaoHistoricaDialog
        open={dialogOpen}
        classificacao={selectedClassificacao}
        saving={saveMutation.isPending}
        onOpenChange={setDialogOpen}
        onSubmit={(data) => saveMutation.mutate({ id: selectedClassificacao?.id, data })}
      />
    </div>
  );
}
