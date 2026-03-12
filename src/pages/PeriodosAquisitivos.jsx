import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { differenceInDays } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
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

export default function PeriodosAquisitivos() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [militarFilter, setMilitarFilter] = useState('all');
  const [periodoFilter, setPeriodoFilter] = useState('all');
  const [expandedMilitares, setExpandedMilitares] = useState({});

  const { data: periodos = [], isLoading } = useQuery({
    queryKey: ['periodos-aquisitivos'],
    queryFn: () => base44.entities.PeriodoAquisitivo.list('-inicio_aquisitivo'),
  });

  const { data: ferias = [], isLoading: isLoadingFerias } = useQuery({
    queryKey: ['ferias'],
    queryFn: () => base44.entities.Ferias.list('-data_inicio'),
  });

  const periodosTransformados = useMemo(
    () => mapPeriodosAquisitivosPorMilitar({ periodos, ferias }),
    [periodos, ferias]
  );

  const periodosFlat = useMemo(
    () =>
      periodosTransformados.militares.flatMap((grupoMilitar) =>
        grupoMilitar.periodos.map((periodo) => ({
          ...periodo,
          militar_id: grupoMilitar.militar.id,
          militar_nome: grupoMilitar.militar.nome_guerra,
          militar_posto: grupoMilitar.militar.posto_graduacao,
          militar_matricula: grupoMilitar.militar.matricula,
          ano_referencia: periodo.referencia,
          inicio_aquisitivo: periodo.data_inicio_aquisitivo,
          fim_aquisitivo: periodo.data_fim_aquisitivo,
          data_limite_gozo: periodo.data_limite_gozo_iso,
          status: periodo.status_operacional,
        }))
      ),
    [periodosTransformados]
  );

  const militaresUnicos = [...new Map(periodosFlat.map((p) => [p.militar_id, { id: p.militar_id, nome: p.militar_nome, posto: p.militar_posto }])).values()]
    .filter((m) => m.id)
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

  const periodosUnicos = [...new Set(periodosFlat.map((p) => p.ano_referencia).filter(Boolean))].sort((a, b) => b.localeCompare(a));

  const filteredMilitares = useMemo(
    () =>
      periodosTransformados.militares
        .map((grupoMilitar) => {
          const periodosFiltrados = grupoMilitar.periodos.filter((periodo) => {
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch =
              grupoMilitar.militar.nome_guerra?.toLowerCase().includes(searchLower) ||
              grupoMilitar.militar.matricula?.toLowerCase().includes(searchLower) ||
              periodo.referencia?.includes(searchTerm);
            const matchesStatus = statusFilter === 'all' || periodo.status_operacional === statusFilter;
            const matchesMilitar = militarFilter === 'all' || grupoMilitar.militar.id === militarFilter;
            const matchesPeriodo = periodoFilter === 'all' || periodo.referencia === periodoFilter;
            return matchesSearch && matchesStatus && matchesMilitar && matchesPeriodo;
          });

          return {
            ...grupoMilitar,
            periodos: periodosFiltrados,
          };
        })
        .filter((grupoMilitar) => grupoMilitar.periodos.length > 0),
    [periodosTransformados, searchTerm, statusFilter, militarFilter, periodoFilter]
  );

  const filteredPeriodosCount = filteredMilitares.reduce((total, grupo) => total + grupo.periodos.length, 0);

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const stats = {
    total: periodos.length,
    disponiveis: periodosFlat.filter((p) => p.status === 'Disponível').length,
    vencendo: periodosFlat.filter((p) => {
      const alerta = getAlertaPeriodoConcessivo({
        dataLimiteGozo: p.data_limite_gozo,
        hasPrevisaoValida: hasPrevisaoValidaPeriodo(p),
      });
      return alerta?.nivel === 'critico';
    }).length,
    vencidos: periodosFlat.filter((p) => {
      if (!p.data_limite_gozo) return false;
      const limite = new Date(`${p.data_limite_gozo}T00:00:00`);
      return differenceInDays(limite, hoje) < 0;
    }).length,
  };

  const toggleMilitar = (militarId) => {
    setExpandedMilitares((prev) => ({
      ...prev,
      [militarId]: !prev[militarId],
    }));
  };

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
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
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

          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
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

          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
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

          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
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
            <Select value={militarFilter} onValueChange={setMilitarFilter}>
              <SelectTrigger className="w-full md:w-52 h-10 border-slate-200">
                <SelectValue placeholder="Filtrar por Militar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Militares</SelectItem>
                {militaresUnicos.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.posto ? `${m.posto} ` : ''}{m.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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

        <div className="mb-4 text-sm text-slate-500">
          {filteredPeriodosCount} período(s) encontrado(s) em {filteredMilitares.length} militar(es)
        </div>

        {isLoading || isLoadingFerias ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredMilitares.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center">
            <Calendar className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">Nenhum período encontrado</h3>
            <p className="text-slate-500 mb-6">
              {searchTerm || statusFilter !== 'all'
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
                  <button
                    type="button"
                    onClick={() => toggleMilitar(grupoMilitar.militar.id)}
                    className="w-full px-4 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                  >
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
                        <p className="text-sm md:text-base font-semibold text-slate-900">
                          {grupoMilitar.militar.posto_graduacao ? `${grupoMilitar.militar.posto_graduacao} ` : ''}
                          {grupoMilitar.militar.nome_guerra || 'Militar sem identificação'}
                        </p>
                        <p className="text-xs text-slate-500">{grupoMilitar.militar.matricula || 'Matrícula não informada'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 md:gap-3 text-xs md:text-sm text-slate-600">
                      <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-700 font-medium">
                        {grupoMilitar.periodos.length} período(s)
                      </span>
                      <span className="px-2 py-1 rounded-md bg-red-50 text-red-700">Críticos: {grupoMilitar.resumo.critico}</span>
                      <span className="px-2 py-1 rounded-md bg-amber-50 text-amber-700">Atenção: {grupoMilitar.resumo.atencao}</span>
                      <span className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700">Em dia: {grupoMilitar.resumo.ok}</span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-100 overflow-x-auto">
                      <table className="w-full text-sm min-w-[860px]">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50">
                            <th className="text-left px-4 py-3 font-semibold text-slate-600">Militar</th>
                            <th className="text-left px-4 py-3 font-semibold text-slate-600">Período Aquisitivo</th>
                            <th className="text-left px-4 py-3 font-semibold text-slate-600">Concessivo / Limite</th>
                            <th className="text-left px-4 py-3 font-semibold text-slate-600">Situação</th>
                            <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                            <th className="text-left px-4 py-3 font-semibold text-slate-600">Alerta Gerencial</th>
                            <th className="text-right px-4 py-3 font-semibold text-slate-600">Ação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {grupoMilitar.periodos.map((periodo) => (
                            <PeriodoAquisitivoCard
                              key={periodo.id}
                              periodo={{
                                ...periodo,
                                militar_id: grupoMilitar.militar.id,
                                militar_nome: grupoMilitar.militar.nome_guerra,
                                militar_posto: grupoMilitar.militar.posto_graduacao,
                                militar_matricula: grupoMilitar.militar.matricula,
                                ano_referencia: periodo.referencia,
                                inicio_aquisitivo: periodo.data_inicio_aquisitivo,
                                fim_aquisitivo: periodo.data_fim_aquisitivo,
                                data_limite_gozo: periodo.data_limite_gozo_iso,
                                status: periodo.status_operacional,
                              }}
                              listMode
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
