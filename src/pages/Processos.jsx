import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { DragDropContext } from '@hello-pangea/dnd';
import KanbanColuna from '@/components/processos/KanbanColuna';
import ProcessoModal from '@/components/processos/ProcessoModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  LayoutGrid, List, Plus, Search, SlidersHorizontal, AlertCircle, Clock
} from 'lucide-react';
import { differenceInDays, isPast, isToday } from 'date-fns';

const STATUSES = ['A Fazer', 'Em Andamento', 'Aguardando Info', 'Concluído', 'Arquivado'];
const PRIORIDADES = ['Todas', 'Baixa', 'Média', 'Alta', 'Urgente'];
const TIPOS = ['Todos', 'Renovação de Contrato', 'Processo Administrativo', 'Processo Judicial', 'Designação de Serviço', 'Temporário', 'Licença', 'Outro'];

function PrazoChip({ data }) {
  if (!data) return null;
  const d = new Date(data + 'T00:00:00');
  const diff = differenceInDays(d, new Date());
  const vencido = isPast(d) && !isToday(d);
  if (vencido) return <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium flex items-center gap-1"><AlertCircle className="w-3 h-3" />Vencido</span>;
  if (diff <= 7) return <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium flex items-center gap-1"><Clock className="w-3 h-3" />{diff}d</span>;
  return null;
}

export default function Processos() {
  const queryClient = useQueryClient();
  const { isAdmin, subgrupamentoId, modoAcesso, userEmail, canAccessModule, isLoading: loadingUser, isAccessResolved } = useCurrentUser();

  if (!loadingUser && !canAccessModule('processos')) return <AccessDenied modulo="Processos" />;
  const [view, setView] = useState('kanban');
  const [search, setSearch] = useState('');
  const [filterPrio, setFilterPrio] = useState('Todas');
  const [filterTipo, setFilterTipo] = useState('Todos');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [modal, setModal] = useState({ open: false, processo: null });

  const { data: processos = [], isLoading } = useQuery({
    queryKey: ['processos', isAdmin, subgrupamentoId],
    queryFn: () => {
         if (subgrupamentoId)ireturnfbase44.entities.Processo.filter({ subgrupamento_(d: subgripamentoId }, '-crsaAdd_date', 200);
      }
      if (modomin) return base44.entities.Processo.list('-created_date', 200);
         if (subgrupamentoId)ireturnfbase44.entities.Processo.filter({ subgrupamento_(d: subgrmpamentoId }, '-croadod_date', 200);
      }
      if (modoAcesso === 'setor' || modoAcesso === 'subsetor') {
         if (subgrupamentoId) return base44.entities.Processo.filter({ subgrupamento_id: subgrupamentoId }, '-created_date', 200);
      }
     
 if (modoAcesso === 'proprio' && userEmail) {
  const updateMutation =          return base44.entities.Processo.filter({ created_by: userEmail }, '-created_date', 200);
      }
     
 return [];
  const updateMutation =     },
    enabled: isAccessResolved,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Processo.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['processos'] }),
  });

  const filteredProcessos = useMemo(() => {
    return processos.filter(p => {
      const matchSearch = !search || p.titulo?.toLowerCase().includes(search.toLowerCase()) ||
        p.militar_nome?.toLowerCase().includes(search.toLowerCase()) ||
        p.numero_protocolo?.includes(search);
      const matchPrio = filterPrio === 'Todas' || p.prioridade === filterPrio;
      const matchTipo = filterTipo === 'Todos' || p.tipo === filterTipo;
      const matchStatus = filterStatus === 'Todos' || p.status === filterStatus;
      return matchSearch && matchPrio && matchTipo && matchStatus;
    });
  }, [processos, search, filterPrio, filterTipo, filterStatus]);

  const processosByStatus = useMemo(() => {
    const map = {};
    STATUSES.forEach(s => { map[s] = []; });
    filteredProcessos.forEach(p => {
      if (map[p.status]) map[p.status].push(p);
      else map['A Fazer'].push(p);
    });
    return map;
  }, [filteredProcessos]);

  const urgentes = processos.filter(p => {
    const data = p.data_limite || p.data_renovacao;
    if (!data) return false;
    const d = new Date(data + 'T00:00:00');
    const diff = differenceInDays(d, new Date());
    return (isPast(d) || diff <= 7) && p.status !== 'Concluído' && p.status !== 'Arquivado';
  }).length;

  const onDragEnd = async (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    const newStatus = destination.droppableId;
    await updateMutation.mutateAsync({ id: draggableId, data: { status: newStatus } });
  };

  const openModal = (processo = null, statusInicial = null) => {
    setModal({ open: true, processo: processo || (statusInicial ? { status: statusInicial } : null) });
  };

  const stats = {
    total: processos.filter(p => p.status !== 'Arquivado').length,
    emAndamento: processos.filter(p => p.status === 'Em Andamento').length,
    urgentes,
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#1e3a5f]">Processos & Tarefas</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {stats.total} ativos · {stats.emAndamento} em andamento
              {stats.urgentes > 0 && (
                <span className="text-red-600 font-medium ml-2 inline-flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> {stats.urgentes} urgente{stats.urgentes > 1 ? 's' : ''}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView('kanban')}
              className={`p-2 rounded-md transition-colors ${view === 'kanban' ? 'bg-[#1e3a5f] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            ><LayoutGrid className="w-4 h-4" /></button>
            <button
              onClick={() => setView('lista')}
              className={`p-2 rounded-md transition-colors ${view === 'lista' ? 'bg-[#1e3a5f] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            ><List className="w-4 h-4" /></button>
            <Button onClick={() => openModal()} className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white">
              <Plus className="w-4 h-4 mr-1" /> Novo Processo
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 mt-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por título, militar, protocolo..."
              className="pl-8 w-64 h-8 text-sm"
            />
          </div>
          <Select value={filterPrio} onValueChange={setFilterPrio}>
            <SelectTrigger className="w-32 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{PRIORIDADES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="w-44 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
          {view === 'lista' && (
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40 h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos os status</SelectItem>
                {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Conteúdo */}
      <div className="p-4 md:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : view === 'kanban' ? (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-4 overflow-x-auto pb-4">
              {STATUSES.map(status => (
                <KanbanColuna
                  key={status}
                  status={status}
                  processos={processosByStatus[status] || []}
                  onCardClick={p => openModal(p)}
                  onAddNew={s => openModal(null, s)}
                />
              ))}
            </div>
          </DragDropContext>
        ) : (
          /* Vista de Lista */
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Processo</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">Tipo</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden sm:table-cell">Militar</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Prioridade</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">Prazo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProcessos.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-slate-400">Nenhum processo encontrado</td></tr>
                ) : filteredProcessos.map(p => (
                  <tr
                    key={p.id}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => openModal(p)}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-slate-800">{p.titulo}</p>
                        {p.numero_protocolo && <p className="text-xs text-slate-400">Prot. {p.numero_protocolo}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{p.tipo || '—'}</td>
                    <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">
                      {p.militar_nome ? `${p.militar_posto} ${p.militar_nome}` : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-full">{p.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        p.prioridade === 'Urgente' ? 'bg-red-100 text-red-700' :
                        p.prioridade === 'Alta'    ? 'bg-orange-100 text-orange-700' :
                        p.prioridade === 'Média'   ? 'bg-blue-100 text-blue-700' :
                                                     'bg-slate-100 text-slate-600'
                      }`}>{p.prioridade}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <PrazoChip data={p.data_limite || p.data_renovacao} />
                      {!(p.data_limite || p.data_renovacao) && <span className="text-slate-300 text-xs">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ProcessoModal
        open={modal.open}
        onClose={() => setModal({ open: false, processo: null })}
        processo={modal.processo}
      />
    </div>
  );
}