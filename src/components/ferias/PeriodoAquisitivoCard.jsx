import React from 'react';
import { format, differenceInDays } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle, Clock, EyeOff, Eye } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
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

export default function PeriodoAquisitivoCard({ periodo, listMode = false }) {
  const queryClient = useQueryClient();

  const handleInativar = async (e) => {
    e.stopPropagation();
    const isInativo = periodo.status === 'Inativo' || periodo.inativo;
    const novoStatus = isInativo ? 'Disponível' : 'Inativo';
    await base44.entities.PeriodoAquisitivo.update(periodo.id, { status: novoStatus, inativo: !isInativo });
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

  const isInativo = periodo.status === 'Inativo' || periodo.inativo;

  if (listMode) {
    return (
      <tr className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${isInativo ? 'opacity-50' : ''}`}>
        <td className="px-4 py-3">
          <span className="font-medium text-slate-900">
            {periodo.militar_posto && <span className="text-slate-500 mr-1">{periodo.militar_posto}</span>}
            {periodo.militar_nome}
          </span>
          <p className="text-xs text-slate-400">{periodo.militar_matricula}</p>
        </td>
        <td className="px-4 py-3 text-slate-700">
          {periodo.ano_referencia || `${format(new Date(periodo.inicio_aquisitivo + 'T00:00:00'), 'yyyy')}/${format(new Date(periodo.fim_aquisitivo + 'T00:00:00'), 'yyyy')}`}
          <p className="text-xs text-slate-400">{formatDate(periodo.inicio_aquisitivo)} a {formatDate(periodo.fim_aquisitivo)}</p>
        </td>
        <td className="px-4 py-3 text-slate-700">{formatDate(periodo.data_limite_gozo)}</td>
        <td className="px-4 py-3 text-slate-700">{periodo.dias_gozados || 0}/{periodo.dias_direito || 30}</td>
        <td className="px-4 py-3">
          <Badge className={`${statusColors[periodo.status] || statusColors['Pendente']} border text-xs`}>
            {periodo.status}
          </Badge>
        </td>
        <td className="px-4 py-3 text-right">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-slate-500 hover:text-slate-700"
            onClick={handleInativar}
            title={isInativo ? 'Reativar período' : 'Inativar período'}
          >
            {isInativo ? <Eye className="w-3 h-3 mr-1" /> : <EyeOff className="w-3 h-3 mr-1" />}
            {isInativo ? 'Reativar' : 'Inativar'}
          </Button>
        </td>
      </tr>
    );
  }

  return null;
}