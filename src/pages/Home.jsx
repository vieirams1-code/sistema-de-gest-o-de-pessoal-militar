import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Award, Shield, AlertTriangle, Calendar, Star, FileText } from 'lucide-react';
import { differenceInDays } from 'date-fns';

export default function Home() {
  const navigate = useNavigate();

  const { data: militares = [] } = useQuery({
    queryKey: ['militares-ativos'],
    queryFn: () => base44.entities.Militar.filter({ status_cadastro: 'Ativo' })
  });

  const { data: periodos = [] } = useQuery({
    queryKey: ['periodos-aquisitivos'],
    queryFn: () => base44.entities.PeriodoAquisitivo.list()
  });

  const { data: publicacoesUrgentesImportantes = [] } = useQuery({
    queryKey: ['publicacoes-urgentes-importantes'],
    queryFn: async () => {
      const [exofficio, livro] = await Promise.all([
        base44.entities.PublicacaoExOfficio.list('-created_date'),
        base44.entities.RegistroLivro.list('-created_date'),
      ]);
      return [...exofficio, ...livro].filter(p => {
        const status = p.status;
        const naoPublicado = status !== 'Publicado';
        return naoPublicado && (p.urgente || p.importante);
      });
    }
  });

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // Períodos onde o fim_aquisitivo está a menos de 6 meses de completar 24 meses (data_limite_gozo)
  // data_limite_gozo = fim_aquisitivo + 24 meses
  // Alertar quando data_limite_gozo - hoje <= 6 meses (180 dias) e período não está Gozado/Inativo
  const periodosAlerta = periodos.filter(p => {
    if (!p.data_limite_gozo) return false;
    if (p.status === 'Gozado' || p.status === 'Inativo') return false;
    const limite = new Date(p.data_limite_gozo + 'T00:00:00');
    const diasRestantes = differenceInDays(limite, hoje);
    return diasRestantes >= 0 && diasRestantes <= 180;
  });

  const stats = {
    totalMilitares: militares.length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#1e3a5f]">Dashboard</h1>
          <p className="text-slate-500">Visão geral do sistema</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-[#1e3a5f]/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-[#1e3a5f]" />
              </div>
              <div>
                <p className="text-3xl font-bold text-[#1e3a5f]">{stats.totalMilitares}</p>
                <p className="text-sm text-slate-500">Militares Ativos</p>
              </div>
            </div>
          </div>
        </div>

        {/* Alertas de Férias Vencendo */}
        {periodosAlerta.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-8">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="text-lg font-semibold text-amber-800">
                  Atenção: {periodosAlerta.length} período(s) aquisitivo(s) vencendo nos próximos 6 meses
                </h2>
                <p className="text-sm text-amber-700">
                  Os militares abaixo possuem férias que devem ser gozadas antes do prazo limite.
                </p>
              </div>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {periodosAlerta.map(p => {
                const limite = new Date(p.data_limite_gozo + 'T00:00:00');
                const dias = differenceInDays(limite, hoje);
                const cor = dias <= 30 ? 'border-red-300 bg-red-50' : dias <= 60 ? 'border-orange-300 bg-orange-50' : 'border-amber-300 bg-amber-50';
                const textCor = dias <= 30 ? 'text-red-700' : dias <= 60 ? 'text-orange-700' : 'text-amber-700';
                return (
                  <div key={p.id} className={`flex items-center justify-between p-3 border rounded-lg ${cor}`}>
                    <div>
                      <span className="text-sm font-medium text-slate-800">
                        {p.militar_posto && <span className="text-slate-500 mr-1 text-xs">{p.militar_posto}</span>}
                        {p.militar_nome}
                      </span>
                      <p className="text-xs text-slate-500">Período: {p.ano_referencia} — Prazo: {p.data_limite_gozo?.split('-').reverse().join('/')}</p>
                    </div>
                    <span className={`text-sm font-bold ${textCor}`}>
                      {dias} dias restantes
                    </span>
                  </div>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 border-amber-400 text-amber-700 hover:bg-amber-100"
              onClick={() => navigate(createPageUrl('PeriodosAquisitivos'))}
            >
              <Calendar className="w-4 h-4 mr-2" />
              Ver Períodos Aquisitivos
            </Button>
          </div>
        )}

        {/* Publicações Urgentes/Importantes */}
        {publicacoesUrgentesImportantes.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <h2 className="text-lg font-semibold text-slate-800">Publicações com Atenção Necessária</h2>
              <Badge className="bg-red-100 text-red-700 ml-auto">{publicacoesUrgentesImportantes.length}</Badge>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {publicacoesUrgentesImportantes.map(p => (
                <div key={p.id} className={`flex items-center justify-between p-3 rounded-lg border ${p.urgente ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    {p.urgente
                      ? <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      : <Star className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    }
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {p.militar_posto && <span className="text-slate-500 text-xs mr-1">{p.militar_posto}</span>}
                        {p.militar_nome}
                      </p>
                      <p className="text-xs text-slate-500">{p.tipo || p.tipo_registro} — {p.status}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="flex-shrink-0 ml-2" onClick={() => navigate(createPageUrl('Publicacoes'))}>
                    <FileText className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate(createPageUrl('Publicacoes'))}>
              Ver Controle de Publicações
            </Button>
          </div>
        )}

        {/* Atalhos Rápidos */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-semibold text-[#1e3a5f] mb-4">Atalhos Rápidos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button variant="outline" className="h-20 flex-col" onClick={() => navigate(createPageUrl('Militares'))}>
              <Users className="w-6 h-6 mb-2" />
              <span>Efetivo</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col" onClick={() => navigate(createPageUrl('Medalhas'))}>
              <Award className="w-6 h-6 mb-2" />
              <span>Medalhas</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col" onClick={() => navigate(createPageUrl('Armamentos'))}>
              <Shield className="w-6 h-6 mb-2" />
              <span>Armamentos</span>
            </Button>          </div>
        </div>
      </div>
    </div>
  );
}