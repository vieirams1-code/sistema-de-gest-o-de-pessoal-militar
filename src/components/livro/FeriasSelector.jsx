import React, { useMemo } from 'react';
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
import {
  Calendar,
  AlertCircle,
  Lock,
  CheckCircle2,
  PauseCircle,
  ArrowRightCircle,
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';

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

function getPeriodoSortKey(ferias) {
  const ref = ferias?.periodo_aquisitivo_ref || '';
  const match = String(ref).match(/(\d{4})\s*\/\s*(\d{4})/);

  if (match) {
    return Number(match[1]);
  }

  if (ferias?.data_inicio) {
    const d = new Date(`${ferias.data_inicio}T00:00:00`);
    if (!Number.isNaN(d.getTime())) return d.getTime();
  }

  return Number.MAX_SAFE_INTEGER;
}

function ordenarFerias(lista) {
  return [...lista].sort((a, b) => {
    const ka = getPeriodoSortKey(a);
    const kb = getPeriodoSortKey(b);

    if (ka !== kb) return ka - kb;

    const da = a?.data_inicio ? new Date(`${a.data_inicio}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER;
    const db = b?.data_inicio ? new Date(`${b.data_inicio}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER;
    return da - db;
  });
}

function montarFeriasOpcoes(ferias, tipoRegistro) {
  if (tipoRegistro === 'Retorno Férias') {
    return ordenarFerias(
      ferias
        .filter((f) => f.status === 'Em Curso')
        .map((f) => ({
          ...f,
          disabled: false,
          bloqueioMotivo: '',
          operacao_sugerida: 'Retorno Férias',
          destaque: 'termino',
        }))
    );
  }

  if (tipoRegistro === 'Interrupção de Férias') {
    return ordenarFerias(
      ferias
        .filter((f) => f.status === 'Em Curso')
        .map((f) => ({
          ...f,
          disabled: false,
          bloqueioMotivo: '',
          operacao_sugerida: 'Interrupção de Férias',
          destaque: 'interrupcao',
        }))
    );
  }

  if (tipoRegistro === 'Nova Saída / Retomada') {
    return ordenarFerias(
      ferias
        .filter((f) => f.status === 'Interrompida')
        .map((f) => ({
          ...f,
          disabled: false,
          bloqueioMotivo: '',
          operacao_sugerida: 'Nova Saída / Retomada',
          destaque: 'continuacao',
        }))
    );
  }

  const emCurso = ordenarFerias(ferias.filter((f) => f.status === 'Em Curso'));
  const interrompidas = ordenarFerias(ferias.filter((f) => f.status === 'Interrompida'));
  const previstas = ordenarFerias(ferias.filter((f) => f.status === 'Prevista' || f.status === 'Autorizada'));

  if (emCurso.length > 0) {
    return [
      ...emCurso.map((f) => ({
        ...f,
        disabled: false,
        bloqueioMotivo: '',
        operacao_sugerida: 'Escolher entre Término ou Interrupção',
        destaque: 'prioridade_em_curso',
      })),
      ...interrompidas.map((f) => ({
        ...f,
        disabled: true,
        bloqueioMotivo: 'Existe férias em curso deste militar. Resolva a cadeia em curso antes de atuar em uma férias interrompida diferente.',
        operacao_sugerida: 'Nova Saída / Retomada',
        destaque: 'bloqueada_por_em_curso',
      })),
      ...previstas.map((f) => ({
        ...f,
        disabled: true,
        bloqueioMotivo: 'Existe férias em curso deste militar. Não é permitido iniciar novo período enquanto houver férias em curso.',
        operacao_sugerida: 'Saída Férias',
        destaque: 'bloqueada_por_em_curso',
      })),
    ];
  }

  if (interrompidas.length > 0) {
    return [
      ...interrompidas.map((f) => ({
        ...f,
        disabled: false,
        bloqueioMotivo: '',
        operacao_sugerida: 'Nova Saída / Retomada',
        destaque: 'prioridade_interrompida',
      })),
      ...previstas.map((f) => ({
        ...f,
        disabled: true,
        bloqueioMotivo: 'Existe férias interrompida pendente. Ela deve ser resolvida antes de iniciar outro período.',
        operacao_sugerida: 'Saída Férias',
        destaque: 'bloqueada_por_interrompida',
      })),
    ];
  }

  const periodoMaisAntigo = previstas[0]?.id;

  return previstas.map((f) => ({
    ...f,
    disabled: f.id !== periodoMaisAntigo,
    bloqueioMotivo:
      f.id !== periodoMaisAntigo
        ? 'Há período aquisitivo mais antigo pendente. O sistema força iniciar primeiro o mais antigo.'
        : '',
    operacao_sugerida: 'Saída Férias',
    destaque: f.id === periodoMaisAntigo ? 'mais_antigo' : 'bloqueada_por_antiguidade',
  }));
}

function getMensagemEstado(tipoRegistro) {
  if (tipoRegistro === 'Retorno Férias') {
    return {
      titulo: 'Nenhuma férias em curso',
      texto: 'Este militar não possui férias em curso para término.',
    };
  }

  if (tipoRegistro === 'Interrupção de Férias') {
    return {
      titulo: 'Nenhuma férias em curso',
      texto: 'Este militar não possui férias em curso para interrupção.',
    };
  }

  if (tipoRegistro === 'Nova Saída / Retomada') {
    return {
      titulo: 'Nenhuma férias interrompida',
      texto: 'Este militar não possui férias interrompidas para continuação.',
    };
  }

  return {
    titulo: 'Nenhuma férias disponível',
    texto: 'Este militar não possui férias previstas, autorizadas ou interrompidas compatíveis com o fluxo atual.',
  };
}

function labelOperacao(operacao) {
  if (operacao === 'Nova Saída / Retomada') return 'Continuação';
  if (operacao === 'Retorno Férias') return 'Término';
  if (operacao === 'Interrupção de Férias') return 'Interrupção';
  if (operacao === 'Escolher entre Término ou Interrupção') return 'Escolher entre Término ou Interrupção';
  return 'Início';
}

export default function FeriasSelector({ militarId, value, onChange, tipoRegistro }) {
  const { data: feriasRaw = [], isLoading } = useQuery({
    queryKey: ['ferias-militar', militarId, tipoRegistro],
    queryFn: async () => {
      if (!militarId) return [];
      return base44.entities.Ferias.filter({ militar_id: militarId });
    },
    enabled: !!militarId,
  });

  const opcoes = useMemo(() => montarFeriasOpcoes(feriasRaw, tipoRegistro), [feriasRaw, tipoRegistro]);
  const selectedFerias = useMemo(() => opcoes.find((item) => item.id === value) || null, [opcoes, value]);
  const estado = getMensagemEstado(tipoRegistro);

  const existeEmCursoPrioritaria = opcoes.some((f) => f.destaque === 'prioridade_em_curso');
  const existeInterrompidaPrioritaria = opcoes.some((f) => f.destaque === 'prioridade_interrompida');
  const existeBloqueioPorAntiguidade = opcoes.some((f) => f.destaque === 'bloqueada_por_antiguidade');

  const handleSelect = (feriasId) => {
    const ferias = opcoes.find((f) => f.id === feriasId);
    if (!ferias || ferias.disabled) return;
    if (onChange) onChange(ferias);
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
    <div className="space-y-3">
      {existeEmCursoPrioritaria && tipoRegistro === 'Saída Férias' && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Existe férias <strong>em curso</strong>. Ela tem prioridade operacional. Após selecionar essa cadeia, o operador poderá escolher entre <strong>Término</strong> ou <strong>Interrupção</strong>.
          </span>
        </div>
      )}

      {existeInterrompidaPrioritaria && tipoRegistro === 'Saída Férias' && (
        <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800 flex items-start gap-2">
          <PauseCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Existe férias <strong>interrompida</strong> pendente. Ela tem prioridade operacional e deve ser continuada antes do início de um novo período.
          </span>
        </div>
      )}

      {existeBloqueioPorAntiguidade && !existeInterrompidaPrioritaria && !existeEmCursoPrioritaria && tipoRegistro === 'Saída Férias' && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 flex items-start gap-2">
          <ArrowRightCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Há mais de um período previsto. O sistema permite selecionar apenas o <strong>mais antigo</strong> primeiro.
          </span>
        </div>
      )}

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
                  {f.disabled ? <Lock className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
                  <span>
                    {f.periodo_aquisitivo_ref || 'Sem período'} • {formatDate(f.data_inicio)} • {f.dias} dias
                    {f.disabled ? ' — bloqueada' : ''}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {opcoes.map((f) => (
          <div
            key={`hint-${f.id}`}
            className={`p-3 rounded-lg border text-xs ${
              f.disabled
                ? 'bg-slate-50 border-slate-200 text-slate-500'
                : f.destaque === 'prioridade_interrompida'
                ? 'bg-orange-50 border-orange-200 text-orange-800'
                : f.destaque === 'prioridade_em_curso'
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : f.destaque === 'mais_antigo'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{f.periodo_aquisitivo_ref || 'Sem período'}</span>
                <Badge className={`${statusColors[f.status] || 'bg-slate-100 text-slate-700'} text-[10px]`}>
                  {f.status}
                </Badge>
                {f.destaque === 'prioridade_interrompida' && (
                  <Badge className="bg-orange-100 text-orange-700 text-[10px]">Prioridade operacional</Badge>
                )}
                {f.destaque === 'prioridade_em_curso' && (
                  <Badge className="bg-amber-100 text-amber-700 text-[10px]">Cadeia ativa prioritária</Badge>
                )}
                {f.destaque === 'mais_antigo' && (
                  <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Mais antigo liberado</Badge>
                )}
              </div>
              <span>{formatDate(f.data_inicio)} → {formatDate(f.data_retorno)}</span>
            </div>
            {f.bloqueioMotivo && <div className="mt-1">{f.bloqueioMotivo}</div>}
          </div>
        ))}
      </div>

      {selectedFerias && (
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-[#1e3a5f]" />
            <span className="font-medium text-sm text-slate-900">Férias Selecionada</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-500">Período:</span>{' '}
              <span className="font-medium">{selectedFerias.periodo_aquisitivo_ref || '-'}</span>
            </div>
            <div>
              <span className="text-slate-500">Status:</span>{' '}
              <span className="font-medium">{selectedFerias.status}</span>
            </div>
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
            {selectedFerias.saldo_remanescente != null && (
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
            <Badge className="bg-[#1e3a5f]/10 text-[#1e3a5f] text-xs">
              Operação sugerida: {labelOperacao(selectedFerias.operacao_sugerida)}
            </Badge>
          </div>
        </div>
      )}
    </div>
  );
}