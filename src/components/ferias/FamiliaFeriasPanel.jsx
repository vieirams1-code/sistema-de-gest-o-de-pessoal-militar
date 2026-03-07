import React, { useMemo } from 'react';
import { X, GitBranch, Calendar, AlertTriangle, CheckCircle, Clock, PauseCircle, LogOut, LogIn, FileText, PlusCircle, MinusCircle, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AdminCadeiaPanel from './AdminCadeiaPanel';

const statusColors = {
  'Prevista': 'bg-slate-100 text-slate-700',
  'Em Curso': 'bg-amber-100 text-amber-700',
  'Gozada': 'bg-emerald-100 text-emerald-700',
  'Interrompida': 'bg-orange-100 text-orange-700',
};

const pubStatusColors = {
  'Aguardando Nota': 'bg-amber-100 text-amber-700',
  'Aguardando Publicação': 'bg-blue-100 text-blue-700',
  'Publicado': 'bg-emerald-100 text-emerald-700',
};

const tipoEventoConfig = {
  'Saída Férias':             { icon: LogOut,      color: 'text-emerald-600', bg: 'bg-emerald-100', border: 'border-emerald-300', label: 'Saída' },
  'Retorno Férias':           { icon: LogIn,       color: 'text-blue-600',    bg: 'bg-blue-100',    border: 'border-blue-300',    label: 'Retorno' },
  'Interrupção de Férias':    { icon: PauseCircle, color: 'text-orange-600',  bg: 'bg-orange-100',  border: 'border-orange-300',  label: 'Interrupção' },
  'Nova Saída / Retomada':    { icon: RefreshCw,   color: 'text-teal-600',    bg: 'bg-teal-100',    border: 'border-teal-300',    label: 'Retomada' },
  'Adição de Dias':           { icon: PlusCircle,  color: 'text-purple-600',  bg: 'bg-purple-100',  border: 'border-purple-300',  label: 'Adição' },
  'Desconto em Férias':       { icon: MinusCircle, color: 'text-rose-600',    bg: 'bg-rose-100',    border: 'border-rose-300',    label: 'Desconto' },
  'Dispensa Desconto Férias': { icon: MinusCircle, color: 'text-rose-600',    bg: 'bg-rose-100',    border: 'border-rose-300',    label: 'Desconto' },
  'default':                  { icon: FileText,    color: 'text-slate-600',   bg: 'bg-slate-100',   border: 'border-slate-300',   label: null },
};

function formatDate(d) {
  if (!d) return '—';
  try { return format(new Date(d + 'T00:00:00'), 'dd/MM/yyyy'); } catch { return d; }
}

function calcPubStatus(r) {
  if (r.numero_bg && r.data_bg) return 'Publicado';
  if (r.nota_para_bg) return 'Aguardando Publicação';
  return 'Aguardando Nota';
}

export default function FamiliaFeriasPanel({ ferias, registrosLivro, onClose, currentUser }) {
  if (!ferias) return null;

  // Eventos de livro vinculados a esta férias
  const eventosVinculados = useMemo(() => {
    return registrosLivro
      .filter(r => r.ferias_id === ferias.id)
      .sort((a, b) => {
        const da = new Date(a.data_registro || a.created_date || 0);
        const db = new Date(b.data_registro || b.created_date || 0);
        return da - db;
      });
  }, [registrosLivro, ferias.id]);

  const totalEventos = eventosVinculados.length;
  const possuiEventosPendentes = eventosVinculados.some(e => !e.numero_bg);

  // Saldo de dias se interrompida
  let saldoDias = null;
  if (ferias.status === 'Interrompida' && ferias.observacoes) {
    const match = ferias.observacoes.match(/Saldo: (\d+) dias/);
    if (match) saldoDias = parseInt(match[1]);
  }

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-[440px] bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200 overflow-hidden">
      {/* Header */}
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

      {/* Scroll area */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        {/* Identificação da Família */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-[#1e3a5f]" />
            <span className="text-xs font-bold text-[#1e3a5f] uppercase tracking-wide">Identificação</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Militar</span>
              <span className="text-sm font-semibold text-slate-800">
                {ferias.militar_posto ? `${ferias.militar_posto} ` : ''}{ferias.militar_nome}
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
                <p className="text-xs text-slate-400">Total</p>
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
            {saldoDias !== null && (
              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center gap-2 p-2 bg-orange-50 rounded-lg border border-orange-200">
                  <PauseCircle className="w-4 h-4 text-orange-600 shrink-0" />
                  <p className="text-xs text-orange-700 font-medium">Saldo após interrupção: <strong>{saldoDias} dias</strong></p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sequência de Eventos */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Sequência de Eventos ({totalEventos})
            </span>
          </div>

          {totalEventos === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Calendar className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhum evento de livro vinculado</p>
              <p className="text-xs mt-1">Use "Iniciar Férias" para registrar a saída</p>
            </div>
          ) : (
            <div className="relative">
              {/* Linha vertical conectora */}
              {totalEventos > 1 && (
                <div className="absolute left-5 top-5 bottom-5 w-0.5 bg-slate-200 z-0" />
              )}
              <div className="space-y-3">
                {eventosVinculados.map((evento, idx) => {
                  const cfg = tipoEventoConfig[evento.tipo_registro] || tipoEventoConfig['default'];
                  const IconComp = cfg.icon;
                  const pubStatus = calcPubStatus(evento);

                  return (
                    <div key={evento.id} className="relative flex gap-3 z-10">
                      {/* Ícone da linha do tempo */}
                      <div className={`w-10 h-10 rounded-full ${cfg.bg} border-2 ${cfg.border} flex items-center justify-center shrink-0`}>
                        <IconComp className={`w-4 h-4 ${cfg.color}`} />
                      </div>

                      {/* Card do evento */}
                      <div className="flex-1 bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500">#{idx + 1}</span>
                            <span className="text-sm font-semibold text-slate-800">{evento.tipo_registro}</span>
                          </div>
                          <Badge className={`${pubStatusColors[pubStatus] || 'bg-slate-100 text-slate-600'} text-xs shrink-0`}>
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
                          {evento.data_inicio && (
                            <>
                              <span className="text-slate-400">Início</span>
                              <span className="text-slate-700 font-medium">{formatDate(evento.data_inicio)}</span>
                            </>
                          )}
                          {evento.dias && (
                            <>
                              <span className="text-slate-400">Dias</span>
                              <span className="text-slate-700 font-medium">{evento.dias}d</span>
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

                        {/* Sem publicação vinculada */}
                        {!evento.nota_para_bg && !evento.numero_bg && (
                          <p className="mt-2 text-xs text-slate-400 italic">Sem publicação vinculada</p>
                        )}

                        {evento.observacoes && (
                          <p className="mt-2 text-xs text-slate-500 italic border-t border-slate-100 pt-1">
                            {evento.observacoes}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {currentUser?.role === 'admin' && (
          <AdminCadeiaPanel ferias={ferias} registrosLivro={registrosLivro} />
        )}
      </div>

      {possuiEventosPendentes && (
        <div className="shrink-0 border-t border-slate-200 bg-amber-50 px-5 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              <strong>Atenção:</strong> Existem eventos pendentes de publicação nesta família.
              Não exclua eventos intermediários se houver eventos posteriores dependentes deles.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}