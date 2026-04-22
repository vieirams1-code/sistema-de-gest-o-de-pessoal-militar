import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Download, Medal, RefreshCw, Search, ShieldAlert, Users } from 'lucide-react';

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
import ExportarIndicadosModal from '@/components/medalhas/ExportarIndicadosModal';
import { exportarIndicadosParaExcel } from '@/utils/indicadosExcelExport';
import {
  ACOES_APURACAO,
  ACOES_MEDALHAS,
  adicionarAuditoriaMedalha,
  listarImpedimentosEscopo,
  listarMedalhasEscopo,
  listarMilitaresEscopo,
  temAlgumaPermissaoMedalhas,
  validarMilitarDentroEscopo,
  validarPermissaoAcaoMedalhas,
} from '@/services/medalhasAcessoService';
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

function formatarData(valor) {
  if (!valor) return '';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return data.toLocaleDateString('pt-BR');
}

export default function ApuracaoMedalhasTempoServico() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAdmin, getMilitarScopeFilters, userEmail, canAccessModule, canAccessAction, isLoading: loadingUser, isAccessResolved } = useCurrentUser();
  const hasMedalhasAccess = canAccessModule('medalhas');
  const hasApuracaoAccess = temAlgumaPermissaoMedalhas(canAccessAction, ACOES_APURACAO);
  const podeIndicar = canAccessAction(ACOES_MEDALHAS.INDICAR);
  const podeConceder = canAccessAction(ACOES_MEDALHAS.CONCEDER);
  const podeResetar = canAccessAction(ACOES_MEDALHAS.RESETAR);
  const podeExportar = canAccessAction(ACOES_MEDALHAS.EXPORTAR);

  const [search, setSearch] = useState('');
  const [unidadeFilter, setUnidadeFilter] = useState('TODAS');
  const [postoFilter, setPostoFilter] = useState('TODOS');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [faixaFilter, setFaixaFilter] = useState('TODAS');
  const [concederDialog, setConcederDialog] = useState({ open: false, medalha: null, data: hojeISO(), doems: '' });
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  useQuery({
    queryKey: ['tipos-medalha-fixos-sync-apuracao'],
    queryFn: () => garantirCatalogoFixoMedalhaTempo(base44),
    enabled: isAccessResolved && hasMedalhasAccess,
  });

  const militaresQuery = useQuery({
    queryKey: ['apuracao-medalhas-militares'],
    queryFn: () => listarMilitaresEscopo({ base44Client: base44, isAdmin, getMilitarScopeFilters }),
    enabled: isAccessResolved && hasMedalhasAccess && hasApuracaoAccess,
  });

  const medalhasQuery = useQuery({
    queryKey: ['apuracao-medalhas-registros'],
    queryFn: async () => {
      const militaresEscopo = await listarMilitaresEscopo({ base44Client: base44, isAdmin, getMilitarScopeFilters });
      return listarMedalhasEscopo({ base44Client: base44, isAdmin, militarIds: militaresEscopo.map((m) => m.id).filter(Boolean) });
    },
    enabled: isAccessResolved && hasMedalhasAccess && hasApuracaoAccess,
  });

  const tiposMedalhaQuery = useQuery({
    queryKey: ['apuracao-medalhas-tipos'],
    queryFn: () => base44.entities.TipoMedalha.list('nome'),
    enabled: isAccessResolved && hasMedalhasAccess,
  });

  const impedimentosQuery = useQuery({
    queryKey: ['apuracao-medalhas-impedimentos'],
    queryFn: async () => {
      const militaresEscopo = await listarMilitaresEscopo({ base44Client: base44, isAdmin, getMilitarScopeFilters });
      return listarImpedimentosEscopo({ base44Client: base44, isAdmin, militarIds: militaresEscopo.map((m) => m.id).filter(Boolean) });
    },
    enabled: isAccessResolved && hasMedalhasAccess && hasApuracaoAccess,
  });

  const militares = militaresQuery.data || [];
  const medalhas = medalhasQuery.data || [];
  const tiposMedalha = tiposMedalhaQuery.data || [];
  const impedimentos = impedimentosQuery.data || [];

  const tiposCatalogo = tiposMedalha.length ? tiposMedalha : TIPOS_FIXOS_MEDALHA_TEMPO;
  const militarIdsEscopo = useMemo(() => new Set(militares.map((m) => m.id).filter(Boolean)), [militares]);

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
  const postosDisponiveis = useMemo(
    () => [...new Set(apuracoes.map((item) => item.militar?.posto_graduacao).filter(Boolean))],
    [apuracoes],
  );

  const apuracoesFiltradas = useMemo(() => apuracoes.filter((item) => {
    const militar = item.militar || {};
    const nome = `${militar.posto_graduacao || ''} ${militar.nome_completo || ''}`.toLowerCase();
    const termo = search.toLowerCase();
    const unidade = militar.lotacao || militar.unidade;
    const posto = militar.posto_graduacao;
    const faixaDevida = item.medalha_devida_codigo;
    const situacao = item.situacao || 'NAO_ELEGIVEL';
    return (!termo || nome.includes(termo) || String(militar.matricula || '').toLowerCase().includes(termo))
      && (unidadeFilter === 'TODAS' || unidade === unidadeFilter)
      && (postoFilter === 'TODOS' || posto === postoFilter)
      && (statusFilter === 'TODOS' || situacao === statusFilter)
      && (faixaFilter === 'TODAS' || faixaDevida === faixaFilter);
  }), [apuracoes, search, unidadeFilter, postoFilter, statusFilter, faixaFilter]);

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

  const exportRows = useMemo(() => apuracoesFiltradas.flatMap((item) => {
    const militar = item.militar || {};
    return CODIGOS_TEMPO.map((codigo) => {
      const cell = getCellState(item, codigo);
      if (cell.type !== 'INDICADO') return null;
      return {
        militar,
        registro: cell.registro,
        faixaCodigo: codigo,
        faixaLabel: LABEL_POR_CODIGO[codigo],
        tempoServicoAnos: item.tempo_servico_anos,
      };
    }).filter(Boolean);
  }), [apuracoesFiltradas, registroPorMilitarCodigo, impedimentos]);

  const camposExportacao = [
    { key: 'nome', group: 'Dados do militar', label: 'Nome', getValue: (row) => row.militar?.nome_completo || '' },
    { key: 'nome_guerra', group: 'Dados do militar', label: 'Nome de guerra', getValue: (row) => row.militar?.nome_guerra || '' },
    { key: 'matricula', group: 'Dados do militar', label: 'Matrícula', getValue: (row) => row.militar?.matricula || '' },
    { key: 'posto', group: 'Dados do militar', label: 'Posto/Graduação', getValue: (row) => row.militar?.posto_graduacao || '' },
    { key: 'unidade', group: 'Dados do militar', label: 'Unidade', getValue: (row) => row.militar?.lotacao || row.militar?.unidade || '' },
    { key: 'tempo_servico', group: 'Dados do militar', label: 'Tempo de serviço (anos)', getValue: (row) => row.tempoServicoAnos ?? '' },
    { key: 'medalha', group: 'Dados da indicação', label: 'Medalha', getValue: (row) => `Medalha de Tempo de Serviço - ${row.faixaLabel}` },
    { key: 'status', group: 'Dados da indicação', label: 'Status', getValue: (row) => normalizarStatusMedalha(row.registro?.status) || '' },
    { key: 'data_indicacao', group: 'Dados da indicação', label: 'Data da indicação', getValue: (row) => formatarData(row.registro?.data_indicacao) },
    { key: 'data_concessao', group: 'Dados da indicação', label: 'Data da concessão', getValue: (row) => formatarData(row.registro?.data_concessao) },
    { key: 'doems', group: 'Dados da indicação', label: 'Número do DOEMS', getValue: (row) => row.registro?.numero_publicacao || row.registro?.doems_numero || '' },
    { key: 'observacoes', group: 'Dados da indicação', label: 'Observações', getValue: (row) => row.registro?.observacoes || '' },
  ];
  const camposPadrao = ['nome', 'matricula', 'posto', 'unidade', 'tempo_servico', 'medalha', 'status', 'data_indicacao'];

  const onConfirmarExportacao = (camposSelecionados) => {
    if (!exportRows.length) {
      toast({ title: 'Sem indicados para exportar', description: 'Ajuste os filtros para visualizar indicações pendentes e tente novamente.' });
      return;
    }
    exportarIndicadosParaExcel({
      camposSelecionados,
      registros: exportRows,
      nomeArquivo: `indicados_medalhas_tempo_${hojeISO()}.xlsx`,
    });
    setExportModalOpen(false);
    toast({ title: 'Exportação concluída', description: `${exportRows.length} indicado(s) exportado(s) em Excel.` });
  };

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
      validarPermissaoAcaoMedalhas({
        canAccessAction,
        acao: ACOES_MEDALHAS.INDICAR,
        mensagem: 'Sem permissão para indicar medalhas.',
      });
      validarMilitarDentroEscopo({ isAdmin, militarId: item?.militar_id, militarIdsEscopo });
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
    mutationFn: async ({ medalhaId, data_concessao, numero_publicacao, militarId }) => {
      validarPermissaoAcaoMedalhas({
        canAccessAction,
        acao: ACOES_MEDALHAS.CONCEDER,
        mensagem: 'Sem permissão para conceder medalhas.',
      });
      validarMilitarDentroEscopo({ isAdmin, militarId, militarIdsEscopo });
      return base44.entities.Medalha.update(
        medalhaId,
        adicionarAuditoriaMedalha(
          normalizarRegistroConcessao({}, { data_concessao, numero_publicacao }),
          { userEmail, acao: 'concessao' },
        ),
      );
    },
    onSuccess: () => {
      refreshQueries();
      setConcederDialog({ open: false, medalha: null, data: hojeISO(), doems: '' });
      toast({ title: 'Concessão registrada', description: 'Medalha marcada como CONCEDIDA.' });
    },
    onError: (error) => toast({ title: 'Erro ao conceder', description: error.message, variant: 'destructive' }),
  });

  const resetIndicacoesMutation = useMutation({
    mutationFn: async () => {
      validarPermissaoAcaoMedalhas({
        canAccessAction,
        acao: ACOES_MEDALHAS.RESETAR,
        mensagem: 'Sem permissão para resetar indicações.',
      });
      const pendentes = filtrarIndicacoesTempoResetaveis(registrosTempo);
      const pendentesEscopo = pendentes.filter((m) => isAdmin || militarIdsEscopo.has(m.militar_id));
      await Promise.all(pendentesEscopo.map((m) => base44.entities.Medalha.update(m.id, adicionarAuditoriaMedalha({
        status: 'CANCELADA',
        observacoes: `${m.observacoes ? `${m.observacoes}\n` : ''}[RESET] Indicação resetada administrativamente em ${new Date().toLocaleDateString('pt-BR')}.`,
      }, { userEmail, acao: 'reset' }))));
      return pendentesEscopo.length;
    },
    onSuccess: (quantidade) => {
      refreshQueries();
      setResetDialogOpen(false);
      toast({ title: 'Reset concluído', description: `${quantidade} indicação(ões) foram resetadas.` });
    },
    onError: (error) => toast({ title: 'Erro no reset', description: error.message, variant: 'destructive' }),
  });

  if (loadingUser || !isAccessResolved) return null;
  if (!hasMedalhasAccess) return <AccessDenied modulo="Medalhas" />;
  if (!hasApuracaoAccess) return <AccessDenied modulo="Apuração de Medalhas" />;

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
            {podeExportar && (
              <Button
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
              </Button>
            )}
            {canAccessAction(ACOES_MEDALHAS.DOM_PEDRO) && <Button variant="outline" onClick={() => navigate(createPageUrl('IndicacoesDomPedroII'))}>Dom Pedro II</Button>}
            {podeResetar && <Button variant="outline" onClick={() => setResetDialogOpen(true)}><RefreshCw className="w-4 h-4 mr-2" />Resetar indicações</Button>}
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

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input className="pl-9" placeholder="Buscar por nome ou matrícula" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div>
            <Select value={unidadeFilter} onValueChange={setUnidadeFilter}>
              <SelectTrigger><SelectValue placeholder="Unidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAS">Todas unidades</SelectItem>
                {unidadesDisponiveis.map((unidade) => <SelectItem key={unidade} value={unidade}>{unidade}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Select value={postoFilter} onValueChange={setPostoFilter}>
            <SelectTrigger><SelectValue placeholder="Posto/Graduação" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos postos</SelectItem>
              {postosDisponiveis.map((posto) => <SelectItem key={posto} value={posto}>{posto}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Status/Situação" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todas situações</SelectItem>
              <SelectItem value="ELEGIVEL">Elegível</SelectItem>
              <SelectItem value="JA_CONTEMPLADO">Já contemplado</SelectItem>
              <SelectItem value="IMPEDIDO">Impedido</SelectItem>
              <SelectItem value="NAO_ELEGIVEL">Não elegível</SelectItem>
            </SelectContent>
          </Select>
          <Select value={faixaFilter} onValueChange={setFaixaFilter}>
            <SelectTrigger><SelectValue placeholder="Faixa devida" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TODAS">Todas faixas</SelectItem>
              {CODIGOS_TEMPO.map((codigo) => <SelectItem key={codigo} value={codigo}>{LABEL_POR_CODIGO[codigo]}</SelectItem>)}
            </SelectContent>
          </Select>
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
                            {cell.type === 'INDICAR' && podeIndicar ? (
                              <Button size="sm" className="bg-[#1e3a5f] hover:bg-[#2d4a6f]" disabled={indicarMutation.isPending} onClick={() => indicarMutation.mutate({ item, codigo })}>
                                <CheckCircle2 className="w-4 h-4 mr-1" />Indicar
                              </Button>
                            ) : cell.type === 'INDICADO' ? (
                              <div className="space-y-1">
                                <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Indicado</Badge>
                                {podeConceder && (
                                  <div>
                                  <Button size="sm" variant="outline" onClick={() => setConcederDialog({ open: true, medalha: cell.registro, data: hojeISO(), doems: '' })}>Conceder</Button>
                                  </div>
                                )}
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
                militarId: concederDialog.medalha?.militar_id,
                data_concessao: concederDialog.data,
                numero_publicacao: concederDialog.doems,
              })}
            >
              Confirmar concessão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={resetDialogOpen && podeResetar} onOpenChange={setResetDialogOpen}>
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
