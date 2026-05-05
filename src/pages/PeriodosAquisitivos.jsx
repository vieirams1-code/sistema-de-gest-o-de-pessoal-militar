import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import React, { useMemo, useState } from 'react';
import { fetchScopedPeriodosAquisitivosBundle } from '@/services/getScopedPeriodosAquisitivosBundleClient';
import { getEffectiveEmail } from '@/services/getScopedMilitaresClient';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { differenceInDays } from 'date-fns';
import { createPageUrl } from '@/utils';
import { atualizarEscopado, excluirEscopado } from '@/services/cudEscopadoClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search,
  Calendar,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Users,
} from 'lucide-react';
import { getAlertaPeriodoConcessivo, hasPrevisaoValidaPeriodo } from '@/components/ferias/feriasRules';
import { mapPeriodosAquisitivosPorMilitar } from '@/components/ferias/periodosAquisitivosMapper';
import PeriodoAquisitivoCard from '@/components/ferias/PeriodoAquisitivoCard';
import PeriodoAquisitivoGenerator from '@/components/ferias/PeriodoAquisitivoGenerator';
import GerenciarPeriodoModal from '@/components/ferias/GerenciarPeriodoModal';
import {
  enriquecerMilitarComMatriculas,
  filtrarMilitaresOperacionais,
  militarCorrespondeBusca,
  montarIndiceMatriculas,
} from '@/services/matriculaMilitarViewService';

export default function PeriodosAquisitivos() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canAccessModule, isLoading: loadingUser, isAccessResolved, isAdmin = false, user = {}, modoAcesso = null } = useCurrentUser();
  const hasFeriasAccess = canAccessModule('ferias');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [quickFilter, setQuickFilter] = useState('all');
  const [periodoFilter, setPeriodoFilter] = useState('all');
  const [expandedMilitares, setExpandedMilitares] = useState({});
  const [periodoGerenciado, setPeriodoGerenciado] = useState(null);

  const effectiveEmail = getEffectiveEmail();
  const paBundleQueryKey = ['pa-bundle', Boolean(isAdmin), modoAcesso || null, user?.email || null, effectiveEmail || null];

  const { data: paBundle, isLoading } = useQuery({
    queryKey: paBundleQueryKey,
    queryFn: () => fetchScopedPeriodosAquisitivosBundle(),
  });

  const periodos = paBundle?.periodosAquisitivos || [];
  const ferias = paBundle?.ferias || [];
  const registrosLivro = paBundle?.registrosLivro || [];
  const militares = paBundle?.militares || [];
  const matriculasMilitar = paBundle?.matriculasMilitar || [];


  const updatePeriodoMutation = useMutation({
    mutationFn: ({ periodoId, payload }) => atualizarEscopado('PeriodoAquisitivo', periodoId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paBundleQueryKey });
    },
  });

  const deletePeriodoMutation = useMutation({
    mutationFn: ({ periodoId }) => excluirEscopado('PeriodoAquisitivo', periodoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paBundleQueryKey });
    },
  });


  const militaresEnriquecidos = useMemo(() => {
    const indice = montarIndiceMatriculas(matriculasMilitar);
    return filtrarMilitaresOperacionais(
      (militares || []).map((m) => enriquecerMilitarComMatriculas(m, indice)),
      { incluirInativos: true }
    );
  }, [militares, matriculasMilitar]);

  const militaresPorId = useMemo(
    () => new Map(militaresEnriquecidos.map((m) => [String(m.id), m])),
    [militaresEnriquecidos]
  );

  const periodosTransformados = useMemo(() => {
    const mapeados = mapPeriodosAquisitivosPorMilitar({ periodos, ferias });

    return {
      ...mapeados,
      militares: mapeados.militares
        .map((grupo) => {
          const militarAtual = militaresPorId.get(String(grupo?.militar?.id || ''));

          if (!militarAtual) return grupo;

          return {
            ...grupo,
            militar: {
              ...grupo.militar,
              matricula: militarAtual.matricula_atual || grupo.militar.matricula || '',
              matricula_atual: militarAtual.matricula_atual || grupo.militar.matricula || '',
              matriculas_historico: militarAtual.matriculas_historico || [],
            },
          };
        })
        .map((grupo) => {
          const militarId = String(grupo?.militar?.id || '');
          if (!militarId || militaresPorId.has(militarId)) return grupo;
          return {
            ...grupo,
            militar: {
              ...grupo.militar,
              nome_guerra: grupo?.militar?.nome_guerra || 'Militar não carregado',
            },
          };
        }),
    };
  }, [periodos, ferias, militaresPorId]);

  const periodosFlat = useMemo(
    () => periodosTransformados.militares.flatMap((grupoMilitar) => grupoMilitar.periodos),
    [periodosTransformados]
  );

  const periodosUnicos = [...new Set(periodosFlat.map((p) => p.referencia).filter(Boolean))].sort((a, b) => b.localeCompare(a));

  const hoje = useMemo(() => {
    const data = new Date();
    data.setHours(0, 0, 0, 0);
    return data;
  }, []);

  const getPeriodoResumoStatus = (periodo) => {
    const alerta = getAlertaPeriodoConcessivo({
      dataLimiteGozo: periodo.data_limite_gozo_iso,
      hasPrevisaoValida: hasPrevisaoValidaPeriodo(periodo),
    });

    const isVencendo = alerta?.nivel === 'critico';
    const isDisponivel = periodo.status_operacional === 'Disponível';

    let isVencido = false;
    if (periodo.data_limite_gozo_iso) {
      const limite = new Date(`${periodo.data_limite_gozo_iso}T00:00:00`);
      isVencido = differenceInDays(limite, hoje) < 0;
    }

    return {
      isDisponivel,
      isVencendo,
      isVencido,
    };
  };

  const filteredMilitares = useMemo(
    () =>
      periodosTransformados.militares
        .map((grupoMilitar) => {
          const periodosFiltrados = grupoMilitar.periodos.filter((periodo) => {
            const searchLower = searchTerm.toLowerCase();
            const matchesMilitarTermo = militarCorrespondeBusca(
              {
                nome_guerra: grupoMilitar.militar.nome_guerra,
                matricula: grupoMilitar.militar.matricula,
                matricula_atual: grupoMilitar.militar.matricula_atual,
                matriculas_historico: grupoMilitar.militar.matriculas_historico,
              },
              searchTerm
            );
            const matchesSearch =
              matchesMilitarTermo ||
              grupoMilitar.militar.nome_guerra?.toLowerCase().includes(searchLower) ||
              periodo.referencia?.includes(searchTerm);
            const matchesStatus = statusFilter === 'all' || periodo.status_operacional === statusFilter;
            const matchesPeriodo = periodoFilter === 'all' || periodo.referencia === periodoFilter;
            const resumo = getPeriodoResumoStatus(periodo);
            const matchesQuick =
              quickFilter === 'all' ||
              (quickFilter === 'disponiveis' && resumo.isDisponivel) ||
              (quickFilter === 'vencendo' && resumo.isVencendo) ||
              (quickFilter === 'vencidos' && resumo.isVencido);
            return matchesSearch && matchesStatus && matchesPeriodo && matchesQuick;
          });

          return {
            ...grupoMilitar,
            periodos: periodosFiltrados,
          };
        })
        .filter((grupoMilitar) => grupoMilitar.periodos.length > 0),
    [periodosTransformados, searchTerm, statusFilter, periodoFilter, quickFilter]
  );

  const filteredPeriodosCount = filteredMilitares.reduce((total, grupo) => total + grupo.periodos.length, 0);

  const stats = {
    total: periodosFlat.length,
    disponiveis: periodosFlat.filter((p) => getPeriodoResumoStatus(p).isDisponivel).length,
    vencendo: periodosFlat.filter((p) => getPeriodoResumoStatus(p).isVencendo).length,
    vencidos: periodosFlat.filter((p) => getPeriodoResumoStatus(p).isVencido).length,
  };

  const quickFilterLabel = {
    all: 'Total',
    disponiveis: 'Disponíveis',
    vencendo: 'Vencendo (90d)',
    vencidos: 'Vencidos',
  };


  const formatProximoVencimento = (dias) => {
    if (typeof dias !== 'number') return 'Sem data limite';
    if (dias < 0) return `Vencido há ${Math.abs(dias)} dia(s)`;
    if (dias === 0) return 'Vence hoje';
    return `Vence em ${dias} dia(s)`;
  };

  const toggleMilitar = (militarId) => {
    setExpandedMilitares((prev) => ({
      ...prev,
      [militarId]: !prev[militarId],
    }));
  };

  const abrirFeriasVinculadas = () => {
    navigate(createPageUrl('Ferias'));
  };

  const handleSubmitEdicao = async (payload) => {
    if (!periodoGerenciado?.id) throw new Error('Período inválido para edição.');

    await updatePeriodoMutation.mutateAsync({
      periodoId: periodoGerenciado.id,
      payload,
    });
  };

  const handleChangeStatus = async (status) => {
    if (!periodoGerenciado?.id) throw new Error('Período inválido para alteração de status.');

    await updatePeriodoMutation.mutateAsync({
      periodoId: periodoGerenciado.id,
      payload: { status },
    });
  };

  const handleConfirmDelete = async ({ forceInactivate }) => {
    if (!periodoGerenciado?.id) throw new Error('Período inválido para exclusão.');

    if (forceInactivate) {
      await updatePeriodoMutation.mutateAsync({
        periodoId: periodoGerenciado.id,
        payload: { status: 'Inativo' },
      });
      return;
    }

    await deletePeriodoMutation.mutateAsync({
      periodoId: periodoGerenciado.id,
    });
  };






  if (loadingUser || !isAccessResolved) return null;
  if (!hasFeriasAccess) return <AccessDenied modulo="Férias" />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('Ferias'))} className="hover:bg-slate-200">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-[#1e3a5f]">Períodos Aquisitivos</h1>
              <p className="text-slate-500">Controle e habilitação/inabilitação de períodos</p>
            </div>
          </div>
          <div className="flex gap-3">
            <PeriodoAquisitivoGenerator />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className={`bg-white rounded-xl p-4 shadow-sm border transition-all cursor-pointer ${quickFilter === 'all' ? 'border-[#1e3a5f] bg-slate-50' : 'border-slate-100 hover:border-slate-200'}`} onClick={() => setQuickFilter('all')}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#1e3a5f]/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-[#1e3a5f]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1e3a5f]">{stats.total}</p>
                <p className="text-xs text-slate-500">Total</p>
              </div>
            </div>
          </div>

          <div
            className={`bg-white rounded-xl p-4 shadow-sm border transition-all cursor-pointer ${quickFilter === 'disponiveis' ? 'border-emerald-400 bg-emerald-50/40' : 'border-slate-100 hover:border-emerald-200'}`}
            onClick={() => setQuickFilter((prev) => (prev === 'disponiveis' ? 'all' : 'disponiveis'))}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600">{stats.disponiveis}</p>
                <p className="text-xs text-slate-500">Disponíveis</p>
              </div>
            </div>
          </div>

          <div
            className={`bg-white rounded-xl p-4 shadow-sm border transition-all cursor-pointer ${quickFilter === 'vencendo' ? 'border-amber-400 bg-amber-50/40' : 'border-slate-100 hover:border-amber-200'}`}
            onClick={() => setQuickFilter((prev) => (prev === 'vencendo' ? 'all' : 'vencendo'))}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">{stats.vencendo}</p>
                <p className="text-xs text-slate-500">Vencendo (90d)</p>
              </div>
            </div>
          </div>

          <div
            className={`bg-white rounded-xl p-4 shadow-sm border transition-all cursor-pointer ${quickFilter === 'vencidos' ? 'border-red-400 bg-red-50/40' : 'border-slate-100 hover:border-red-200'}`}
            onClick={() => setQuickFilter((prev) => (prev === 'vencidos' ? 'all' : 'vencidos'))}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{stats.vencidos}</p>
                <p className="text-xs text-slate-500">Vencidos</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Buscar por militar, matrícula ou ano..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10 border-slate-200"
              />
            </div>
            <Select value={periodoFilter} onValueChange={setPeriodoFilter}>
              <SelectTrigger className="w-full md:w-40 h-10 border-slate-200">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Períodos</SelectItem>
                {periodosUnicos.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48 h-10 border-slate-200">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="Pendente">Pendente</SelectItem>
                <SelectItem value="Disponível">Disponível</SelectItem>
                <SelectItem value="Previsto">Previsto</SelectItem>
                <SelectItem value="Parcialmente Gozado">Parcialmente Gozado</SelectItem>
                <SelectItem value="Gozado">Gozado</SelectItem>
                <SelectItem value="Vencido">Vencido</SelectItem>
                <SelectItem value="Inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {quickFilter !== 'all' && (
          <div className="mb-3 flex items-center gap-3 text-sm">
            <span className="text-slate-600">Filtro rápido: <strong>{quickFilterLabel[quickFilter]}</strong></span>
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setQuickFilter('all')}>
              Limpar filtro
            </Button>
          </div>
        )}

        <div className="mb-4 text-sm text-slate-500">
          {filteredPeriodosCount} período(s) encontrado(s) em {filteredMilitares.length} militar(es)
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredMilitares.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center">
            <Calendar className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">Nenhum período encontrado</h3>
            <p className="text-slate-500 mb-6">
              {searchTerm || statusFilter !== 'all' || periodoFilter !== 'all' || quickFilter !== 'all'
                ? 'Tente ajustar os filtros de busca'
                : 'Clique em "Gerar Períodos Automáticos" para começar'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredMilitares.map((grupoMilitar) => {
              const isExpanded = expandedMilitares[grupoMilitar.militar.id] ?? false;

              return (
                <div key={grupoMilitar.militar.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                  <button type="button" onClick={() => toggleMilitar(grupoMilitar.militar.id)} className="w-full px-4 py-4 hover:bg-slate-50 transition-colors">
                    <div className="grid lg:grid-cols-[minmax(220px,1fr)_minmax(220px,1.3fr)_minmax(180px,1fr)_auto] gap-4 items-center text-left">
                      <div className="flex items-center gap-3 text-left">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-slate-500 shrink-0" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-slate-500 shrink-0" />
                      )}
                      <div className="w-10 h-10 rounded-lg bg-[#1e3a5f]/10 flex items-center justify-center shrink-0">
                        <Users className="w-5 h-5 text-[#1e3a5f]" />
                      </div>
                      <div>
                        <p className="text-sm md:text-base font-semibold text-slate-900 leading-tight">
                          {grupoMilitar.militar.posto_graduacao ? `${grupoMilitar.militar.posto_graduacao} ` : ''}
                          {grupoMilitar.militar.nome_guerra || 'Militar sem identificação'}
                        </p>
                        <p className="text-xs text-slate-500">{grupoMilitar.militar.matricula || 'Matrícula não informada'}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm text-slate-600">
                      <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-700 font-medium">
                        {grupoMilitar.resumo.total} período(s)
                      </span>
                      <span className="px-2 py-1 rounded-md bg-blue-50 text-blue-700">Próx.: {grupoMilitar.resumo.proximo_vencimento || '-'}</span>
                    </div>

                    <div className="text-xs text-slate-600">
                      <p className="font-medium text-slate-700">{formatProximoVencimento(grupoMilitar.resumo.dias_proximo_vencimento)}</p>
                      <p className="text-slate-500">Resumo de vencimento</p>
                    </div>

                    <div className="flex flex-wrap items-center justify-start lg:justify-end gap-2 md:gap-3 text-xs md:text-sm text-slate-600">
                      <span className="px-2 py-1 rounded-md bg-red-50 text-red-700">Críticos: {grupoMilitar.resumo.critico}</span>
                      <span className="px-2 py-1 rounded-md bg-amber-50 text-amber-700">Atenção: {grupoMilitar.resumo.atencao}</span>
                      <span className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700">Em dia: {grupoMilitar.resumo.ok}</span>
                    </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-100 p-4 bg-slate-50/50">
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        {grupoMilitar.periodos.map((periodo) => (
                          <PeriodoAquisitivoCard
                            key={periodo.id}
                            periodo={periodo}
                            onManage={() => setPeriodoGerenciado(periodo)}
                            onOpenFerias={abrirFeriasVinculadas}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <GerenciarPeriodoModal
        open={Boolean(periodoGerenciado)}
        periodo={periodoGerenciado}
        registrosLivro={registrosLivro}
        saving={updatePeriodoMutation.isPending}
        deleting={deletePeriodoMutation.isPending}
        onOpenChange={(open) => {
          if (!open) setPeriodoGerenciado(null);
        }}
        onSubmitEdicao={handleSubmitEdicao}
        onChangeStatus={handleChangeStatus}
        onConfirmDelete={handleConfirmDelete}
        onOpenFerias={abrirFeriasVinculadas}
      />

    </div>
  );
}
