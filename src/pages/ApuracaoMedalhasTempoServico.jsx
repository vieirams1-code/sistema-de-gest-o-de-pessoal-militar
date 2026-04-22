import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Medal, RefreshCw, Search, ShieldAlert, Users } from 'lucide-react';

import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  TIPOS_FIXOS_MEDALHA_TEMPO,
  apurarListaMilitaresTempoServico,
  filtrarIndicacoesTempoResetaveis,
  garantirCatalogoFixoMedalhaTempo,
  indicarMedalhaPorCodigo,
  normalizarStatusMedalha,
  obterEstadoCelulaTempoServico,
  resolverCodigoTipoMedalha,
} from '@/services/medalhasTempoServicoService';

const CODIGOS_TEMPO = ['TEMPO_10', 'TEMPO_20', 'TEMPO_30', 'TEMPO_40'];
const LABEL_POR_CODIGO = { TEMPO_10: '10 anos', TEMPO_20: '20 anos', TEMPO_30: '30 anos', TEMPO_40: '40 anos' };

function hojeISO() {
  return new Date().toISOString().split('T')[0];
}

function normalizarRegistroConcessao(registro, payload) {
  return {
    ...registro,
    ...payload,
    status: 'CONCEDIDA',
    data_concessao: payload.data_concessao,
    numero_publicacao: payload.numero_publicacao,
    doems_numero: payload.numero_publicacao,
  };
}

export default function ApuracaoMedalhasTempoServico() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { canAccessModule, isLoading: loadingUser, isAccessResolved } = useCurrentUser();
  const hasMedalhasAccess = canAccessModule('medalhas');

  const [search, setSearch] = useState('');
  const [unidadeFilter, setUnidadeFilter] = useState('TODAS');
  const [concederDialog, setConcederDialog] = useState({ open: false, medalha: null, data: hojeISO(), doems: '' });
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  useQuery({
    queryKey: ['tipos-medalha-fixos-sync-apuracao'],
    queryFn: () => garantirCatalogoFixoMedalhaTempo(base44),
    enabled: isAccessResolved && hasMedalhasAccess,
  });

  const militaresQuery = useQuery({
    queryKey: ['apuracao-medalhas-militares'],
    queryFn: () => base44.entities.Militar.list('nome_completo'),
    enabled: isAccessResolved && hasMedalhasAccess,
  });

  const medalhasQuery = useQuery({
    queryKey: ['apuracao-medalhas-registros'],
    queryFn: () => base44.entities.Medalha.list('-created_date'),
    enabled: isAccessResolved && hasMedalhasAccess,
  });

  const tiposMedalhaQuery = useQuery({
    queryKey: ['apuracao-medalhas-tipos'],
    queryFn: () => base44.entities.TipoMedalha.list('nome'),
    enabled: isAccessResolved && hasMedalhasAccess,
  });

  const impedimentosQuery = useQuery({
    queryKey: ['apuracao-medalhas-impedimentos'],
    queryFn: () => base44.entities.ImpedimentoMedalha.list('-created_date'),
    enabled: isAccessResolved && hasMedalhasAccess,
  });

  const militares = militaresQuery.data || [];
  const medalhas = medalhasQuery.data || [];
  const tiposMedalha = tiposMedalhaQuery.data || [];
  const impedimentos = impedimentosQuery.data || [];

  const tiposCatalogo = tiposMedalha.length ? tiposMedalha : TIPOS_FIXOS_MEDALHA_TEMPO;

  const registrosTempo = useMemo(() => medalhas.filter((item) => CODIGOS_TEMPO.includes(resolverCodigoTipoMedalha(item))), [medalhas]);

  const registroPorMilitarCodigo = useMemo(() => {
    const mapa = new Map();
    registrosTempo.forEach((registro) => {
      const codigo = resolverCodigoTipoMedalha(registro);
      const militarId = registro?.militar_id;
      if (!codigo || !militarId) return;
      const chave = `${militarId}:${codigo}`;
      const atual = mapa.get(chave);
      const statusAtual = normalizarStatusMedalha(atual?.status);
      const statusNovo = normalizarStatusMedalha(registro?.status);
      const prioridade = (status) => (status === 'CONCEDIDA' ? 2 : status === 'INDICADA' ? 1 : 0);
      if (!atual || prioridade(statusNovo) > prioridade(statusAtual)) {
        mapa.set(chave, registro);
      }
    });
    return mapa;
  }, [registrosTempo]);

  const apuracoes = useMemo(() => apurarListaMilitaresTempoServico({
    militares,
    medalhas,
    impedimentos,
    tiposMedalha: tiposCatalogo,
  }), [militares, medalhas, impedimentos, tiposCatalogo]);

  const unidadesDisponiveis = useMemo(
    () => [...new Set(apuracoes.map((item) => item.militar?.lotacao || item.militar?.unidade).filter(Boolean))],
    [apuracoes],
  );

  const apuracoesFiltradas = useMemo(() => apuracoes.filter((item) => {
    const militar = item.militar || {};
    const nome = `${militar.posto_graduacao || ''} ${militar.nome_completo || ''}`.toLowerCase();
    const termo = search.toLowerCase();
    const unidade = militar.lotacao || militar.unidade;
    return (!termo || nome.includes(termo) || String(militar.matricula || '').toLowerCase().includes(termo))
      && (unidadeFilter === 'TODAS' || unidade === unidadeFilter);
  }), [apuracoes, search, unidadeFilter]);

  const totais = useMemo(() => {
    const indicados = registrosTempo.filter((m) => normalizarStatusMedalha(m.status) === 'INDICADA').length;
    const contemplados = registrosTempo.filter((m) => normalizarStatusMedalha(m.status) === 'CONCEDIDA').length;
    const elegiveis = apuracoes.filter((item) => item.situacao === 'ELEGIVEL').length;
    return { indicados, contemplados, elegiveis };
  }, [apuracoes, registrosTempo]);

  const refreshQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['apuracao-medalhas-registros'] });
    queryClient.invalidateQueries({ queryKey: ['medalhas'] });
    queryClient.invalidateQueries({ queryKey: ['ver-medalhas'] });
  };

  const indicarMutation = useMutation({
    mutationFn: async ({ item, codigo }) => {
      const existente = registroPorMilitarCodigo.get(`${item.militar_id}:${codigo}`);
      return indicarMedalhaPorCodigo(base44, {
        militar: item.militar,
        codigoMedalha: codigo,
        tiposMedalha: tiposCatalogo,
        registroExistente: existente,
        dataIndicacao: hojeISO(),
      });
    },
    onSuccess: () => {
      refreshQueries();
      toast({ title: 'Indicação registrada', description: 'Status atualizado para INDICADA.' });
    },
    onError: (error) => toast({ title: 'Erro ao indicar', description: error.message, variant: 'destructive' }),
  });

  const concederMutation = useMutation({
    mutationFn: async ({ medalhaId, data_concessao, numero_publicacao }) => base44.entities.Medalha.update(
      medalhaId,
      normalizarRegistroConcessao({}, { data_concessao, numero_publicacao }),
    ),
    onSuccess: () => {
      refreshQueries();
      setConcederDialog({ open: false, medalha: null, data: hojeISO(), doems: '' });
      toast({ title: 'Concessão registrada', description: 'Medalha marcada como CONCEDIDA.' });
    },
    onError: (error) => toast({ title: 'Erro ao conceder', description: error.message, variant: 'destructive' }),
  });

  const resetIndicacoesMutation = useMutation({
    mutationFn: async () => {
      const pendentes = filtrarIndicacoesTempoResetaveis(registrosTempo);
      await Promise.all(pendentes.map((m) => base44.entities.Medalha.update(m.id, {
        status: 'CANCELADA',
        observacoes: `${m.observacoes ? `${m.observacoes}\n` : ''}[RESET] Indicação resetada administrativamente em ${new Date().toLocaleDateString('pt-BR')}.`,
      })));
      return pendentes.length;
    },
    onSuccess: (quantidade) => {
      refreshQueries();
      setResetDialogOpen(false);
      toast({ title: 'Reset concluído', description: `${quantidade} indicação(ões) foram resetadas.` });
    },
    onError: (error) => toast({ title: 'Erro no reset', description: error.message, variant: 'destructive' }),
  });

  const getCellState = (item, codigo) => {
    const registro = registroPorMilitarCodigo.get(`${item.militar_id}:${codigo}`);
    const type = obterEstadoCelulaTempoServico({
      apuracao: item,
      codigoFaixa: codigo,
      registroMedalha: registro,
      impedimentos,
    });
    if (type === 'CONTEMPLADO') return { label: 'Contemplado', type, registro };
    if (type === 'INDICADO') return { label: 'Indicado', type, registro };
    if (type === 'IMPEDIDO') return { label: 'Impedido', type, registro: null };
    if (type === 'INDICAR') return { label: 'Indicar', type, registro: null };
    return { label: 'Inabilitado', type: 'INABILITADO', registro: null };
  };

  if (loadingUser || !isAccessResolved) return null;
  if (!hasMedalhasAccess) return <AccessDenied modulo="Medalhas" />;

  const isLoadingData = militaresQuery.isLoading || medalhasQuery.isLoading || tiposMedalhaQuery.isLoading || impedimentosQuery.isLoading;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100">
      <div className="max-w-[1500px] mx-auto px-4 py-8 space-y-5">
        <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-sm flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('Medalhas'))}><ArrowLeft className="w-4 h-4" /></Button>
            <div className="rounded-xl bg-slate-100 p-2 mt-0.5"><Medal className="w-6 h-6 text-[#1e3a5f]" /></div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#1e3a5f]">Apuração de Tempo de Serviço</h1>
              <p className="text-sm text-slate-600 mt-1">Tabela operacional por militar para indicação e concessão das faixas de 10, 20, 30 e 40 anos.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(createPageUrl('IndicacoesDomPedroII'))}>Dom Pedro II</Button>
            <Button variant="outline" onClick={() => setResetDialogOpen(true)}><RefreshCw className="w-4 h-4 mr-2" />Resetar indicações</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[{ label: 'Elegíveis', value: totais.elegiveis }, { label: 'Indicados', value: totais.indicados }, { label: 'Contemplados', value: totais.contemplados }].map((card) => (
            <div key={card.label} className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">{card.label}</p>
              <p className="text-2xl leading-tight font-semibold text-slate-800 mt-2">{card.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="relative md:col-span-3">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input className="pl-9" placeholder="Buscar por nome ou matrícula" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Select value={unidadeFilter} onValueChange={setUnidadeFilter}>
              <SelectTrigger><SelectValue placeholder="Unidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAS">Todas unidades</SelectItem>
                {unidadesDisponiveis.map((unidade) => <SelectItem key={unidade} value={unidade}>{unidade}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm overflow-x-auto">
          {isLoadingData ? (
            <div className="space-y-2 animate-pulse"><div className="h-16 bg-slate-100 rounded-lg" /><div className="h-16 bg-slate-100 rounded-lg" /></div>
          ) : (
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-3 px-2">Militar</th>
                  <th className="py-3 px-2">Tempo</th>
                  {CODIGOS_TEMPO.map((codigo) => <th key={codigo} className="py-3 px-2 text-center">{LABEL_POR_CODIGO[codigo]}</th>)}
                  <th className="py-3 px-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {apuracoesFiltradas.map((item) => {
                  const militar = item.militar || {};
                  const unidade = militar.lotacao || militar.unidade || 'Unidade não informada';
                  const linhaImpedida = item.situacao === 'IMPEDIDO';
                  return (
                    <tr key={item.militar_id} className={`border-b last:border-0 ${linhaImpedida ? 'bg-amber-50/50' : ''}`}>
                      <td className="py-3 px-2 align-top">
                        <p className="font-semibold text-slate-800">{militar.posto_graduacao} {militar.nome_completo}</p>
                        <p className="text-xs text-slate-500">Mat: {militar.matricula || '—'}</p>
                        <p className="text-xs text-slate-500">{unidade}</p>
                      </td>
                      <td className="py-3 px-2 align-top">
                        <p className="font-medium text-slate-700">{item.tempo_servico_anos ?? '—'} anos</p>
                        {linhaImpedida && <Badge className="mt-1 bg-amber-100 text-amber-800 border-amber-200"><ShieldAlert className="w-3 h-3 mr-1" />Impedido</Badge>}
                      </td>
                      {CODIGOS_TEMPO.map((codigo) => {
                        const cell = getCellState(item, codigo);
                        return (
                          <td key={codigo} className="py-3 px-2 align-top text-center">
                            {cell.type === 'INDICAR' ? (
                              <Button size="sm" className="bg-[#1e3a5f] hover:bg-[#2d4a6f]" disabled={indicarMutation.isPending} onClick={() => indicarMutation.mutate({ item, codigo })}>
                                <CheckCircle2 className="w-4 h-4 mr-1" />Indicar
                              </Button>
                            ) : cell.type === 'INDICADO' ? (
                              <div className="space-y-1">
                                <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Indicado</Badge>
                                <div>
                                  <Button size="sm" variant="outline" onClick={() => setConcederDialog({ open: true, medalha: cell.registro, data: hojeISO(), doems: '' })}>Conceder</Button>
                                </div>
                              </div>
                            ) : cell.type === 'CONTEMPLADO' ? (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Contemplado</Badge>
                            ) : cell.type === 'IMPEDIDO' ? (
                              <Badge className="bg-amber-100 text-amber-800 border-amber-200">Impedido</Badge>
                            ) : (
                              <span className="text-slate-400">Inabilitado</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-3 px-2 align-top">
                        <Button size="sm" variant="outline" onClick={() => navigate(`${createPageUrl('VerMilitar')}?id=${item.militar_id}&tab=medalhas`)}>Perfil &gt; Medalhas</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {!isLoadingData && apuracoesFiltradas.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center mt-3">
              <Users className="w-8 h-8 mx-auto text-slate-400 mb-2" />
              <p className="text-slate-700 font-medium">Nenhum militar encontrado para os filtros informados.</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={concederDialog.open} onOpenChange={(open) => setConcederDialog((curr) => ({ ...curr, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar medalha como concedida</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-slate-600">Data da concessão</p>
              <Input type="date" value={concederDialog.data} onChange={(e) => setConcederDialog((curr) => ({ ...curr, data: e.target.value }))} />
            </div>
            <div>
              <p className="text-sm text-slate-600">Número do DOEMS</p>
              <Input value={concederDialog.doems} onChange={(e) => setConcederDialog((curr) => ({ ...curr, doems: e.target.value }))} placeholder="Ex.: 12345" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConcederDialog({ open: false, medalha: null, data: hojeISO(), doems: '' })}>Cancelar</Button>
            <Button
              className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
              disabled={!concederDialog.data || !concederDialog.doems || concederMutation.isPending}
              onClick={() => concederMutation.mutate({
                medalhaId: concederDialog.medalha?.id,
                data_concessao: concederDialog.data,
                numero_publicacao: concederDialog.doems,
              })}
            >
              Confirmar concessão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resetar indicações pendentes?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o status INDICADA de todas as medalhas de tempo ainda não concedidas.
              Medalhas já CONCEDIDA não serão alteradas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => resetIndicacoesMutation.mutate()} className="bg-red-600 hover:bg-red-700">Confirmar reset</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
