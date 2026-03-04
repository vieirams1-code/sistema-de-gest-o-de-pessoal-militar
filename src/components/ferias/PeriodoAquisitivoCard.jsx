import React from 'react';
import { format, differenceInDays } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Calendar, AlertCircle, CheckCircle, Clock, EyeOff } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const statusColors = {
  'Pendente': 'bg-slate-100 text-slate-700 border-slate-200',
  'Disponível': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Previsto': 'bg-blue-100 text-blue-700 border-blue-200',
  'Parcialmente Gozado': 'bg-amber-100 text-amber-700 border-amber-200',
  'Gozado': 'bg-green-100 text-green-700 border-green-200',
  'Vencido': 'bg-red-100 text-red-700 border-red-200',
  'Inativo': 'bg-slate-100 text-slate-500 border-slate-200'
};

export default function PeriodoAquisitivoCard({ periodo, onClick }) {
  const queryClient = useQueryClient();

  const handleInativar = async (e) => {
    e.stopPropagation();
    const novoStatus = periodo.status === 'Inativo' ? 'Disponível' : 'Inativo';
    await base44.entities.PeriodoAquisitivo.update(periodo.id, { status: novoStatus, inativo: novoStatus === 'Inativo' });
    queryClient.invalidateQueries({ queryKey: ['periodos-aquisitivos'] });
  };
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return format(new Date(dateString + 'T00:00:00'), "dd/MM/yyyy");
  };

  const getDiasRestantes = () => {
    if (!periodo.data_limite_gozo) return null;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const limite = new Date(periodo.data_limite_gozo + 'T00:00:00');
    return differenceInDays(limite, hoje);
  };

  const diasRestantes = getDiasRestantes();
  const diasRestantesFerias = (periodo.dias_direito || 30) - (periodo.dias_gozados || 0);
  const percentualGozado = ((periodo.dias_gozados || 0) / (periodo.dias_direito || 30)) * 100;

  const getStatusInfo = () => {
    if (periodo.status === 'Vencido') {
      return {
        icon: AlertCircle,
        text: 'Período vencido',
        color: 'text-red-600'
      };
    }
    
    if (diasRestantes !== null) {
      if (diasRestantes < 0) {
        return {
          icon: AlertCircle,
          text: 'Vencido',
          color: 'text-red-600'
        };
      } else if (diasRestantes <= 30) {
        return {
          icon: AlertCircle,
          text: `Vence em ${diasRestantes} dias`,
          color: 'text-orange-600'
        };
      } else if (diasRestantes <= 90) {
        return {
          icon: Clock,
          text: `${diasRestantes} dias para vencer`,
          color: 'text-amber-600'
        };
      } else {
        return {
          icon: CheckCircle,
          text: `${diasRestantes} dias disponíveis`,
          color: 'text-emerald-600'
        };
      }
    }
    return null;
  };

  const statusInfo = getStatusInfo();

  return (
    <Card
      className={`hover:shadow-md transition-all duration-200 cursor-pointer border border-slate-200 ${periodo.status === 'Inativo' ? 'opacity-60' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-[#1e3a5f]/10 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-5 h-5 text-[#1e3a5f]" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-900 truncate">
                {periodo.militar_posto && `${periodo.militar_posto} `}
                {periodo.militar_nome}
              </h3>
              <p className="text-sm text-slate-500">
                {periodo.ano_referencia || `${format(new Date(periodo.inicio_aquisitivo + 'T00:00:00'), 'yyyy')}/${format(new Date(periodo.fim_aquisitivo + 'T00:00:00'), 'yyyy')}`}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-3 justify-between items-center">
          <div className="flex gap-2 flex-wrap">
            <Badge className={`${statusColors[periodo.status] || statusColors['Pendente']} border`}>
              {periodo.status}
            </Badge>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-slate-500 hover:text-slate-700"
            onClick={handleInativar}
            title={periodo.status === 'Inativo' ? 'Reativar período' : 'Inativar período (desconsiderar)'}
          >
            <EyeOff className="w-3 h-3 mr-1" />
            {periodo.status === 'Inativo' ? 'Reativar' : 'Inativar'}
          </Button>
        </div>

        {statusInfo && (
          <div className="flex items-center gap-2 mb-3 text-sm">
            <statusInfo.icon className={`w-4 h-4 ${statusInfo.color}`} />
            <span className={statusInfo.color}>{statusInfo.text}</span>
          </div>
        )}

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Período Aquisitivo:</span>
            <span className="font-medium text-slate-700">
              {formatDate(periodo.inicio_aquisitivo)} a {formatDate(periodo.fim_aquisitivo)}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-slate-500">Prazo para gozo:</span>
            <span className="font-medium text-slate-700">
              {formatDate(periodo.data_limite_gozo)}
            </span>
          </div>

          <div className="pt-2">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-500">Dias gozados</span>
              <span className="font-medium text-slate-700">
                {periodo.dias_gozados || 0} / {periodo.dias_direito || 30} dias
              </span>
            </div>
            <Progress value={percentualGozado} className="h-2" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}