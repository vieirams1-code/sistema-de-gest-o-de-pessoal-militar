import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, History } from 'lucide-react';
import RankIcon from './RankIcon';

const STATUS_BADGE = { ativo: 'bg-emerald-100 text-emerald-800 border-emerald-200', pendente: 'bg-amber-100 text-amber-800 border-amber-200', retificado: 'bg-blue-100 text-blue-800 border-blue-200', cancelado: 'bg-rose-100 text-rose-800 border-rose-200', previsto: 'bg-indigo-100 text-indigo-800 border-indigo-200' };

function Info({ label, value }) { return <div><p className="text-[11px] text-slate-500 uppercase tracking-wide">{label}</p><p className="font-medium text-slate-800">{value}</p></div>; }

export default function PromocoesTimeline({ historico, promocaoAtual, canManage, isRegistroIncompativel, isRegistroIncompleto, onOpenPromocaoHistoricaModal, onDetalhe, onRetificar, onEditarPrevisao, onCancelar }) {
  return <div className="space-y-4">
    <div className="flex justify-end">{canManage && <Button size="sm" variant="outline" className="border-slate-300 text-slate-700" onClick={onOpenPromocaoHistoricaModal}><History className="w-4 h-4 mr-1" />Adicionar registro histórico anterior</Button>}</div>
    {historico.map((h) => {
      const isAtual = promocaoAtual?.id === h.id;
      const statusLower = String(h.status_registro || '').toLowerCase();
      const isCancelado = statusLower === 'cancelado';
      const isRetificado = statusLower === 'retificado';
      const isPrevista = statusLower === 'previsto';
      const showPostoAtual = statusLower === 'ativo' && isAtual;
      const cardClass = isCancelado
        ? 'bg-rose-50/40 border-rose-200'
        : isRetificado
          ? 'bg-blue-50/30 border-blue-200'
          : isPrevista
            ? 'bg-amber-50/20 border-amber-200'
            : showPostoAtual
              ? 'bg-blue-50/40 border-blue-200'
              : 'bg-white border-slate-200';

      return <div key={h.id} className="group relative pl-16 pb-1">
        <div className={`absolute left-6 top-1 bottom-0 w-px ${isCancelado ? 'border-l-2 border-dashed border-rose-300 bg-transparent' : isRetificado ? 'border-l-2 border-dashed border-blue-300 bg-transparent' : isPrevista ? 'border-l-2 border-dashed border-amber-300 bg-transparent' : 'bg-gradient-to-b from-slate-300 via-slate-200 to-transparent'}`} />
        <div className="absolute top-0 bottom-0 -left-[61px] flex justify-center w-12 h-12 z-10">
          <div
            className={`absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 flex items-center justify-center w-auto min-w-[2.5rem] px-2.5 h-11 rounded-full border-4 border-white shadow-sm transition-transform group-hover:scale-105 ${showPostoAtual ? 'bg-blue-50 ring-2 ring-blue-500' : isCancelado ? 'bg-rose-50 ring-1 ring-rose-300' : isRetificado ? 'bg-blue-50 ring-1 ring-blue-300' : isPrevista ? 'bg-amber-50 ring-1 ring-amber-300' : 'bg-slate-50 ring-1 ring-slate-200'}`}
          >
            <RankIcon postoGraduacao={h.posto_graduacao_novo || h.posto_graduacao_anterior} />
          </div>
        </div>
        <div className={`rounded-xl border p-4 space-y-3 shadow-sm ${cardClass}`}>
          <div className="flex flex-wrap gap-2 items-center">
            <Badge className={`${STATUS_BADGE[h.status_registro] || STATUS_BADGE.pendente} border`}>{h.status_registro || 'pendente'}</Badge>
            {showPostoAtual && <Badge className="border border-blue-300 text-blue-700 bg-blue-100">Posto Atual</Badge>}
            {isPrevista && <Badge className="border border-amber-300 text-amber-800 bg-amber-100">Previsão / Futura</Badge>}
            {isRegistroIncompativel(h) && <Badge variant="outline" className="border-rose-200 text-rose-700">Registro incompatível</Badge>}
            {isRegistroIncompleto(h) && <Badge variant="outline" className="border-amber-200 text-amber-700">Registro incompleto</Badge>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
            <Info label="Posto/graduação anterior" value={h.posto_graduacao_anterior || '—'} />
            <Info label="Posto/graduação novo" value={h.posto_graduacao_novo || '—'} />
            <Info label="Quadro" value={h.quadro_novo || '—'} />
            <Info label="Data da promoção" value={h.data_promocao || '—'} />
            <Info label="Nº/ordem de antiguidade" value={h.antiguidade_referencia_ordem ?? '—'} />
            <Info label="DOEMS / boletim / ato" value={h.boletim_referencia || h.ato_referencia || '—'} />
            <Info label="Observações" value={h.observacoes || '—'} />
            <Info label="Origem do dado" value={h.origem_dado || '—'} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="border-slate-300 text-slate-700" onClick={() => onDetalhe(h)}><FileText className="w-4 h-4 mr-1" />Ver detalhes</Button>
            {isPrevista && !isCancelado && !isRetificado && <Button size="sm" variant="outline" className="border-slate-300 text-slate-700" disabled={!canManage} onClick={() => onEditarPrevisao?.(h)}>Editar previsão</Button>}
            {!isPrevista && !isCancelado && !isRetificado && <Button size="sm" variant="outline" className="border-slate-300 text-slate-700" disabled={!canManage} onClick={() => onRetificar(h)}>Retificar</Button>}
            {!isCancelado && !isRetificado && <Button size="sm" variant="outline" className="border-rose-300 text-rose-700 hover:bg-rose-50" disabled={!canManage} onClick={() => onCancelar(h)}>Cancelar</Button>}
          </div>
        </div>
      </div>;
    })}
  </div>;
}
