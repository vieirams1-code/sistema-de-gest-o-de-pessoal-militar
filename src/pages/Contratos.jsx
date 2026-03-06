import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, FileText, AlertTriangle, Clock, CheckCircle, XCircle, Search, Calendar, Trash2 } from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import ContratoModal from '@/components/contratos/ContratoModal';
import { useCurrentUser } from '@/components/auth/useCurrentUser';

const POSTOS_OFICIAIS = ['Coronel', 'Tenente Coronel', 'Major', 'Capitão', '1º Tenente', '2º Tenente', 'Aspirante'];

function calcStatusContrato(data_fim) {
  if (!data_fim) return 'Vigente';
  const hoje = new Date();
  const fim = parseISO(data_fim);
  const diasRestantes = differenceInDays(fim, hoje);
  if (diasRestantes < 0) return 'Vencido';
  if (diasRestantes <= 90) return 'A vencer';
  return 'Vigente';
}

const statusConfig = {
  'Vigente': { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle },
  'A vencer': { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: AlertTriangle },
  'Vencido': { color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
  'Encerrado': { color: 'bg-slate-100 text-slate-600 border-slate-200', icon: XCircle },
  'Cancelado': { color: 'bg-slate-100 text-slate-500 border-slate-200', icon: XCircle },
};

function formatDate(d) {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd/MM/yyyy'); } catch { return d; }
}

export default function Contratos() {
  const queryClient = useQueryClient();
  const { isAdmin } = useCurrentUser();
  const [search, setSearch] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [showModal, setShowModal] = useState(false);
  const [editingContrato, setEditingContrato] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const { data: contratos = [], isLoading } = useQuery({
    queryKey: ['contratos'],
    queryFn: () => base44.entities.ContratoConvocacao.list('-data_fim'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ContratoConvocacao.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contratos'] }); setDeleteId(null); }
  });

  // Calcular status dinâmico
  const contratosComStatus = useMemo(() => contratos.map(c => {
    const statusDinamico = ['Encerrado', 'Cancelado'].includes(c.status)
      ? c.status
      : calcStatusContrato(c.data_fim);
    return { ...c, statusDinamico };
  }), [contratos]);

  const filtrados = useMemo(() => contratosComStatus.filter(c => {
    if (filtroStatus !== 'todos' && c.statusDinamico !== filtroStatus) return false;
    if (filtroTipo !== 'todos' && c.tipo_contrato !== filtroTipo) return false;
    if (search && !c.militar_nome?.toLowerCase().includes(search.toLowerCase()) &&
        !c.militar_matricula?.includes(search)) return false;
    return true;
  }), [contratosComStatus, filtroStatus, filtroTipo, search]);

  // Stats
  const stats = useMemo(() => ({
    vigentes: contratosComStatus.filter(c => c.statusDinamico === 'Vigente').length,
    aVencer: contratosComStatus.filter(c => c.statusDinamico === 'A vencer').length,
    vencidos: contratosComStatus.filter(c => c.statusDinamico === 'Vencido').length,
  }), [contratosComStatus]);

  const diasRestantes = (data_fim) => {
    if (!data_fim) return null;
    try {
      const d = differenceInDays(parseISO(data_fim), new Date());
      return d;
    } catch { return null; }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#1e3a5f]">Contratos de Convocação/Designação</h1>
            <p className="text-slate-500 text-sm">Controle de militares RR em serviço ativo</p>
          </div>
          <Button onClick={() => { setEditingContrato(null); setShowModal(true); }} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
            <Plus className="w-4 h-4 mr-2" /> Novo Contrato
          </Button>
        </div>

        {/* Cards de resumo */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-emerald-200 p-4 flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
            <div>
              <p className="text-2xl font-bold text-emerald-700">{stats.vigentes}</p>
              <p className="text-sm text-slate-500">Vigentes</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-amber-200 p-4 flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
            <div>
              <p className="text-2xl font-bold text-amber-700">{stats.aVencer}</p>
              <p className="text-sm text-slate-500">A vencer (90 dias)</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-red-200 p-4 flex items-center gap-3">
            <XCircle className="w-8 h-8 text-red-500" />
            <div>
              <p className="text-2xl font-bold text-red-700">{stats.vencidos}</p>
              <p className="text-sm text-slate-500">Vencidos</p>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Buscar militar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              <SelectItem value="Vigente">Vigente</SelectItem>
              <SelectItem value="A vencer">A vencer</SelectItem>
              <SelectItem value="Vencido">Vencido</SelectItem>
              <SelectItem value="Encerrado">Encerrado</SelectItem>
              <SelectItem value="Cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos tipos</SelectItem>
              <SelectItem value="Convocação">Convocação</SelectItem>
              <SelectItem value="Designação">Designação</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Lista */}
        {isLoading ? (
          <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" /></div>
        ) : filtrados.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
            <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">Nenhum contrato encontrado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtrados.map(c => {
              const cfg = statusConfig[c.statusDinamico] || statusConfig['Vigente'];
              const StatusIcon = cfg.icon;
              const dias = diasRestantes(c.data_fim);
              return (
                <div key={c.id} className={`bg-white rounded-xl border shadow-sm p-4 ${c.statusDinamico === 'A vencer' ? 'border-amber-300' : c.statusDinamico === 'Vencido' ? 'border-red-300' : 'border-slate-200'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge className={cfg.color + ' text-xs flex items-center gap-1'}>
                          <StatusIcon className="w-3 h-3" />
                          {c.statusDinamico}
                        </Badge>
                        <Badge variant="outline" className="text-xs">{c.tipo_contrato}</Badge>
                        {c.statusDinamico === 'A vencer' && dias !== null && (
                          <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            ⚠ Vence em {dias} dia(s) — Iniciar renovação!
                          </span>
                        )}
                        {c.statusDinamico === 'Vencido' && (
                          <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                            ⚠ Retornar para Reserva Remunerada
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-slate-900">{c.militar_posto} {c.militar_nome}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Mat. {c.militar_matricula}</p>
                      <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-600">
                        <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {formatDate(c.data_inicio)} até {formatDate(c.data_fim)}</span>
                        {c.numero_doems && <span>DOEMS: {c.numero_doems}</span>}
                        {c.data_doems && <span>Data DOEMS: {formatDate(c.data_doems)}</span>}
                      </div>
                      {c.observacoes && <p className="text-xs text-slate-400 mt-1">{c.observacoes}</p>}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => { setEditingContrato(c); setShowModal(true); }}>Editar</Button>
                      <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => setDeleteId(c.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <ContratoModal
          contrato={editingContrato}
          onClose={() => setShowModal(false)}
          onSave={() => { queryClient.invalidateQueries({ queryKey: ['contratos'] }); setShowModal(false); }}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contrato?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteMutation.mutate(deleteId)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}