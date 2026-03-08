import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Pencil, Clock, CheckCircle2, Calendar, User, Plus, Inbox, List,
} from 'lucide-react';
import EtapaBadge from '@/components/demandas/EtapaBadge';
import DemandaDetalhePanel from '@/components/demandas/DemandaDetalhePanel';
import DemandaFormModal from '@/components/demandas/DemandaFormModal';
import {
  prioridadeColors,
  etapaColors,
  ETAPAS_CHEFE,
  isAtrasada,
  isVencendoHoje,
  sortDemandas,
  formatDate,
} from '@/components/demandas/DemandaUtils';

export default function ProcessosTarefas() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [detalhePanel, setDetalhePanel] = useState(null);
  const [formModal, setFormModal] = useState({ open: false, demanda: null });

  const { data: demandas = [], isLoading } = useQuery({
    queryKey: ['demandas'],
    queryFn: () => base44.entities.Demanda.list('-created_date'),
  });

  const abertas = useMemo(() => demandas.filter(d => d.status !== 'Concluída' && d.status !== 'Arquivada' && d.status !== 'Cancelada'), [demandas]);

  const stats = useMemo(() => ({
    abertas: abertas.length,
    aguardandoDecisao: abertas.filter(d => d.etapa_fluxo === 'Aguardando decisão do chefe').length,
    aguardandoAssinatura: abertas.filter(d => d.etapa_fluxo === 'Aguardando assinatura do chefe').length,
    aguardandoComando: abertas.filter(d => d.etapa_fluxo === 'Aguardando comando superior').length,
    vencendoHoje: abertas.filter(isVencendoHoje).length,
    atrasadas: abertas.filter(isAtrasada).length,
    semResponsavel: abertas.filter(d => !d.responsavel_atual_nome).length,
  }), [abertas]);

  const prioritarias = useMemo(() => sortDemandas(abertas).slice(0, 8), [abertas]);

  const handleDelete = async (d) => {
    if (!confirm(`Excluir demanda "${d.titulo}"?`)) return;
    await base44.entities.Demanda.delete(d.id);
    queryClient.invalidateQueries({ queryKey: ['demandas'] });
    setDetalhePanel(null);
  };

  const statCards = [
    { label: 'Abertas', value: stats.abertas, color: 'text-[#1e3a5f]', bg: 'bg-[#1e3a5f]/10', icon: Inbox },
    { label: 'Aguard. Decisão', value: stats.aguardandoDecisao, color: 'text-amber-700', bg: 'bg-amber-100', icon: AlertTriangle },
    { label: 'Aguard. Assinatura', value: stats.aguardandoAssinatura, color: 'text-orange-700', bg: 'bg-orange-100', icon: Pencil },
    { label: 'Aguard. Comando', value: stats.aguardandoComando, color: 'text-rose-700', bg: 'bg-rose-100', icon: Clock },
    { label: 'Vencendo Hoje', value: stats.vencendoHoje, color: 'text-amber-600', bg: 'bg-amber-50', icon: Calendar },
    { label: 'Atrasadas', value: stats.atrasadas, color: 'text-red-700', bg: 'bg-red-100', icon: AlertTriangle },
    { label: 'Sem Responsável', value: stats.semResponsavel, color: 'text-slate-600', bg: 'bg-slate-100', icon: User },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#1e3a5f]">Painel de Demandas</h1>
            <p className="text-slate-500 mt-1">Centro de controle operacional-administrativo</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => navigate(createPageUrl('InboxDemandas'))}>
              <Inbox className="w-4 h-4 mr-2" /> Caixa de Entrada
            </Button>
            <Button variant="outline" onClick={() => navigate(createPageUrl('FilaDemandas'))}>
              <List className="w-4 h-4 mr-2" /> Fila de Trabalho
            </Button>
            <Button className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white" onClick={() => setFormModal({ open: true, demanda: null })}>
              <Plus className="w-4 h-4 mr-2" /> Nova Demanda
            </Button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-8">
          {statCards.map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex flex-col items-center text-center">
                <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center mb-2`}>
                  <Icon className={`w-4 h-4 ${s.color}`} />
                </div>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">{s.label}</p>
              </div>
            );
          })}
        </div>

        {/* Alertas de atenção */}
        {(stats.aguardandoDecisao > 0 || stats.aguardandoAssinatura > 0 || stats.aguardandoComando > 0 || stats.atrasadas > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            {stats.aguardandoDecisao > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Aguardando decisão do chefe</p>
                  <p className="text-xs text-amber-600">{stats.aguardandoDecisao} demanda(s) aguardam sua decisão</p>
                </div>
              </div>
            )}
            {stats.aguardandoAssinatura > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
                <Pencil className="w-5 h-5 text-orange-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-orange-800">Aguardando assinatura do chefe</p>
                  <p className="text-xs text-orange-600">{stats.aguardandoAssinatura} demanda(s) aguardam assinatura</p>
                </div>
              </div>
            )}
            {stats.atrasadas > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Demandas atrasadas</p>
                  <p className="text-xs text-red-600">{stats.atrasadas} demanda(s) com prazo vencido</p>
                </div>
              </div>
            )}
            {stats.aguardandoComando > 0 && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center gap-3">
                <Clock className="w-5 h-5 text-rose-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-rose-800">Aguardando comando superior</p>
                  <p className="text-xs text-rose-600">{stats.aguardandoComando} demanda(s) aguardam retorno</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Lista prioritária */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Fila Prioritária do Dia</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate(createPageUrl('FilaDemandas'))}>
              Ver todas <List className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : prioritarias.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhuma demanda aberta</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">Título</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 hidden md:table-cell">Militar</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Etapa</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 hidden lg:table-cell">Responsável</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 hidden lg:table-cell">Prazo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Prioridade</th>
                </tr>
              </thead>
              <tbody>
                {prioritarias.map(d => {
                  const atrasada = isAtrasada(d);
                  return (
                    <tr
                      key={d.id}
                      className={`border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors ${atrasada ? 'bg-red-50/30' : ''}`}
                      onClick={() => setDetalhePanel(d)}
                    >
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-900 truncate max-w-[200px]">{d.titulo}</p>
                        {d.origem_tipo && <p className="text-xs text-slate-400">{d.origem_tipo}</p>}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-slate-600 text-xs">
                          {d.militar_posto_snapshot ? `${d.militar_posto_snapshot} ` : ''}{d.militar_nome_snapshot || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <EtapaBadge etapa={d.etapa_fluxo} size="sm" />
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className={`text-xs ${!d.responsavel_atual_nome ? 'text-red-400 italic' : 'text-slate-500'}`}>
                          {d.responsavel_atual_nome || 'Sem responsável'}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {d.prazo_final ? (
                          <span className={`text-xs ${atrasada ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                            {formatDate(d.prazo_final)}
                          </span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`${prioridadeColors[d.prioridade]} text-[10px]`}>{d.prioridade}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {detalhePanel && (
        <DemandaDetalhePanel
          demanda={detalhePanel}
          onClose={() => setDetalhePanel(null)}
          onEdit={(d) => { setFormModal({ open: true, demanda: d }); setDetalhePanel(null); }}
          onDelete={handleDelete}
        />
      )}

      <DemandaFormModal
        open={formModal.open}
        demanda={formModal.demanda}
        onClose={() => setFormModal({ open: false, demanda: null })}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['demandas'] })}
      />
    </div>
  );
}