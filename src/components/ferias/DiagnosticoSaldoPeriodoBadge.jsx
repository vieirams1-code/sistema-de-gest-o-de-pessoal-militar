import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { compararSaldoPeriodo } from '@/services/diagnosticoSaldoFeriasService';

function formatarDias(value) {
  const numero = Number(value);
  if (!Number.isFinite(numero)) return '—';
  return `${numero}d`;
}

function temDadosMinimos(periodo) {
  return Boolean(periodo?.id && Number.isFinite(Number(periodo?.dias_saldo)));
}

export default function DiagnosticoSaldoPeriodoBadge({
  periodo,
  ajustes = [],
  ferias = [],
  creditosExtraordinarios = [],
  descontos = [],
  isLoading = false,
}) {
  const diagnostico = useMemo(() => {
    if (isLoading || !temDadosMinimos(periodo)) return null;

    return compararSaldoPeriodo({
      periodo,
      ajustes,
      ferias,
      creditosExtraordinarios,
      descontos,
    });
  }, [ajustes, creditosExtraordinarios, descontos, ferias, isLoading, periodo]);

  if (isLoading) {
    return (
      <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5" />
          Carregando diagnóstico de saldo...
        </span>
      </div>
    );
  }

  if (!diagnostico) {
    return (
      <div className="mb-4 rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5" />
          Diagnóstico indisponível
        </span>
      </div>
    );
  }

  const oficialCompativelComLegado = Number(diagnostico.diferenca_oficial_vs_legado) === 0;
  const ajustesPuroCompativelComLegado = Number(diagnostico.diferenca_legado_vs_ajustes_puro) === 0;
  const shadowPendente = oficialCompativelComLegado && !ajustesPuroCompativelComLegado;
  let statusLabel = 'Divergência';
  let badgeClass = 'border-red-200 bg-red-100 text-red-700';

  if (oficialCompativelComLegado && ajustesPuroCompativelComLegado) {
    statusLabel = 'Compatível';
    badgeClass = 'border-emerald-200 bg-emerald-100 text-emerald-700';
  } else if (shadowPendente) {
    statusLabel = 'Shadow pendente';
    badgeClass = 'border-amber-200 bg-amber-100 text-amber-800';
  }
  const Icon = oficialCompativelComLegado && !shadowPendente ? CheckCircle2 : AlertTriangle;

  return (
    <div className={`mb-4 rounded-lg border px-3 py-2 text-xs ${oficialCompativelComLegado && !shadowPendente ? 'border-emerald-100 bg-emerald-50/70' : 'border-amber-100 bg-amber-50/70'}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-slate-700">Diagnóstico admin de saldo</p>
        <Badge className={`${badgeClass} border text-xs`}>
          <Icon className="mr-1 h-3.5 w-3.5" />
          {statusLabel}
        </Badge>
      </div>
      <div className="grid grid-cols-1 gap-2 text-slate-600 sm:grid-cols-3">
        <div>
          <p className="text-slate-500">Oficial atual</p>
          <p className="font-semibold text-slate-800">{formatarDias(diagnostico.modelo_oficial_atual?.saldo_atual_sistema)}</p>
        </div>
        <div>
          <p className="text-slate-500">Derivado legado</p>
          <p className="font-semibold text-slate-800">{formatarDias(diagnostico.modelo_derivado_legado?.saldo)}</p>
        </div>
        <div>
          <p className="text-slate-500">Ajustes puro</p>
          <p className={`font-semibold ${ajustesPuroCompativelComLegado ? 'text-emerald-700' : 'text-amber-800'}`}>
            {formatarDias(diagnostico.modelo_ajustes_puro?.saldo)}
          </p>
        </div>
      </div>
    </div>
  );
}
