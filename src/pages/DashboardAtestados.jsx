import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  AlertTriangle, 
  Calendar, 
  Activity,
  ArrowRight,
  Clock,
  Shield
} from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';

export default function DashboardAtestados() {
  const navigate = useNavigate();
  const hoje = new Date().toISOString().split('T')[0];

  const { data: atestados = [], isLoading } = useQuery({
    queryKey: ['atestados-dashboard'],
    queryFn: () => base44.entities.Atestado.list('-created_date')
  });

  const atestadosVigentes = atestados.filter(a => a.status === 'Ativo');
  
  const afastamentoTotal = atestadosVigentes.filter(a => a.tipo_afastamento === 'Afastamento Total');
  const esforcoFisico = atestadosVigentes.filter(a => a.tipo_afastamento === 'Esforço Físico');
  const paraJISO = atestadosVigentes.filter(a => a.necessita_jiso && !a.encaminhado_jiso);
  const vencemHoje = atestadosVigentes.filter(a => a.data_retorno === hoje);

  const calcularProgresso = (dataInicio, dataRetorno) => {
    if (!dataInicio || !dataRetorno) return 0;
    const inicio = parseISO(dataInicio);
    const retorno = parseISO(dataRetorno);
    const agora = new Date();
    const total = differenceInDays(retorno, inicio);
    const decorrido = differenceInDays(agora, inicio);
    return Math.min(Math.max((decorrido / total) * 100, 0), 100);
  };

  const getProgressColor = (progresso) => {
    if (progresso < 50) return 'bg-green-500';
    if (progresso < 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return format(parseISO(dateString + 'T00:00:00'), 'dd/MM/yyyy');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#1e3a5f]">Dashboard de Atestados</h1>
            <p className="text-slate-500">Visão geral e controle de afastamentos médicos</p>
          </div>
          <Button
            onClick={() => navigate(createPageUrl('Atestados'))}
            className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
          >
            Ver Todos os Atestados
          </Button>
        </div>

        {/* Alertas */}
        {vencemHoje.length > 0 && (
          <Card className="mb-6 border-amber-300 bg-amber-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-900 mb-2">
                    Atenção: {vencemHoje.length} atestado(s) vencem hoje!
                  </h3>
                  <div className="space-y-1">
                    {vencemHoje.map(a => (
                      <p key={a.id} className="text-sm text-amber-800">
                        • {a.militar_posto} {a.militar_nome} - Retorno previsto para hoje
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#1e3a5f]/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-[#1e3a5f]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#1e3a5f]">{atestadosVigentes.length}</p>
                  <p className="text-xs text-slate-500">Vigentes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{afastamentoTotal.length}</p>
                  <p className="text-xs text-slate-500">Afastamento Total</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-orange-600">{esforcoFisico.length}</p>
                  <p className="text-xs text-slate-500">Esforço Físico</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-600">{paraJISO.length}</p>
                  <p className="text-xs text-slate-500">Aguardando JISO</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Atestados Vigentes */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-bold text-[#1e3a5f] mb-4">Atestados Vigentes</h2>
            
            {atestadosVigentes.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum atestado vigente no momento</p>
              </div>
            ) : (
              <div className="space-y-4">
                {atestadosVigentes.map(atestado => {
                  const progresso = calcularProgresso(atestado.data_inicio, atestado.data_retorno);
                  const diasRestantes = atestado.data_retorno 
                    ? differenceInDays(parseISO(atestado.data_retorno), new Date())
                    : 0;

                  return (
                    <div
                      key={atestado.id}
                      className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => navigate(createPageUrl('VerAtestado') + `?id=${atestado.id}`)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-slate-900">
                              {atestado.militar_posto} {atestado.militar_nome}
                            </h3>
                            <Badge variant="outline" className="text-xs">
                              {atestado.militar_matricula}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-2 text-sm text-slate-600">
                            <Badge className={
                              atestado.tipo_afastamento === 'Afastamento Total' 
                                ? 'bg-red-100 text-red-700'
                                : 'bg-orange-100 text-orange-700'
                            }>
                              {atestado.tipo_afastamento}
                            </Badge>
                            {atestado.necessita_jiso && (
                              <Badge className="bg-purple-100 text-purple-700">
                                {atestado.encaminhado_jiso ? 'JISO Realizada' : 'Aguardando JISO'}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <ArrowRight className="w-5 h-5 text-slate-400" />
                      </div>

                      <div className="grid grid-cols-3 gap-3 mb-3 text-sm">
                        <div>
                          <p className="text-slate-500 text-xs">Início</p>
                          <p className="font-medium">{formatDate(atestado.data_inicio)}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-xs">Retorno</p>
                          <p className="font-medium">{formatDate(atestado.data_retorno)}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-xs">Dias Restantes</p>
                          <p className="font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {diasRestantes > 0 ? diasRestantes : 0} dias
                          </p>
                        </div>
                      </div>

                      {/* Barra de Progresso */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>Decurso do prazo</span>
                          <span>{Math.round(progresso)}%</span>
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${getProgressColor(progresso)} transition-all duration-300`}
                            style={{ width: `${progresso}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}