import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  MessageSquare, Send, ChevronDown, ChevronUp,
  ArrowRightLeft, ClipboardCheck, Pen, ArrowDownLeft, RefreshCw, CheckCircle2, Archive, Cpu,
} from 'lucide-react';

const TIPO_CONFIG = {
  'Comentário':         { icon: MessageSquare, dot: 'bg-slate-400',  badge: 'bg-slate-100 text-slate-600' },
  'Encaminhamento':     { icon: ArrowRightLeft,icon2: null, dot: 'bg-blue-400',   badge: 'bg-blue-100 text-blue-700' },
  'Decisão':            { icon: ClipboardCheck, dot: 'bg-amber-500',  badge: 'bg-amber-100 text-amber-800' },
  'Assinatura':         { icon: Pen,            dot: 'bg-orange-500', badge: 'bg-orange-100 text-orange-800' },
  'Retorno externo':    { icon: ArrowDownLeft,  dot: 'bg-rose-500',   badge: 'bg-rose-100 text-rose-700' },
  'Atualização interna':{ icon: RefreshCw,      dot: 'bg-teal-400',   badge: 'bg-teal-100 text-teal-700' },
  'Sistema':            { icon: Cpu,            dot: 'bg-slate-300',  badge: 'bg-slate-50 text-slate-400 italic' },
};

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function HistoricoItem({ item, isLast }) {
  const cfg = TIPO_CONFIG[item.tipo_registro] || TIPO_CONFIG['Comentário'];
  const Icon = cfg.icon;

  return (
    <div className="flex gap-3">
      {/* Linha de tempo */}
      <div className="flex flex-col items-center shrink-0">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${cfg.dot} bg-opacity-20 border-2 ${cfg.dot.replace('bg-', 'border-')}`}>
          <Icon className={`w-3.5 h-3.5 ${cfg.dot.replace('bg-', 'text-')}`} />
        </div>
        {!isLast && <div className="w-px flex-1 bg-slate-200 mt-1" />}
      </div>

      {/* Conteúdo */}
      <div className={`pb-4 flex-1 min-w-0 ${isLast ? '' : ''}`}>
        <div className="flex flex-wrap items-center gap-1.5 mb-1">
          <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${cfg.badge}`}>
            {item.tipo_registro}
          </span>
          {item.etapa_no_momento && (
            <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded truncate max-w-[140px]">
              {item.etapa_no_momento}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">{item.mensagem}</p>
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="text-[10px] font-medium text-slate-500">
            {item.autor_nome || 'Sistema'}
          </span>
          <span className="text-[10px] text-slate-300">·</span>
          <span className="text-[10px] text-slate-400">{formatDateTime(item.criado_em)}</span>
        </div>
      </div>
    </div>
  );
}

export default function DemandaHistorico({ demanda, onRegistrar }) {
  const queryClient = useQueryClient();
  const [mensagem, setMensagem] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [expandido, setExpandido] = useState(true);

  const { data: historico = [], isLoading } = useQuery({
    queryKey: ['demanda-historico', demanda.id],
    queryFn: () => base44.entities.DemandaComentario.filter(
      { demanda_id: demanda.id, visivel_no_historico: true },
      '-criado_em',
      100
    ),
    enabled: !!demanda.id,
  });

  const registrar = async (dados) => {
    await base44.entities.DemandaComentario.create({
      demanda_id: demanda.id,
      criado_em: new Date().toISOString(),
      visivel_no_historico: true,
      etapa_no_momento: demanda.etapa_fluxo,
      ...dados,
    });
    queryClient.invalidateQueries({ queryKey: ['demanda-historico', demanda.id] });
  };

  // Expõe para o pai registrar eventos automáticos
  React.useImperativeHandle(onRegistrar, () => ({ registrar }), [demanda.id, demanda.etapa_fluxo]);

  const handleComentario = async () => {
    if (!mensagem.trim()) return;
    setSalvando(true);
    await registrar({ tipo_registro: 'Comentário', mensagem: mensagem.trim() });
    setMensagem('');
    setSalvando(false);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Cabeçalho */}
      <button
        onClick={() => setExpandido(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Histórico da Demanda</span>
          {historico.length > 0 && (
            <span className="text-[10px] bg-slate-100 text-slate-500 rounded-full px-1.5 py-0.5 font-semibold">
              {historico.length}
            </span>
          )}
        </div>
        {expandido ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {expandido && (
        <div className="border-t border-slate-100">
          {/* Timeline */}
          <div className="px-4 pt-4 max-h-[420px] overflow-y-auto">
            {isLoading && (
              <p className="text-xs text-slate-400 italic text-center py-4">Carregando histórico...</p>
            )}
            {!isLoading && historico.length === 0 && (
              <p className="text-xs text-slate-400 italic text-center py-4">Nenhum registro ainda.</p>
            )}
            {historico.map((item, idx) => (
              <HistoricoItem key={item.id} item={item} isLast={idx === historico.length - 1} />
            ))}
          </div>

          {/* Campo de comentário */}
          <div className="px-4 pb-4 pt-3 border-t border-slate-100 space-y-2">
            <Textarea
              value={mensagem}
              onChange={e => setMensagem(e.target.value)}
              rows={2}
              placeholder="Adicionar comentário ou anotação..."
              className="text-sm resize-none"
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleComentario(); }}
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleComentario}
                disabled={!mensagem.trim() || salvando}
                className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Registrar comentário
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Hook utilitário para registrar eventos automáticos a partir do painel pai
export function useDemandaHistoricoRegistrar(demandaId, etapaAtual) {
  const queryClient = useQueryClient();

  return async (dados) => {
    await base44.entities.DemandaComentario.create({
      demanda_id: demandaId,
      criado_em: new Date().toISOString(),
      visivel_no_historico: true,
      etapa_no_momento: etapaAtual,
      ...dados,
    });
    queryClient.invalidateQueries({ queryKey: ['demanda-historico', demandaId] });
  };
}