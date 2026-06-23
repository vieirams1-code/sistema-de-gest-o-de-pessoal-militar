import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STATUS_ELEGIVEIS = new Set(['Disponível', 'Previsto', 'Parcialmente Gozado', 'Pendente']);

function formatarPeriodo(periodo) {
  const ref = periodo?.ano_referencia ? `${periodo.ano_referencia}` : '';
  const inicio = periodo?.inicio_aquisitivo ? periodo.inicio_aquisitivo.slice(0, 10).split('-').reverse().join('/') : '';
  const fim = periodo?.fim_aquisitivo ? periodo.fim_aquisitivo.slice(0, 10).split('-').reverse().join('/') : '';
  const intervalo = inicio && fim ? `${inicio} a ${fim}` : '';
  return [ref, intervalo, periodo?.status].filter(Boolean).join(' — ');
}

export default function PeriodoAquisitivoSelector({ periodos = [], value, onChange }) {
  const elegiveis = (periodos || []).filter((p) => !p?.inativo && STATUS_ELEGIVEIS.has(p?.status));

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-slate-700">
        Período Aquisitivo <span className="text-red-500">*</span>
      </Label>
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={elegiveis.length ? 'Selecione o período aquisitivo...' : 'Nenhum período elegível'} />
        </SelectTrigger>
        <SelectContent>
          {elegiveis.length === 0 && (
            <SelectItem value="_none" disabled>Nenhum período aquisitivo elegível para este militar</SelectItem>
          )}
          {elegiveis.map((periodo) => (
            <SelectItem key={periodo.id} value={periodo.id}>
              {formatarPeriodo(periodo)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}