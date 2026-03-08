import React from 'react';
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
import { Calendar, AlertCircle, PauseCircle, RefreshCw, LogIn, LogOut } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';

const statusColors = {
  Prevista: 'bg-slate-100 text-slate-700',
  Autorizada: 'bg-blue-100 text-blue-700',
  'Em Curso': 'bg-amber-100 text-amber-700',
  Interrompida: 'bg-orange-100 text-orange-700',
  Gozada: 'bg-emerald-100 text-emerald-700',
};

const tipoInfoMap = {
  'Saída Férias': {
    titulo: 'Selecionar Férias',
    placeholder: 'Selecione as férias para início...',
    emptyTitle: 'Nenhuma férias disponível para início',
    emptyText: 'Este militar não possui férias previstas ou autorizadas para iniciar.',
    icon: LogOut,
  },
  'Interrupção de Férias': {
    titulo: 'Selecionar Férias em Curso',
    placeholder: 'Selecione as férias para interrupção...',
    emptyTitle: 'Nenhuma férias em curso',
    emptyText: 'Este militar não possui férias em curso para interrupção.',
    icon: PauseCircle,
  },
  'Nova Saída / Retomada': {
    titulo: 'Selecionar Férias Interrompida',
    placeholder: 'Selecione as férias para continuação...',
    emptyTitle: 'Nenhuma férias interrompida',
    emptyText: 'Este militar não possui férias interrompidas para continuação.',
    icon: RefreshCw,
  },
  'Retorno Férias': {
    titulo: 'Selecionar Férias em Curso',
    placeholder: 'Selecione as férias para término...',
    emptyTitle: 'Nenhuma férias em curso',
    emptyText: 'Este militar não possui férias em curso para término.',
    icon: LogIn,
  },
};

function formatDate(dateString) {
  if (!dateString) return '-';
  return format(new Date(`${dateString}T00:00:00`), 'dd/MM/yyyy');
}

function getTipoConfig(tipoRegistro) {
  return tipoInfoMap[tipoRegistro] || {
    titulo: 'Selecionar Férias',
    placeholder: 'Selecione as férias...',
    emptyTitle: 'Nenhuma férias disponível',
    emptyText: 'Este militar não possui férias compatíveis com este tipo de registro.',
    icon: Calendar,
  };
}

function filterFeriasByTipo(ferias, tipoRegistro) {
  if (tipoRegistro === 'Saída Férias') {
    return ferias.filter((f) => f.status === 'Prevista' || f.status === 'Autorizada');
  }

  if (tipoRegistro === 'Interrupção de Férias') {
    return ferias.filter((f) => f.status === 'Em Curso');
  }

  if (tipoRegistro === 'Nova Saída / Retomada') {
    return ferias.filter((f) => f.status === 'Interrompida');
  }

  if (tipoRegistro === 'Retorno Férias') {
    return ferias.filter((f) => f.status === 'Em Curso');
  }

  return ferias;
}

export default function FeriasSelector({ militarId, value, onChange, tipoRegistro }) {
  const tipoConfig = getTipoConfig(tipoRegistro);
  const IconeTitulo = tipoConfig.icon;

  const { data: feriasList = [], isLoading } = useQuery({
    queryKey: ['ferias-militar', militarId, tipoRegistro],
    queryFn: async () => {
      if (!militarId) return [];
      const ferias = await base44.entities.Ferias.filter({ militar_id: militarId });
      return filterFeriasByTipo(ferias, tipoRegistro);
    },
    enabled: !!militarId,
  });

  const { data: selectedFerias } = useQuery({
    queryKey: ['ferias-selected', value],
    queryFn: async () => {
      if (!value) return null;
      const result = await base44.entities.Ferias.filter({ id: value });
      return result[0] || null;
    },
    enabled: !!value,
  });

  const handleSelect = (feriasId) => {
    const ferias = feriasList.find((f) => f.id === feriasId);
    if (ferias && onChange) {
      onChange(ferias);
    }
  };

  if (!militarId) {
    return (
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
        <p className="text-sm text-slate-600">
          Selecione primeiro o militar para carregar as férias disponíveis.
        </p>
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

  if (feriasList.length === 0) {
    return (
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800">{tipoConfig.emptyTitle}</p>
          <p className="text-xs text-amber-700 mt-1">{tipoConfig.emptyText}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-sm font-medium text-slate-700">{tipoConfig.titulo}</Label>
        <Select value={value || ''} onValueChange={handleSelect}>
          <SelectTrigger className="mt-1.5">
            <SelectValue placeholder={tipoConfig.placeholder} />
          </SelectTrigger>
          <SelectContent>
            {feriasList.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {formatDate(f.data_inicio)} - {f.dias} dias - {f.periodo_aquisitivo_ref || 'Sem período'}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedFerias && (
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <IconeTitulo className="w-4 h-4 text-[#1e3a5f]" />
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
              <span className="text-slate-500">Dias atuais:</span>{' '}
              <span className="font-medium">{selectedFerias.dias ?? '-'}</span>
            </div>
            <div>
              <span className="text-slate-500">Período:</span>{' '}
              <span className="font-medium">{selectedFerias.periodo_aquisitivo_ref || '-'}</span>
            </div>

            {selectedFerias.fracionamento && (
              <div>
                <span className="text-slate-500">Fração:</span>{' '}
                <span className="font-medium">{selectedFerias.fracionamento}</span>
              </div>
            )}

            {selectedFerias.saldo_remanescente != null && selectedFerias.status === 'Interrompida' && (
              <div>
                <span className="text-slate-500">Saldo:</span>{' '}
                <span className="font-medium text-blue-700">{selectedFerias.saldo_remanescente}d</span>
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Badge className={`${statusColors[selectedFerias.status] || 'bg-slate-100 text-slate-700'} text-xs`}>
              {selectedFerias.status}
            </Badge>

            {selectedFerias.tipo && (
              <Badge className="bg-purple-100 text-purple-700 text-xs">
                {selectedFerias.tipo}
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}