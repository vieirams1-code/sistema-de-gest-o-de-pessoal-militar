import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { List, Search, Plus, AlertTriangle, Calendar } from 'lucide-react';
import EtapaBadge from '@/components/demandas/EtapaBadge';
import DemandaDetalhePanel from '@/components/demandas/DemandaDetalhePanel';
import DemandaFormModal from '@/components/demandas/DemandaFormModal';
import {
  prioridadeColors,
  criticidadeColors,
  ETAPAS_CHEFE,
  isAtrasada,
  isVencendoHoje,
  sortDemandas,
  formatDate,
} from '@/components/demandas/DemandaUtils';

export default function FilaDemandas() {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState('');
  const [filtroEtapa, setFiltroEtapa] = useState('all');
  const [detalhePanel, setDetalhePanel] = useState(null);
  const [formModal, setFormModal] = useState({ open: false, demanda: null });

  const { data: demandas = [], isLoading } = useQuery({
    queryKey: ['demandas'],
    queryFn: () => base44.entities.Demanda.list('-created_date'),
  });

  const fila = useMemo(() => {
    let list = demandas.filter(d => d.status !== 'Concluída' && d.status !== 'Arquivada' && d.status !== 'Cancelada');

    if (filtroEtapa !== 'all') list = list.filter(d => d.etapa_fluxo === filtroEtapa);

    if (busca) {
      const b = busca.toLowerCase();
      list = list.filter(d =>
        d.titulo?.toLowerCase().includes(b) ||
        d.militar_nome_snapshot?.toLowerCase().includes(b) ||
        d.origem_numero_protocolo?.toLowerCase().includes(b)
      );
    }

    return sortDemandas(list);
  }, [demandas, filtroEtapa, busca]);

  const handleDelete = async (d) => {
    if (!confirm(`Excluir demanda "${d.titulo}"?`)) return;
    await base44.entities.Demanda.delete(d.id);
    queryClient.invalidateQueries({ queryKey: ['demandas'] });
    setDetalhePanel(null);
  };

  const ETAPAS = ['Recebido', 'Triagem', 'Aguardando decisão do chefe', 'Aguardando assinatura do chefe', 'Em elaboração', 'Aguardando documento', 'Aguardando comando superior', 'Retornado para execução'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#1e3a5f]">Fila de Trabalho</h1>
            <p className="text-slate-500 mt-1">Ordenado por prazo, prioridade e criticidade</p>
          </div>
          <Button className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white" onClick={() => setFormModal({ open: true, demanda: null })}>
            <Plus className="w-4 h-4 mr-2" /> Nova Demanda
          </Button>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 mb-5 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-10 h-9" />
          </div>
          <Select value={filtroEtapa} onValueChange={setFiltroEtapa}>
            <SelectTrigger className="w-52 h-9"><SelectValue placeholder="Etapa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Etapas</SelectItem>
              {ETAPAS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="mb-3 text-sm text-slate-500">{fila.length} demanda(s) na fila</div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : fila.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm py-16 text-center">
            <List className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">Fila vazia</p>
          </div>
        ) : (
          <div className="space-y-2">
            {fila.map((d, idx) => {
              const atrasada = isAtrasada(d);
              const venceHoje = isVencendoHoje(d);
              const isChefe = ETAPAS_CHEFE.includes(d.etapa_fluxo);

              return (
                <div
                  key={d.id}
                  onClick={() => setDetalhePanel(d)}
                  className={`bg-white rounded-xl border shadow-sm cursor-pointer hover:shadow-md transition-all p-4 flex items-center gap-4 ${
                    atrasada ? 'border-red-200 bg-red-50/20' : isChefe ? 'border-amber-200 bg-amber-50/20' : 'border-slate-200'
                  }`}
                >
                  {/* Posição */}
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                    {idx + 1}
                  </div>

                  {/* Título e origem */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900 truncate">{d.titulo}</p>
                      {atrasada && <Badge className="bg-red-100 text-red-700 text-[10px]">⚠ Atrasada</Badge>}
                      {venceHoje && !atrasada && <Badge className="bg-amber-100 text-amber-700 text-[10px]">Vence hoje</Badge>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5 flex-wrap">
                      {d.origem_tipo && <span>{d.origem_tipo}{d.origem_numero_protocolo ? ` • ${d.origem_numero_protocolo}` : ''}</span>}
                      {d.militar_nome_snapshot && (
                        <span className="text-slate-500">
                          {d.militar_posto_snapshot ? `${d.militar_posto_snapshot} ` : ''}{d.militar_nome_snapshot}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Etapa */}
                  <div className="hidden md:block shrink-0">
                    <EtapaBadge etapa={d.etapa_fluxo} size="sm" />
                  </div>

                  {/* Responsável */}
                  <div className="hidden lg:block shrink-0 text-xs text-slate-500 max-w-[120px] truncate">
                    {d.responsavel_atual_nome || <span className="text-red-400">Sem resp.</span>}
                  </div>

                  {/* Prazo */}
                  <div className="hidden sm:block shrink-0 text-xs">
                    {d.prazo_final ? (
                      <span className={`flex items-center gap-1 ${atrasada ? 'text-red-600 font-semibold' : venceHoje ? 'text-amber-600 font-semibold' : 'text-slate-500'}`}>
                        <Calendar className="w-3 h-3" />
                        {formatDate(d.prazo_final)}
                      </span>
                    ) : <span className="text-slate-300">Sem prazo</span>}
                  </div>

                  {/* Prioridade */}
                  <div className="shrink-0">
                    <Badge className={`${prioridadeColors[d.prioridade]} text-[10px]`}>{d.prioridade}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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