import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit3, Loader2, Plus, Search, BookOpenText } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  matchesSubtipoSearch,
  normalizeSubtipoForm,
  validateSubtipoForm,
} from '@/components/rp/subtipoDOEMSUtils';

const EMPTY_FORM = { nome: '', ativo: true, ordem: 0, observacoes: '' };
const LIMIT = 1000;

function StatusBadge({ ativo }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
      ativo !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
    }`}>
      {ativo !== false ? 'Ativo' : 'Inativo'}
    </span>
  );
}

function SubtipoDialog({ open, subtipo, saving, onOpenChange, onSubmit }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (!open) return;
    setForm({
      nome: subtipo?.nome || '',
      ativo: subtipo?.ativo !== false,
      ordem: subtipo?.ordem || 0,
      observacoes: subtipo?.observacoes || '',
    });
    setError('');
  }, [subtipo, open]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const normalized = normalizeSubtipoForm(form);
    const validationError = validateSubtipoForm(normalized);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    onSubmit(normalized);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{subtipo ? 'Editar subtipo' : 'Novo subtipo'}</DialogTitle>
          <DialogDescription>
            Defina o nome e a ordem de exibição do subtipo no fluxo DOEMS.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="cadastro-subtipo-nome">Nome do subtipo *</Label>
            <Input
              id="cadastro-subtipo-nome"
              value={form.nome}
              onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))}
              placeholder="Ex.: Promoção"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cadastro-subtipo-ordem">Ordem</Label>
            <Input
              id="cadastro-subtipo-ordem"
              type="number"
              value={form.ordem}
              onChange={(event) => setForm((current) => ({ ...current, ordem: event.target.value }))}
              placeholder="0"
            />
            <p className="text-xs text-slate-500">Valores menores aparecem primeiro na lista.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cadastro-subtipo-observacoes">Observações</Label>
            <Textarea
              id="cadastro-subtipo-observacoes"
              value={form.observacoes}
              onChange={(event) => setForm((current) => ({ ...current, observacoes: event.target.value }))}
              placeholder="Observações opcionais"
              className="min-h-[88px]"
            />
          </div>
          {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" className="bg-[#1e3a5f] hover:bg-[#2d4a6f]" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar subtipo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function SubtiposDOEMS() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSubtipo, setSelectedSubtipo] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);

  const { data: subtipos = [], isLoading, isError } = useQuery({
    queryKey: ['subtipos-doems-admin'],
    queryFn: () => base44.entities.SubtipoDOEMS.list('ordem', LIMIT),
    staleTime: 30 * 1000,
  });

  const refreshSubtipos = () => {
    queryClient.invalidateQueries({ queryKey: ['subtipos-doems-admin'] });
    queryClient.invalidateQueries({ queryKey: ['subtipos-doems-selector'] });
  };

  const saveMutation = useMutation({
    mutationFn: ({ id, data }) => (id ? base44.entities.SubtipoDOEMS.update(id, data) : base44.entities.SubtipoDOEMS.create(data)),
    onSuccess: (_, variables) => {
      refreshSubtipos();
      setDialogOpen(false);
      setSelectedSubtipo(null);
      toast({ title: variables.id ? 'Subtipo atualizado com sucesso.' : 'Subtipo cadastrado com sucesso.' });
    },
    onError: (error) => toast({ title: 'Não foi possível salvar o subtipo.', description: error?.message, variant: 'destructive' }),
  });

  const statusMutation = useMutation({
    mutationFn: (subtipo) => base44.entities.SubtipoDOEMS.update(subtipo.id, { ativo: subtipo.ativo === false }),
    onSuccess: (_, subtipo) => {
      refreshSubtipos();
      setStatusTarget(null);
      toast({ title: subtipo.ativo === false ? 'Subtipo ativado com sucesso.' : 'Subtipo inativado com sucesso.' });
    },
    onError: (error) => toast({ title: 'Não foi possível alterar o status.', description: error?.message, variant: 'destructive' }),
  });

  const filteredSubtipos = useMemo(
    () => subtipos.filter((subtipo) => matchesSubtipoSearch(subtipo, search)),
    [subtipos, search],
  );

  const openCreate = () => {
    setSelectedSubtipo(null);
    setDialogOpen(true);
  };

  const openEdit = (subtipo) => {
    setSelectedSubtipo(subtipo);
    setDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-100 p-2.5"><BookOpenText className="h-6 w-6 text-[#1e3a5f]" /></div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Subtipos DOEMS</h1>
                <p className="text-sm text-slate-600">Gerencie os subtipos disponíveis no registro de publicações DOEMS.</p>
              </div>
            </div>
          </div>
          <Button onClick={openCreate} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
            <Plus className="mr-2 h-4 w-4" /> Novo Subtipo
          </Button>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4">
            <div className="relative max-w-xl">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar por nome ou observações..." className="pl-9" />
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-12 w-full" />)}
            </div>
          ) : isError ? (
            <div className="p-8 text-center text-sm text-red-600">Não foi possível carregar o cadastro de subtipos.</div>
          ) : filteredSubtipos.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">Nenhum subtipo encontrado.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Ordem</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubtipos.map((subtipo) => (
                  <TableRow key={subtipo.id}>
                    <TableCell className="text-slate-600 font-mono">{subtipo.ordem || 0}</TableCell>
                    <TableCell className="font-medium text-slate-900">{subtipo.nome || '—'}</TableCell>
                    <TableCell><StatusBadge ativo={subtipo.ativo} /></TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(subtipo)}><Edit3 className="mr-1.5 h-3.5 w-3.5" /> Editar</Button>
                        <Button variant={subtipo.ativo === false ? 'outline' : 'ghost'} size="sm" onClick={() => setStatusTarget(subtipo)}>
                          {subtipo.ativo === false ? 'Ativar' : 'Inativar'}
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

      <SubtipoDialog
        open={dialogOpen}
        subtipo={selectedSubtipo}
        saving={saveMutation.isPending}
        onOpenChange={setDialogOpen}
        onSubmit={(data) => saveMutation.mutate({ id: selectedSubtipo?.id, data })}
      />

      <AlertDialog open={!!statusTarget} onOpenChange={(open) => !open && setStatusTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{statusTarget?.ativo === false ? 'Ativar subtipo?' : 'Inativar subtipo?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {statusTarget?.ativo === false
                ? 'O subtipo voltará a aparecer na seleção de novos registros DOEMS.'
                : 'O subtipo deixará de aparecer na seleção de novos registros DOEMS. Registros existentes serão preservados.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={statusMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => statusMutation.mutate(statusTarget)} disabled={statusMutation.isPending}>
              {statusMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
