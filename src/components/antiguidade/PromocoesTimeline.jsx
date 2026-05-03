import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';
import RankIcon from './RankIcon';

const STATUS_BADGE = { ativo: 'bg-emerald-100 text-emerald-800', pendente: 'bg-amber-100 text-amber-800', retificado: 'bg-blue-100 text-blue-800', cancelado: 'bg-rose-100 text-rose-800', previsto: 'bg-indigo-100 text-indigo-800' };

function Info({ label, value }) { return <div><p className="text-xs text-slate-500 uppercase">{label}</p><p className="font-medium text-slate-800">{value}</p></div>; }

export default function PromocoesTimeline({ historico, promocaoAtual, canManage, isRegistroIncompativel, isRegistroIncompleto, onOpenPromocaoHistoricaModal, onDetalhe, onRetificar, onCancelar }) {
  return <div className="space-y-4">
    <div className="flex justify-end">{canManage && <Button size="sm" variant="secondary" onClick={onOpenPromocaoHistoricaModal}>Adicionar registro histórico anterior</Button>}</div>
    {historico.map((h) => <div key={h.id} className="relative pl-14">
      <div className="absolute left-6 top-0 bottom-0 w-px bg-slate-200" />
      <div className="absolute left-0 top-2"><RankIcon postoGraduacao={h.posto_graduacao_novo || h.posto_graduacao_anterior} className="w-12 h-12" /></div>
      <div className="border rounded-md p-3 space-y-2 bg-white">
        <div className="flex flex-wrap gap-2 items-center">
          <Badge className={STATUS_BADGE[h.status_registro] || STATUS_BADGE.pendente}>{h.status_registro || 'pendente'}</Badge>
          {promocaoAtual?.id === h.id && <Badge variant="outline">Posto Atual</Badge>}
          {String(h.status_registro || '').toLowerCase() === 'previsto' && <Badge variant="outline">Previsão / Futura</Badge>}
          {isRegistroIncompativel(h) && <Badge variant="outline">Registro incompatível</Badge>}
          {isRegistroIncompleto(h) && <Badge variant="outline">Registro incompleto</Badge>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
          <Info label="Posto/graduação anterior" value={h.posto_graduacao_anterior || '—'} />
          <Info label="Posto/graduação novo" value={h.posto_graduacao_novo || '—'} />
          <Info label="Quadro" value={h.quadro_novo || '—'} />
          <Info label="Data da promoção" value={h.data_promocao || '—'} />
          <Info label="Nº/ordem de antiguidade" value={h.antiguidade_referencia_ordem ?? '—'} />
          <Info label="DOEMS / boletim / ato" value={h.boletim_referencia || h.ato_referencia || '—'} />
          <Info label="Observações" value={h.observacoes || '—'} />
          <Info label="Origem do dado" value={h.origem_dado || '—'} />
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => onDetalhe(h)}><FileText className="w-4 h-4 mr-1" />Ver detalhes</Button>
          <Button size="sm" variant="outline" disabled={!canManage} onClick={() => onRetificar(h)}>Retificar</Button>
          <Button size="sm" variant="destructive" disabled={!canManage} onClick={() => onCancelar(h)}>Cancelar</Button>
        </div>
      </div>
    </div>)}
  </div>;
}
