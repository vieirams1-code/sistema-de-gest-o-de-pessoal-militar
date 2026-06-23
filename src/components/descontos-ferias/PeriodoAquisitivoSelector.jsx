import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STATUS_ELEGIVEIS = new Set(['Disponível', 'Previsto', 'Parcialmente Gozado', 'Pendente']);
const LIMITE_DIAS_PERIODO = 8;

function formatarIntervalo(periodo) {
  const inicio = periodo?.inicio_aquisitivo ? periodo.inicio_aquisitivo.slice(0, 10).split('-').reverse().join('/') : '';
  const fim = periodo?.fim_aquisitivo ? periodo.fim_aquisitivo.slice(0, 10).split('-').reverse().join('/') : '';
  return inicio && fim ? `${inicio} a ${fim}` : '';
}

function calcularDescontados(periodoId, descontos = []) {
  return (descontos || [])
    .filter((d) => d.periodo_aquisitivo_id === periodoId && ['ativo', 'pendente_publicacao'].includes(d.status))
    .reduce((acc, d) => acc + Math.max(0, Number(d.dias) || 0), 0);
}

function calcularSaldoAtual(periodo) {
  const direito = Number(periodo?.dias_direito ?? 30);
  const gozados = Number(periodo?.dias_gozados ?? 0);
  return Math.max(0, direito - gozados);
}

export default function PeriodoAquisitivoSelector({ periodos = [], descontosExistentes = [], value, onChange }) {
  const elegiveis = (periodos || []).filter((p) => !p?.inativo && STATUS_ELEGIVEIS.has(p?.status));

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-slate-700">
        Período Aquisitivo <span className="text-red-500">*</span>
      </Label>
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger className="h-auto py-2">
          <SelectValue placeholder={elegiveis.length ? 'Selecione o período aquisitivo...' : 'Nenhum período elegível'} />
        </SelectTrigger>
        <SelectContent>
          {elegiveis.length === 0 && (
            <SelectItem value="_none" disabled>Nenhum período aquisitivo elegível para este militar</SelectItem>
          )}
          {elegiveis.map((periodo) => {
            const descontados = calcularDescontados(periodo.id, descontosExistentes);
            const saldo = calcularSaldoAtual(periodo);
            const podeDescontar = Math.max(0, LIMITE_DIAS_PERIODO - descontados);
            const intervalo = formatarIntervalo(periodo);
            return (
              <SelectItem key={periodo.id} value={periodo.id}>
                <div className="flex flex-col py-0.5">
                  <span className="font-medium text-slate-800">
                    {periodo.ano_referencia || '—'}
                    {intervalo ? ` — ${intervalo}` : ''}
                    {periodo.status ? ` — ${periodo.status}` : ''}
                  </span>
                  <span className="text-xs text-slate-500">
                    Saldo: {saldo} | Descontados: {descontados} | Pode descontar: {podeDescontar}
                  </span>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}