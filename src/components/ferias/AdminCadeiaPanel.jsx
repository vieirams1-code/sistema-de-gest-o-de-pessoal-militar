import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import {
  ShieldAlert,
  Trash2,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import {
  montarCadeia,
  identificarDescendentes,
  executarExclusaoAdminCadeia,
  recalcularCadeiaCompleta,
} from './feriasAdminUtils';

function formatDate(d) {
  if (!d) return '—';
  try {
    return format(new Date(`${d}T00:00:00`), 'dd/MM/yyyy');
  } catch {
    return d;
  }
}

const statusResultante = {
  Prevista: 'bg-slate-100 text-slate-700',
  'Em Curso': 'bg-amber-100 text-amber-700',
  Gozada: 'bg-emerald-100 text-emerald-700',
  Interrompida: 'bg-orange-100 text-orange-700',
};

export default function AdminCadeiaPanel({ ferias, registrosLivro, modoAdmin = false }) {
  const queryClient = useQueryClient();
  const { isAdmin, canAccessAction } = useCurrentUser();
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState(null);

  const cadeia = montarCadeia(ferias, registrosLivro);

  const handleRecalcular = async () => {
    if (!isAdmin || !canAccessAction('admin_mode') || !modoAdmin || !canAccessAction('recalcular_ferias')) {
      setFeedback({ type: 'error', msg: 'Ative o modo admin e certifique-se de ter permissão para recalcular férias.' });
      return;
    }
    setLoading(true);
    setFeedback(null);

    try {
      const resultado = await recalcularCadeiaCompleta({
        ferias,
        cadeia,
        queryClient,
      });

      setFeedback({
        type: 'success',
        msg: `Cadeia recalculada. Novo status: ${resultado.status}`,
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        msg: error?.message || 'Erro ao recalcular a cadeia.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleIniciarExclusao = (evento, incluirDescendentes) => {
    if (!isAdmin || !canAccessAction('admin_mode') || !modoAdmin || !canAccessAction('gerir_cadeia_ferias')) {
      setFeedback({ type: 'error', msg: 'Ative o modo admin e certifique-se de ter permissão para gerir cadeia.' });
      return;
    }

    const descendentes = identificarDescendentes(evento, cadeia);

    if (!incluirDescendentes && descendentes.length > 0) {
      setFeedback({
        type: 'error',
        msg: 'Este evento possui descendentes e não pode ser excluído isoladamente. Use “Excluir este + descendentes”.',
      });
      return;
    }

    setConfirmarExclusao({ evento, incluirDescendentes });
    setFeedback(null);
  };

  const handleConfirmarExclusao = async () => {
    if (!confirmarExclusao) return;
    if (!isAdmin || !canAccessAction('admin_mode') || !modoAdmin || !canAccessAction('gerir_cadeia_ferias')) {
      setFeedback({ type: 'error', msg: 'Ative o modo admin e certifique-se de ter permissão para gerir cadeia.' });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      await executarExclusaoAdminCadeia({
        ferias,
        eventoAlvo: confirmarExclusao.evento,
        incluirDescendentes: confirmarExclusao.incluirDescendentes,
        cadeia,
        queryClient,
      });

      setFeedback({
        type: 'success',
        msg: 'Exclusão realizada e cadeia recalculada.',
      });
      setConfirmarExclusao(null);
    } catch (error) {
      setFeedback({
        type: 'error',
        msg: error?.message || 'Erro ao excluir evento(s) da cadeia.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelarExclusao = () => {
    setConfirmarExclusao(null);
  };

  const previewExclusao = confirmarExclusao
    ? (() => {
        const descendentes = identificarDescendentes(confirmarExclusao.evento, cadeia);
        const idsAfetados = confirmarExclusao.incluirDescendentes
          ? [confirmarExclusao.evento.id, ...descendentes.map((d) => d.id)]
          : [confirmarExclusao.evento.id];

        const sobreviventes = cadeia.filter((e) => !idsAfetados.includes(e.id));

        return {
          descendentes,
          idsAfetados,
          sobreviventes,
        };
      })()
    : null;

  return (
    <div className="mt-4 rounded-xl border border-red-200 bg-red-50/40 overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-red-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-red-600" />
          <span className="text-sm font-bold text-red-700 uppercase tracking-wide">
            Administração da Cadeia
          </span>
          <span className="text-[10px] text-red-400 font-semibold bg-red-100 px-1.5 py-0.5 rounded">
            ADMIN
          </span>
        </div>

        {expanded ? (
          <ChevronUp className="w-4 h-4 text-red-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-red-500" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {!modoAdmin && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-amber-50 text-amber-700 border border-amber-200">
              <Lock className="w-4 h-4 shrink-0" />
              Ative o <strong>modo admin</strong> na barra superior para desbloquear as ações destrutivas.
            </div>
          )}

          {feedback && (
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <Check className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              {feedback.msg}
            </div>
          )}

          <div className="bg-white rounded-lg border border-slate-200 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-700">Recalcular Cadeia</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Reconstrói status, saldo e período aquisitivo sem excluir nada.
                </p>
              </div>

              <Button
                size="sm"
                variant="outline"
                className="shrink-0 border-slate-300 hover:border-[#1e3a5f] hover:text-[#1e3a5f]"
                disabled={loading || !modoAdmin}
                onClick={handleRecalcular}
                title={!modoAdmin ? 'Ative o modo admin para usar esta função.' : ''}
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-1" />
                )}
                Recalcular
              </Button>
            </div>
          </div>

          {confirmarExclusao && previewExclusao && (
            <div className="bg-red-50 border border-red-300 rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <p className="text-sm font-bold text-red-700">Confirmar exclusão</p>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Evento alvo:
                </p>
                <div className="bg-white rounded border border-red-200 px-3 py-1.5 text-xs text-slate-700">
                  <strong>{confirmarExclusao.evento.tipo_registro}</strong> —{' '}
                  {formatDate(confirmarExclusao.evento.data_registro)}
                </div>
              </div>

              {confirmarExclusao.incluirDescendentes && previewExclusao.descendentes.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Descendentes que também serão excluídos:
                  </p>
                  <div className="space-y-1">
                    {previewExclusao.descendentes.map((d) => (
                      <div
                        key={d.id}
                        className="bg-white rounded border border-red-200 px-3 py-1 text-xs text-red-700"
                      >
                        {d.tipo_registro} — {formatDate(d.data_registro)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Eventos que sobrarão: {previewExclusao.sobreviventes.length}
                </p>

                {previewExclusao.sobreviventes.length === 0 ? (
                  <p className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded px-2 py-1">
                    Nenhum evento restante. Férias voltarão para <strong>Prevista</strong>.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {previewExclusao.sobreviventes.map((s) => (
                      <div
                        key={s.id}
                        className="bg-emerald-50 rounded border border-emerald-200 px-3 py-1 text-xs text-emerald-700"
                      >
                        {s.tipo_registro} — {formatDate(s.data_registro)}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {previewExclusao.sobreviventes.length > 0 && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    Revise os eventos remanescentes. A exclusão confirmada deve preservar uma cadeia lógica válida.
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white flex-1"
                    disabled={loading || !modoAdmin}
                    onClick={handleConfirmarExclusao}
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
                    ) : (
                      <Trash2 className="w-4 h-4 mr-1" />
                    )}
                    Confirmar Exclusão
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancelarExclusao}
                    disabled={loading}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!confirmarExclusao && cadeia.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Excluir Evento da Cadeia
              </p>

              {cadeia.map((evento, idx) => {
                const descendentes = identificarDescendentes(evento, cadeia);
                const temDescendentes = descendentes.length > 0;

                return (
                  <div
                    key={evento.id}
                    className="bg-white rounded-lg border border-slate-200 px-3 py-2 flex items-center justify-between gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] text-slate-400 font-semibold">#{idx + 1}</span>
                        <span className="text-xs font-semibold text-slate-700 truncate">
                          {evento.tipo_registro}
                        </span>

                        {temDescendentes && (
                          <Badge className="bg-amber-100 text-amber-700 text-[10px]">
                            +{descendentes.length} descendente(s)
                          </Badge>
                        )}
                      </div>

                      <p className="text-xs text-slate-400">
                        {formatDate(evento.data_registro)}
                        {evento.dias ? ` · ${evento.dias}d` : ''}
                      </p>

                      {temDescendentes && (
                        <p className="text-[11px] text-amber-700 mt-1">
                          Este evento não pode ser excluído isoladamente.
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {temDescendentes ? (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs text-slate-400 h-7 px-2 cursor-not-allowed"
                            title="Este evento possui descendentes e não pode ser excluído isoladamente"
                            disabled
                          >
                            <Lock className="w-3.5 h-3.5 mr-1" />
                            Só este
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs text-red-700 hover:text-red-800 hover:bg-red-100 h-7 px-2"
                            title={!modoAdmin ? 'Ative o modo admin' : `Excluir este + ${descendentes.length} descendente(s)`}
                            disabled={!modoAdmin}
                            onClick={() => modoAdmin && handleIniciarExclusao(evento, true)}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" />
                            +{descendentes.length} desc.
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 h-7 px-2"
                          disabled={!modoAdmin}
                          title={!modoAdmin ? 'Ative o modo admin' : ''}
                          onClick={() => modoAdmin && handleIniciarExclusao(evento, false)}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          Excluir
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}

              {cadeia.length === 0 && (
                <p className="text-xs text-slate-400 italic">
                  Nenhum evento na cadeia para excluir.
                </p>
              )}
            </div>
          )}

          <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              Ações administrativas. Use somente em ambiente de teste ou para corrigir inconsistências reais.
              Toda exclusão é irreversível.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}