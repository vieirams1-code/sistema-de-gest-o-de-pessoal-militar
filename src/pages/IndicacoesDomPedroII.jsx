import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Medal, Search } from 'lucide-react';

import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { useToast } from '@/components/ui/use-toast';
import { criarIndicacaoAutomatica, garantirCatalogoFixoMedalhaTempo, normalizarStatusMedalha, obterTipoMedalhaPorCodigo, resolverCodigoTipoMedalha } from '@/services/medalhasTempoServicoService';

function hojeISO() { return new Date().toISOString().split('T')[0]; }

export default function IndicacoesDomPedroII() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { canAccessModule, isLoading: loadingUser, isAccessResolved } = useCurrentUser();
  const hasMedalhasAccess = canAccessModule('medalhas');

  const [search, setSearch] = useState('');
  const [unidadeFilter, setUnidadeFilter] = useState('TODAS');
  const [postoFilter, setPostoFilter] = useState('TODOS');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [concederDialog, setConcederDialog] = useState({ open: false, medalha: null, data: hojeISO(), doems: '' });

  useQuery({
    queryKey: ['tipos-medalha-fixos-sync-dompedro'],
    queryFn: () => garantirCatalogoFixoMedalhaTempo(base44),
    enabled: isAccessResolved && hasMedalhasAccess,
  });

  const militaresQuery = useQuery({
    queryKey: ['dompedro-militares'],
    queryFn: () => base44.entities.Militar.list('nome_completo'),
    enabled: isAccessResolved && hasMedalhasAccess,
  });
  const medalhasQuery = useQuery({
    queryKey: ['dompedro-medalhas'],
    queryFn: () => base44.entities.Medalha.list('-created_date'),
    enabled: isAccessResolved && hasMedalhasAccess,
  });
  const tiposQuery = useQuery({
    queryKey: ['dompedro-tipos'],
    queryFn: () => base44.entities.TipoMedalha.list('nome'),
    enabled: isAccessResolved && hasMedalhasAccess,
  });

  const militares = militaresQuery.data || [];
  const medalhas = medalhasQuery.data || [];
  const tipos = tiposQuery.data || [];

  const domPedroRegistros = useMemo(() => medalhas.filter((m) => resolverCodigoTipoMedalha(m) === 'DOM_PEDRO_II'), [medalhas]);

  const registroPorMilitar = useMemo(() => {
    const mapa = new Map();
    domPedroRegistros.forEach((registro) => {
      const atual = mapa.get(registro.militar_id);
      const prioridade = (st) => (st === 'CONCEDIDA' ? 2 : st === 'INDICADA' ? 1 : 0);
      if (!atual || prioridade(normalizarStatusMedalha(registro.status)) > prioridade(normalizarStatusMedalha(atual.status))) {
        mapa.set(registro.militar_id, registro);
      }
    });
    return mapa;
  }, [domPedroRegistros]);

  const unidades = useMemo(() => [...new Set(militares.map((m) => m.lotacao || m.unidade).filter(Boolean))], [militares]);
  const postos = useMemo(() => [...new Set(militares.map((m) => m.posto_graduacao).filter(Boolean))], [militares]);

  const rows = useMemo(() => militares.filter((m) => {
    const registro = registroPorMilitar.get(m.id);
    const status = normalizarStatusMedalha(registro?.status) || 'SEM_INDICACAO';
    const termo = search.toLowerCase();
    const unidade = m.lotacao || m.unidade;
    return (!termo || `${m.nome_completo || ''} ${m.matricula || ''}`.toLowerCase().includes(termo))
      && (unidadeFilter === 'TODAS' || unidade === unidadeFilter)
      && (postoFilter === 'TODOS' || m.posto_graduacao === postoFilter)
      && (statusFilter === 'TODOS' || status === statusFilter);
  }), [militares, registroPorMilitar, search, unidadeFilter, postoFilter, statusFilter]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['dompedro-medalhas'] });
    queryClient.invalidateQueries({ queryKey: ['medalhas'] });
  };

  const indicarMutation = useMutation({
    mutationFn: async (militar) => {
      const existente = registroPorMilitar.get(militar.id);
      if (existente?.id && normalizarStatusMedalha(existente.status) !== 'CONCEDIDA') {
        return base44.entities.Medalha.update(existente.id, { status: 'INDICADA', data_indicacao: hojeISO() });
      }
      let tipo = obterTipoMedalhaPorCodigo('DOM_PEDRO_II', tipos);
      if (!tipo?.id) {
        await garantirCatalogoFixoMedalhaTempo(base44);
        tipo = obterTipoMedalhaPorCodigo('DOM_PEDRO_II', await base44.entities.TipoMedalha.list('nome'));
      }
      const payload = criarIndicacaoAutomatica({ militar, medalhaDevida: 'DOM_PEDRO_II', tipoMedalha: tipo });
      payload.origem_registro = 'INDICACAO_MANUAL_DOM_PEDRO_II';
      payload.observacoes = 'Fluxo manual Dom Pedro II.';
      return base44.entities.Medalha.create(payload);
    },
    onSuccess: () => { refresh(); toast({ title: 'Indicação registrada para Dom Pedro II.' }); },
  });

  const concederMutation = useMutation({
    mutationFn: ({ medalhaId, data_concessao, numero_publicacao }) => base44.entities.Medalha.update(medalhaId, {
      status: 'CONCEDIDA',
      data_concessao,
      numero_publicacao,
      doems_numero: numero_publicacao,
    }),
    onSuccess: () => {
      refresh();
      setConcederDialog({ open: false, medalha: null, data: hojeISO(), doems: '' });
      toast({ title: 'Concessão registrada para Dom Pedro II.' });
    },
  });

  if (loadingUser || !isAccessResolved) return null;
  if (!hasMedalhasAccess) return <AccessDenied modulo="Medalhas" />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-5">
        <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('ApuracaoMedalhasTempoServico'))}><ArrowLeft className="w-4 h-4" /></Button>
            <Medal className="w-6 h-6 text-[#1e3a5f]" />
            <div>
              <h1 className="text-2xl font-bold text-[#1e3a5f]">Indicações Dom Pedro II</h1>
              <p className="text-sm text-slate-600">Fluxo manual separado para indicação e concessão da medalha Dom Pedro II.</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou matrícula" />
          </div>
          <Select value={unidadeFilter} onValueChange={setUnidadeFilter}><SelectTrigger><SelectValue placeholder="Unidade" /></SelectTrigger><SelectContent><SelectItem value="TODAS">Todas unidades</SelectItem>{unidades.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select>
          <Select value={postoFilter} onValueChange={setPostoFilter}><SelectTrigger><SelectValue placeholder="Posto/Graduação" /></SelectTrigger><SelectContent><SelectItem value="TODOS">Todos postos</SelectItem>{postos.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="TODOS">Todos status</SelectItem><SelectItem value="SEM_INDICACAO">Sem indicação</SelectItem><SelectItem value="INDICADA">Indicada</SelectItem><SelectItem value="CONCEDIDA">Concedida</SelectItem></SelectContent></Select>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead><tr className="text-left text-slate-500 border-b"><th className="py-3 px-2">Militar</th><th className="py-3 px-2">Unidade</th><th className="py-3 px-2">Status</th><th className="py-3 px-2">Ações</th></tr></thead>
            <tbody>
              {rows.map((militar) => {
                const registro = registroPorMilitar.get(militar.id);
                const status = normalizarStatusMedalha(registro?.status) || 'SEM_INDICACAO';
                return (
                  <tr key={militar.id} className="border-b last:border-0">
                    <td className="py-3 px-2"><p className="font-semibold text-slate-800">{militar.posto_graduacao} {militar.nome_completo}</p><p className="text-xs text-slate-500">Mat: {militar.matricula || '—'}</p></td>
                    <td className="py-3 px-2">{militar.lotacao || militar.unidade || '—'}</td>
                    <td className="py-3 px-2">{status === 'CONCEDIDA' ? <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Concedida</Badge> : status === 'INDICADA' ? <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Indicada</Badge> : <span className="text-slate-500">Sem indicação</span>}</td>
                    <td className="py-3 px-2 flex gap-2">
                      {status !== 'CONCEDIDA' && <Button size="sm" className="bg-[#1e3a5f] hover:bg-[#2d4a6f]" onClick={() => indicarMutation.mutate(militar)}>Indicar</Button>}
                      {status === 'INDICADA' && <Button size="sm" variant="outline" onClick={() => setConcederDialog({ open: true, medalha: registro, data: hojeISO(), doems: '' })}>Conceder</Button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={concederDialog.open} onOpenChange={(open) => setConcederDialog((curr) => ({ ...curr, open }))}>
        <DialogContent>
          <DialogHeader><DialogTitle>Conceder Dom Pedro II</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input type="date" value={concederDialog.data} onChange={(e) => setConcederDialog((curr) => ({ ...curr, data: e.target.value }))} />
            <Input value={concederDialog.doems} onChange={(e) => setConcederDialog((curr) => ({ ...curr, doems: e.target.value }))} placeholder="Número do DOEMS" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConcederDialog({ open: false, medalha: null, data: hojeISO(), doems: '' })}>Cancelar</Button>
            <Button disabled={!concederDialog.data || !concederDialog.doems} onClick={() => concederMutation.mutate({ medalhaId: concederDialog.medalha?.id, data_concessao: concederDialog.data, numero_publicacao: concederDialog.doems })}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
