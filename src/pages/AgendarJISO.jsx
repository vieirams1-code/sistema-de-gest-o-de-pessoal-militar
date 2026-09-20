import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Clock, FileText, MapPin, Plus, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { fetchScopedAtestadosBundle } from '@/services/getScopedAtestadosBundleClient';
import { jisoService } from '@/services/jisoService';
import { createPageUrl } from '@/utils';

const STATUS_CLASS = {
  Rascunho: 'bg-slate-100 text-slate-700',
  'Aguardando Agendamento': 'bg-amber-100 text-amber-800',
  Agendada: 'bg-blue-100 text-blue-800',
  Realizada: 'bg-violet-100 text-violet-800',
  'Resultado Registrado': 'bg-indigo-100 text-indigo-800',
  'Concluída': 'bg-emerald-100 text-emerald-800',
  Cancelada: 'bg-red-100 text-red-800',
};

const initialForm = {
  data_jiso: '',
  hora_jiso: '',
  local_jiso: '',
  secao_jiso: '',
  finalidade_jiso: 'LTS',
  nup: '',
};

function formatDate(value) {
  if (!value) return 'Não agendada';
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

export default function AgendarJISO() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canAccessModule, canAccessAction, isLoading, isAccessResolved } = useCurrentUser();
  const canView = canAccessAction('gerir_jiso') || canAccessAction('registrar_decisao_jiso');
  const canManage = canAccessAction('gerir_jiso');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [atestadoSearch, setAtestadoSearch] = useState('');
  const [form, setForm] = useState(initialForm);

  const { data: lista = [], isLoading: loadingJisos, error } = useQuery({
    queryKey: ['jisos-independentes'],
    queryFn: async () => (await jisoService.listar()).jisos || [],
    enabled: isAccessResolved && canAccessModule('atestados') && canView,
  });

  const { data: atestados = [] } = useQuery({
    queryKey: ['atestados-para-jiso'],
    queryFn: async () => {
      const bundle = await fetchScopedAtestadosBundle({ functionName: 'getScopedAtestadosBundleV2', dtoVersion: 'operacional-v2' });
      return bundle?.atestados || [];
    },
    enabled: showCreate && canManage,
  });

  const selectedMilitarId = useMemo(() => {
    const first = atestados.find((item) => selectedIds.includes(item.id));
    return first?.militar_id || '';
  }, [atestados, selectedIds]);

  const selectableAtestados = useMemo(() => {
    const term = atestadoSearch.trim().toLowerCase();
    return atestados
      .filter((item) => !selectedMilitarId || item.militar_id === selectedMilitarId)
      .filter((item) => {
        if (!term) return true;
        return [item.militar_nome, item.militar_matricula, item.tipo_afastamento, item.data_inicio]
          .some((value) => String(value || '').toLowerCase().includes(term));
      })
      .sort((a, b) => String(b.data_inicio || '').localeCompare(String(a.data_inicio || '')));
  }, [atestados, atestadoSearch, selectedMilitarId]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return lista.filter((item) => {
      if (statusFilter !== 'TODOS' && item.status !== statusFilter) return false;
      if (!term) return true;
      return [item.codigo, item.militar_nome, item.militar_matricula, item.finalidade_jiso, item.nup]
        .some((value) => String(value || '').toLowerCase().includes(term));
    });
  }, [lista, search, statusFilter]);

  const createMutation = useMutation({
    mutationFn: () => jisoService.criar({ atestadoIds: selectedIds, jiso: form }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['jisos-independentes'] });
      setShowCreate(false);
      setSelectedIds([]);
      setForm(initialForm);
      const id = data?.jiso?.id;
      if (id) navigate(createPageUrl('EditarJISO') + `?jiso_id=${id}`);
    },
    onError: (err) => alert(err?.message || 'Não foi possível criar a JISO.'),
  });

  const toggleAtestado = (id) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  if (isLoading || !isAccessResolved) return null;
  if (!canAccessModule('atestados') || !canView) return <AccessDenied modulo="JISO / Atestados" />;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-7 space-y-5">
        <div className="rounded-2xl bg-gradient-to-r from-[#1e3a5f] to-[#0f233a] p-6 text-white shadow-lg">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-200">
                <CalendarDays className="h-4 w-4" /> Gestão independente
              </div>
              <h1 className="text-3xl font-black">Juntas de Inspeção de Saúde</h1>
              <p className="mt-1 text-sm text-slate-300">Cada JISO reúne um ou vários atestados do mesmo militar.</p>
            </div>
            {canManage && (
              <Button onClick={() => setShowCreate(true)} className="bg-white text-[#1e3a5f] hover:bg-slate-100">
                <Plus className="mr-2 h-4 w-4" /> Nova JISO
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ['Total', lista.length],
            ['Agendadas', lista.filter((item) => item.status === 'Agendada').length],
            ['Aguardando resultado', lista.filter((item) => ['Realizada', 'Resultado Registrado'].includes(item.status)).length],
            ['Concluídas', lista.filter((item) => item.status === 'Concluída').length],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-2xl font-black text-[#1e3a5f]">{value}</p>
              <p className="text-xs font-medium text-slate-500">{label}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por militar, matrícula, código ou TARS..." className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos os status</SelectItem>
              {Object.keys(STATUS_CLASS).map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error.message}</div>
        ) : loadingJisos ? (
          <div className="py-20 text-center text-sm text-slate-500">Carregando JISOs...</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
            <CalendarDays className="mx-auto mb-3 h-12 w-12 text-slate-300" />
            <p className="font-semibold text-slate-700">Nenhuma JISO encontrada</p>
            <p className="mt-1 text-sm text-slate-500">Crie uma JISO e vincule os atestados que serão analisados.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(createPageUrl('EditarJISO') + `?jiso_id=${item.id}`)}
                className="w-full rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-500">{item.codigo || 'JISO sem código'}</span>
                      <Badge className={STATUS_CLASS[item.status] || STATUS_CLASS.Rascunho}>{item.status || 'Rascunho'}</Badge>
                      {item.whatsapp_status === 'enviado' && <Badge className="bg-emerald-50 text-emerald-700">WhatsApp enviado</Badge>}
                    </div>
                    <h2 className="truncate text-lg font-bold text-slate-900">{item.militar_posto} {item.militar_nome}</h2>
                    <p className="text-sm text-slate-500">Matrícula {item.militar_matricula_atual || item.militar_matricula || '—'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-x-7 gap-y-2 text-sm md:grid-cols-4">
                    <span className="flex items-center gap-2 text-slate-600"><CalendarDays className="h-4 w-4 text-blue-600" />{formatDate(item.data_jiso)}</span>
                    <span className="flex items-center gap-2 text-slate-600"><Clock className="h-4 w-4 text-blue-600" />{item.hora_jiso || '—'}</span>
                    <span className="flex items-center gap-2 text-slate-600"><MapPin className="h-4 w-4 text-blue-600" />{item.local_jiso || item.secao_jiso || '—'}</span>
                    <span className="flex items-center gap-2 text-slate-600"><FileText className="h-4 w-4 text-blue-600" />{item.total_atestados || 0} atestado(s)</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-h-[92vh] w-[96vw] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Criar nova JISO</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <Label>Atestados do militar</Label>
              <Input value={atestadoSearch} onChange={(e) => setAtestadoSearch(e.target.value)} placeholder="Buscar militar, matrícula ou data..." />
              {selectedMilitarId && (
                <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
                  Após o primeiro atestado, a seleção fica restrita ao mesmo militar.
                </div>
              )}
              <div className="max-h-[430px] space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {selectableAtestados.map((atestado) => (
                  <label key={atestado.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-100 p-3 hover:bg-slate-50">
                    <Checkbox checked={selectedIds.includes(atestado.id)} onCheckedChange={() => toggleAtestado(atestado.id)} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{atestado.militar_posto} {atestado.militar_nome}</span>
                      <span className="block text-xs text-slate-500">
                        {formatDate(atestado.data_inicio)} · {atestado.dias || 0} dia(s) · {atestado.tipo_afastamento || 'Atestado'}
                      </span>
                    </span>
                  </label>
                ))}
                {!selectableAtestados.length && <p className="p-6 text-center text-sm text-slate-500">Nenhum atestado encontrado.</p>}
              </div>
              <p className="text-xs font-semibold text-slate-600">{selectedIds.length} atestado(s) selecionado(s)</p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Data</Label><Input type="date" value={form.data_jiso} onChange={(e) => setForm((p) => ({ ...p, data_jiso: e.target.value }))} className="mt-1.5" /></div>
                <div><Label>Horário</Label><Input type="time" value={form.hora_jiso} onChange={(e) => setForm((p) => ({ ...p, hora_jiso: e.target.value }))} className="mt-1.5" /></div>
              </div>
              <div><Label>Local</Label><Input value={form.local_jiso} onChange={(e) => setForm((p) => ({ ...p, local_jiso: e.target.value }))} className="mt-1.5" /></div>
              <div><Label>Seção JISO</Label><Input value={form.secao_jiso} onChange={(e) => setForm((p) => ({ ...p, secao_jiso: e.target.value }))} className="mt-1.5" /></div>
              <div>
                <Label>Finalidade</Label>
                <Select value={form.finalidade_jiso} onValueChange={(value) => setForm((p) => ({ ...p, finalidade_jiso: value }))}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['LTS', 'V.A.F', 'Reserva Remunerada', 'Atestado de Origem'].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>TARS/NUP</Label><Input value={form.nup} onChange={(e) => setForm((p) => ({ ...p, nup: e.target.value }))} className="mt-1.5" /></div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
                <Button disabled={!selectedIds.length || createMutation.isPending} onClick={() => createMutation.mutate()} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
                  {createMutation.isPending ? 'Criando...' : 'Criar JISO'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
