import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Archive, CalendarClock, CheckCircle2, ClipboardList, Edit3, Eye, FileText, Loader2, Plus, Search, ShieldCheck, Trash2, UserRound, XCircle } from 'lucide-react';

import AccessDenied from '@/components/auth/AccessDenied';
import ContratoDesignacaoModal from '@/components/militar/ContratoDesignacaoModal';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { atualizarEscopado, criarEscopado, excluirEscopado } from '@/services/cudEscopadoClient';
import { fetchScopedPainelContratosDesignacao } from '@/services/getScopedPainelContratosDesignacaoClient';
import { fetchScopedMilitares, getEffectiveEmail } from '@/services/getScopedMilitaresClient';
import { arquivarPeriodosDesignacaoEmBloco } from '@/services/arquivarPeriodosDesignacaoEmBlocoClient';
import {
  aplicarFiltrosPainelContratos,
  buscarEfeitosContratoEmPeriodos,
  calcularDiasParaVencimento,
  calcularSituacaoDerivadaContrato,
  classificarVencimentoContrato,
  getCampoCadeiaFeriasAlterado,
  isContratoAtivoOperacional,
  FILTRO_LEGADO,
  FILTRO_SITUACAO,
  FILTRO_VENCIMENTO,
  MENSAGEM_CONTRATO_COM_EFEITOS,
  SITUACAO_CONTRATO_DESIGNACAO,
} from '@/services/painelContratosDesignacaoService';

const EMPTY_COUNTERS = {
  ativos: 0,
  vencendo30: 0,
  vencendo60: 0,
  vencendo90: 0,
  vencidos: 0,
  semDataFim: 0,
  legadoAtivaAplicada: 0,
  legadoAtivaPendente: 0,
  encerrados: 0,
  cancelados: 0,
};

const SITUACAO_UI = {
  [SITUACAO_CONTRATO_DESIGNACAO.ATIVO]: { label: 'Ativo', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  [SITUACAO_CONTRATO_DESIGNACAO.ATIVO_VENCENDO]: { label: 'Ativo vencendo', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  [SITUACAO_CONTRATO_DESIGNACAO.ATIVO_VENCIDO]: { label: 'Ativo vencido', className: 'bg-red-50 text-red-700 border-red-200' },
  [SITUACAO_CONTRATO_DESIGNACAO.ENCERRADO]: { label: 'Encerrado', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  [SITUACAO_CONTRATO_DESIGNACAO.CANCELADO]: { label: 'Cancelado', className: 'bg-rose-50 text-rose-700 border-rose-200' },
  [SITUACAO_CONTRATO_DESIGNACAO.SEM_DATA_FIM]: { label: 'Sem data fim', className: 'bg-blue-50 text-blue-700 border-blue-200' },
};

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR');
}

function sanitizarIdMatricula(value) {
  const texto = String(value ?? '').trim();
  const posicaoSeparador = texto.indexOf(':');
  return posicaoSeparador >= 0 ? texto.slice(0, posicaoSeparador).trim() : texto;
}

function CounterCard({ title, value, icon: Icon, color = 'slate' }) {
  const colors = {
    slate: 'bg-slate-50 text-slate-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    blue: 'bg-blue-50 text-blue-700',
    rose: 'bg-rose-50 text-rose-700',
  };
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2.5 rounded-xl ${colors[color] || colors.slate}`}><Icon size={20} /></div>
        <div>
          <p className="text-xs font-medium text-slate-500">{title}</p>
          <p className="text-2xl font-bold text-slate-900">{value || 0}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function formatarPeriodoBloqueante(bloqueante) {
  const referencia = bloqueante?.referencia ? `Ref. ${bloqueante.referencia}` : 'Sem referência';
  const periodo = bloqueante?.periodo || 'Período não informado';
  const status = bloqueante?.status ? `status ${bloqueante.status}` : 'status não informado';
  const quantidade = Number(bloqueante?.quantidade_ferias || 0);
  return `${referencia} — ${periodo} — ${status} — ${quantidade} férias vinculada(s)`;
}

function DetailItem({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-900 break-words">{value || '—'}</p>
    </div>
  );
}



function extrairMatriculasDisponiveis(militaresDisponiveis = []) {
  return militaresDisponiveis.flatMap((militar) => {
    const historico = Array.isArray(militar?.matriculas_historico) ? militar.matriculas_historico : [];
    if (historico.length > 0) {
      return historico
        .map((matricula) => ({
          ...matricula,
          id: sanitizarIdMatricula(matricula?.id),
          militar_id: matricula?.militar_id || militar.id,
        }))
        .filter((matricula) => matricula.id);
    }

    const matriculaFallback = militar?.matricula_atual || militar?.matricula;
    const matriculaFallbackId = sanitizarIdMatricula(militar?.matricula_militar_id || militar?.matricula_atual_id);
    if (!matriculaFallback || !matriculaFallbackId) return [];
    return [{
      id: matriculaFallbackId,
      militar_id: militar.id,
      matricula: matriculaFallback,
      matricula_formatada: matriculaFallback,
      is_atual: true,
    }];
  });
}

export default function ContratosDesignacao() {
  const { isAdmin, canAccessAction, canAccessAll, permissions, userEmail, modoAcesso, isLoading: loadingUser, isAccessResolved } = useCurrentUser();
  const hasAbsoluteAccess = canAccessAll || permissions === 'ALL';
  const canView = hasAbsoluteAccess || isAdmin || canAccessAction('visualizar_contratos_designacao') || canAccessAction('gerir_contratos_designacao');
  const canCreate = hasAbsoluteAccess || isAdmin || canAccessAction('gerir_contratos_designacao');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState(FILTRO_SITUACAO.TODOS);
  const [vencimento, setVencimento] = useState(FILTRO_VENCIMENTO.TODOS);
  const [legado, setLegado] = useState(FILTRO_LEGADO.TODOS);
  const [contratoDetalhe, setContratoDetalhe] = useState(null);
  const [contratoArquivamento, setContratoArquivamento] = useState(null);
  const [contratoEdicao, setContratoEdicao] = useState(null);
  const [contratoEdicaoBloqueiaCadeia, setContratoEdicaoBloqueiaCadeia] = useState(false);
  const [confirmarArquivamento, setConfirmarArquivamento] = useState(false);
  const [arquivandoPeriodos, setArquivandoPeriodos] = useState(false);
  const [arquivamentoBloqueio, setArquivamentoBloqueio] = useState(null);
  const [novoContratoOpen, setNovoContratoOpen] = useState(false);
  const [salvandoContrato, setSalvandoContrato] = useState(false);
  const [excluindoContratoId, setExcluindoContratoId] = useState(null);
  const effectiveEmail = getEffectiveEmail();

  const query = useQuery({
    queryKey: ['painel-contratos-designacao', Boolean(isAdmin || hasAbsoluteAccess), null, userEmail || null, null],
    queryFn: () => fetchScopedPainelContratosDesignacao(),
    enabled: Boolean(isAccessResolved && canView),
  });

  const militaresDisponiveisQuery = useQuery({
    queryKey: ['contratos-designacao-militares-disponiveis', isAdmin, modoAcesso, userEmail, effectiveEmail || null],
    queryFn: async () => {
      const { militares: militaresEscopados = [] } = await fetchScopedMilitares({
        statusCadastro: 'Ativo',
        limit: 10000,
        offset: 0,
        includeFoto: false,
        effectiveEmail: effectiveEmail || undefined,
      });
      return militaresEscopados;
    },
    enabled: Boolean(isAccessResolved && canCreate && (novoContratoOpen || contratoEdicao)),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const bundle = query.data || {};
  const counters = { ...EMPTY_COUNTERS, ...(bundle.counters || {}) };
  const contratos = bundle.contratos || [];
  const militares = bundle.militares || [];
  const matriculasMilitar = bundle.matriculasMilitar || [];
  const legadoAtivaPorContrato = bundle.legadoAtivaPorContrato || {};
  const militaresDisponiveis = militaresDisponiveisQuery.data || [];
  const militaresOpcoesContrato = useMemo(() => {
    const porId = new Map();
    [...militares, ...militaresDisponiveis].forEach((militar) => {
      if (militar?.id) porId.set(String(militar.id), militar);
    });
    return Array.from(porId.values());
  }, [militares, militaresDisponiveis]);
  const matriculasMilitaresDisponiveis = useMemo(
    () => extrairMatriculasDisponiveis(militaresOpcoesContrato),
    [militaresOpcoesContrato],
  );

  const militaresPorId = useMemo(() => Object.fromEntries(militares.map((m) => [String(m.id), m])), [militares]);
  const contratosFiltrados = useMemo(() => aplicarFiltrosPainelContratos(contratos, {
    militaresPorId,
    matriculasMilitar,
    legadoAtivaPorContrato,
    busca,
    situacao,
    vencimento,
    legado,
  }), [busca, contratos, legado, legadoAtivaPorContrato, matriculasMilitar, militaresPorId, situacao, vencimento]);

  const handleArquivarPeriodos = async () => {
    if (!contratoArquivamento || !confirmarArquivamento) return;
    setArquivandoPeriodos(true);
    setArquivamentoBloqueio(null);
    try {
      const resultado = await arquivarPeriodosDesignacaoEmBloco({
        militarId: contratoArquivamento.militar_id,
        contratoDesignacaoId: contratoArquivamento.id,
        confirmar: true,
      });
      const resumo = resultado?.resumo || {};
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['painel-contratos-designacao'] }),
        queryClient.invalidateQueries({ queryKey: ['pa-bundle'] }),
        queryClient.invalidateQueries({ queryKey: ['periodos-aquisitivos'] }),
        queryClient.invalidateQueries({ queryKey: ['periodos-existentes'] }),
      ]);
      setContratoArquivamento(null);
      setConfirmarArquivamento(false);
      toast({
        title: 'Períodos arquivados logicamente',
        description: `${resumo.arquivados || 0} arquivado(s), ${resumo.cancelados || 0} cancelado(s), ${resumo.ja_processados || 0} já processado(s).`,
      });
    } catch (error) {
      if (error?.code === 'PERIODOS_COM_FERIAS_VINCULADAS') {
        const bloqueantes = Array.isArray(error?.bloqueantes) ? error.bloqueantes : [];
        setArquivamentoBloqueio({ mensagem: error.message, bloqueantes });
        toast({
          title: 'Arquivamento bloqueado por férias vinculadas',
          description: 'Não foi possível arquivar/excluir os períodos porque existem férias lançadas em um ou mais períodos da cadeia antiga. Ajuste essas férias primeiro e tente novamente.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Erro ao arquivar períodos',
        description: error?.message || 'Não foi possível concluir o arquivamento lógico.',
        variant: 'destructive',
      });
    } finally {
      setArquivandoPeriodos(false);
    }
  };

  const handleCreateContrato = async (payload) => {
    setSalvandoContrato(true);
    try {
      await criarEscopado('ContratoDesignacaoMilitar', payload);
      setNovoContratoOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['painel-contratos-designacao'] });
      toast({ title: 'Contrato cadastrado', description: 'O painel foi atualizado com o novo contrato de designação.' });
    } catch (error) {
      toast({
        title: 'Erro ao cadastrar contrato',
        description: error?.message || 'Não foi possível salvar o contrato de designação.',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setSalvandoContrato(false);
    }
  };


  const handleAbrirEdicaoContrato = async (contrato) => {
    if (!contrato) return;
    try {
      const periodosComEfeito = await buscarEfeitosContratoEmPeriodos(base44, contrato.id);
      setContratoEdicaoBloqueiaCadeia(periodosComEfeito.length > 0);
      setContratoEdicao(contrato);
    } catch (error) {
      toast({
        title: 'Erro ao verificar efeitos do contrato',
        description: error?.message || 'Não foi possível verificar os períodos aquisitivos antes da edição.',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateContrato = async (payload) => {
    if (!contratoEdicao?.id) return;
    setSalvandoContrato(true);
    try {
      const periodosComEfeito = await buscarEfeitosContratoEmPeriodos(base44, contratoEdicao.id);
      const temEfeitos = periodosComEfeito.length > 0;
      if (temEfeitos) {
        const campoAlterado = getCampoCadeiaFeriasAlterado(contratoEdicao, payload);
        if (campoAlterado) {
          throw new Error(`Campo ${campoAlterado} bloqueado: ${MENSAGEM_CONTRATO_COM_EFEITOS}`);
        }
      }
      await atualizarEscopado('ContratoDesignacaoMilitar', contratoEdicao.id, {
        ...payload,
        militar_id: contratoEdicao.militar_id,
        matricula_militar_id: contratoEdicao.matricula_militar_id || payload.matricula_militar_id,
        matricula_designacao: contratoEdicao.matricula_designacao || payload.matricula_designacao,
      });
      setContratoEdicao(null);
      setContratoEdicaoBloqueiaCadeia(false);
      await queryClient.invalidateQueries({ queryKey: ['painel-contratos-designacao'] });
      toast({ title: 'Contrato atualizado', description: 'Os dados do contrato de designação foram salvos.' });
    } catch (error) {
      toast({
        title: 'Erro ao editar contrato',
        description: error?.message || 'Não foi possível atualizar o contrato de designação.',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setSalvandoContrato(false);
    }
  };

  const handleExcluirContrato = async (contrato) => {
    if (!contrato?.id) return;
    const confirmado = window.confirm('Excluir fisicamente este contrato cadastrado por engano? Esta ação não altera ficha, férias, saldos ou publicações.');
    if (!confirmado) return;
    setExcluindoContratoId(contrato.id);
    try {
      const periodosComEfeito = await buscarEfeitosContratoEmPeriodos(base44, contrato.id);
      if (periodosComEfeito.length > 0) {
        toast({ title: 'Exclusão bloqueada', description: MENSAGEM_CONTRATO_COM_EFEITOS, variant: 'destructive' });
        return;
      }
      await excluirEscopado('ContratoDesignacaoMilitar', contrato.id);
      await queryClient.invalidateQueries({ queryKey: ['painel-contratos-designacao'] });
      toast({ title: 'Contrato excluído', description: 'O contrato cadastrado por engano foi removido sem afetar períodos.' });
    } catch (error) {
      toast({
        title: 'Erro ao excluir contrato',
        description: error?.message || 'Não foi possível excluir o contrato de designação.',
        variant: 'destructive',
      });
    } finally {
      setExcluindoContratoId(null);
    }
  };

  if (loadingUser || !isAccessResolved) return null;
  if (!canView) return <AccessDenied modulo="Contratos de Designação" />;

  const getMilitar = (contrato) => militaresPorId[String(contrato?.militar_id || '')] || {};
  const getMatriculaAtual = (contrato) => {
    const militar = getMilitar(contrato);
    const atual = matriculasMilitar.find((m) => String(m.militar_id) === String(contrato?.militar_id) && m.is_atual);
    return atual?.matricula || militar.matricula || '—';
  };
  const renderDias = (contrato) => {
    const dias = calcularDiasParaVencimento(contrato);
    if (dias === null) return '—';
    if (dias < 0) return `${Math.abs(dias)} dia(s) vencido`;
    if (dias === 0) return 'Vence hoje';
    return `${dias} dia(s)`;
  };
  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-sm"><ClipboardList size={26} /></div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Contratos de Designação</h1>
              <p className="text-slate-500">Controle centralizado de contratos ativos, vencidos, encerrados e cancelados. Nenhuma alteração automática é realizada nesta tela.</p>
            </div>
          </div>
          {canCreate && (
            <Button onClick={() => setNovoContratoOpen(true)} className="bg-[#1e3a5f] text-white hover:bg-[#2d4a6f]">
              <Plus className="mr-2 h-4 w-4" />Novo contrato
            </Button>
          )}
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          <CounterCard title="Ativos" value={counters.ativos} icon={CheckCircle2} color="emerald" />
          <CounterCard title="Vencendo em 30 dias" value={counters.vencendo30} icon={CalendarClock} color="amber" />
          <CounterCard title="Vencendo em 60 dias" value={counters.vencendo60} icon={CalendarClock} color="amber" />
          <CounterCard title="Vencendo em 90 dias" value={counters.vencendo90} icon={CalendarClock} color="amber" />
          <CounterCard title="Vencidos" value={counters.vencidos} icon={AlertTriangle} color="red" />
          <CounterCard title="Sem data fim" value={counters.semDataFim} icon={FileText} color="blue" />
          <CounterCard title="Legado da Ativa aplicado" value={counters.legadoAtivaAplicada} icon={ShieldCheck} color="emerald" />
          <CounterCard title="Legado da Ativa pendente" value={counters.legadoAtivaPendente} icon={AlertTriangle} color="amber" />
          <CounterCard title="Encerrados" value={counters.encerrados} icon={XCircle} color="slate" />
          <CounterCard title="Cancelados" value={counters.cancelados} icon={XCircle} color="rose" />
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4 grid grid-cols-1 lg:grid-cols-4 gap-3">
            <div className="relative lg:col-span-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-slate-200" placeholder="Buscar por militar, matrícula, contrato ou boletim..." value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <select className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm" value={situacao} onChange={(e) => setSituacao(e.target.value)}>
              <option value={FILTRO_SITUACAO.TODOS}>Situação: Todos</option>
              <option value={FILTRO_SITUACAO.ATIVOS}>Ativos</option>
              <option value={FILTRO_SITUACAO.ATIVOS_VENCENDO}>Ativos vencendo</option>
              <option value={FILTRO_SITUACAO.ATIVOS_VENCIDOS}>Ativos vencidos</option>
              <option value={FILTRO_SITUACAO.ENCERRADOS}>Encerrados</option>
              <option value={FILTRO_SITUACAO.CANCELADOS}>Cancelados</option>
              <option value={FILTRO_SITUACAO.SEM_DATA_FIM}>Sem data fim</option>
            </select>
            <select className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm" value={vencimento} onChange={(e) => setVencimento(e.target.value)}>
              <option value={FILTRO_VENCIMENTO.TODOS}>Vencimento: Todos</option>
              <option value={FILTRO_VENCIMENTO.VENCIDOS}>Vencidos</option>
              <option value={FILTRO_VENCIMENTO.ATE_30}>Até 30 dias</option>
              <option value={FILTRO_VENCIMENTO.DE_31_A_60}>31–60 dias</option>
              <option value={FILTRO_VENCIMENTO.DE_61_A_90}>61–90 dias</option>
              <option value={FILTRO_VENCIMENTO.ACIMA_90}>Acima de 90 dias</option>
              <option value={FILTRO_VENCIMENTO.SEM_DATA_FIM}>Sem data fim</option>
            </select>
            <select className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm" value={legado} onChange={(e) => setLegado(e.target.value)}>
              <option value={FILTRO_LEGADO.TODOS}>Legado da Ativa: Todos</option>
              <option value={FILTRO_LEGADO.APLICADO}>Com transição aplicada</option>
              <option value={FILTRO_LEGADO.PENDENTE}>Sem transição aplicada</option>
            </select>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4">
            {query.isLoading ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">Carregando contratos...</div>
            ) : contratosFiltrados.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">Nenhum contrato encontrado para os filtros informados.</div>
            ) : (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {contratosFiltrados.map((contrato) => {
                  const militar = getMilitar(contrato);
                  const situacaoDerivada = calcularSituacaoDerivadaContrato(contrato);
                  const ui = SITUACAO_UI[situacaoDerivada] || SITUACAO_UI[SITUACAO_CONTRATO_DESIGNACAO.ATIVO];
                  const legadoInfo = legadoAtivaPorContrato[String(contrato.id)] || { aplicado: false };
                  const podeResolverPeriodos = canCreate && isContratoAtivoOperacional(contrato);

                  return (
                    <article key={contrato.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={ui.className}>{ui.label}</Badge>
                            <Badge variant="outline" className={legadoInfo.aplicado ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}>
                              Legado da Ativa: {legadoInfo.aplicado ? 'Aplicado' : 'Pendente'}
                            </Badge>
                          </div>
                          <h2 className="mt-2 break-words text-lg font-bold text-slate-900">{militar.nome_guerra || militar.nome_completo || 'Militar não localizado'}</h2>
                          <p className="text-sm text-slate-500">{militar.posto_graduacao || militar.quadro || 'Posto/graduação não informado'}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 sm:justify-end">
                          <Button asChild variant="outline" size="sm">
                            <Link to={`${createPageUrl('VerMilitar')}?id=${contrato.militar_id}`}><UserRound size={14} className="mr-1" />Ver ficha</Link>
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => setContratoDetalhe(contrato)}><Eye size={14} className="mr-1" />Detalhes</Button>
                          {canCreate && <Button type="button" variant="outline" size="sm" onClick={() => handleAbrirEdicaoContrato(contrato)}><Edit3 size={14} className="mr-1" />Editar contrato</Button>}
                          {podeResolverPeriodos && (
                            <Button type="button" variant="outline" size="sm" onClick={() => { setContratoArquivamento(contrato); setConfirmarArquivamento(false); setArquivamentoBloqueio(null); }} className="border-amber-200 text-amber-800 hover:bg-amber-50">
                              <Archive size={14} className="mr-1" />Arquivar períodos da ativa
                            </Button>
                          )}
                          {canCreate && (
                            <Button type="button" variant="outline" size="sm" onClick={() => handleExcluirContrato(contrato)} disabled={excluindoContratoId === contrato.id} className="border-rose-200 text-rose-700 hover:bg-rose-50">
                              {excluindoContratoId === contrato.id ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Trash2 size={14} className="mr-1" />}Excluir contrato
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <DetailItem label="Matrícula atual" value={getMatriculaAtual(contrato)} />
                        <DetailItem label="Matrícula de designação" value={contrato.matricula_designacao} />
                        <DetailItem label="Início" value={formatDate(contrato.data_inicio_contrato)} />
                        <DetailItem label="Fim previsto/operacional" value={formatDate(contrato.data_fim_contrato || contrato.data_encerramento_operacional)} />
                        <DetailItem label="Dias para vencimento" value={renderDias(contrato)} />
                        <DetailItem label="Contrato/boletim/publicação" value={[contrato.numero_contrato, contrato.boletim_publicacao, formatDate(contrato.data_publicacao)].filter((value) => value && value !== '—').join(' • ')} />
                        <div className="sm:col-span-2 lg:col-span-3">
                          <DetailItem label="Fonte legal/tipo" value={[contrato.fonte_legal, contrato.tipo_designacao].filter(Boolean).join(' / ')} />
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {query.error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{query.error.message || 'Erro ao carregar painel.'}</div>}
      </div>

      <ContratoDesignacaoModal
        open={novoContratoOpen}
        onOpenChange={setNovoContratoOpen}
        militares={militaresOpcoesContrato}
        matriculas={matriculasMilitaresDisponiveis}
        militaresLoading={militaresDisponiveisQuery.isLoading || militaresDisponiveisQuery.isFetching}
        onSubmit={handleCreateContrato}
        isSubmitting={salvandoContrato}
      />

      <ContratoDesignacaoModal
        open={Boolean(contratoEdicao)}
        onOpenChange={(open) => { if (!open) { setContratoEdicao(null); setContratoEdicaoBloqueiaCadeia(false); } }}
        contrato={contratoEdicao}
        militares={militaresOpcoesContrato}
        matriculas={matriculasMilitaresDisponiveis}
        militaresLoading={militaresDisponiveisQuery.isLoading || militaresDisponiveisQuery.isFetching}
        bloqueiaCadeiaFerias={contratoEdicaoBloqueiaCadeia}
        onSubmit={handleUpdateContrato}
        isSubmitting={salvandoContrato}
      />

      {contratoArquivamento && (() => {
        const militar = getMilitar(contratoArquivamento);
        const legadoInfo = legadoAtivaPorContrato[String(contratoArquivamento.id)] || { aplicado: false, totalPeriodos: 0, ultimaAplicacaoEm: null };
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true">
            <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
              <div className="border-b border-slate-200 p-5">
                <h2 className="text-xl font-bold text-slate-900">Arquivar períodos da ativa</h2>
                <p className="mt-1 text-sm text-slate-500">Arquivamento lógico em bloco da cadeia anterior à nova data-base de férias.</p>
              </div>
              <div className="space-y-4 p-5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <DetailItem label="Militar" value={militar.nome_completo || militar.nome_guerra} />
                  <DetailItem label="Matrícula" value={getMatriculaAtual(contratoArquivamento)} />
                  <DetailItem label="Contrato" value={[contratoArquivamento.numero_contrato, contratoArquivamento.boletim_publicacao].filter(Boolean).join(' • ')} />
                  <DetailItem label="Nova data-base" value={formatDate(contratoArquivamento.data_inclusao_para_ferias)} />
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Esta ação não apaga períodos, férias, Livro ou publicações. Apenas retira a cadeia antiga da operação normal.
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  Resumo prévio: {legadoInfo.aplicado ? `${legadoInfo.totalPeriodos || 0} período(s) já marcado(s) como Legado da Ativa neste contrato.` : 'pendente de arquivamento lógico para este contrato.'}
                </div>
                {arquivamentoBloqueio && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                      <div>
                        <p className="font-semibold">Não foi possível arquivar/excluir os períodos porque existem férias lançadas em um ou mais períodos da cadeia antiga.</p>
                        <p className="mt-1">Exclua ou corrija as férias vinculadas antes de continuar.</p>
                        {arquivamentoBloqueio.bloqueantes?.length > 0 && (
                          <ul className="mt-3 list-disc space-y-1 pl-5">
                            {arquivamentoBloqueio.bloqueantes.map((bloqueante) => (
                              <li key={bloqueante.id || `${bloqueante.referencia}-${bloqueante.periodo}`}>{formatarPeriodoBloqueante(bloqueante)}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-slate-300"
                    checked={confirmarArquivamento}
                    onChange={(event) => setConfirmarArquivamento(event.target.checked)}
                  />
                  <span>Confirmo o arquivamento lógico da cadeia anterior</span>
                </label>
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-200 p-5">
                <Button variant="outline" onClick={() => { setContratoArquivamento(null); setConfirmarArquivamento(false); setArquivamentoBloqueio(null); }} disabled={arquivandoPeriodos}>Cancelar</Button>
                <Button onClick={handleArquivarPeriodos} disabled={!confirmarArquivamento || arquivandoPeriodos} className="bg-[#1e3a5f] text-white hover:bg-[#2d4a6f]">
                  {arquivandoPeriodos ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />}
                  Arquivar períodos
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {contratoDetalhe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-4xl rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-5 flex items-center justify-between">
              <div><h2 className="text-xl font-bold text-slate-900">Detalhes do contrato</h2><p className="text-sm text-slate-500">Visualização read-only — não há alteração de dados nesta tela.</p></div>
              <Button variant="outline" onClick={() => setContratoDetalhe(null)}>Fechar</Button>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
              {(() => {
                const militar = getMilitar(contratoDetalhe);
                const legadoInfo = legadoAtivaPorContrato[String(contratoDetalhe.id)] || { aplicado: false, totalPeriodos: 0, ultimaAplicacaoEm: null };
                return (<>
                  <DetailItem label="Militar" value={militar.nome_completo || militar.nome_guerra} />
                  <DetailItem label="Matrícula atual" value={getMatriculaAtual(contratoDetalhe)} />
                  <DetailItem label="Matrícula de designação" value={contratoDetalhe.matricula_designacao} />
                  <DetailItem label="Status persistido" value={contratoDetalhe.status_contrato} />
                  <DetailItem label="Situação visual derivada" value={SITUACAO_UI[calcularSituacaoDerivadaContrato(contratoDetalhe)]?.label} />
                  <DetailItem label="Classificação vencimento" value={classificarVencimentoContrato(contratoDetalhe)} />
                  <DetailItem label="Início" value={formatDate(contratoDetalhe.data_inicio_contrato)} />
                  <DetailItem label="Fim previsto/operacional" value={formatDate(contratoDetalhe.data_fim_contrato || contratoDetalhe.data_encerramento_operacional)} />
                  <DetailItem label="Data de inclusão para férias" value={formatDate(contratoDetalhe.data_inclusao_para_ferias)} />
                  <DetailItem label="Tipo de prazo" value={contratoDetalhe.tipo_prazo_contrato} />
                  <DetailItem label="Gera direito a férias" value={contratoDetalhe.gera_direito_ferias === false ? 'Não' : 'Sim'} />
                  <DetailItem label="Regra de geração de períodos" value={contratoDetalhe.regra_geracao_periodos} />
                  <DetailItem label="Nº contrato" value={contratoDetalhe.numero_contrato} />
                  <DetailItem label="Boletim/publicação" value={contratoDetalhe.boletim_publicacao} />
                  <DetailItem label="Data publicação" value={formatDate(contratoDetalhe.data_publicacao)} />
                  <DetailItem label="Fonte legal" value={contratoDetalhe.fonte_legal} />
                  <DetailItem label="Tipo de designação" value={contratoDetalhe.tipo_designacao} />
                  <DetailItem label="Legado da Ativa" value={legadoInfo.aplicado ? `Aplicada (${legadoInfo.totalPeriodos} período(s))` : 'Pendente'} />
                  <DetailItem label="Última aplicação legado" value={legadoInfo.ultimaAplicacaoEm ? formatDate(legadoInfo.ultimaAplicacaoEm) : '—'} />
                  {contratoDetalhe.gera_direito_ferias === false && <div className="md:col-span-2"><DetailItem label="Motivo para não gerar férias" value={contratoDetalhe.motivo_nao_gera_ferias} /></div>}
                  <div className="md:col-span-2"><DetailItem label="Observações" value={contratoDetalhe.observacoes} /></div>
                </>);
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
