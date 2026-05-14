import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CalendarClock, Edit3, Eye, Loader2, MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react';

import AccessDenied from '@/components/auth/AccessDenied';
import ContratoDesignacaoModal from '@/components/militar/ContratoDesignacaoModal';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { atualizarEscopado, criarEscopado, excluirEscopado } from '@/services/cudEscopadoClient';
import { fetchScopedPainelContratosDesignacao } from '@/services/getScopedPainelContratosDesignacaoClient';
import { fetchScopedMilitares, getEffectiveEmail } from '@/services/getScopedMilitaresClient';
import {
  aplicarFiltrosPainelContratos,
  buscarEfeitosContratoEmPeriodos,
  calcularDiasParaVencimento,
  calcularSituacaoDerivadaContrato,
  classificarVencimentoContrato,
  getCampoCadeiaFeriasAlterado,
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

function CounterCard({ title, value, tone = 'slate' }) {
  const tones = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-400',
    red: 'bg-red-500',
    blue: 'bg-blue-500',
    slate: 'bg-slate-700',
  };
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm">
      <div className={`absolute inset-y-0 left-0 w-1.5 ${tones[tone] || tones.slate}`} />
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-1 text-2xl font-bold leading-none text-slate-950">{value || 0}</p>
    </div>
  );
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
  const navigate = useNavigate();
  const { toast } = useToast();
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState(FILTRO_SITUACAO.TODOS);
  const [vencimento, setVencimento] = useState(FILTRO_VENCIMENTO.TODOS);
  const [contratoDetalhe, setContratoDetalhe] = useState(null);
  const [contratoEdicao, setContratoEdicao] = useState(null);
  const [contratoEdicaoBloqueiaCadeia, setContratoEdicaoBloqueiaCadeia] = useState(false);
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
    busca,
    situacao,
    vencimento,
  }), [busca, contratos, matriculasMilitar, militaresPorId, situacao, vencimento]);

  const revisarPeriodosMilitar = (militarId) => {
    if (!militarId) return;
    navigate(`${createPageUrl('PeriodosAquisitivos')}?militarId=${encodeURIComponent(militarId)}`);
  };

  const handleCreateContrato = async (payload) => {
    setSalvandoContrato(true);
    try {
      await criarEscopado('ContratoDesignacaoMilitar', payload);
      setNovoContratoOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['painel-contratos-designacao'] });
      toast({
        title: 'Contrato cadastrado',
        description: 'Revise os períodos aquisitivos do militar e exclua manualmente apenas os períodos incompatíveis, quando permitido.',
        duration: 10000,
        action: (
          <Button type="button" size="sm" variant="outline" onClick={() => revisarPeriodosMilitar(payload?.militar_id)}>
            Revisar períodos aquisitivos deste militar
          </Button>
        ),
      });
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
        <header className="rounded-xl border-b border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Gestão administrativa</p>
              <h1 className="text-3xl font-bold text-slate-950">Contratos de Designação</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">Controle centralizado de contratos ativos, vencidos e encerrados, preservando os fluxos administrativos existentes.</p>
            </div>
            {canCreate && (
              <Button onClick={() => setNovoContratoOpen(true)} className="bg-blue-600 text-white hover:bg-blue-700">
                <Plus className="mr-2 h-4 w-4" />Novo contrato
              </Button>
            )}
          </div>
        </header>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <CounterCard title="Ativos" value={counters.ativos} tone="emerald" />
          <CounterCard title="Sem data fim" value={counters.semDataFim} tone="blue" />
          <CounterCard title="Vencendo" value={(counters.vencendo30 || 0) + (counters.vencendo60 || 0) + (counters.vencendo90 || 0)} tone="amber" />
          <CounterCard title="Vencidos" value={counters.vencidos} tone="red" />
          <CounterCard title="Encerrados" value={counters.encerrados} tone="slate" />
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-1 gap-3 border-b border-slate-200 bg-white p-4 lg:grid-cols-[minmax(18rem,1fr)_14rem_14rem]">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-100" placeholder="Buscar por militar, matrícula, contrato ou boletim..." value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <select className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700" value={situacao} onChange={(e) => setSituacao(e.target.value)}>
              <option value={FILTRO_SITUACAO.TODOS}>Situação: Todos</option>
              <option value={FILTRO_SITUACAO.ATIVOS}>Ativos</option>
              <option value={FILTRO_SITUACAO.ATIVOS_VENCENDO}>Ativos vencendo</option>
              <option value={FILTRO_SITUACAO.ATIVOS_VENCIDOS}>Ativos vencidos</option>
              <option value={FILTRO_SITUACAO.ENCERRADOS}>Encerrados</option>
              <option value={FILTRO_SITUACAO.CANCELADOS}>Cancelados</option>
              <option value={FILTRO_SITUACAO.SEM_DATA_FIM}>Sem data fim</option>
            </select>
            <select className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700" value={vencimento} onChange={(e) => setVencimento(e.target.value)}>
              <option value={FILTRO_VENCIMENTO.TODOS}>Vencimento: Todos</option>
              <option value={FILTRO_VENCIMENTO.VENCIDOS}>Vencidos</option>
              <option value={FILTRO_VENCIMENTO.ATE_30}>Até 30 dias</option>
              <option value={FILTRO_VENCIMENTO.DE_31_A_60}>31–60 dias</option>
              <option value={FILTRO_VENCIMENTO.DE_61_A_90}>61–90 dias</option>
              <option value={FILTRO_VENCIMENTO.ACIMA_90}>Acima de 90 dias</option>
              <option value={FILTRO_VENCIMENTO.SEM_DATA_FIM}>Sem data fim</option>
            </select>
          </div>

          {query.isLoading ? (
            <div className="px-4 py-12 text-center text-sm text-slate-500">Carregando contratos...</div>
          ) : contratosFiltrados.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-slate-500">Nenhum contrato encontrado para os filtros informados.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Militar / Identificação</th>
                    <th className="px-4 py-3">Período do Contrato</th>
                    <th className="px-4 py-3">Publicação</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {contratosFiltrados.map((contrato) => {
                    const militar = getMilitar(contrato);
                    const situacaoDerivada = calcularSituacaoDerivadaContrato(contrato);
                    const ui = SITUACAO_UI[situacaoDerivada] || SITUACAO_UI[SITUACAO_CONTRATO_DESIGNACAO.ATIVO];
                    const nomeMilitar = militar.nome_completo || militar.nome_guerra || 'Militar não localizado';
                    const matriculaAtual = getMatriculaAtual(contrato);
                    const fimContrato = contrato.data_fim_contrato || contrato.data_encerramento_operacional;
                    const dataBaseFerias = contrato.data_inclusao_para_ferias && contrato.data_inclusao_para_ferias !== contrato.data_inicio_contrato
                      ? formatDate(contrato.data_inclusao_para_ferias)
                      : null;

                    return (
                      <tr key={contrato.id} className="align-top hover:bg-slate-50/70">
                        <td className="min-w-[18rem] px-4 py-4">
                          <div className="space-y-1.5">
                            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">{militar.posto_graduacao || militar.quadro || 'Posto/graduação'}</Badge>
                            <p className="font-semibold text-slate-950">{nomeMilitar}</p>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <span>Matrícula {matriculaAtual}</span>
                              <Link className="font-semibold text-blue-700 hover:text-blue-800" to={`${createPageUrl('VerMilitar')}?id=${contrato.militar_id}`}>Ver ficha</Link>
                            </div>
                          </div>
                        </td>
                        <td className="min-w-[17rem] px-4 py-4">
                          <div className="flex flex-wrap items-center gap-2 font-medium text-slate-800">
                            <span>{formatDate(contrato.data_inicio_contrato)}</span>
                            <ArrowRight className="h-4 w-4 text-slate-400" />
                            <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">{fimContrato ? formatDate(fimContrato) : 'Indeterminado'}</Badge>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">{dataBaseFerias ? `Data-base férias: ${dataBaseFerias}` : `Vencimento: ${renderDias(contrato)}`}</p>
                        </td>
                        <td className="min-w-[12rem] px-4 py-4">
                          <p className="font-medium text-slate-900">{contrato.boletim_publicacao || contrato.numero_contrato || '—'}</p>
                          <p className="text-xs text-slate-500">{contrato.data_publicacao ? formatDate(contrato.data_publicacao) : 'Data não informada'}</p>
                        </td>
                        <td className="px-4 py-4">
                          <Badge variant="outline" className={`${ui.className} rounded-full px-2.5 py-1`}>
                            {situacaoDerivada === SITUACAO_CONTRATO_DESIGNACAO.ATIVO && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-500" />}
                            {ui.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {canCreate && (
                              <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => handleAbrirEdicaoContrato(contrato)} aria-label="Editar contrato">
                                <Edit3 className="h-4 w-4" />
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button type="button" variant="outline" size="icon" className="h-8 w-8" aria-label="Mais opções">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuItem onSelect={() => setContratoDetalhe(contrato)}>
                                  <Eye className="h-4 w-4" />Detalhes
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => revisarPeriodosMilitar(contrato.militar_id)}>
                                  <CalendarClock className="h-4 w-4" />Revisar períodos
                                </DropdownMenuItem>
                                {canCreate && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-red-600 focus:text-red-700"
                                      disabled={excluindoContratoId === contrato.id}
                                      onSelect={() => handleExcluirContrato(contrato)}
                                    >
                                      {excluindoContratoId === contrato.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                      Excluir contrato
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

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
