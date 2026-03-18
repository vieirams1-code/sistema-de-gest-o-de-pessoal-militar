import React, { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Label } from "@/components/ui/label";
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
import { FERIAS_OPERACOES, getFeriasElegiveisPorOperacao, getLivroOperacaoFeriasLabel } from '@/components/livro/feriasOperacaoUtils';

const statusColors = {
  Prevista: 'bg-slate-100 text-slate-700',
  Autorizada: 'bg-blue-100 text-blue-700',
  'Em Curso': 'bg-amber-100 text-amber-700',
  Interrompida: 'bg-orange-100 text-orange-700',
  Gozada: 'bg-emerald-100 text-emerald-700',
};

function formatDate(dateString) {
  if (!dateString) return '-';
  return format(new Date(`${dateString}T00:00:00`), 'dd/MM/yyyy');
}

function getMensagemEstado(operacao) {
  const label = getLivroOperacaoFeriasLabel(operacao);

  if (operacao === FERIAS_OPERACOES.TERMINO) {
    return { titulo: 'Nenhuma férias em curso', texto: `Este militar não possui férias em curso elegíveis para ${label.toLowerCase()}.` };
  }

  if (operacao === FERIAS_OPERACOES.INTERRUPCAO) {
    return { titulo: 'Nenhuma férias em curso', texto: `Este militar não possui férias em curso elegíveis para ${label.toLowerCase()}.` };
  }

  if (operacao === FERIAS_OPERACOES.CONTINUACAO) {
    return { titulo: 'Nenhuma férias interrompida', texto: 'Este militar não possui férias interrompidas elegíveis para continuação.' };
  }

  return {
    titulo: 'Nenhuma férias iniciável',
    texto: 'Este militar não possui férias previstas ou autorizadas compatíveis para início neste fluxo.',
  };
}

function labelOperacao(operacao) {
  return getLivroOperacaoFeriasLabel(operacao);
}

export default function FeriasSelector({ militarId, value, onChange, tipoRegistro, livroOperacaoFerias, dataBase }) {
  const { data: feriasRaw = [], isLoading } = useQuery({
    queryKey: ['ferias-militar', militarId, tipoRegistro],
    queryFn: async () => {
      if (!militarId) return [];
      return base44.entities.Ferias.filter({ militar_id: militarId });
    },
    enabled: !!militarId,
  });

  const opcoes = useMemo(() => getFeriasElegiveisPorOperacao(feriasRaw, livroOperacaoFerias), [feriasRaw, livroOperacaoFerias, dataBase]);
  const selectedFerias = useMemo(() => opcoes.find((item) => item.id === value) || null, [opcoes, value]);
  const estado = getMensagemEstado(livroOperacaoFerias);

  useEffect(() => {
    if (value && !selectedFerias && onChange) onChange(null);
  }, [onChange, selectedFerias, value]);

  const handleSelect = (feriasId) => {
    const ferias = opcoes.find((f) => f.id === feriasId);
    if (!ferias || ferias.disabled) return;
    if (onChange) onChange(ferias);
  };

  if (!militarId) {
    return (
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
        <p className="text-sm text-slate-600">Selecione primeiro o militar para carregar as férias disponíveis.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="w-6 h-6 border-2 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (opcoes.length === 0) {
    return (
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800">{estado.titulo}</p>
          <p className="text-xs text-amber-700 mt-1">{estado.texto}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium text-slate-700">Selecionar Férias</Label>
        <Select value={value || ''} onValueChange={handleSelect}>
          <SelectTrigger className="mt-1.5">
            <SelectValue placeholder="Selecione as férias..." />
          </SelectTrigger>
          <SelectContent>
            {opcoes.map((f) => (
              <SelectItem key={f.id} value={f.id} disabled={f.disabled}>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>{f.periodo_aquisitivo_ref || 'Sem período'} • {formatDate(f.data_inicio)} • {f.dias} dias</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedFerias && (
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Férias identificada</div>
              <div className="text-lg font-semibold text-slate-900 mt-1">{selectedFerias.periodo_aquisitivo_ref || 'Sem período'}</div>
            </div>
            <Badge className={`${statusColors[selectedFerias.status] || 'bg-slate-100 text-slate-700'} text-xs`}>
              {selectedFerias.status}
            </Badge>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="rounded-lg border bg-white p-3">
              <div className="text-slate-500">Início</div>
              <div className="font-medium mt-1">{formatDate(selectedFerias.data_inicio)}</div>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <div className="text-slate-500">Retorno</div>
              <div className="font-medium mt-1">{formatDate(selectedFerias.data_retorno)}</div>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <div className="text-slate-500">Dias</div>
              <div className="font-medium mt-1">{selectedFerias.dias ?? '-'}</div>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <div className="text-slate-500">Saldo remanescente</div>
              <div className="font-medium mt-1 text-blue-700">{selectedFerias.saldo_remanescente != null ? `${selectedFerias.saldo_remanescente}d` : '—'}</div>
            </div>
          </div>

          <div className="mt-3">
            <Badge className="bg-[#1e3a5f]/10 text-[#1e3a5f] text-xs">Operação: {labelOperacao(livroOperacaoFerias)}</Badge>
          </div>
        </div>
      )}

      <div className="space-y-2">

      </div>
    </div>
  );
}
