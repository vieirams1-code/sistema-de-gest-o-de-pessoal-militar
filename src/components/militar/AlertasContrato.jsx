import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, Clock } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';

function calcStatus(data_fim) {
  if (!data_fim) return null;
  const dias = differenceInDays(parseISO(data_fim), new Date());
  if (dias < 0) return { tipo: 'vencido', dias };
  if (dias <= 90) return { tipo: 'a_vencer', dias };
  return null;
}

export default function AlertasContrato({ militarId }) {
  const { data: contratos = [] } = useQuery({
    queryKey: ['contratos-militar', militarId],
    queryFn: () => base44.entities.ContratoConvocacao.filter({ militar_id: militarId }),
    enabled: !!militarId,
  });

  const ativos = contratos.filter(c => !['Encerrado', 'Cancelado'].includes(c.status));
  const alertas = ativos.map(c => ({ ...c, alerta: calcStatus(c.data_fim) })).filter(c => c.alerta);

  if (alertas.length === 0) return null;

  return (
    <div className="space-y-2">
      {alertas.map(c => (
        <div key={c.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium ${
          c.alerta.tipo === 'vencido'
            ? 'bg-red-50 border-red-200 text-red-700'
            : 'bg-amber-50 border-amber-200 text-amber-700'
        }`}>
          {c.alerta.tipo === 'vencido' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <Clock className="w-4 h-4 shrink-0" />}
          <span>
            {c.alerta.tipo === 'vencido'
              ? `Contrato de ${c.tipo_contrato} VENCIDO há ${Math.abs(c.alerta.dias)} dia(s). Militar deve retornar para Reserva Remunerada.`
              : `Contrato de ${c.tipo_contrato} vence em ${c.alerta.dias} dia(s). Iniciar processo de renovação!`
            }
          </span>
          <Link to={createPageUrl('Contratos')} className="ml-auto text-xs underline whitespace-nowrap">Ver contratos</Link>
        </div>
      ))}
    </div>
  );
}