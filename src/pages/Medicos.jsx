import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit3, Loader2, Plus, Search, Stethoscope } from 'lucide-react';
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
  findDuplicateCrm,
  matchesMedicoSearch,
  normalizeMedicoForm,
  validateMedicoForm,
} from '@/components/atestado/medicoUtils';

const EMPTY_FORM = { nome: '', crm: '', observacoes: '', ativo: true };
const MEDICOS_LIMIT = 1000;

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function StatusBadge({ ativo }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
      ativo !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
    }`}>
      {ativo !== false ? 'Ativo' : 'Inativo'}
    </span>
  );
}

function MedicoDialog({ open, medico, medicos, saving, onOpenChange, onSubmit }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (!open) return;
    setForm({
      nome: medico?.nome || '',
      crm: medico?.crm || '',
      observacoes: medico?.observacoes || '',
      ativo: medico?.ativo !== false,
    });
    setError('');
  }, [medico, open]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const normalized = normalizeMedicoForm(form);
    const validationError = validateMedicoForm(normalized);
    if (validationError) {
      setError(validationError);
      return;
    }
    const duplicate = findDuplicateCrm(medicos, normalized.crm, medico?.id);
    if (duplicate) {
      setError(`Já existe um médico cadastrado com este CRM: ${duplicate.nome}.`);
      return;
    }
    setError('');
    onSubmit(normalized);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{medico ? 'Editar médico' : 'Novo médico'}</DialogTitle>
          <DialogDescription>
            Os dados atualizados serão usados apenas ao selecionar este cadastro em novos atestados ou em edições posteriores.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="cadastro-medico-nome">Nome do médico *</Label>
            <Input
              id="cadastro-medico-nome"
              value={form.nome}
              onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))}
              placeholder="Dr(a). Nome do médico"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cadastro-medico-crm">CRM *</Label>
            <Input
              id="cadastro-medico-crm"
              value={form.crm}
              onChange={(event) => setForm((current) => ({ ...current, crm: event.target.value }))}
              placeholder="Ex.: CRM/SP 123456"
            />
            <p className="text-xs text-slate-500">Informe a UF junto ao CRM quando disponível, por exemplo: CRM/SP 123456.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cadastro-medico-observacoes">Observações</Label>
            <Textarea
              id="cadastro-medico-observacoes"
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
              Salvar médico
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Medicos() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMedico, setSelectedMedico] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);

  const { data: medicos = [], isLoading, isError } = useQuery({
    queryKey: ['medicos-admin'],
    queryFn: () => base44.entities.Medico.list('-updated_date', MEDICOS_LIMIT),
    staleTime: 30 * 1000,
  });

  const refreshMedicos = () => {
    queryClient.invalidateQueries({ queryKey: ['medicos-admin'] });
    queryClient.invalidateQueries({ queryKey: ['medicos-selector'] });
  };

  const saveMutation = useMutation({
    mutationFn: ({ id, data }) => (id ? base44.entities.Medico.update(id, data) : base44.entities.Medico.create(data)),
    onSuccess: (_, variables) => {
      refreshMedicos();
      setDialogOpen(false);
      setSelectedMedico(null);
      toast({ title: variables.id ? 'Médico atualizado com sucesso.' : 'Médico cadastrado com sucesso.' });
    },
    onError: (error) => toast({ title: 'Não foi possível salvar o médico.', description: error?.message, variant: 'destructive' }),
  });

  const statusMutation = useMutation({
    mutationFn: (medico) => base44.entities.Medico.update(medico.id, { ativo: medico.ativo === false }),
    onSuccess: (_, medico) => {
      refreshMedicos();
      setStatusTarget(null);
      toast({ title: medico.ativo === false ? 'Médico ativado com sucesso.' : 'Médico inativado com sucesso.' });
    },
    onError: (error) => toast({ title: 'Não foi possível alterar o status.', description: error?.message, variant: 'destructive' }),
  });

  const filteredMedicos = useMemo(
    () => medicos.filter((medico) => matchesMedicoSearch(medico, search)),
    [medicos, search],
  );

  const openCreate = () => {
    setSelectedMedico(null);
    setDialogOpen(true);
  };

  const openEdit = (medico) => {
    setSelectedMedico(medico);
    setDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-100 p-2.5"><Stethoscope className="h-6 w-6 text-[#1e3a5f]" /></div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Cadastro de Médicos</h1>
                <p className="text-sm text-slate-600">Gerencie os dados usados como referência nos atestados médicos.</p>
              </div>
            </div>
          </div>
          <Button onClick={openCreate} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
            <Plus className="mr-2 h-4 w-4" /> Novo Médico
          </Button>
        </header>

        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Alterações neste cadastro não modificam snapshots já gravados em atestados antigos, publicados ou homologados.
        </section>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4">
            <div className="relative max-w-xl">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar por nome ou CRM..." className="pl-9" />
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-12 w-full" />)}
            </div>
          ) : isError ? (
            <div className="p-8 text-center text-sm text-red-600">Não foi possível carregar o cadastro de médicos.</div>
          ) : filteredMedicos.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">Nenhum médico encontrado.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CRM / UF</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criação</TableHead>
                  <TableHead>Atualização</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMedicos.map((medico) => (
                  <TableRow key={medico.id}>
                    <TableCell className="font-medium text-slate-900">{medico.nome || '—'}</TableCell>
                    <TableCell>{medico.crm || '—'}</TableCell>
                    <TableCell><StatusBadge ativo={medico.ativo} /></TableCell>
                    <TableCell className="text-sm text-slate-600">{formatDateTime(medico.created_date)}</TableCell>
                    <TableCell className="text-sm text-slate-600">{formatDateTime(medico.updated_date)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(medico)}><Edit3 className="mr-1.5 h-3.5 w-3.5" /> Editar</Button>
                        <Button variant={medico.ativo === false ? 'outline' : 'ghost'} size="sm" onClick={() => setStatusTarget(medico)}>
                          {medico.ativo === false ? 'Ativar' : 'Inativar'}
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

      <MedicoDialog
        open={dialogOpen}
        medico={selectedMedico}
        medicos={medicos}
        saving={saveMutation.isPending}
        onOpenChange={setDialogOpen}
        onSubmit={(data) => saveMutation.mutate({ id: selectedMedico?.id, data })}
      />

      <AlertDialog open={!!statusTarget} onOpenChange={(open) => !open && setStatusTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{statusTarget?.ativo === false ? 'Ativar médico?' : 'Inativar médico?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {statusTarget?.ativo === false
                ? 'O médico voltará a aparecer na seleção de novos atestados.'
                : 'O médico deixará de aparecer na seleção de novos atestados. Snapshots históricos serão preservados.'}
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
