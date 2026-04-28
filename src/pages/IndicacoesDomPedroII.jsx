import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Download, Medal, Search } from 'lucide-react';

import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { useToast } from '@/components/ui/use-toast';
import ExportarIndicadosModal from '@/components/medalhas/ExportarIndicadosModal';
import { exportarIndicadosParaExcel } from '@/utils/indicadosExcelExport';
import {
  ACOES_MEDALHAS,
  adicionarAuditoriaMedalha,
  listarImpedimentosEscopo,
  listarMedalhasEscopo,
  listarMilitaresEscopo,
  validarMilitarDentroEscopo,
  validarPermissaoAcaoMedalhas,
} from '@/services/medalhasAcessoService';
import {
  criarIndicacaoAutomatica,
  filtrarIndicacoesDomPedroResetaveis,
  garantirCatalogoFixoMedalhaTempo,
  apurarListaMilitaresDomPedroII,
  normalizarStatusMedalha,
  resolverCodigoTipoMedalha,
  resolverOuGarantirTipoMedalha,
} from '@/services/medalhasTempoServicoService';

function hojeISO() { return new Date().toISOString().split('T')[0]; }
function formatarData(valor) {
  if (!valor) return '';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return data.toLocaleDateString('pt-BR');
}

export default function IndicacoesDomPedroII() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, isAdmin, getMilitarScopeFilters, userEmail, canAccessModule, canAccessAction, isLoading: loadingUser, isAccessResolved } = useCurrentUser();
  const hasMedalhasAccess = canAccessModule('medalhas');
  const hasDomPedroAccess = canAccessAction(ACOES_MEDALHAS.DOM_PEDRO);
  const podeConceder = canAccessAction(ACOES_MEDALHAS.CONCEDER);
  const podeResetar = canAccessAction(ACOES_MEDALHAS.RESETAR);
  const podeExportar = canAccessAction(ACOES_MEDALHAS.EXPORTAR);
  const podeModoAdmin = canAccessAction(ACOES_MEDALHAS.ADMIN_OVERRIDE);

  const [search, setSearch] = useState('');
  const [unidadeFilter, setUnidadeFilter] = useState('TODAS');
  const [postoFilter, setPostoFilter] = useState('TODOS');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [medalhaFilter, setMedalhaFilter] = useState('TODAS');
  const [concederDialog, setConcederDialog] = useState({ open: false, medalha: null, data: hojeISO(), doems: '' });
  const [adminModeAtivo, setAdminModeAtivo] = useState(false);
  const [adminIndicacaoDialog, setAdminIndicacaoDialog] = useState({ open: false, militar: null, justificativa: '' });
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  useQuery({
    queryKey: ['tipos-medalha-fixos-sync-dompedro'],
    queryFn: () => garantirCatalogoFixoMedalhaTempo(base44),
    enabled: isAccessResolved && hasMedalhasAccess,
  });

  const militaresQuery = useQuery({
    queryKey: ['dompedro-militares'],
    queryFn: () => listarMilitaresEscopo({ base44Client: base44, isAdmin, getMilitarScopeFilters }),
    enabled: isAccessResolved && hasMedalhasAccess && hasDomPedroAccess,
  });
  const medalhasQuery = useQuery({
    queryKey: ['dompedro-medalhas'],
    queryFn: async () => {
      const militaresEscopo = await listarMilitaresEscopo({ base44Client: base44, isAdmin, getMilitarScopeFilters });
      return listarMedalhasEscopo({ base44Client: base44, isAdmin, militarIds: militaresEscopo.map((m) => m.id).filter(Boolean) });
    },
    enabled: isAccessResolved && hasMedalhasAccess && hasDomPedroAccess,
  });
  const tiposQuery = useQuery({
    queryKey: ['dompedro-tipos'],
    queryFn: () => base44.entities.TipoMedalha.list('nome'),
    enabled: isAccessResolved && hasMedalhasAccess,
  });
  const impedimentosQuery = useQuery({
    queryKey: ['dompedro-impedimentos'],
    queryFn: async () => {
      const militaresEscopo = await listarMilitaresEscopo({ base44Client: base44, isAdmin, getMilitarScopeFilters });
      return listarImpedimentosEscopo({ base44Client: base44, isAdmin, militarIds: militaresEscopo.map((m) => m.id).filter(Boolean) });
    },
    enabled: isAccessResolved && hasMedalhasAccess && hasDomPedroAccess,
  });

  const militares = militaresQuery.data || [];
  const medalhas = medalhasQuery.data || [];
  const tipos = tiposQuery.data || [];
  const impedimentos = impedimentosQuery.data || [];
  const militarIdsEscopo = useMemo(() => new Set(militares.map((m) => m.id).filter(Boolean)), [militares]);
  const apuracaoPorMilitar = useMemo(() => {
    const apuracoes = apurarListaMilitaresDomPedroII({ militares, medalhas, tiposMedalha: tipos, impedimentos });
    return new Map(apuracoes.map((item) => [item.militar_id, item]));
  }, [militares, medalhas, tipos, impedimentos]);

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
    const apuracao = apuracaoPorMilitar.get(m.id);
    const status = normalizarStatusMedalha(registro?.status) || 'SEM_INDICACAO';
    const termo = search.toLowerCase();
    const unidade = m.lotacao || m.unidade;
    const medalhaCodigo = registro ? resolverCodigoTipoMedalha(registro) : 'SEM_INDICACAO';
    const situacao = apuracao?.situacao || 'SEM_DIREITO';
    return (!termo || `${m.nome_completo || ''} ${m.matricula || ''}`.toLowerCase().includes(termo))
      && (unidadeFilter === 'TODAS' || unidade === unidadeFilter)
      && (postoFilter === 'TODOS' || m.posto_graduacao === postoFilter)
      && (statusFilter === 'TODOS' || status === statusFilter || (statusFilter === 'BLOQUEADO' && situacao === 'IMPEDIDO') || (statusFilter === 'INABILITADO' && situacao !== 'ELEGIVEL' && situacao !== 'IMPEDIDO'))
      && (medalhaFilter === 'TODAS' || medalhaCodigo === medalhaFilter);
  }), [militares, registroPorMilitar, apuracaoPorMilitar, search, unidadeFilter, postoFilter, statusFilter, medalhaFilter]);

  const exportRows = useMemo(() => rows.flatMap((militar) => {
    const registro = registroPorMilitar.get(militar.id);
    if (!registro) return [];
    if (normalizarStatusMedalha(registro.status) !== 'INDICADA') return [];
    if (registro.origem_registro && registro.origem_registro !== 'INDICACAO_MANUAL_DOM_PEDRO_II') return [];
    return [{
      militar,
      registro,
      medalhaLabel: 'Medalha Dom Pedro II',
    }];
  }), [rows, registroPorMilitar]);

  const camposExportacao = [
    { key: 'nome', group: 'Dados do militar', label: 'Nome', getValue: (row) => row.militar?.nome_completo || '' },
    { key: 'nome_guerra', group: 'Dados do militar', label: 'Nome de guerra', getValue: (row) => row.militar?.nome_guerra || '' },
    { key: 'matricula', group: 'Dados do militar', label: 'Matrícula', getValue: (row) => row.militar?.matricula || '' },
    { key: 'posto', group: 'Dados do militar', label: 'Posto/Graduação', getValue: (row) => row.militar?.posto_graduacao || '' },
    { key: 'unidade', group: 'Dados do militar', label: 'Unidade', getValue: (row) => row.militar?.lotacao || row.militar?.unidade || '' },
    { key: 'medalha', group: 'Dados da indicação', label: 'Medalha', getValue: (row) => row.medalhaLabel },
    { key: 'status', group: 'Dados da indicação', label: 'Status', getValue: (row) => normalizarStatusMedalha(row.registro?.status) || '' },
    { key: 'data_indicacao', group: 'Dados da indicação', label: 'Data da indicação', getValue: (row) => formatarData(row.registro?.data_indicacao) },
    { key: 'data_concessao', group: 'Dados da indicação', label: 'Data da concessão', getValue: (row) => formatarData(row.registro?.data_concessao) },
    { key: 'doems', group: 'Dados da indicação', label: 'Número do DOEMS', getValue: (row) => row.registro?.numero_publicacao || row.registro?.doems_numero || '' },
    { key: 'observacoes', group: 'Dados da indicação', label: 'Observações', getValue: (row) => row.registro?.observacoes || '' },
  ];
  const camposPadrao = ['nome', 'matricula', 'posto', 'unidade', 'medalha', 'status', 'data_indicacao'];

  const onConfirmarExportacao = (camposSelecionados) => {
    if (!exportRows.length) {
      toast({ title: 'Sem indicados para exportar', description: 'Não há indicações manuais da Dom Pedro II no contexto atual.' });
      return;
    }
    exportarIndicadosParaExcel({
      camposSelecionados,
      registros: exportRows,
      nomeArquivo: `indicados_dom_pedro_ii_${hojeISO()}.xlsx`,
    });
    setExportModalOpen(false);
    toast({ title: 'Exportação concluída', description: `${exportRows.length} indicado(s) exportado(s) em Excel.` });
  };

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['dompedro-medalhas'] });
    queryClient.invalidateQueries({ queryKey: ['medalhas'] });
  };

  const indicarMutation = useMutation({
    mutationFn: async (militar) => {
      validarPermissaoAcaoMedalhas({ canAccessAction, acao: ACOES_MEDALHAS.DOM_PEDRO, mensagem: 'Sem permissão para indicar Dom Pedro II.' });
      validarMilitarDentroEscopo({ isAdmin, militarId: militar?.id, militarIdsEscopo });
      const existente = registroPorMilitar.get(militar.id);
      if (existente?.id && normalizarStatusMedalha(existente.status) !== 'CONCEDIDA') {
        return base44.entities.Medalha.update(existente.id, adicionarAuditoriaMedalha({ status: 'INDICADA', data_indicacao: hojeISO() }, { userEmail, acao: 'indicacao' }));
      }
      const tipo = await resolverOuGarantirTipoMedalha(base44, 'DOM_PEDRO_II', tipos);
      if (!tipo?.id) throw new Error('Tipo DOM_PEDRO_II não encontrado.');
      const payload = criarIndicacaoAutomatica({ militar, medalhaDevida: 'DOM_PEDRO_II', tipoMedalha: tipo });
      payload.origem_registro = 'INDICACAO_MANUAL_DOM_PEDRO_II';
      payload.observacoes = 'Fluxo manual Dom Pedro II.';
      return base44.entities.Medalha.create(adicionarAuditoriaMedalha(payload, { userEmail, acao: 'indicacao' }));
    },
    onSuccess: () => { refresh(); toast({ title: 'Indicação registrada para Dom Pedro II.' }); },
  });

  const indicarAdminMutation = useMutation({
    mutationFn: async ({ militar, justificativa }) => {
      validarPermissaoAcaoMedalhas({ canAccessAction, acao: ACOES_MEDALHAS.ADMIN_OVERRIDE, mensagem: 'Sem permissão para usar override administrativo.' });
      validarMilitarDentroEscopo({ isAdmin, militarId: militar?.id, militarIdsEscopo });
      if (!justificativa?.trim()) {
        throw new Error('A justificativa do override administrativo é obrigatória.');
      }
      const existente = registroPorMilitar.get(militar.id);
      const tipo = await resolverOuGarantirTipoMedalha(base44, 'DOM_PEDRO_II', tipos);
      if (!tipo?.id) throw new Error('Tipo DOM_PEDRO_II não encontrado.');
      const payload = criarIndicacaoAutomatica({ militar, medalhaDevida: 'DOM_PEDRO_II', tipoMedalha: tipo });
      payload.origem_registro = 'INDICACAO_MANUAL_DOM_PEDRO_II_ADMIN_OVERRIDE';
      payload.observacoes = `Indicação Dom Pedro II por override administrativo. Justificativa: ${justificativa.trim()}`;
      payload.override_admin = true;
      payload.override_motivo = justificativa.trim();
      payload.override_usuario_id = user?.id || userEmail || '';
      payload.override_usuario_nome = user?.name || user?.full_name || userEmail || 'Usuário não identificado';
      payload.override_data = new Date().toISOString();

      if (existente?.id && normalizarStatusMedalha(existente.status) !== 'CONCEDIDA') {
        return base44.entities.Medalha.update(existente.id, adicionarAuditoriaMedalha(payload, { userEmail, acao: 'indicacao' }));
      }
      return base44.entities.Medalha.create(adicionarAuditoriaMedalha(payload, { userEmail, acao: 'indicacao' }));
    },
    onSuccess: () => {
      refresh();
      setAdminIndicacaoDialog({ open: false, militar: null, justificativa: '' });
      toast({ title: 'Indicação administrativa registrada', description: 'Registro salvo com metadados de override.' });
    },
    onError: (error) => toast({ title: 'Erro no override', description: error.message, variant: 'destructive' }),
  });

  const concederMutation = useMutation({
    mutationFn: ({ medalhaId, militarId, data_concessao, numero_publicacao }) => {
      validarPermissaoAcaoMedalhas({ canAccessAction, acao: ACOES_MEDALHAS.CONCEDER, mensagem: 'Sem permissão para conceder medalhas.' });
      validarMilitarDentroEscopo({ isAdmin, militarId, militarIdsEscopo });
      return base44.entities.Medalha.update(medalhaId, adicionarAuditoriaMedalha({
        status: 'CONCEDIDA',
        data_concessao,
        numero_publicacao,
        doems_numero: numero_publicacao,
      }, { userEmail, acao: 'concessao' }));
    },
    onSuccess: () => {
      refresh();
      setConcederDialog({ open: false, medalha: null, data: hojeISO(), doems: '' });
      toast({ title: 'Concessão registrada para Dom Pedro II.' });
    },
  });

  const resetIndicacoesMutation = useMutation({
    mutationFn: async () => {
      validarPermissaoAcaoMedalhas({ canAccessAction, acao: ACOES_MEDALHAS.RESETAR, mensagem: 'Sem permissão para resetar indicações.' });
      const pendentes = filtrarIndicacoesDomPedroResetaveis(domPedroRegistros);
      const pendentesEscopo = pendentes.filter((m) => isAdmin || militarIdsEscopo.has(m.militar_id));
      await Promise.all(pendentesEscopo.map((registro) => base44.entities.Medalha.update(registro.id, adicionarAuditoriaMedalha({
        status: 'CANCELADA',
        observacoes: `${registro.observacoes ? `${registro.observacoes}\n` : ''}[RESET] Indicação Dom Pedro II resetada administrativamente em ${new Date().toLocaleDateString('pt-BR')}.`,
      }, { userEmail, acao: 'reset' }))));
      return pendentesEscopo.length;
    },
    onSuccess: (quantidade) => {
      refresh();
      setResetDialogOpen(false);
      toast({ title: 'Reset concluído', description: `${quantidade} indicação(ões) de Dom Pedro II foram resetadas.` });
    },
    onError: (error) => toast({ title: 'Erro no reset', description: error.message, variant: 'destructive' }),
  });

  if (loadingUser || !isAccessResolved) return null;
  if (!hasMedalhasAccess) return <AccessDenied modulo="Medalhas" />;
  if (!hasDomPedroAccess) return <AccessDenied modulo="Dom Pedro II" />;

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
          <div className="flex gap-2">
            {podeModoAdmin && (
              <Button
                variant={adminModeAtivo ? 'destructive' : 'outline'}
                onClick={() => setAdminModeAtivo((prev) => !prev)}
              >
                {adminModeAtivo ? 'Modo Admin ativo' : 'Ativar Modo Admin'}
              </Button>
            )}
            {podeExportar && <Button
              variant="outline"
              onClick={() => {
                if (!exportRows.length) {
                  toast({ title: 'Sem indicados para exportar', description: 'Não há registros indicados no contexto atual.' });
                  return;
                }
                setExportModalOpen(true);
              }}
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar indicados
            </Button>}
            {podeResetar && <Button variant="outline" onClick={() => setResetDialogOpen(true)}>
              Resetar indicados
            </Button>}
          </div>
        </div>

        {adminModeAtivo && podeModoAdmin && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">Override administrativo</p>
            <p>Modo Admin ativo: indicações podem ser feitas mesmo em situações de inabilitação ou bloqueio. Use apenas mediante conferência e justificativa.</p>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou matrícula" />
          </div>
          <Select value={unidadeFilter} onValueChange={setUnidadeFilter}><SelectTrigger><SelectValue placeholder="Unidade" /></SelectTrigger><SelectContent><SelectItem value="TODAS">Todas unidades</SelectItem>{unidades.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select>
          <Select value={postoFilter} onValueChange={setPostoFilter}><SelectTrigger><SelectValue placeholder="Posto/Graduação" /></SelectTrigger><SelectContent><SelectItem value="TODOS">Todos postos</SelectItem>{postos.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
          <Select value={medalhaFilter} onValueChange={setMedalhaFilter}><SelectTrigger><SelectValue placeholder="Tipo/Faixa" /></SelectTrigger><SelectContent><SelectItem value="TODAS">Todas medalhas</SelectItem><SelectItem value="DOM_PEDRO_II">Dom Pedro II</SelectItem><SelectItem value="SEM_INDICACAO">Sem indicação</SelectItem></SelectContent></Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="TODOS">Todos status</SelectItem><SelectItem value="SEM_INDICACAO">Sem indicação</SelectItem><SelectItem value="INDICADA">Indicada</SelectItem><SelectItem value="CONCEDIDA">Concedida</SelectItem><SelectItem value="BLOQUEADO">Bloqueado</SelectItem><SelectItem value="INABILITADO">Inabilitado</SelectItem></SelectContent></Select>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead><tr className="text-left text-slate-500 border-b"><th className="py-3 px-2">Militar</th><th className="py-3 px-2">Unidade</th><th className="py-3 px-2">Status</th><th className="py-3 px-2">Ações</th></tr></thead>
            <tbody>
              {rows.map((militar) => {
                const registro = registroPorMilitar.get(militar.id);
                const apuracao = apuracaoPorMilitar.get(militar.id);
                const status = normalizarStatusMedalha(registro?.status) || 'SEM_INDICACAO';
                const situacao = apuracao?.situacao || 'SEM_DIREITO';
                const estaBloqueado = situacao === 'IMPEDIDO';
                const estaInabilitado = situacao !== 'ELEGIVEL' && situacao !== 'IMPEDIDO';
                return (
                  <tr key={militar.id} className="border-b last:border-0">
                    <td className="py-3 px-2"><p className="font-semibold text-slate-800">{militar.posto_graduacao} {militar.nome_completo}</p><p className="text-xs text-slate-500">Mat: {militar.matricula || '—'}</p></td>
                    <td className="py-3 px-2">{militar.lotacao || militar.unidade || '—'}</td>
                    <td className="py-3 px-2">
                      {status === 'CONCEDIDA' ? <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Concedida</Badge> : status === 'INDICADA' ? <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Indicada</Badge> : estaBloqueado ? <Badge className="bg-amber-100 text-amber-800 border-amber-200">Bloqueado</Badge> : estaInabilitado ? <span className="text-slate-500">Inabilitado</span> : <span className="text-slate-500">Sem indicação</span>}
                    </td>
                    <td className="py-3 px-2 flex gap-2">
                      {(status !== 'CONCEDIDA' && !estaBloqueado && !estaInabilitado) && <Button size="sm" className="bg-[#1e3a5f] hover:bg-[#2d4a6f]" onClick={() => indicarMutation.mutate(militar)}>Indicar</Button>}
                      {(status !== 'CONCEDIDA' && (estaBloqueado || estaInabilitado) && adminModeAtivo && podeModoAdmin) && (
                        <Button size="sm" variant="outline" onClick={() => setAdminIndicacaoDialog({ open: true, militar, justificativa: '' })}>Indicar Admin</Button>
                      )}
                      {status === 'INDICADA' && podeConceder && <Button size="sm" variant="outline" onClick={() => setConcederDialog({ open: true, medalha: registro, data: hojeISO(), doems: '' })}>Conceder</Button>}
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
            <Button disabled={!concederDialog.data || !concederDialog.doems} onClick={() => concederMutation.mutate({ medalhaId: concederDialog.medalha?.id, militarId: concederDialog.medalha?.militar_id, data_concessao: concederDialog.data, numero_publicacao: concederDialog.doems })}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={adminIndicacaoDialog.open} onOpenChange={(open) => setAdminIndicacaoDialog((curr) => ({ ...curr, open, justificativa: open ? curr.justificativa : '' }))}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmação de override administrativo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-700">
              Esta indicação será registrada por override administrativo, apesar da situação atual do militar. Confirme apenas se houver autorização/justificativa.
            </p>
            <div>
              <p className="text-sm text-slate-600 mb-1">Justificativa do override administrativo</p>
              <Textarea
                value={adminIndicacaoDialog.justificativa}
                onChange={(e) => setAdminIndicacaoDialog((curr) => ({ ...curr, justificativa: e.target.value }))}
                placeholder="Descreva a autorização e o motivo do override."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdminIndicacaoDialog({ open: false, militar: null, justificativa: '' })}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={!adminIndicacaoDialog.justificativa.trim() || indicarAdminMutation.isPending}
              onClick={() => indicarAdminMutation.mutate({ militar: adminIndicacaoDialog.militar, justificativa: adminIndicacaoDialog.justificativa })}
            >
              Confirmar indicação admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={resetDialogOpen && podeResetar} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resetar indicações pendentes de Dom Pedro II?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação reseta apenas registros com status INDICADA da medalha Dom Pedro II.
              Registros com status CONCEDIDA não serão alterados e o histórico será preservado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => resetIndicacoesMutation.mutate()} className="bg-red-600 hover:bg-red-700">
              Confirmar reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {podeExportar && (
        <ExportarIndicadosModal
          open={exportModalOpen}
          onOpenChange={setExportModalOpen}
          campos={camposExportacao}
          defaultSelecionados={camposPadrao}
          onConfirm={onConfirmarExportacao}
        />
      )}
    </div>
  );
}
