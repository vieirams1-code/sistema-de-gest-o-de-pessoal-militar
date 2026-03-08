import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, User, Calendar, FileText, AlertTriangle, Pencil, Trash2, ArrowRight } from 'lucide-react';
import EtapaBadge from './EtapaBadge';
import TarefaPanel from './TarefaPanel';
import {
  prioridadeColors,
  criticidadeColors,
  statusColors,
  etapaColors,
  isAtrasada,
  formatDate,
  ETAPAS_CHEFE,
} from './DemandaUtils';

const ETAPAS = [
  'Recebido', 'Triagem', 'Aguardando decisão do chefe', 'Aguardando assinatura do chefe',
  'Em elaboração', 'Aguardando documento', 'Aguardando comando superior',
  'Retornado para execução', 'Concluído', 'Arquivado',
];

export default function DemandaDetalhePanel({ demanda, onClose, onEdit, onDelete }) {
  const queryClient = useQueryClient();
  const [atualizandoEtapa, setAtualizandoEtapa] = useState(false);

  if (!demanda) return null;

  const atrasada = isAtrasada(demanda);
  const isChefe = ETAPAS_CHEFE.includes(demanda.etapa_fluxo);

  const handleEtapaChange = async (novaEtapa) => {
    setAtualizandoEtapa(true);
    await base44.entities.Demanda.update(demanda.id, { etapa_fluxo: novaEtapa });
    queryClient.invalidateQueries({ queryKey: ['demandas'] });
    setAtualizandoEtapa(false);
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-[520px] bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200 overflow-hidden">
      {/* Header */}
      <div className={`px-5 py-4 flex items-start justify-between shrink-0 ${isChefe ? 'bg-amber-700' : 'bg-[#1e3a5f]'} text-white`}>
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
            <FileText className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-base leading-tight line-clamp-2">{demanda.titulo}</p>
            <p className="text-xs text-white/60 mt-0.5">
              {demanda.origem_tipo} {demanda.origem_numero_protocolo ? `• ${demanda.origem_numero_protocolo}` : ''}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10 shrink-0">
          <X className="w-5 h-5" />
        </Button>
      </div>

      {isChefe && (
        <div className="bg-amber-50 border-b border-amber-200 px-5 py-2.5 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-xs font-semibold text-amber-800">{demanda.etapa_fluxo}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        {/* Status e badges */}
        <div className="flex flex-wrap gap-2">
          <Badge className={`${statusColors[demanda.status] || 'bg-slate-100 text-slate-600'} text-xs`}>{demanda.status}</Badge>
          <Badge className={`${prioridadeColors[demanda.prioridade]} text-xs`}>{demanda.prioridade}</Badge>
          {demanda.criticidade && demanda.criticidade !== 'Rotina' && (
            <Badge className={`${criticidadeColors[demanda.criticidade]} text-xs`}>{demanda.criticidade}</Badge>
          )}
          {atrasada && <Badge className="bg-red-100 text-red-700 text-xs">⚠ Atrasada</Badge>}
          {demanda.exige_assinatura && <Badge className="bg-orange-100 text-orange-700 text-xs">Exige assinatura</Badge>}
          {demanda.exige_documentacao && <Badge className="bg-purple-100 text-purple-700 text-xs">Exige documentação</Badge>}
          {demanda.impacto_no_efetivo && <Badge className="bg-rose-100 text-rose-700 text-xs">Impacta efetivo</Badge>}
        </div>

        {/* Avançar etapa */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <ArrowRight className="w-4 h-4 text-[#1e3a5f]" />
            <span className="text-xs font-bold text-[#1e3a5f] uppercase tracking-wide">Etapa Atual</span>
          </div>
          <Select value={demanda.etapa_fluxo} onValueChange={handleEtapaChange} disabled={atualizandoEtapa}>
            <SelectTrigger className="bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ETAPAS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
          {atualizandoEtapa && <p className="text-xs text-slate-400 mt-1">Atualizando...</p>}
        </div>

        {/* Dados principais */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Identificação</p>
          {[
            ['Tipo', demanda.tipo_demanda],
            ['Origem', demanda.origem_tipo],
            ['Protocolo', demanda.origem_numero_protocolo],
            ['Data de Entrada', formatDate(demanda.data_entrada)],
            ['Prazo Interno', formatDate(demanda.prazo_interno)],
            ['Prazo Final', demanda.prazo_final ? (
              <span className={atrasada ? 'text-red-600 font-semibold' : ''}>{formatDate(demanda.prazo_final)}</span>
            ) : null],
          ].filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="flex justify-between items-center text-sm">
              <span className="text-xs text-slate-400">{k}</span>
              <span className="text-slate-700 font-medium text-right">{v}</span>
            </div>
          ))}
        </div>

        {/* Militar */}
        {demanda.militar_nome_snapshot && (
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Militar Vinculado</p>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-semibold text-slate-800">
                {demanda.militar_posto_snapshot ? `${demanda.militar_posto_snapshot} ` : ''}
                {demanda.militar_nome_snapshot}
              </span>
              {demanda.militar_matricula_snapshot && (
                <span className="text-xs text-slate-400">Mat: {demanda.militar_matricula_snapshot}</span>
              )}
            </div>
          </div>
        )}

        {/* Responsável */}
        {demanda.responsavel_atual_nome && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <User className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Responsável: <strong>{demanda.responsavel_atual_nome}</strong></span>
          </div>
        )}

        {/* Descrição */}
        {(demanda.descricao || demanda.assunto_resumido) && (
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Descrição</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{demanda.descricao || demanda.assunto_resumido}</p>
          </div>
        )}

        {/* Observações internas */}
        {demanda.observacoes_internas && (
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
            <p className="text-xs font-bold text-amber-600 uppercase tracking-wide mb-2">Observações Internas</p>
            <p className="text-sm text-amber-800 whitespace-pre-wrap">{demanda.observacoes_internas}</p>
          </div>
        )}

        {/* Tarefas */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <TarefaPanel demandaId={demanda.id} />
        </div>
      </div>

      {/* Rodapé ações */}
      <div className="shrink-0 border-t border-slate-200 px-5 py-3 flex items-center justify-between bg-slate-50">
        <Button variant="outline" size="sm" onClick={() => onDelete(demanda)} className="text-red-600 border-red-200 hover:bg-red-50">
          <Trash2 className="w-4 h-4 mr-1" /> Excluir
        </Button>
        <Button size="sm" onClick={() => onEdit(demanda)} className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white">
          <Pencil className="w-4 h-4 mr-1" /> Editar
        </Button>
      </div>
    </div>
  );
}