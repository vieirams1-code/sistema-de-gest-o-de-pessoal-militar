import React, { useMemo } from 'react';
import { CalendarClock, CalendarX, UserX, PenLine, PauseCircle } from 'lucide-react';
import { classificarPrazo, getStatusBadgeClass } from '@/utils/controle-processos/controleProcessosConfig';

function diasParados(processo) {
  const ref = processo.updated_date || processo.created_date;
  if (!ref) return 0;
  const dataRef = new Date(ref).getTime();
  if (Number.isNaN(dataRef)) return 0;
  const diff = (Date.now() - dataRef) / (1000 * 60 * 60 * 24);
  return Math.floor(diff);
}

function Card({ icon: Icon, titulo, cor, processos, onVer }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className={`rounded-lg p-2 ${cor}`}><Icon className="w-4 h-4" /></div>
        <h3 className="font-semibold text-sm text-slate-800">{titulo}</h3>
        <span className="ml-auto text-lg font-bold text-slate-900">{processos.length}</span>
      </div>
      <div className="space-y-1.5 max-h-56 overflow-y-auto">
        {processos.length === 0 ? (
          <p className="text-xs text-slate-400">Nenhum processo.</p>
        ) : (
          processos.map((p) => (
            <button
              key={p.id}
              onClick={() => onVer(p)}
              className="w-full text-left rounded-md border border-slate-100 px-2.5 py-1.5 hover:bg-slate-50"
            >
              <p className="text-xs font-medium text-slate-800 truncate">{p.titulo}</p>
              <span className={`mt-0.5 inline-block text-[10px] px-1.5 py-0.5 rounded ${getStatusBadgeClass(p.status)}`}>{p.status}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export default function PrazosPanel({ processos = [], onVer }) {
  const grupos = useMemo(() => {
    const ativos = (processos || []).filter((p) => !p.arquivado && p.status !== 'Concluído' && p.status !== 'Cancelado');
    return {
      hoje: ativos.filter((p) => classificarPrazo(p.prazo) === 'hoje'),
      proximo: ativos.filter((p) => classificarPrazo(p.prazo) === 'proximo'),
      atrasados: ativos.filter((p) => classificarPrazo(p.prazo) === 'atrasado'),
      semResponsavel: ativos.filter((p) => !p.responsavel_id),
      aguardandoAssinatura: ativos.filter((p) => p.status === 'Aguardando assinatura'),
      parados: ativos.filter((p) => diasParados(p) > 7),
    };
  }, [processos]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <Card icon={CalendarClock} titulo="Vencem hoje" cor="bg-orange-100 text-orange-700" processos={grupos.hoje} onVer={onVer} />
      <Card icon={CalendarClock} titulo="Vencem em até 3 dias" cor="bg-amber-100 text-amber-700" processos={grupos.proximo} onVer={onVer} />
      <Card icon={CalendarX} titulo="Atrasados" cor="bg-red-100 text-red-700" processos={grupos.atrasados} onVer={onVer} />
      <Card icon={UserX} titulo="Sem responsável" cor="bg-slate-100 text-slate-700" processos={grupos.semResponsavel} onVer={onVer} />
      <Card icon={PenLine} titulo="Aguardando assinatura" cor="bg-indigo-100 text-indigo-700" processos={grupos.aguardandoAssinatura} onVer={onVer} />
      <Card icon={PauseCircle} titulo="Parados há mais de 7 dias" cor="bg-purple-100 text-purple-700" processos={grupos.parados} onVer={onVer} />
    </div>
  );
}
