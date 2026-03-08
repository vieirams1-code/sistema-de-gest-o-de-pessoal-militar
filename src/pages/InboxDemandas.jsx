import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Inbox } from 'lucide-react';
import EtapaBadge from '@/components/demandas/EtapaBadge';
import DemandaDetalhePanel from '@/components/demandas/DemandaDetalhePanel';
import DemandaFormModal from '@/components/demandas/DemandaFormModal';
import {
  prioridadeColors,
  criticidadeColors,
  statusColors,
  isAtrasada,
  isVencendoHoje,
  sortDemandas,
  formatDate,
} from '@/components/demandas/DemandaUtils';

const ETAPAS = ['Recebido', 'Triagem', 'Aguardando decisão do chefe', 'Aguardando assinatura do chefe', 'Em elaboração', 'Aguardando documento', 'Aguardando comando superior', 'Retornado para execução', 'Concluído', 'Arquivado'];
const ORIGENS = ['TARS', 'EMS', 'Verbal', 'Interno', 'Documento Físico', 'E-mail', 'Outro'];
const PRIORIDADES = ['Baixa', 'Média', 'Alta', 'Urgente'];

export default function InboxDemandas() {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState('');
  const [filtroOrigem, setFiltroOrigem] = useState('all');
  const [filtroEtapa, setFiltroEtapa] = useState('all');
  const [filtroResponsavel, setFiltroResponsavel] = useState('');
  const [filtroPrioridade, setFiltroPrioridade] = useState('all');
  const [filtroStatus, setFiltroStatus] = useState('abertas');
  const [detalhePanel, setDetalhePanel] = useState(null);
  const [formModal, setFormModal] = useState({ open: false, demanda: null });

  const { data: demandas = [], isLoading } = useQuery({
    queryKey: ['demandas'],
    queryFn: () => base44.entities.Demanda.list('-created_date'),
  });

  const filtered = useMemo(() => {
    let list = [...demandas];

    if (filtroStatus === 'abertas') {
      list = list.filter(d => d.status !== 'Concluída' && d.status !== 'Arquivada' && d.status !== 'Cancelada');
    } else if (filtroStatus !== 'all') {
      list = list.filter(d => d.status === filtroStatus);
    }

    if (filtroOrigem !== 'all') list = list.filter(d => d.origem_tipo === filtroOrigem);
    if (filtroEtapa !== 'all') list = list.filter(d => d.etapa_fluxo === filtroEtapa);
    if (filtroPrioridade !== 'all') list = list.filter(d => d.prioridade === filtroPrioridade);
    if (filtroResponsavel) {
      list = list.filter(d => d.responsavel_atual_nome?.toLowerCase().includes(filtroResponsavel.toLowerCase()));
    }

    if (busca) {
      const b = busca.toLowerCase();
      list = list.filter(d =>
        d.titulo?.toLowerCase().includes(b) ||
        d.militar_nome_snapshot?.toLowerCase().includes(b) ||
        d.origem_numero_protocolo?.toLowerCase().includes(b) ||
        d.assunto_resumido?.toLowerCase().includes(b)
      );
    }

    return sortDemandas(list);
  }, [demandas, filtroStatus, filtroOrigem, filtroEtapa, filtroPrioridade, filtroResponsavel, busca]);

  const handleDelete = async (d) => {
    if (!confirm(`Excluir demanda "${d.titulo}"?`)) return;
    await base44.entities.Demanda.delete(d.id);
    queryClient.invalidateQueries({ queryKey: ['demandas'] });
    setDetalhePanel(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#1e3a5f]">Caixa de Entrada</h1>
            <p className="text-slate-500 mt-1">Todas as demandas recebidas pela seção</p>
          </div>
          <Button className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white" onClick={() => setFormModal({ open: true, demanda: null })}>
            <Plus className="w-4 h-4 mr-2" /> Nova Demanda
          </Button>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 mb-5">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input placeholder="Buscar por título, militar, protocolo..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-10 h-9" />
            </div>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="abertas">Abertas</SelectItem>
                <SelectItem value="Aberta">Aberta</SelectItem>
                <SelectItem value="Em Andamento">Em Andamento</SelectItem>
                <SelectItem value="Concluída">Concluída</SelectItem>
                <SelectItem value="Arquivada">Arquivada</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
              <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Origem" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Origens</SelectItem>
                {ORIGENS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroEtapa} onValueChange={setFiltroEtapa}>
              <SelectTrigger className="w-48 h-9"><SelectValue placeholder="Etapa" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Etapas</SelectItem>
                {ETAPAS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroPrioridade} onValueChange={setFiltroPrioridade}>
              <SelectTrigger className="w-32 h-9"><SelectValue placeholder="Prioridade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {PRIORIDADES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              placeholder="Responsável..."
              value={filtroResponsavel}
              onChange={e => setFiltroResponsavel(e.target.value)}
              className="w-36 h-9"
            />
          </div>
        </div>

        <div className="mb-3 text-sm text-slate-500">{filtered.length} demanda(s)</div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm py-16 text-center">
            <Inbox className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">Nenhuma demanda encontrada</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">Demanda</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 hidden md:table-cell">Militar</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Etapa</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 hidden lg:table-cell">Responsável</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 hidden lg:table-cell">Prazo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Prior.</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(d => {
                  const atrasada = isAtrasada(d);
                  const venceHoje = isVencendoHoje(d);
                  return (
                    <tr
                      key={d.id}
                      className={`border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors ${atrasada ? 'bg-red-50/20' : ''}`}
                      onClick={() => setDetalhePanel(d)}
                    >
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-900 truncate max-w-[220px]">{d.titulo}</p>
                        <p className="text-xs text-slate-400">
                          {d.origem_tipo}{d.origem_numero_protocolo ? ` • ${d.origem_numero_protocolo}` : ''} • {formatDate(d.data_entrada)}
                        </p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs text-slate-600">
                          {d.militar_posto_snapshot ? `${d.militar_posto_snapshot} ` : ''}{d.militar_nome_snapshot || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <EtapaBadge etapa={d.etapa_fluxo} size="sm" />
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs text-slate-500">
                        {d.responsavel_atual_nome || <span className="text-red-400">Sem responsável</span>}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {d.prazo_final ? (
                          <span className={`text-xs font-medium ${atrasada ? 'text-red-600' : venceHoje ? 'text-amber-600' : 'text-slate-500'}`}>
                            {formatDate(d.prazo_final)}
                          </span>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`${prioridadeColors[d.prioridade]} text-[10px]`}>{d.prioridade}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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