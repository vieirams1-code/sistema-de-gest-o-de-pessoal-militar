import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { reconciliarCadeiaFerias, calcularSnapshotInterrupcao, compareEventosFerias } from '@/components/ferias/reconciliacaoCadeiaFerias';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  LogOut,
  LogIn,
  PauseCircle,
  RefreshCw,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { addDays, differenceInDays, format } from 'date-fns';
import { montarCadeia } from '@/components/ferias/feriasAdminUtils';
import { getBlockingReasonForInicio } from '@/components/ferias/inicioValidation';
import { aplicarTemplate, buildVarsLivro } from '@/components/utils/templateUtils';
import {
  validarInicioFracaoNoLivro,
  validarInicioNoPeriodoConcessivo,
} from '@/components/ferias/feriasRules';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { getTemplateAtivoPorTipo } from '@/components/rp/templateValidation';

const NOMES_OPERACIONAIS = {
  'Saída Férias': 'Início',
  'Retorno Férias': 'Término',
  'Interrupção de Férias': 'Interrupção',
  'Nova Saída / Retomada': 'Continuação',
};

const ICONES = {
  'Saída Férias': LogOut,
  'Retorno Férias': LogIn,
  'Interrupção de Férias': PauseCircle,
  'Nova Saída / Retomada': RefreshCw,
};

const TIPOS_OPERACIONAIS = [
  'Saída Férias',
  'Retorno Férias',
  'Interrupção de Férias',
  'Nova Saída / Retomada',
];

function toDateOnlyString(date) {
  return format(date, 'yyyy-MM-dd');
}

function parseDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`);
}

function formatDateBR(dateStr) {
  if (!dateStr) return '';
  return format(parseDate(dateStr), 'dd/MM/yyyy');
}

function calcStatusPublicacao(nota, numeroBg, dataBg) {
  if (numeroBg && dataBg) return 'Publicado';
  if (nota) return 'Aguardando Publicação';
  return 'Aguardando Nota';
}

function getEventDate(evento) {
  return evento?.data_registro || evento?.data_inicio || null;
}

function deriveUltimaInterrupcao(ferias, registros) {
  const cadeia = [...registros].sort(compareEventosFerias);
  const ultima = [...cadeia]
    .reverse()
    .find((r) => r.tipo_registro === 'Interrupção de Férias');

  if (!ultima) return null;

  const snap = calcularSnapshotInterrupcao(ultima, cadeia, ferias);

  return {
    ...ultima,
    diasNoMomento: snap.diasNoMomento,
    gozados: snap.gozados,
    saldo: snap.saldo,
  };
}

function getCadeiaOperacional(ferias, registrosDaFerias) {
  if (!ferias) return [];

  return montarCadeia(ferias, registrosDaFerias).filter((r) =>
    TIPOS_OPERACIONAIS.includes(r.tipo_registro)
  );
}

function getEstadoAtualDaCadeia(cadeia) {
  if (!cadeia.length) {
    return {
      status: 'Sem Eventos',
      ultimoEvento: null,
      ultimaSaidaOuContinuacao: null,
      ultimaInterrupcao: null,
      ultimoRetorno: null,
    };
  }

  const ultimoEvento = cadeia[cadeia.length - 1];
  const ultimaSaidaOuContinuacao = [...cadeia]
    .reverse()
    .find((e) => e.tipo_registro === 'Saída Férias' || e.tipo_registro === 'Nova Saída / Retomada');

  const ultimaInterrupcao = [...cadeia]
    .reverse()
    .find((e) => e.tipo_registro === 'Interrupção de Férias');

  const ultimoRetorno = [...cadeia]
    .reverse()
    .find((e) => e.tipo_registro === 'Retorno Férias');

  let status = 'Sem Eventos';

  if (
    ultimoEvento.tipo_registro === 'Saída Férias' ||
    ultimoEvento.tipo_registro === 'Nova Saída / Retomada'
  ) {
    status = 'Em Curso';
  } else if (ultimoEvento.tipo_registro === 'Interrupção de Férias') {
    status = 'Interrompida';
  } else if (ultimoEvento.tipo_registro === 'Retorno Férias') {
    status = 'Encerrada';
  }

  return {
    status,
    ultimoEvento,
    ultimaSaidaOuContinuacao,
    ultimaInterrupcao,
    ultimoRetorno,
  };
}

function validarCronologia({
  tipoRegistro,
  dataRegistro,
  cadeia,
  estadoAtual,
  resumo,
  ferias,
  todasFeriasDoMilitar,
  dataLimiteGozo,
}) {
  if (!dataRegistro) {
    return 'Informe a data do registro.';
  }

  const dataNova = parseDate(dataRegistro);

  if (tipoRegistro === 'Saída Férias' && ferias) {
    const bloqueioInicio = getBlockingReasonForInicio(ferias, todasFeriasDoMilitar || []);
    if (bloqueioInicio) {
      return bloqueioInicio;
    }

    const bloqueioFracao = validarInicioFracaoNoLivro({
      feriasAtual: ferias,
      todasFeriasDoMilitar,
      dataRegistro,
    });

    if (bloqueioFracao) {
      return bloqueioFracao;
    }

    const bloqueioConcessivo = validarInicioNoPeriodoConcessivo(
      dataRegistro,
      dataLimiteGozo || ferias.data_limite_gozo
    );

    if (bloqueioConcessivo) {
      return bloqueioConcessivo;
    }
  }

  if (cadeia.length > 0 && estadoAtual.ultimoEvento) {
    const dataUltimoEventoStr = getEventDate(estadoAtual.ultimoEvento);

    if (dataUltimoEventoStr) {
      const dataUltimoEvento = parseDate(dataUltimoEventoStr);

      if (dataNova < dataUltimoEvento) {
        return `${NOMES_OPERACIONAIS[tipoRegistro] || tipoRegistro} não pode ter data anterior ao evento anterior da cadeia (${NOMES_OPERACIONAIS[estadoAtual.ultimoEvento.tipo_registro] || estadoAtual.ultimoEvento.tipo_registro} em ${formatDateBR(dataUltimoEventoStr)}).`;
      }
    }
  }

  if (tipoRegistro === 'Saída Férias') {
    if (cadeia.length > 0) {
      return 'Esta cadeia já possui evento operacional. O início só pode ser lançado como primeiro evento.';
    }
    return null;
  }

  if (tipoRegistro === 'Interrupção de Férias') {
    if (estadoAtual.status !== 'Em Curso' || !estadoAtual.ultimaSaidaOuContinuacao) {
      return 'A interrupção só pode ser lançada quando as férias estiverem em curso.';
    }

    const dataBaseStr = getEventDate(estadoAtual.ultimaSaidaOuContinuacao);

    if (dataBaseStr && dataNova < parseDate(dataBaseStr)) {
      return `A interrupção não pode ser anterior ao início/continuação de ${formatDateBR(dataBaseStr)}.`;
    }

    if (resumo && Number(resumo.saldo) <= 0) {
      return 'Não há saldo remanescente para interromper estas férias.';
    }

    return null;
  }

  if (tipoRegistro === 'Nova Saída / Retomada') {
    if (estadoAtual.status !== 'Interrompida' || !estadoAtual.ultimaInterrupcao) {
      return 'A continuação só pode ser lançada após uma interrupção válida.';
    }

    const dataInterrupcaoStr = getEventDate(estadoAtual.ultimaInterrupcao);

    if (dataInterrupcaoStr && dataNova < parseDate(dataInterrupcaoStr)) {
      return `A continuação não pode ser anterior à interrupção de ${formatDateBR(dataInterrupcaoStr)}.`;
    }

    if (resumo && Number(resumo.saldo) <= 0) {
      return 'Não existe saldo remanescente para continuação.';
    }

    return null;
  }

  if (tipoRegistro === 'Retorno Férias') {
    if (estadoAtual.status !== 'Em Curso' || !estadoAtual.ultimaSaidaOuContinuacao) {
      return 'O término só pode ser lançado quando as férias estiverem em curso.';
    }

    const dataBaseStr = getEventDate(estadoAtual.ultimaSaidaOuContinuacao);

    if (dataBaseStr && dataNova < parseDate(dataBaseStr)) {
      return `O término não pode ser anterior ao início/continuação de ${formatDateBR(dataBaseStr)}.`;
    }

    return null;
  }

  return null;
}

export default function RegistroLivroModal({
  open,
  onClose,
  ferias,
  tipoInicial = 'Saída Férias',
}) {
  const queryClient = useQueryClient();
  
  const { canAccessAction } = useCurrentUser();
  const canGerirCadeia = canAccessAction('gerir_cadeia_ferias');

  const [tipoRegistro, setTipoRegistro] = useState(tipoInicial);
  const [dataRegistro, setDataRegistro] = useState('');
  const [notaParaBg, setNotaParaBg] = useState('');
  const [numeroBg, setNumeroBg] = useState('');
  const [dataBg, setDataBg] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [textoPublicacao, setTextoPublicacao] = useState('');
  const [saving, setSaving] = useState(false);
  const [templateError, setTemplateError] = useState(null);

  const { data: templates = [] } = useQuery({
    queryKey: ['templates-texto'],
    queryFn: () => base44.entities.TemplateTexto.list(),
    staleTime: 30000,
    enabled: open,
  });

  const { data: registrosDaFerias = [] } = useQuery({
    queryKey: ['registros-livro-ferias-modal', ferias?.id],
    queryFn: async () => {
      if (!ferias?.id) return [];
      return base44.entities.RegistroLivro.filter({ ferias_id: ferias.id });
    },
    enabled: open && !!ferias?.id,
  });

  const { data: todasFeriasDoMilitar = [] } = useQuery({
    queryKey: ['ferias-militar-modal', ferias?.militar_id],
    queryFn: async () => {
      if (!ferias?.militar_id) return [];
      return base44.entities.Ferias.filter({ militar_id: ferias.militar_id });
    },
    enabled: open && !!ferias?.militar_id,
  });

  const { data: periodosDoMilitar = [] } = useQuery({
    queryKey: ['periodos-militar-modal', ferias?.militar_id],
    queryFn: async () => {
      if (!ferias?.militar_id) return [];
      return base44.entities.PeriodoAquisitivo.filter({ militar_id: ferias.militar_id });
    },
    enabled: open && !!ferias?.militar_id,
  });

  const dataLimiteGozo = useMemo(() => {
    if (!ferias) return null;

    const periodo = (periodosDoMilitar || []).find((item) =>
      (ferias.periodo_aquisitivo_id && item.id === ferias.periodo_aquisitivo_id) ||
      ((item.ano_referencia || '') === (ferias.periodo_aquisitivo_ref || ''))
    );

    return periodo?.data_limite_gozo || ferias.data_limite_gozo || null;
  }, [periodosDoMilitar, ferias]);

  useEffect(() => {
    if (!open || !ferias) return;

    setTipoRegistro(tipoInicial);

    if (tipoInicial === 'Saída Férias') {
      setDataRegistro(ferias.data_inicio || '');
    } else if (tipoInicial === 'Retorno Férias') {
      setDataRegistro(ferias.data_retorno || '');
    } else {
      setDataRegistro(toDateOnlyString(new Date()));
    }

    setNotaParaBg('');
    setNumeroBg('');
    setDataBg('');
    setObservacoes('');
    setTextoPublicacao('');
    setTemplateError(null);
  }, [open, ferias, tipoInicial]);

  const cadeiaOperacional = useMemo(() => {
    if (!ferias) return [];
    return getCadeiaOperacional(ferias, registrosDaFerias);
  }, [ferias, registrosDaFerias]);

  const estadoAtualCadeia = useMemo(() => {
    return getEstadoAtualDaCadeia(cadeiaOperacional);
  }, [cadeiaOperacional]);

  const resumo = useMemo(() => {
    if (!ferias || !dataRegistro) return null;

    const baseDias = Number(ferias.dias || 0);
    const dataRef = parseDate(dataRegistro);

    if (tipoRegistro === 'Saída Férias') {
      const novoFim = toDateOnlyString(addDays(dataRef, Math.max(baseDias - 1, 0)));
      const novoRetorno = toDateOnlyString(addDays(dataRef, baseDias));

      return {
        titulo: 'Resumo do Início',
        inicio: dataRegistro,
        dias: baseDias,
        fim: novoFim,
        retorno: novoRetorno,
      };
    }

    if (tipoRegistro === 'Retorno Férias') {
      return {
        titulo: 'Resumo do Término',
        retorno: dataRegistro,
        dias: baseDias,
      };
    }

    if (tipoRegistro === 'Interrupção de Férias') {
      const eventoBase = estadoAtualCadeia.ultimaSaidaOuContinuacao;
      const dataBaseStr =
        getEventDate(eventoBase) || ferias.data_inicio || null;

      if (!dataBaseStr) return null;

      const inicioBase = parseDate(dataBaseStr);

      let gozados = Math.max(0, differenceInDays(dataRef, inicioBase) + 1);
      gozados = Math.min(gozados, baseDias);
      const saldo = Math.max(0, baseDias - gozados);

      return {
        titulo: 'Resumo da Interrupção',
        dataInterrupcao: dataRegistro,
        gozados,
        saldo,
        diasNoMomento: baseDias,
      };
    }

    if (tipoRegistro === 'Nova Saída / Retomada') {
      const ultimaInterrupcao = deriveUltimaInterrupcao(ferias, registrosDaFerias);
      const saldo = Number(ultimaInterrupcao?.saldo ?? ferias.saldo_remanescente ?? 0);
      const novoFim = saldo > 0 ? toDateOnlyString(addDays(dataRef, saldo - 1)) : dataRegistro;
      const novoRetorno = toDateOnlyString(addDays(dataRef, saldo));

      return {
        titulo: 'Resumo da Continuação',
        saldo,
        novoInicio: dataRegistro,
        novoFim,
        novoRetorno,
      };
    }

    return null;
  }, [ferias, dataRegistro, tipoRegistro, registrosDaFerias, estadoAtualCadeia]);

  const erroCronologia = useMemo(() => {
    return validarCronologia({
      tipoRegistro,
      dataRegistro,
      cadeia: cadeiaOperacional,
      estadoAtual: estadoAtualCadeia,
      resumo,
      ferias,
      todasFeriasDoMilitar,
      dataLimiteGozo,
    });
  }, [tipoRegistro, dataRegistro, cadeiaOperacional, estadoAtualCadeia, resumo, ferias, todasFeriasDoMilitar, dataLimiteGozo]);

  useEffect(() => {
    if (!ferias || !resumo || erroCronologia) {
      setTextoPublicacao('');
      setTemplateError(null);
      return;
    }

    const tmpl = getTemplateAtivoPorTipo(tipoRegistro, 'Livro', templates, {
      grupamento_id: ferias?.grupamento_id,
      subgrupamento_id: ferias?.subgrupamento_id,
      subgrupamento_tipo: ferias?.subgrupamento_tipo,
    });

    if (!tmpl?.template) {
      setTextoPublicacao('');
      setTemplateError(`Template obrigatório não encontrado para '${tipoRegistro}'. Entre em contato com o administrador para cadastrar o template antes de continuar.`);
      return;
    }

    setTemplateError(null);

    const periodoFerias = (periodosDoMilitar || []).find((item) =>
      (ferias.periodo_aquisitivo_id && item.id === ferias.periodo_aquisitivo_id) ||
      ((item.ano_referencia || '') === (ferias.periodo_aquisitivo_ref || ''))
    );

    let interrupcaoInfo = null;
    if (tipoRegistro === 'Interrupção de Férias') {
      interrupcaoInfo = {
        dataInterrupcao: resumo.dataInterrupcao || dataRegistro,
        diasNoMomento: resumo.diasNoMomento,
        diasGozados: resumo.gozados,
        saldoRemanescente: resumo.saldo,
      };
    } else if (tipoRegistro === 'Nova Saída / Retomada') {
      interrupcaoInfo = {
        saldoRemanescente: resumo.saldo,
      };
    }

    const vars = buildVarsLivro({
      ferias,
      dataRegistro,
      periodo: periodoFerias,
      interrupcaoInfo
    });

    setTextoPublicacao(aplicarTemplate(tmpl.template, vars));
  }, [ferias, resumo, tipoRegistro, dataRegistro, erroCronologia, templates, periodosDoMilitar]);

  const statusPublicacao = useMemo(
    () => calcStatusPublicacao(notaParaBg, numeroBg, dataBg),
    [notaParaBg, numeroBg, dataBg]
  );

  const handleSalvar = async () => {
    if (!ferias || !dataRegistro || erroCronologia) return;

    if (!canGerirCadeia) {
      alert('Ação negada: Você não possui permissão para gerir a cadeia de férias (adicionar registros).');
      return;
    }

    setSaving(true);

    try {
      const registroPayload = {
        militar_id: ferias.militar_id,
        militar_nome: ferias.militar_nome,
        militar_posto: ferias.militar_posto,
        militar_matricula: ferias.militar_matricula,
        ferias_id: ferias.id,
        periodo_aquisitivo: ferias.periodo_aquisitivo_ref || '',
        data_registro: dataRegistro,
        tipo_registro: tipoRegistro,
        dias: Number(ferias.dias || 0),
        nota_para_bg: notaParaBg || '',
        numero_bg: numeroBg || '',
        data_bg: dataBg || '',
        status: statusPublicacao,
        observacoes: observacoes || '',
        texto_publicacao: textoPublicacao || '',
      };

      if (tipoRegistro === 'Interrupção de Férias' && resumo) {
        registroPayload.dias = Number(resumo.diasNoMomento || ferias.dias || 0);
        registroPayload.dias_no_momento = Number(resumo.diasNoMomento || ferias.dias || 0);
        registroPayload.dias_gozados = Number(resumo.gozados || 0);
        registroPayload.saldo_remanescente = Number(resumo.saldo || 0);
      } else if (tipoRegistro === 'Nova Saída / Retomada' && resumo) {
        registroPayload.dias = Number(resumo.saldo || 0);
      } else if (tipoRegistro === 'Saída Férias' && resumo) {
        registroPayload.dias = Number(resumo.dias || ferias.dias || 0);
      }

      await base44.entities.RegistroLivro.create(registroPayload);

      if (TIPOS_OPERACIONAIS.includes(tipoRegistro)) {
        await reconciliarCadeiaFerias({ feriasId: ferias.id, ferias });
      }

      queryClient.invalidateQueries({ queryKey: ['ferias'] });
      queryClient.invalidateQueries({ queryKey: ['registros-livro-all'] });
      queryClient.invalidateQueries({ queryKey: ['registros-livro'] });
      queryClient.invalidateQueries({ queryKey: ['registros-livro-ferias-modal', ferias.id] });
      queryClient.invalidateQueries({ queryKey: ['ferias-militar-modal', ferias.militar_id] });

      onClose();
    } catch (error) {
      console.error('Erro ao salvar registro de férias:', error);
      alert('Erro ao salvar registro.');
    } finally {
      setSaving(false);
    }
  };

  const IconeTitulo = ICONES[tipoRegistro] || FileText;

  if (!ferias) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <IconeTitulo className="w-5 h-5 text-[#1e3a5f]" />
            <DialogTitle>{NOMES_OPERACIONAIS[tipoRegistro] || tipoRegistro}</DialogTitle>
          </div>
          <DialogDescription>
            Registro de movimentação no Livro de Férias e Outras Concessões.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="font-semibold text-slate-800">
              {ferias.militar_posto ? `${ferias.militar_posto} ` : ''}
              {ferias.militar_nome}
            </div>
            <div className="text-sm text-slate-500 mt-1">
              Base: {ferias.dias || 0}d | Período: {ferias.periodo_aquisitivo_ref || '—'}
            </div>
          </div>

          {cadeiaOperacional.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-700 mb-2">
                Situação atual da cadeia
              </div>
              <div className="text-sm text-slate-600 space-y-1">
                <div>
                  <span className="font-medium">Status atual:</span> {estadoAtualCadeia.status}
                </div>
                {estadoAtualCadeia.ultimoEvento && (
                  <div>
                    <span className="font-medium">Último evento:</span>{' '}
                    {NOMES_OPERACIONAIS[estadoAtualCadeia.ultimoEvento.tipo_registro] ||
                      estadoAtualCadeia.ultimoEvento.tipo_registro}
                    {' — '}
                    {formatDateBR(getEventDate(estadoAtualCadeia.ultimoEvento))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <Label>Data do Registro *</Label>
            <Input
              type="date"
              value={dataRegistro}
              onChange={(e) => setDataRegistro(e.target.value)}
              className="mt-1.5"
            />
          </div>

          {erroCronologia && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{erroCronologia}</span>
            </div>
          )}

          {templateError && !erroCronologia && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{templateError}</span>
            </div>
          )}

          {resumo && !erroCronologia && (
            <div className="rounded-lg border p-4 bg-cyan-50 border-cyan-200">
              <div className="font-semibold text-cyan-800 mb-3">{resumo.titulo}</div>

              {tipoRegistro === 'Saída Férias' && (
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-cyan-700">Início</div>
                    <div className="font-semibold">{formatDateBR(resumo.inicio)}</div>
                  </div>
                  <div>
                    <div className="text-cyan-700">Novo fim</div>
                    <div className="font-semibold">{formatDateBR(resumo.fim)}</div>
                  </div>
                  <div>
                    <div className="text-cyan-700">Novo retorno</div>
                    <div className="font-semibold">{formatDateBR(resumo.retorno)}</div>
                  </div>
                </div>
              )}

              {tipoRegistro === 'Retorno Férias' && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-cyan-700">Término</div>
                    <div className="font-semibold">{formatDateBR(resumo.retorno)}</div>
                  </div>
                  <div>
                    <div className="text-cyan-700">Dias encerrados</div>
                    <div className="font-semibold">{resumo.dias}d</div>
                  </div>
                </div>
              )}

              {tipoRegistro === 'Interrupção de Férias' && (
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-cyan-700">Data interrupção</div>
                    <div className="font-semibold">{formatDateBR(resumo.dataInterrupcao)}</div>
                  </div>
                  <div>
                    <div className="text-cyan-700">Dias gozados</div>
                    <div className="font-semibold">{resumo.gozados}d</div>
                  </div>
                  <div>
                    <div className="text-cyan-700">Saldo remanescente</div>
                    <div className="font-semibold">{resumo.saldo}d</div>
                  </div>
                </div>
              )}

              {tipoRegistro === 'Nova Saída / Retomada' && (
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-cyan-700">Saldo retomado</div>
                    <div className="font-semibold">{resumo.saldo}d</div>
                  </div>
                  <div>
                    <div className="text-cyan-700">Novo fim</div>
                    <div className="font-semibold">{formatDateBR(resumo.novoFim)}</div>
                  </div>
                  <div>
                    <div className="text-cyan-700">Novo retorno</div>
                    <div className="font-semibold">{formatDateBR(resumo.novoRetorno)}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label>Texto para Publicação</Label>
              <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Gerado automaticamente
              </span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg min-h-[100px]">
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {textoPublicacao || 'Nenhum texto gerado.'}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-500" />
              <span className="font-medium text-slate-700">Publicação (opcional)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Nota para BG</Label>
                <Input
                  value={notaParaBg}
                  onChange={(e) => setNotaParaBg(e.target.value)}
                  className="mt-1.5"
                  placeholder="001/2025"
                />
              </div>

              <div>
                <Label>Número do BG</Label>
                <Input
                  value={numeroBg}
                  onChange={(e) => setNumeroBg(e.target.value)}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label>Data do BG</Label>
                <Input
                  type="date"
                  value={dataBg}
                  onChange={(e) => setDataBg(e.target.value)}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label>Status</Label>
                <Input
                  value={statusPublicacao}
                  readOnly
                  className="mt-1.5 bg-slate-50"
                />
              </div>
            </div>

            {!textoPublicacao && !erroCronologia && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 flex gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>O texto da publicação está vazio. Revise antes de salvar.</span>
              </div>
            )}
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              className="mt-1.5"
              placeholder="Observações..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={handleSalvar}
              disabled={saving || !dataRegistro || !!erroCronologia || !canGerirCadeia || !!templateError}
              className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white"
            >
              {saving ? 'Salvando...' : 'Salvar Registro'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
