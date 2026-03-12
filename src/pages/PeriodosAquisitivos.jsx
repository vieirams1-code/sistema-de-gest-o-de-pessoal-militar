import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Calendar, AlertCircle, CheckCircle, ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { getAlertaPeriodoConcessivo, hasPrevisaoValidaPeriodo } from '@/components/ferias/feriasRules';
import PeriodoAquisitivoCard from '@/components/ferias/PeriodoAquisitivoCard';
import PeriodoAquisitivoGenerator from '@/components/ferias/PeriodoAquisitivoGenerator';
import mapPeriodosAquisitivos from '@/components/ferias/periodosAquisitivosMapper';

export default function PeriodosAquisitivos() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [militarFilter, setMilitarFilter] = useState('all');
  const [periodoFilter, setPeriodoFilter] = useState('all');
  const [expandedMilitares, setExpandedMilitares] = useState({});

  const { data: periodos = [], isLoading } = useQuery({
    queryKey: ['periodos-aquisitivos'],
    queryFn: () => base44.entities.PeriodoAquisitivo.list('-inicio_aquisitivo')
  });

  const periodosTransformados = useMemo(() => mapPeriodosAquisitivos(periodos), [periodos]);

  const militaresUnicos = periodosTransformados.militares.map((militar) => ({
    id: militar.militar_id,
    nome: militar.militar_nome,
    posto: militar.militar_posto,
  })).filter((militar) => militar.id);

  const periodosUnicos = [...new Set(periodosTransformados.periodosFlat.map((p) => p.ano_referencia).filter(Boolean))]
    .sort((a, b) => b.localeCompare(a));

  const matchesPeriodoFilters = (periodo, searchLower) => {
    const matchesSearch =
      periodo.militar_nome?.toLowerCase().includes(searchLower) ||
      periodo.militar_matricula?.toLowerCase().includes(searchLower) ||
      periodo.ano_referencia?.includes(searchTerm);

    const matchesStatus = statusFilter === 'all' || periodo.status === statusFilter;
    const matchesPeriodo = periodoFilter === 'all' || periodo.ano_referencia === periodoFilter;

    return matchesSearch && matchesStatus && matchesPeriodo;
  };

  const militaresFiltrados = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();

    return periodosTransformados.militares
      .filter((militar) => militarFilter === 'all' || militar.militar_id === militarFilter)
      .map((militar) => {
        const periodosFiltrados = militar.periodos.filter((periodo) => matchesPeriodoFilters(periodo, searchLower));

        return {
          ...militar,
          periodos: periodosFiltrados,
        };
      })
      .filter((militar) => {
        if (militar.periodos.length > 0) return true;
        return militar.militar_nome?.toLowerCase().includes(searchLower) && searchLower.length > 0;
      });
  }, [periodosTransformados.militares, militarFilter, statusFilter, periodoFilter, searchTerm]);

  const totalPeriodosFiltrados = militaresFiltrados.reduce((total, militar) => total + militar.periodos.length, 0);

  const toggleMilitar = (militarId) => {
    setExpandedMilitares((current) => ({
      ...current,
      [militarId]: !current[militarId],
    }));
  };

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const stats = {
    total: periodosTransformados.periodosFlat.length,
    disponiveis: periodosTransformados.periodosFlat.filter((p) => p.status === 'Disponível').length,
    vencendo: periodosTransformados.periodosFlat.filter((p) => {
      const alerta = getAlertaPeriodoConcessivo({
        dataLimiteGozo: p.data_limite_gozo,
        hasPrevisaoValida: hasPrevisaoValidaPeriodo(p),
      });
      return alerta?.nivel === 'critico';
    }).length,
    vencidos: periodosTransformados.periodosFlat.filter((p) => {
      if (!p.data_limite_gozo) return false;
      const limite = new Date(p.data_limite_gozo + 'T00:00:00');
      return differenceInDays(limite, hoje) < 0;
    }).length,
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
              <p className="text-slate-500">Controle e habilitação/inabilitação de períodos por militar</p>
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
          {militaresFiltrados.length} militar(es) e {totalPeriodosFiltrados} período(s) encontrado(s)
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : militaresFiltrados.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center">
            <Calendar className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">
              Nenhum período encontrado
            </h3>
            <p className="text-slate-500 mb-6">
              {searchTerm || statusFilter !== 'all' || militarFilter !== 'all' || periodoFilter !== 'all'
                ? 'Tente ajustar os filtros de busca'
                : 'Clique em "Gerar Períodos Automáticos" para começar'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {militaresFiltrados.map((militar, idx) => {
              const militarKey = militar.militar_id || `${militar.militar_nome}-${idx}`;
              const isExpanded = expandedMilitares[militarKey] ?? idx === 0;

              return (
                <div key={militarKey} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleMilitar(militarKey)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                  >
                    <div className="text-left">
                      <p className="font-semibold text-slate-900">
                        {militar.militar_posto ? `${militar.militar_posto} ` : ''}{militar.militar_nome}
                      </p>
                      <p className="text-xs text-slate-500">
                        Matrícula: {militar.militar_matricula || '-'} • {militar.periodos.length} período(s)
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-100 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50">
                            <th className="text-left px-4 py-3 font-semibold text-slate-600">Período Aquisitivo</th>
                            <th className="text-left px-4 py-3 font-semibold text-slate-600">Concessivo / Limite</th>
                            <th className="text-left px-4 py-3 font-semibold text-slate-600">Situação</th>
                            <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                            <th className="text-left px-4 py-3 font-semibold text-slate-600">Alerta Gerencial</th>
                            <th className="text-right px-4 py-3 font-semibold text-slate-600">Ação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {militar.periodos.map((periodo) => (
                            <PeriodoAquisitivoCard
                              key={periodo.id}
                              periodo={periodo}
                              listMode
                              showMilitarInfo={false}
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
