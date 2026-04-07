import React, { useEffect } from 'react';
import { addDays, format } from 'date-fns';
import { Calculator } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export default function DateCalculator({ dataInicio, dias, dataTermino, dataRetorno, onChange }) {
  useEffect(() => {
    if (dataInicio && dias && dias > 0) {
      const inicio = new Date(dataInicio + 'T00:00:00');
      const termino = addDays(inicio, dias - 1);
      const retorno = addDays(inicio, dias);
      
      onChange('data_termino', format(termino, 'yyyy-MM-dd'));
      onChange('data_retorno', format(retorno, 'yyyy-MM-dd'));
    }
  }, [dataInicio, dias]);

  const formatDateDisplay = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString + 'T00:00:00');
    return format(date, "dd/MM/yyyy");
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="data_inicio" className="text-sm font-medium text-slate-700">
            Data de Início <span className="text-red-500">*</span>
          </Label>
          <Input
            id="data_inicio"
            type="date"
            value={dataInicio || ''}
            onChange={(e) => onChange('data_inicio', e.target.value)}
            className="h-10 border-slate-200"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="dias" className="text-sm font-medium text-slate-700">
            Quantidade de Dias <span className="text-red-500">*</span>
          </Label>
          <Input
            id="dias"
            type="number"
            min="1"
            value={dias || ''}
            onChange={(e) => onChange('dias', parseInt(e.target.value) || 0)}
            placeholder="Ex: 3"
            className="h-10 border-slate-200"
          />
        </div>
      </div>

      {dataInicio && dias > 0 && dataTermino && dataRetorno && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calculator className="w-5 h-5 text-emerald-600" />
            <span className="font-semibold text-emerald-900">Cálculo Automático</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-emerald-700 mb-1">Período de Afastamento</p>
              <p className="font-medium text-emerald-900">
                {formatDateDisplay(dataInicio)} até {formatDateDisplay(dataTermino)}
              </p>
              <Badge className="mt-1 bg-emerald-100 text-emerald-700">
                {dias} {dias === 1 ? 'dia' : 'dias'}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-emerald-700 mb-1">Data de Término</p>
              <p className="font-bold text-lg text-emerald-900">
                {formatDateDisplay(dataTermino)}
              </p>
            </div>
            <div>
              <p className="text-xs text-emerald-700 mb-1">Data de Retorno</p>
              <p className="font-bold text-lg text-emerald-900">
                {formatDateDisplay(dataRetorno)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}