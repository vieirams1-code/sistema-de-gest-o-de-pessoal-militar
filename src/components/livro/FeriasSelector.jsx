import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, AlertCircle } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';

export default function FeriasSelector({ militarId, value, onChange }) {
  const { data: feriasList = [], isLoading } = useQuery({
    queryKey: ['ferias-militar', militarId],
    queryFn: async () => {
      if (!militarId) return [];
      const ferias = await base44.entities.Ferias.filter({ militar_id: militarId });
      // Filtrar apenas férias previstas ou autorizadas
      return ferias.filter(f => f.status === 'Prevista' || f.status === 'Autorizada');
    },
    enabled: !!militarId
  });

  const { data: selectedFerias } = useQuery({
    queryKey: ['ferias-selected', value],
    queryFn: async () => {
      if (!value) return null;
      const result = await base44.entities.Ferias.filter({ id: value });
      return result[0] || null;
    },
    enabled: !!value
  });

  const handleSelect = (feriasId) => {
    const ferias = feriasList.find(f => f.id === feriasId);
    if (ferias && onChange) {
      onChange(ferias);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return format(new Date(dateString + 'T00:00:00'), 'dd/MM/yyyy');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="w-6 h-6 border-2 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (feriasList.length === 0) {
    return (
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800">Nenhuma férias disponível</p>
          <p className="text-xs text-amber-700 mt-1">
            Este militar não possui férias previstas ou autorizadas para registro.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-sm font-medium text-slate-700">Selecionar Férias</Label>
        <Select value={value || ''} onValueChange={handleSelect}>
          <SelectTrigger className="mt-1.5">
            <SelectValue placeholder="Selecione as férias..." />
          </SelectTrigger>
          <SelectContent>
            {feriasList.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {formatDate(f.data_inicio)} - {f.dias} dias - {f.periodo_aquisitivo_ref}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedFerias && (
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-[#1e3a5f]" />
            <span className="font-medium text-sm text-slate-900">Férias Selecionada</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-500">Início:</span>{' '}
              <span className="font-medium">{formatDate(selectedFerias.data_inicio)}</span>
            </div>
            <div>
              <span className="text-slate-500">Retorno:</span>{' '}
              <span className="font-medium">{formatDate(selectedFerias.data_retorno)}</span>
            </div>
            <div>
              <span className="text-slate-500">Dias:</span>{' '}
              <span className="font-medium">{selectedFerias.dias}</span>
            </div>
            <div>
              <span className="text-slate-500">Período:</span>{' '}
              <span className="font-medium">{selectedFerias.periodo_aquisitivo_ref}</span>
            </div>
          </div>
          <div className="mt-2">
            <Badge className="bg-blue-100 text-blue-700 text-xs">
              {selectedFerias.tipo}
            </Badge>
          </div>
        </div>
      )}
    </div>
  );
}