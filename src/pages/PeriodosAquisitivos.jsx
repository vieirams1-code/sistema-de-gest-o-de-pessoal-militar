import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Calendar, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import PeriodoAquisitivoCard from '@/components/ferias/PeriodoAquisitivoCard';
import PeriodoAquisitivoGenerator from '@/components/ferias/PeriodoAquisitivoGenerator';

export default function PeriodosAquisitivos() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [militarFilter, setMilitarFilter] = useState('all');
  const [periodoFilter, setPeriodoFilter] = useState('all');

  const { data: periodos = [], isLoading } = useQuery({
    queryKey: ['periodos-aquisitivos'],
    queryFn: () => base44.entities.PeriodoAquisitivo.list('-inicio_aquisitivo')
  });

  // Opções únicas para os filtros
  const militaresUnicos = [...new Map(periodos.map(p => [p.militar_id, { id: p.militar_id, nome: p.militar_nome, posto: p.militar_posto }])).values()]
    .filter(m => m.id)
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

  const periodosUnicos = [...new Set(periodos.map(p => p.ano_referencia).filter(Boolean))].sort((a, b) => b.localeCompare(a));

  const filteredPeriodos = periodos.filter(p => {
    const matchesSearch = 
      p.militar_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.militar_matricula?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.ano_referencia?.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchesMilitar = militarFilter === 'all' || p.militar_id === militarFilter;
    const matchesPeriodo = periodoFilter === 'all' || p.ano_referencia === periodoFilter;
    return matchesSearch && matchesStatus && matchesMilitar && matchesPeriodo;
  });

  // Estatísticas
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const stats = {
    total: periodos.length,
    disponiveis: periodos.filter(p => p.status === 'Disponível').length,
    vencendo: periodos.filter(p => {
      if (!p.data_limite_gozo) return false;
      const limite = new Date(p.data_limite_gozo + 'T00:00:00');
      const diff = differenceInDays(limite, hoje);
      return diff >= 0 && diff <= 90;
    }).length,
    vencidos: periodos.filter(p => {
      if (!p.data_limite_gozo) return false;
      const limite = new Date(p.data_limite_gozo + 'T00:00:00');
      return differenceInDays(limite, hoje) < 0;
    }).length
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
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

        {/* Stats Cards */}
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

        {/* Filters */}
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
                {militaresUnicos.map(m => (
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
                {periodosUnicos.map(p => (
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

        {/* Results count */}
        <div className="mb-4 text-sm text-slate-500">
          {filteredPeriodos.length} período(s) encontrado(s)
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredPeriodos.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center">
            <Calendar className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">
              Nenhum período encontrado
            </h3>
            <p className="text-slate-500 mb-6">
              {searchTerm || statusFilter !== 'all'
                ? 'Tente ajustar os filtros de busca'
                : 'Clique em "Gerar Períodos Automáticos" para começar'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Militar</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Período</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Prazo Gozo</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Dias</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Ação</th>
                </tr>
              </thead>
              <tbody>
                {filteredPeriodos.map((periodo) => (
                  <PeriodoAquisitivoCard key={periodo.id} periodo={periodo} listMode />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}