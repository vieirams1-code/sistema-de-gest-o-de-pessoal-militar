import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  X, User, Calendar, FileText, AlertTriangle, Pencil, Trash2,
  ArrowRight, CheckCircle2, Archive, RotateCcw, SendHorizonal, UserCheck, History,
} from 'lucide-react';
import EtapaBadge from './EtapaBadge';
import TarefaPanel from './TarefaPanel';
import { BlocoDecisaoChefe, BlocoAssinaturaChefe, BlocoRetornoComando } from './BlocoDecisao';
import DemandaHistorico, { useDemandaHistoricoRegistrar } from './DemandaHistorico';
import {
  prioridadeColors, criticidadeColors, statusColors, isAtrasada, formatDate, ETAPAS_CHEFE,
} from './DemandaUtils';

const ETAPAS = [
  'Recebido', 'Triagem', 'Aguardando decisão do chefe', 'Aguardando assinatura do chefe',
  'Em elaboração', 'Aguardando documento', 'Aguardando comando superior',
  'Retornado para execução', 'Concluído', 'Arquivado',
];

// Mapa de próxima ação esperada por etapa
const PROXIMA_ACAO_POR_ETAPA = {
  'Recebido': 'Realizar triagem e definir responsável',
  'Triagem': 'Classificar e encaminhar para elaboração ou decisão',
  'Aguardando decisão do chefe': 'Aguardar decisão do chefe da seção',
  'Aguardando assinatura do chefe': 'Aguardar assinatura do chefe',
  'Em elaboração': 'Elaborar documento / executar ação necessária',
  'Aguardando documento': 'Aguardar entrega de documentação',
  'Aguardando comando superior': 'Aguardar retorno do comando superior',
  'Retornado para execução': 'Retomar elaboração conforme orientação recebida',
  'Concluído': 'Demanda concluída',
  'Arquivado': 'Demanda arquivada',
};

export default function DemandaDetalhePanel({ demanda, onClose, onEdit, onDelete }) {
  const queryClient = useQueryClient();
  const [salvando, setSalvando] = useState(false);
  const registrarHistorico = useDemandaHistoricoRegistrar(demanda?.id, demanda?.etapa_fluxo);

  if (!demanda) return null;

  const atrasada = isAtrasada(demanda);
  const isChefe = ETAPAS_CHEFE.includes(demanda.etapa_fluxo);

  const salvar = async (dados) => {
    setSalvando(true);
    await base44.entities.Demanda.update(demanda.id, dados);
    queryClient.invalidateQueries({ queryKey: ['demandas'] });
    setSalvando(false);
  };

  const handleEtapaChange = (novaEtapa) => salvar({ etapa_fluxo: novaEtapa });

  const salvarComHistorico = async (dadosDemanda, tipoHistorico, mensagemHistorico) => {
    await salvar(dadosDemanda);
    await registrarHistorico({ tipo_registro: tipoHistorico, mensagem: mensagemHistorico, etapa_no_momento: dadosDemanda.etapa_fluxo || demanda.etapa_fluxo });
  };

  // Ações rápidas de fluxo
  const acoes = [
    {
      label: 'Enc. p/ decisão do chefe',
      icon: SendHorizonal,
      color: 'border-amber-300 text-amber-800 hover:bg-amber-50',
      show: !['Aguardando decisão do chefe', 'Concluído', 'Arquivado'].includes(demanda.etapa_fluxo),
      acao: () => salvarComHistorico({ etapa_fluxo: 'Aguardando decisão do chefe', data_ultimo_encaminhamento: new Date().toISOString() }, 'Encaminhamento', 'Demanda encaminhada para decisão do chefe.'),
    },
    {
      label: 'Enc. p/ assinatura do chefe',
      icon: Pencil,
      color: 'border-orange-300 text-orange-800 hover:bg-orange-50',
      show: !['Aguardando assinatura do chefe', 'Concluído', 'Arquivado'].includes(demanda.etapa_fluxo),
      acao: () => salvarComHistorico({ etapa_fluxo: 'Aguardando assinatura do chefe', data_ultimo_encaminhamento: new Date().toISOString() }, 'Encaminhamento', 'Demanda encaminhada para assinatura do chefe.'),
    },
    {
      label: 'Marcar retorno recebido',
      icon: UserCheck,
      color: 'border-teal-300 text-teal-800 hover:bg-teal-50',
      show: ['Aguardando decisão do chefe', 'Aguardando assinatura do chefe', 'Aguardando comando superior', 'Aguardando documento'].includes(demanda.etapa_fluxo),
      acao: () => salvarComHistorico({ etapa_fluxo: 'Retornado para execução', data_ultimo_retorno: new Date().toISOString() }, 'Atualização interna', 'Retorno recebido e demanda devolvida para execução.'),
    },
    {
      label: 'Retornar p/ elaboração',
      icon: RotateCcw,
      color: 'border-blue-300 text-blue-800 hover:bg-blue-50',
      show: demanda.etapa_fluxo === 'Retornado para execução',
      acao: () => salvarComHistorico({ etapa_fluxo: 'Em elaboração' }, 'Atualização interna', 'Demanda retornada para elaboração.'),
    },
    {
      label: 'Concluir demanda',
      icon: CheckCircle2,
      color: 'border-emerald-300 text-emerald-800 hover:bg-emerald-50',
      show: demanda.status !== 'Concluída' && demanda.status !== 'Arquivada',
      acao: () => salvarComHistorico({ etapa_fluxo: 'Concluído', status: 'Concluída', concluida_em: new Date().toISOString().split('T')[0] }, 'Sistema', 'Demanda concluída.'),
    },
    {
      label: 'Arquivar demanda',
      icon: Archive,
      color: 'border-slate-300 text-slate-600 hover:bg-slate-50',
      show: demanda.status !== 'Arquivada',
      acao: () => salvarComHistorico({ etapa_fluxo: 'Arquivado', status: 'Arquivada' }, 'Sistema', 'Demanda arquivada.'),
    },
  ].filter(a => a.show);

  const proximaAcao = demanda.proxima_acao || PROXIMA_ACAO_POR_ETAPA[demanda.etapa_fluxo] || '';
  const depende = {
    chefe: demanda.etapa_fluxo === 'Aguardando decisão do chefe',
    assinatura: demanda.etapa_fluxo === 'Aguardando assinatura do chefe',
    comando: demanda.etapa_fluxo === 'Aguardando comando superior',
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-[540px] bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200 overflow-hidden">
      {/* Header */}
      <div className={`px-5 py-4 flex items-start justify-between shrink-0 ${isChefe ? 'bg-amber-700' : 'bg-[#1e3a5f]'} text-white`}>
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
            <FileText className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-base leading-tight line-clamp-2">{demanda.titulo}</p>
            <p className="text-xs text-white/60 mt-0.5">
              {demanda.origem_tipo}{demanda.origem_numero_protocolo ? ` • ${demanda.origem_numero_protocolo}` : ''}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10 shrink-0">
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Banners críticos */}
      {depende.chefe && (
        <div className="bg-amber-500 px-5 py-2 flex items-center gap-2 shrink-0">
          <AlertTriangle className="w-4 h-4 text-white shrink-0" />
          <p className="text-xs font-bold text-white uppercase tracking-wide">Aguardando decisão do chefe
            {demanda.aguardando_decisao_de_nome && ` — ${demanda.aguardando_decisao_de_nome}`}
          </p>
        </div>
      )}
      {depende.assinatura && (
        <div className="bg-orange-500 px-5 py-2 flex items-center gap-2 shrink-0">
          <Pencil className="w-4 h-4 text-white shrink-0" />
          <p className="text-xs font-bold text-white uppercase tracking-wide">Aguardando assinatura do chefe
            {demanda.aguardando_assinatura_de_nome && ` — ${demanda.aguardando_assinatura_de_nome}`}
          </p>
        </div>
      )}
      {depende.comando && (
        <div className="bg-rose-500 px-5 py-2 flex items-center gap-2 shrink-0">
          <ArrowRight className="w-4 h-4 text-white shrink-0" />
          <p className="text-xs font-bold text-white uppercase tracking-wide">Aguardando comando superior
            {demanda.aguardando_retorno_de && ` — ${demanda.aguardando_retorno_de}`}
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">

        {/* ── BLOCO: Situação Atual ── */}
        <div className={`rounded-xl border p-4 space-y-3 ${isChefe ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Situação Atual</p>

          {/* Badges */}
          <div className="flex flex-wrap gap-1.5">
            <Badge className={`${statusColors[demanda.status] || 'bg-slate-100 text-slate-600'} text-xs`}>{demanda.status}</Badge>
            <Badge className={`${prioridadeColors[demanda.prioridade]} text-xs`}>{demanda.prioridade}</Badge>
            {demanda.criticidade && demanda.criticidade !== 'Rotina' && (
              <Badge className={`${criticidadeColors[demanda.criticidade]} text-xs`}>{demanda.criticidade}</Badge>
            )}
            {atrasada && <Badge className="bg-red-100 text-red-700 text-xs font-semibold">⚠ Atrasada</Badge>}
            {demanda.exige_assinatura && <Badge className="bg-orange-100 text-orange-700 text-xs">Exige assinatura</Badge>}
            {demanda.exige_documentacao && <Badge className="bg-purple-100 text-purple-700 text-xs">Exige documentação</Badge>}
            {demanda.impacto_no_efetivo && <Badge className="bg-rose-100 text-rose-700 text-xs">Impacta efetivo</Badge>}
          </div>

          {/* Etapa (select) */}
          <div>
            <p className="text-xs text-slate-400 mb-1.5">Etapa do Fluxo</p>
            <Select value={demanda.etapa_fluxo} onValueChange={handleEtapaChange} disabled={salvando}>
              <SelectTrigger className="bg-white h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ETAPAS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Próxima ação — destaque */}
          {proximaAcao && demanda.status !== 'Concluída' && demanda.status !== 'Arquivada' && (
            <div className={`rounded-lg px-3 py-2.5 flex items-start gap-2.5 border ${
              depende.chefe ? 'bg-amber-100 border-amber-300' :
              depende.assinatura ? 'bg-orange-100 border-orange-300' :
              depende.comando ? 'bg-rose-100 border-rose-300' :
              'bg-[#1e3a5f]/5 border-[#1e3a5f]/20'
            }`}>
              <ArrowRight className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                depende.chefe ? 'text-amber-700' :
                depende.assinatura ? 'text-orange-700' :
                depende.comando ? 'text-rose-700' : 'text-[#1e3a5f]'
              }`} />
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-wide mb-0.5 ${
                  depende.chefe ? 'text-amber-600' :
                  depende.assinatura ? 'text-orange-600' :
                  depende.comando ? 'text-rose-600' : 'text-[#1e3a5f]/60'
                }`}>Próxima ação</p>
                <p className={`text-xs font-semibold leading-relaxed ${
                  depende.chefe ? 'text-amber-900' :
                  depende.assinatura ? 'text-orange-900' :
                  depende.comando ? 'text-rose-900' : 'text-[#1e3a5f]'
                }`}>{proximaAcao}</p>
              </div>
            </div>
          )}

          {/* Dependências */}
          {(depende.chefe || depende.assinatura || depende.comando) && (
            <div className="flex flex-wrap gap-1.5">
              {depende.chefe && <Badge className="bg-amber-100 text-amber-800 text-[10px]">🔒 Depende do chefe</Badge>}
              {depende.assinatura && <Badge className="bg-orange-100 text-orange-800 text-[10px]">✍️ Depende de assinatura</Badge>}
              {depende.comando && <Badge className="bg-rose-100 text-rose-800 text-[10px]">⬆️ Depende do comando superior</Badge>}
            </div>
          )}
        </div>

        {/* ── BLOCO: Ações Rápidas (só exibe se não estiver em etapa de decisão/assinatura/comando nem finalizado) ── */}
        {acoes.length > 0 && demanda.status !== 'Concluída' && demanda.status !== 'Arquivada'
          && !depende.chefe && !depende.assinatura && !depende.comando && (
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Ações Rápidas</p>
            <div className="grid grid-cols-2 gap-2">
              {acoes.map(a => {
                const Icon = a.icon;
                return (
                  <button
                    key={a.label}
                    onClick={a.acao}
                    disabled={salvando}
                    className={`flex items-center gap-2 text-xs font-medium px-3 py-2.5 rounded-lg border transition-colors disabled:opacity-50 text-left ${a.color}`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="leading-tight">{a.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── BLOCO CONTEXTUAL: Decisão / Assinatura / Retorno ── */}
        {depende.chefe && (
          <BlocoDecisaoChefe onSalvar={salvar} salvando={salvando} />
        )}
        {depende.assinatura && (
          <BlocoAssinaturaChefe onSalvar={salvar} salvando={salvando} />
        )}
        {depende.comando && (
          <BlocoRetornoComando onSalvar={salvar} salvando={salvando} />
        )}

        {/* ── BLOCO: Responsáveis ── */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Responsáveis</p>
          {[
            ['Responsável Atual', demanda.responsavel_atual_nome],
            ['Criado por', demanda.criado_por_nome],
            ['Encaminhado por', demanda.encaminhado_por_nome],
            ['Aguard. decisão de', demanda.aguardando_decisao_de_nome],
            ['Aguard. assinatura de', demanda.aguardando_assinatura_de_nome],
            ['Aguard. retorno de', demanda.aguardando_retorno_de],
          ].filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-400 shrink-0">{k}</span>
              <span className="text-xs font-medium text-slate-700 flex items-center gap-1 truncate">
                <User className="w-3 h-3 text-slate-400 shrink-0" />{v}
              </span>
            </div>
          ))}
          {!demanda.responsavel_atual_nome && !demanda.criado_por_nome && (
            <p className="text-xs text-red-400 italic">Sem responsável definido</p>
          )}
          {demanda.data_ultimo_encaminhamento && (
            <div className="pt-1 border-t border-slate-100 flex justify-between">
              <span className="text-xs text-slate-400">Último encaminhamento</span>
              <span className="text-xs text-slate-500">{formatDate(demanda.data_ultimo_encaminhamento.split('T')[0])}</span>
            </div>
          )}
          {demanda.data_ultimo_retorno && (
            <div className="flex justify-between">
              <span className="text-xs text-slate-400">Último retorno</span>
              <span className="text-xs text-slate-500">{formatDate(demanda.data_ultimo_retorno.split('T')[0])}</span>
            </div>
          )}
        </div>

        {/* ── BLOCO: Militar Vinculado ── */}
        {demanda.militar_nome_snapshot ? (
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Militar Vinculado</p>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {demanda.militar_posto_snapshot ? `${demanda.militar_posto_snapshot} ` : ''}{demanda.militar_nome_snapshot}
                </p>
                {demanda.militar_matricula_snapshot && (
                  <p className="text-xs text-slate-400">Mat: {demanda.militar_matricula_snapshot}</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 rounded-xl border border-dashed border-slate-200 p-3 flex items-center gap-2">
            <User className="w-4 h-4 text-slate-300 shrink-0" />
            <p className="text-xs text-slate-400 italic">Nenhum militar vinculado</p>
          </div>
        )}

        {/* ── BLOCO: Origem ── */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Origem</p>
          {[
            ['Tipo de Demanda', demanda.tipo_demanda],
            ['Origem', demanda.origem_tipo],
            ['Protocolo', demanda.origem_numero_protocolo],
            ['Data de Entrada', formatDate(demanda.data_entrada)],
          ].filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="flex justify-between items-center">
              <span className="text-xs text-slate-400">{k}</span>
              <span className="text-sm text-slate-700 font-medium">{v}</span>
            </div>
          ))}
        </div>

        {/* ── BLOCO: Prazos ── */}
        {(demanda.prazo_interno || demanda.prazo_final) && (
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Prazos</p>
            {demanda.prazo_interno && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">Prazo Interno</span>
                <span className="text-sm text-slate-700 font-medium flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />{formatDate(demanda.prazo_interno)}
                </span>
              </div>
            )}
            {demanda.prazo_final && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">Prazo Final</span>
                <span className={`text-sm font-semibold flex items-center gap-1 ${atrasada ? 'text-red-600' : 'text-slate-700'}`}>
                  <Calendar className={`w-3 h-3 ${atrasada ? 'text-red-500' : 'text-slate-400'}`} />
                  {formatDate(demanda.prazo_final)}{atrasada ? ' — VENCIDO' : ''}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── BLOCO: Observações Internas ── */}
        {demanda.observacoes_internas && (
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">Observações Internas</p>
            <p className="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">{demanda.observacoes_internas}</p>
          </div>
        )}

        {/* ── BLOCO: Histórico Resumido ── */}
        {(demanda.decisao_texto || demanda.assinatura_data || demanda.retorno_externo_texto) && (
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-2">
              <History className="w-3.5 h-3.5" /> Histórico de Decisões
            </p>
            {demanda.decisao_texto && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">
                    Última decisão {demanda.decisao_tipo ? `— ${demanda.decisao_tipo}` : ''}
                  </span>
                  {demanda.decisao_data && (
                    <span className="text-[10px] text-amber-500">{formatDate(demanda.decisao_data.split('T')[0])}</span>
                  )}
                </div>
                <p className="text-xs text-amber-900 leading-relaxed">{demanda.decisao_texto}</p>
              </div>
            )}
            {demanda.assinatura_data && (
              <div className="rounded-lg bg-orange-50 border border-orange-200 px-3 py-2">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="text-[10px] font-bold text-orange-700 uppercase tracking-wide">
                    Assinatura {demanda.assinatura_status ? `— ${demanda.assinatura_status}` : ''}
                  </span>
                  <span className="text-[10px] text-orange-500">{formatDate(demanda.assinatura_data.split('T')[0])}</span>
                </div>
                {demanda.assinatura_observacao && (
                  <p className="text-xs text-orange-900 leading-relaxed">{demanda.assinatura_observacao}</p>
                )}
              </div>
            )}
            {demanda.retorno_externo_texto && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wide">Retorno do Comando Superior</span>
                  {demanda.retorno_externo_data && (
                    <span className="text-[10px] text-rose-500">{formatDate(demanda.retorno_externo_data.split('T')[0])}</span>
                  )}
                </div>
                <p className="text-xs text-rose-900 leading-relaxed">{demanda.retorno_externo_texto}</p>
              </div>
            )}
          </div>
        )}

        {/* ── BLOCO: Tarefas Vinculadas ── */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <TarefaPanel demandaId={demanda.id} />
        </div>
      </div>

      {/* Rodapé */}
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