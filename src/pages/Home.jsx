import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { AlertTriangle, Users, Award, Shield, ChevronRight } from 'lucide-react';
import { calcularComportamento } from '@/components/utils/comportamentoCalculator';

export default function Home() {
  const navigate = useNavigate();

  const { data: militares = [] } = useQuery({
    queryKey: ['militares-ativos'],
    queryFn: () => base44.entities.Militar.filter({ status_cadastro: 'Ativo' })
  });

  const { data: todasPunicoes = [] } = useQuery({
    queryKey: ['punicoes-all'],
    queryFn: () => base44.entities.Punicao.list('-data_aplicacao')
  });

  // Calcular alertas de comportamento
  const alertasComportamento = React.useMemo(() => {
    const alertas = [];
    const pracas = ['Soldado', 'Cabo', '3º Sargento', '2º Sargento', '1º Sargento', 'Subtenente', 'Aspirante'];

    militares.forEach(militar => {
      if (!pracas.includes(militar.posto_graduacao)) return;

      const punicoesMilitar = todasPunicoes.filter(p => p.militar_id === militar.id);
      
      // Calcular comportamento sugerido
      const resultado = calcularComportamento(punicoesMilitar, militar.data_inclusao);
      
      // Se o comportamento atual é diferente do sugerido, criar alerta
      if (militar.comportamento !== resultado.comportamento) {
        alertas.push({
          militar_id: militar.id,
          militar_nome: militar.nome_completo,
          posto: militar.posto_graduacao,
          comportamentoAtual: militar.comportamento || 'Não definido',
          comportamentoSugerido: resultado.comportamento,
          motivo: resultado.motivo
        });
      }
    });

    return alertas;
  }, [militares, todasPunicoes]);

  const stats = {
    totalMilitares: militares.length,
    alertasComportamento: alertasComportamento.length,
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

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-amber-600">{stats.alertasComportamento}</p>
                <p className="text-sm text-slate-500">Alertas Pendentes</p>
              </div>
            </div>
          </div>
        </div>

        {/* Alertas de Comportamento */}
        {alertasComportamento.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
                <h2 className="text-xl font-semibold text-[#1e3a5f]">Alertas de Comportamento</h2>
              </div>
            </div>

            <div className="space-y-3">
              {alertasComportamento.map((alerta, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">
                      {alerta.posto} {alerta.militar_nome}
                    </p>
                    <p className="text-sm text-slate-600 mt-1">
                      Comportamento atual: <span className="font-medium">{alerta.comportamentoAtual}</span>
                      {' → '}
                      Sugerido: <span className="font-medium text-green-600">{alerta.comportamentoSugerido}</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{alerta.motivo}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(createPageUrl('CadastrarMilitar') + `?id=${alerta.militar_id}`)}
                  >
                    Revisar
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Atalhos Rápidos */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-semibold text-[#1e3a5f] mb-4">Atalhos Rápidos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button
              variant="outline"
              className="h-20 flex-col"
              onClick={() => navigate(createPageUrl('Militares'))}
            >
              <Users className="w-6 h-6 mb-2" />
              <span>Efetivo</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex-col"
              onClick={() => navigate(createPageUrl('Punicoes'))}
            >
              <Shield className="w-6 h-6 mb-2" />
              <span>Punições</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex-col"
              onClick={() => navigate(createPageUrl('Medalhas'))}
            >
              <Award className="w-6 h-6 mb-2" />
              <span>Medalhas</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex-col"
              onClick={() => navigate(createPageUrl('Armamentos'))}
            >
              <Shield className="w-6 h-6 mb-2" />
              <span>Armamentos</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}