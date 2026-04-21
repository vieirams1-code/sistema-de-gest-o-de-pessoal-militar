import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Plus, Download } from 'lucide-react';
import { format } from 'date-fns';
import { enriquecerFeriasComContextoMilitar } from '@/services/feriasMilitarContextService';

const meses = [
  { nome: 'Janeiro', valor: 'Janeiro', numero: 1 },
  { nome: 'Fevereiro', valor: 'Fevereiro', numero: 2 },
  { nome: 'Março', valor: 'Março', numero: 3 },
  { nome: 'Abril', valor: 'Abril', numero: 4 },
  { nome: 'Maio', valor: 'Maio', numero: 5 },
  { nome: 'Junho', valor: 'Junho', numero: 6 },
  { nome: 'Julho', valor: 'Julho', numero: 7 },
  { nome: 'Agosto', valor: 'Agosto', numero: 8 },
  { nome: 'Setembro', valor: 'Setembro', numero: 9 },
  { nome: 'Outubro', valor: 'Outubro', numero: 10 },
  { nome: 'Novembro', valor: 'Novembro', numero: 11 },
  { nome: 'Dezembro', valor: 'Dezembro', numero: 12 }
];

export default function PlanoAnualFerias() {
  const navigate = useNavigate();
  const anoAtual = new Date().getFullYear();
  const [anoSelecionado, setAnoSelecionado] = useState(anoAtual + 1);

  const { data: planos = [], isLoading: loadingPlanos } = useQuery({
    queryKey: ['planos-ferias', anoSelecionado],
    queryFn: () => base44.entities.PlanoFerias.filter({ ano_plano: anoSelecionado })
  });

  const { data: ferias = [], isLoading: loadingFerias } = useQuery({
    queryKey: ['ferias-ano', anoSelecionado],
    queryFn: async () => {
      const todasFerias = await base44.entities.Ferias.list();
      const filtradas = todasFerias.filter(f => {
        if (!f.data_inicio) return false;
        const ano = new Date(f.data_inicio + 'T00:00:00').getFullYear();
        return ano === anoSelecionado;
      });
      return enriquecerFeriasComContextoMilitar(filtradas, { contexto: 'operacional' });
    }
  });

  // Agrupar férias por mês
  const feriasPorMes = meses.map(mes => {
    const feriasDoMes = ferias.filter(f => {
      if (!f.data_inicio) return false;
      const dataInicio = new Date(f.data_inicio + 'T00:00:00');
      return dataInicio.getMonth() + 1 === mes.numero;
    });
    return {
      ...mes,
      ferias: feriasDoMes,
      quantidade: feriasDoMes.length
    };
  });

  const anos = Array.from({ length: 5 }, (_, i) => anoAtual - 1 + i);

  const handleAdicionarFerias = (mes) => {
    // Redirecionar para cadastro de férias com mês pré-selecionado
    navigate(createPageUrl('CadastrarFerias') + `?mes=${mes}&ano=${anoSelecionado}`);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return format(new Date(dateString + 'T00:00:00'), "dd/MM");
  };

  const totalFerias = ferias.length;
  const totalPrevistas = ferias.filter(f => f.status === 'Prevista' || f.status === 'Autorizada').length;
  const totalEmCurso = ferias.filter(f => f.status === 'Em Curso').length;
  const totalGozadas = ferias.filter(f => f.status === 'Gozada').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#1e3a5f]">Plano Anual de Férias</h1>
            <p className="text-slate-500">Visualização e controle do plano de férias por mês</p>
          </div>
          <div className="flex gap-3">
            <Select value={anoSelecionado.toString()} onValueChange={(v) => setAnoSelecionado(parseInt(v))}>
              <SelectTrigger className="w-32 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {anos.map(ano => (
                  <SelectItem key={ano} value={ano.toString()}>{ano}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
              <Download className="w-4 h-4 mr-2" />
              Exportar PDF
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#1e3a5f]/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-[#1e3a5f]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#1e3a5f]">{totalFerias}</p>
                  <p className="text-xs text-slate-500">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600">{totalPrevistas}</p>
                  <p className="text-xs text-slate-500">Previstas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-600">{totalEmCurso}</p>
                  <p className="text-xs text-slate-500">Em Curso</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-600">{totalGozadas}</p>
                  <p className="text-xs text-slate-500">Gozadas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Plano por Mês */}
        <div className="space-y-4">
          {feriasPorMes.map((mes) => (
            <Card key={mes.valor}>
              <CardHeader className="bg-gradient-to-r from-[#1e3a5f] to-[#2d4a6f] text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5" />
                    <CardTitle className="text-xl">{mes.nome} / {anoSelecionado}</CardTitle>
                    <Badge className="bg-white/20 text-white border-white/30">
                      {mes.quantidade} {mes.quantidade === 1 ? 'militar' : 'militares'}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAdicionarFerias(mes.valor)}
                    className="text-white hover:bg-white/10"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {mes.ferias.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p>Nenhuma férias cadastrada para este mês</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {mes.ferias.map((f, idx) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer transition-colors"
                        onClick={() => navigate(createPageUrl('CadastrarFerias') + `?id=${f.id}`)}
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <div className="w-8 h-8 rounded-full bg-[#1e3a5f]/10 flex items-center justify-center text-sm font-bold text-[#1e3a5f]">
                            {idx + 1}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900">
                              {f.militar_posto && `${f.militar_posto} `}
                              {f.militar_nome}
                            </p>
                            <p className="text-sm text-slate-500">
                              Mat: {f.militar_matricula_label || f.militar_matricula_atual || f.militar_matricula || '—'} | Período: {formatDate(f.data_inicio)} a {formatDate(f.data_retorno)}
                            </p>
                            {f.militar_mesclado && (
                              <p className="text-xs text-amber-700">
                                Registro vinculado a militar mesclado (somente histórico documental).
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="bg-white">
                              {f.dias} dias
                            </Badge>
                            {f.periodo_aquisitivo_ref && (
                              <Badge variant="outline" className="text-xs">
                                {f.periodo_aquisitivo_ref}
                              </Badge>
                            )}
                            {f.fracionamento && (
                              <Badge variant="outline" className="text-xs bg-amber-50">
                                {f.fracionamento}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
