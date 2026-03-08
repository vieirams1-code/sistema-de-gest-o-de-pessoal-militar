import React, { useMemo } from 'react';
import {
  X,
  GitBranch,
  Calendar,
  LogOut,
  LogIn,
  PauseCircle,
  RefreshCw,
  Timer,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Clock3,
} from 'lucide-react';
import { differenceInDays, format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { montarCadeia } from '@/components/ferias/feriasAdminUtils';

const statusColors = {
  Prevista: 'bg-slate-100 text-slate-700',
  'Em Curso': 'bg-amber-100 text-amber-700',
  Gozada: 'bg-emerald-100 text-emerald-700',
  Interrompida: 'bg-orange-100 text-orange-700',
};

const pubStatusColors = {
  'Aguardando Nota': 'bg-amber-100 text-amber-700',
  'Aguardando Publicação': 'bg-blue-100 text-blue-700',
  Publicado: 'bg-emerald-100 text-emerald-700',
};

const NOMES_OPERACIONAIS = {
  'Saída Férias': 'Início',
  'Retorno Férias': 'Término',
  'Interrupção de Férias': 'Interrupção',
  'Nova Saída / Retomada': 'Continuação',
};

const TIPOS_OPERACIONAIS = [
  'Saída Férias',
  'Retorno Férias',
  'Interrupção de Férias',
  'Nova Saída / Retomada',
];

const tipoEventoConfig = {
  'Saída Férias': {
    icon: LogOut,
    color: 'text-emerald-600',
    bg: 'bg-emerald-100',
    border: 'border-emerald-300',
  },
  'Retorno Férias': {
    icon: LogIn,
    color: 'text-blue-600',
    bg: 'bg-blue-100',
    border: 'border-blue-300',
  },
  'Interrupção de Férias': {
    icon: PauseCircle,
    color: 'text-orange-600',
    bg: 'bg-orange-100',
    border: 'border-orange-300',
  },
  'Nova Saída / Retomada': {
    icon: RefreshCw,
    color: 'text-teal-600',
    bg: 'bg-teal-100',
    border: 'border-teal-300',
  },
  default: {
    icon: Calendar,
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    border: 'border-slate-300',
  },
};

function formatDate(d) {
  if (!d) return '—';
  try {
    return format(new Date(`${d}T00:00:00`), 'dd/MM/yyyy');
  } catch {
    return d;
  }
}

function parseDate(d) {
  return new Date(`${d}T00:00:00`);
}

function calcPubStatus(r) {
  if (r.numero_bg && r.data_bg) return 'Publicado';
  if (r.nota_para_bg) return 'Aguardando Publicação';
  return 'Aguardando Nota';
}

function getEventDate(evento) {
  return evento?.data_registro || evento?.data_inicio || null;
}

function compareEvents(a, b) {
  const da = getEventDate(a) || '2000-01-01';
  const db = getEventDate(b) || '2000-01-01';

  const dateA = new Date(`${da}T00:00:00`);
  const dateB = new Date(`${db}T00:00:00`);

  if (dateA.getTime() !== dateB.getTime()) {
    return dateA - dateB;
  }

  return new Date(a?.created_date || 0) - new Date(b?.created_date || 0);
}

function deriveEventoInterrupcao(ferias, evento) {
  if (!ferias || !evento) {
    return { gozados: null, saldo: null, diasNoMomento: null };
  }

  const diasNoMomento = Number(
    evento.dias_no_momento ??
      evento.dias ??
      ferias.dias ??
      0
  );

  let gozados = null;
  let saldo = null;

  if (ferias.data_inicio && evento.data_registro) {
    const inicio = parseDate(ferias.data_inicio);
    const dataInterrupcao = parseDate(evento.data_registro);
    gozados = Math.max(0, differenceInDays(dataInterrupcao, inicio) + 1);
    gozados = Math.min(gozados, diasNoMomento);
    saldo = Math.max(0, diasNoMomento - gozados);
  }

  if (evento.dias_gozados != null && !Number.isNaN(Number(evento.dias_gozados))) {
    gozados = Number(evento.dias_gozados);
  }

  if (evento.saldo_remanescente != null && !Number.isNaN(Number(evento.saldo_remanescente))) {
    saldo = Number(evento.saldo_remanescente);
  }

  return { gozados, saldo, diasNoMomento };
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

function detectarInconsistencias(cadeia) {
  const inconsistencias = [];

  if (!cadeia.length) return inconsistencias;

  const primeiro = cadeia[0];
  if (primeiro.tipo_registro !== 'Saída Férias') {
    inconsistencias.push(
      `A cadeia inicia com ${NOMES_OPERACIONAIS[primeiro.tipo_registro] || primeiro.tipo_registro}, e não com Início.`
    );
  }

  for (let i = 1; i < cadeia.length; i += 1) {
    const anterior = cadeia[i - 1];
    const atual = cadeia[i];

    const dataAnterior = getEventDate(anterior);
    const dataAtual = getEventDate(atual);

    if (dataAnterior && dataAtual && parseDate(dataAtual) < parseDate(dataAnterior)) {
      inconsistencias.push(
        `${NOMES_OPERACIONAIS[atual.tipo_registro] || atual.tipo_registro} em ${formatDate(dataAtual)} está anterior ao evento anterior (${NOMES_OPERACIONAIS[anterior.tipo_registro] || anterior.tipo_registro} em ${formatDate(dataAnterior)}).`
      );
    }

    const tAnterior = anterior.tipo_registro;
    const tAtual = atual.tipo_registro;

    const transicaoValida =
      (tAnterior === 'Saída Férias' && (tAtual === 'Interrupção de Férias' || tAtual === 'Retorno Férias')) ||
      (tAnterior === 'Interrupção de Férias' && tAtual === 'Nova Saída / Retomada') ||
      (tAnterior === 'Nova Saída / Retomada' && (tAtual === 'Interrupção de Férias' || tAtual === 'Retorno Férias'));

    if (!transicaoValida) {
      inconsistencias.push(
        `Sequência incomum entre ${NOMES_OPERACIONAIS[tAnterior] || tAnterior} e ${NOMES_OPERACIONAIS[tAtual] || tAtual}.`
      );
    }
  }

  return [...new Set(inconsistencias)];
}

export default function FamiliaFeriasPanel({ ferias, registrosLivro, onClose }) {
  if (!ferias) return null;

  const eventosVinculados = useMemo(() => {
    return montarCadeia(
      ferias,
      registrosLivro.filter(
        (r) => r.ferias_id === ferias.id && TIPOS_OPERACIONAIS.includes(r.tipo_registro)
      )
    ).sort(compareEvents);
  }, [registrosLivro, ferias]);

  const totalEventos = eventosVinculados.length;
  const possuiEventosPendentes = eventosVinculados.some((e) => !e.numero_bg);

  const estadoCadeia = useMemo(() => {
    return getEstadoAtualDaCadeia(eventosVinculados);
  }, [eventosVinculados]);

  const inconsistencias = useMemo(() => {
    return detectarInconsistencias(eventosVinculados);
  }, [eventosVinculados]);

  const ultimaInterrupcao = useMemo(() => {
    return [...eventosVinculados]
      .filter((e) => e.tipo_registro === 'Interrupção de Férias')
      .sort(compareEvents)
      .pop();
  }, [eventosVinculados]);

  const indicadores = useMemo(() => {
    const diasTotais = Number(ferias.dias || 0);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    if (ferias.status === 'Em Curso' && ferias.data_inicio) {
      const inicio = new Date(`${ferias.data_inicio}T00:00:00`);
      const gozados = Math.min(Math.max(0, differenceInDays(hoje, inicio) + 1), diasTotais);
      const restantes = Math.max(0, diasTotais - gozados);

      return {
        tipo: 'em_curso',
        diasTotais,
        gozados,
        restantes,
      };
    }

    if (ferias.status === 'Interrompida') {
      const derivado = deriveEventoInterrupcao(ferias, ultimaInterrupcao);

      return {
        tipo: 'interrompida',
        diasTotais: derivado.diasNoMomento ?? diasTotais,
        gozados: derivado.gozados,
        saldo: derivado.saldo,
        dataInterrupcao: ultimaInterrupcao?.data_registro || null,
      };
    }

    return null;
  }, [ferias, ultimaInterrupcao]);

  const resumoCadeia = useMemo(() => {
    const ultimo = estadoCadeia.ultimoEvento;
    const dataUltimo = getEventDate(ultimo);

    return {
      statusAtual: estadoCadeia.status,
      ultimoEventoNome: ultimo ? (NOMES_OPERACIONAIS[ultimo.tipo_registro] || ultimo.tipo_registro) : '—',
      ultimoEventoData: dataUltimo ? formatDate(dataUltimo) : '—',
      cadeiaSaudavel: inconsistencias.length === 0,
    };
  }, [estadoCadeia, inconsistencias]);

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-[460px] bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200 overflow-hidden">
      <div className="bg-[#1e3a5f] text-white px-5 py-4 flex items-start justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
            <GitBranch className="w-5 h-5 text-blue-200" />
          </div>
          <div>
            <h2 className="font-bold text-base leading-tight">Rastro da Família</h2>
            <p className="text-xs text-white/60">Cadeia completa de eventos das férias</p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="text-white/70 hover:text-white hover:bg-white/10 mt-0.5"
          onClick={onClose}
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-[#1e3a5f]" />
            <span className="text-xs font-bold text-[#1e3a5f] uppercase tracking-wide">
              Identificação
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Militar</span>
              <span className="text-sm font-semibold text-slate-800 text-right">
                {ferias.militar_posto ? `${ferias.militar_posto} ` : ''}
                {ferias.militar_nome}
              </span>
            </div>

            {ferias.militar_matricula && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">Matrícula</span>
                <span className="text-sm text-slate-700">{ferias.militar_matricula}</span>
              </div>
            )}

            {ferias.periodo_aquisitivo_ref && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">Período Aquisitivo</span>
                <span className="text-sm font-medium text-slate-700">{ferias.periodo_aquisitivo_ref}</span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Status</span>
              <Badge className={`${statusColors[ferias.status] || 'bg-slate-100 text-slate-600'} text-xs`}>
                {ferias.status}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 mt-2">
              <div className="text-center">
                <p className="text-xs text-slate-400">Atual</p>
                <p className="text-lg font-bold text-[#1e3a5f]">{ferias.dias || 0}d</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400">Início</p>
                <p className="text-xs font-semibold text-slate-700">{formatDate(ferias.data_inicio)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400">Retorno</p>
                <p className="text-xs font-semibold text-slate-700">{formatDate(ferias.data_retorno)}</p>
              </div>
            </div>
          </div>
        </div>

        <div
          className={`rounded-xl border p-4 ${
            resumoCadeia.cadeiaSaudavel
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <div className="flex items-center gap-2 mb-3">
            {resumoCadeia.cadeiaSaudavel ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600" />
            )}
            <span
              className={`text-xs font-bold uppercase tracking-wide ${
                resumoCadeia.cadeiaSaudavel ? 'text-emerald-700' : 'text-red-700'
              }`}
            >
              Estado da Cadeia
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-white/70 rounded-lg border border-white/60 p-3">
              <p className="text-xs text-slate-400 mb-1">Status atual</p>
              <p className="font-semibold text-slate-800">{resumoCadeia.statusAtual}</p>
            </div>

            <div className="bg-white/70 rounded-lg border border-white/60 p-3">
              <p className="text-xs text-slate-400 mb-1">Último evento válido</p>
              <p className="font-semibold text-slate-800">{resumoCadeia.ultimoEventoNome}</p>
              <p className="text-xs text-slate-500 mt-0.5">{resumoCadeia.ultimoEventoData}</p>
            </div>
          </div>

          {!resumoCadeia.cadeiaSaudavel && (
            <div className="mt-3 text-xs text-red-700">
              Foram encontradas inconsistências cronológicas ou de sequência nesta família.
            </div>
          )}
        </div>

        {inconsistencias.length > 0 && (
          <div className="bg-red-50 rounded-xl border border-red-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span className="text-xs font-bold text-red-700 uppercase tracking-wide">
                Inconsistências Encontradas
              </span>
            </div>

            <div className="space-y-2">
              {inconsistencias.map((item, idx) => (
                <div
                  key={`${item}-${idx}`}
                  className="text-sm text-red-700 bg-white/70 border border-red-100 rounded-lg p-3"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        )}

        {indicadores?.tipo === 'em_curso' && (
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Timer className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">
                Em Curso — Indicadores
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white rounded-lg border border-amber-100 p-2">
                <p className="text-xs text-slate-400 mb-0.5">Atual</p>
                <p className="text-xl font-bold text-[#1e3a5f]">{indicadores.diasTotais}</p>
                <p className="text-[10px] text-slate-400">dias</p>
              </div>

              <div className="bg-amber-100 rounded-lg border border-amber-200 p-2">
                <p className="text-xs text-amber-600 mb-0.5">Gozados</p>
                <p className="text-xl font-bold text-amber-700">{indicadores.gozados}</p>
                <p className="text-[10px] text-amber-500">até hoje</p>
              </div>

              <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-2">
                <p className="text-xs text-emerald-600 mb-0.5">Restantes</p>
                <p className="text-xl font-bold text-emerald-700">{indicadores.restantes}</p>
                <p className="text-[10px] text-emerald-500">dias</p>
              </div>
            </div>
          </div>
        )}

        {indicadores?.tipo === 'interrompida' && (
          <div className="bg-orange-50 rounded-xl border border-orange-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="w-4 h-4 text-orange-600" />
              <span className="text-xs font-bold text-orange-700 uppercase tracking-wide">
                Interrompida — Indicadores
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white rounded-lg border border-orange-100 p-2">
                <p className="text-xs text-slate-400 mb-0.5">Atual</p>
                <p className="text-xl font-bold text-[#1e3a5f]">{indicadores.diasTotais}</p>
                <p className="text-[10px] text-slate-400">dias</p>
              </div>

              <div className="bg-orange-100 rounded-lg border border-orange-200 p-2">
                <p className="text-xs text-orange-600 mb-0.5">Gozados</p>
                <p className="text-xl font-bold text-orange-700">
                  {indicadores.gozados != null ? `${indicadores.gozados}d` : '—'}
                </p>
                <p className="text-[10px] text-orange-500">até interrupção</p>
              </div>

              <div className="bg-blue-50 rounded-lg border border-blue-200 p-2">
                <p className="text-xs text-blue-600 mb-0.5">Saldo</p>
                <p className="text-xl font-bold text-blue-700">
                  {indicadores.saldo != null ? `${indicadores.saldo}d` : '—'}
                </p>
                <p className="text-[10px] text-blue-500">remanescente</p>
              </div>
            </div>

            {indicadores.dataInterrupcao && (
              <p className="text-xs text-orange-600 mt-2 text-center">
                Interrompida em: <strong>{formatDate(indicadores.dataInterrupcao)}</strong>
              </p>
            )}
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Sequência de Eventos ({totalEventos})
            </span>

            {estadoCadeia.ultimoEvento && (
              <div className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                <Clock3 className="w-3.5 h-3.5" />
                <span>Atual: {NOMES_OPERACIONAIS[estadoCadeia.ultimoEvento.tipo_registro] || estadoCadeia.ultimoEvento.tipo_registro}</span>
              </div>
            )}
          </div>

          {totalEventos === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Calendar className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhum evento de livro vinculado</p>
              <p className="text-xs mt-1">Use “Iniciar Férias” para registrar a saída</p>
            </div>
          ) : (
            <div className="relative">
              {totalEventos > 1 && (
                <div className="absolute left-5 top-5 bottom-5 w-0.5 bg-slate-200 z-0" />
              )}

              <div className="space-y-3">
                {eventosVinculados.map((evento, idx) => {
                  const cfg = tipoEventoConfig[evento.tipo_registro] || tipoEventoConfig.default;
                  const IconComp = cfg.icon;
                  const pubStatus = calcPubStatus(evento);
                  const interrupcaoDerivada =
                    evento.tipo_registro === 'Interrupção de Férias'
                      ? deriveEventoInterrupcao(ferias, evento)
                      : null;

                  const isUltimoEvento =
                    estadoCadeia.ultimoEvento && evento.id === estadoCadeia.ultimoEvento.id;

                  return (
                    <div key={evento.id} className="relative flex gap-3 z-10">
                      <div
                        className={`w-10 h-10 rounded-full ${cfg.bg} border-2 ${cfg.border} flex items-center justify-center shrink-0`}
                      >
                        <IconComp className={`w-4 h-4 ${cfg.color}`} />
                      </div>

                      <div
                        className={`flex-1 bg-white rounded-xl border p-3 shadow-sm ${
                          isUltimoEvento
                            ? 'border-[#1e3a5f] ring-2 ring-[#1e3a5f]/10'
                            : 'border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-400">#{idx + 1}</span>
                            <span className="text-sm font-semibold text-slate-800">
                              {NOMES_OPERACIONAIS[evento.tipo_registro] || evento.tipo_registro}
                            </span>
                            {isUltimoEvento && (
                              <Badge className="bg-[#1e3a5f]/10 text-[#1e3a5f] text-[10px]">
                                Atual
                              </Badge>
                            )}
                          </div>

                          <Badge
                            className={`${pubStatusColors[pubStatus] || 'bg-slate-100 text-slate-600'} text-xs shrink-0`}
                          >
                            {pubStatus}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          {evento.data_registro && (
                            <>
                              <span className="text-slate-400">Data Registro</span>
                              <span className="text-slate-700 font-medium">{formatDate(evento.data_registro)}</span>
                            </>
                          )}

                          {(evento.tipo_registro === 'Saída Férias' || evento.tipo_registro === 'Retorno Férias') &&
                            evento.dias != null && (
                              <>
                                <span className="text-slate-400">Dias</span>
                                <span className="text-slate-700 font-medium">{Number(evento.dias)}d</span>
                              </>
                            )}

                          {evento.tipo_registro === 'Interrupção de Férias' && (
                            <>
                              <span className="text-slate-400">Dias no momento</span>
                              <span className="text-slate-700 font-medium">
                                {interrupcaoDerivada?.diasNoMomento != null
                                  ? `${interrupcaoDerivada.diasNoMomento}d`
                                  : '—'}
                              </span>
                            </>
                          )}

                          {evento.tipo_registro === 'Interrupção de Férias' && (
                            <>
                              <span className="text-slate-400">Gozados</span>
                              <span className="text-orange-700 font-medium">
                                {interrupcaoDerivada?.gozados != null
                                  ? `${interrupcaoDerivada.gozados}d`
                                  : '—'}
                              </span>
                            </>
                          )}

                          {evento.tipo_registro === 'Interrupção de Férias' && (
                            <>
                              <span className="text-slate-400">Saldo</span>
                              <span className="text-blue-700 font-medium">
                                {interrupcaoDerivada?.saldo != null
                                  ? `${interrupcaoDerivada.saldo}d`
                                  : '—'}
                              </span>
                            </>
                          )}

                          {evento.tipo_registro === 'Nova Saída / Retomada' && (
                            <>
                              <span className="text-slate-400">Saldo retomado</span>
                              <span className="text-slate-700 font-medium">
                                {evento.dias != null ? `${Number(evento.dias)}d` : '—'}
                              </span>
                            </>
                          )}

                          {evento.numero_bg && (
                            <>
                              <span className="text-slate-400">BG Nº</span>
                              <span className="text-emerald-700 font-semibold">{evento.numero_bg}</span>
                            </>
                          )}

                          {evento.data_bg && evento.numero_bg && (
                            <>
                              <span className="text-slate-400">Data BG</span>
                              <span className="text-emerald-700 font-medium">{formatDate(evento.data_bg)}</span>
                            </>
                          )}

                          {evento.nota_para_bg && !evento.numero_bg && (
                            <>
                              <span className="text-slate-400">Nota BG</span>
                              <span className="text-blue-700 font-medium">{evento.nota_para_bg}</span>
                            </>
                          )}
                        </div>

                        {evento.texto_publicacao ? (
                          <div className="mt-2 text-[11px] text-slate-500 italic">
                            Texto vinculado à publicação disponível.
                          </div>
                        ) : (
                          <div className="mt-2 text-[11px] text-slate-400 italic">
                            Sem publicação vinculada
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {possuiEventosPendentes && (
        <div className="shrink-0 px-5 py-4 border-t border-slate-200 bg-amber-50">
          <div className="flex gap-2 text-amber-700 text-sm">
            <Calendar className="w-4 h-4 mt-0.5 shrink-0" />
            <p>Atenção: existem eventos pendentes de publicação nesta família.</p>
          </div>
        </div>
      )}
    </div>
  );
}