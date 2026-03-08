import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Search, Calendar, CheckCircle, Clock, Settings, Trash2, Pencil, AlertTriangle, MoreHorizontal, LogIn, LogOut, PauseCircle, PlusCircle, MinusCircle, GitBranch } from 'lucide-react';
import RegistroLivroModal from '@/components/ferias/RegistroLivroModal';
import FamiliaFeriasPanel from '@/components/ferias/FamiliaFeriasPanel';
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, parseISO, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCurrentUser } from '@/components/auth/useCurrentUser';

const statusColors = {
  'Prevista': 'bg-slate-100 text-slate-700',
  'Em Curso': 'bg-amber-100 text-amber-700',
  'Gozada': 'bg-emerald-100 text-emerald-700',
  'Interrompida': 'bg-orange-100 text-orange-700',
};

export default function Ferias() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser, isAdmin } = useCurrentUser();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Delete flow states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [feriasToDelete, setFeriasToDelete] = useState(null);
  const [livrosVinculados, setLivrosVinculados] = useState([]);
  const [livrosDialogOpen, setLivrosDialogOpen] = useState(false);
  const [deletingLivroId, setDeletingLivroId] = useState(null);
  const [deletingLivro, setDeletingLivro] = useState(false);

  // Estado para o modal de registro de livro
  const [registroLivroModal, setRegistroLivroModal] = useState({ open: false, ferias: null, tipo: 'Saída Férias' });

  // Modal editar data início
  const [editDataModal, setEditDataModal] = useState({ open: false, ferias: null, novaData: '' });
  // Modal adicionar dias
  const [addDiasModal, setAddDiasModal] = useState({ open: false, ferias: null, dias: 1, motivo: '' });
  // Modal desconto férias
  const [descontoModal, setDescontoModal] = useState({ open: false, ferias: null, dias: 1, motivo: '' });
  // interromperModal removido — usa diretamente RegistroLivroModal com tipo 'Interrupção de Férias'
  const [savingEdit, setSavingEdit] = useState(false);
  const [familiaPanel, setFamiliaPanel] = useState({ open: false, ferias: null });

  const { data: ferias = [], isLoading } = useQuery({
    queryKey: ['ferias'],
    queryFn: () => base44.entities.Ferias.list('-data_inicio')
  });

  const { data: registrosLivro = [] } = useQuery({
    queryKey: ['registros-livro-all'],
    queryFn: () => base44.entities.RegistroLivro.list()
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ feriasId, periodoId }) => {
      await base44.entities.Ferias.delete(feriasId);
      if (periodoId) {
        await base44.entities.PeriodoAquisitivo.update(periodoId, {
          status: 'Disponível',
          dias_gozados: 0,
          dias_previstos: 0
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ferias'] });
      queryClient.invalidateQueries({ queryKey: ['periodos-aquisitivos'] });
      setDeleteDialogOpen(false);
      setFeriasToDelete(null);
      setLivrosVinculados([]);
    }
  });

  const deleteLivroMutation = useMutation({
    mutationFn: (id) => base44.entities.RegistroLivro.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registros-livro-all'] });
      setDeletingLivroId(null);
    }
  });

  const filteredFerias = ferias.filter(f => {
    const matchesSearch =
      f.militar_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.militar_matricula?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.periodo_aquisitivo_ref?.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || f.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Agrupar por mês/ano da data de início
  const feriasAgrupadas = filteredFerias.reduce((acc, f) => {
    if (!f.data_inicio) {
      const key = 'Sem data';
      if (!acc[key]) acc[key] = { label: 'Sem data', items: [], sortKey: '9999-99' };
      acc[key].items.push(f);
      return acc;
    }
    const d = parseISO(f.data_inicio + 'T00:00:00');
    const key = format(d, 'yyyy-MM');
    const label = format(d, "MMMM 'de' yyyy", { locale: ptBR });
    if (!acc[key]) acc[key] = { label, items: [], sortKey: key };
    acc[key].items.push(f);
    return acc;
  }, {});

  const gruposOrdenados = Object.values(feriasAgrupadas).sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  const handleDelete = async (f) => {
    setFeriasToDelete(f);
    // Verificar lançamentos de livro vinculados
    const vinculados = registrosLivro.filter(r => r.ferias_id === f.id);
    setLivrosVinculados(vinculados);
    if (vinculados.length > 0) {
      setLivrosDialogOpen(true);
    } else {
      setDeleteDialogOpen(true);
    }
  };

  const confirmDelete = () => {
    if (feriasToDelete) {
      deleteMutation.mutate({
        feriasId: feriasToDelete.id,
        periodoId: feriasToDelete.periodo_aquisitivo_id
      });
    }
  };

  const handleDeleteLivro = async (livroId) => {
    setDeletingLivroId(livroId);
    await deleteLivroMutation.mutateAsync(livroId);
    const remaining = livrosVinculados.filter(l => l.id !== livroId);
    setLivrosVinculados(remaining);
    if (remaining.length === 0) {
      setLivrosDialogOpen(false);
      setDeleteDialogOpen(true);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return format(new Date(dateString + 'T00:00:00'), "dd/MM/yyyy");
  };

  const handleSalvarEditData = async () => {
    if (!editDataModal.ferias || !editDataModal.novaData) return;
    setSavingEdit(true);
    const f = editDataModal.ferias;
    const novaDataFim = format(addDays(new Date(editDataModal.novaData + 'T00:00:00'), f.dias - 1), 'yyyy-MM-dd');
    const novaDataRetorno = format(addDays(new Date(editDataModal.novaData + 'T00:00:00'), f.dias), 'yyyy-MM-dd');
    await base44.entities.Ferias.update(f.id, {
      data_inicio: editDataModal.novaData,
      data_fim: novaDataFim,
      data_retorno: novaDataRetorno,
    });
    queryClient.invalidateQueries({ queryKey: ['ferias'] });
    setSavingEdit(false);
    setEditDataModal({ open: false, ferias: null, novaData: '' });
  };

  /**
   * Calcula dias totais a partir da base imutável + eventos persistidos + novo evento opcional.
   * Usa SEMPRE dias_base como ponto de partida — nunca f.dias.
   * idsExcluir: lista de IDs de eventos a ignorar (para cálculo pós-exclusão antes do refetch).
   */
  const recalcularDiasLocalmente = (f, novoEvento, idsExcluir = []) => {
    const diasBase = f.dias_base || f.dias_originais || f.dias || 0;
    const eventosExistentes = registrosLivro.filter(r => r.ferias_id === f.id && !idsExcluir.includes(r.id));
    const todosEventos = novoEvento ? [...eventosExistentes, novoEvento] : eventosExistentes;
    const totalAdicoes = todosEventos.filter(e => e.tipo_registro === 'Adição de Dias').reduce((s, e) => s + (e.dias_evento || 0), 0);
    const totalDescontos = todosEventos.filter(e => e.tipo_registro === 'Desconto em Férias' || e.tipo_registro === 'Dispensa Desconto Férias').reduce((s, e) => s + (e.dias_evento || 0), 0);
    return Math.max(0, diasBase + totalAdicoes - totalDescontos);
  };

  /**
   * Reconstrói observações SOMENTE a partir dos eventos persistidos + novo evento.
   * Não reaproveia texto livre — apenas linhas derivadas de Adição/Desconto.
   * idsExcluir: lista de IDs de eventos a ignorar.
   */
  const reconstruirObservacoesDerivadas = (f, novoEvento, idsExcluir = []) => {
    const eventosExistentes = registrosLivro.filter(r => r.ferias_id === f.id && !idsExcluir.includes(r.id));
    const todosEventos = novoEvento ? [...eventosExistentes, novoEvento] : eventosExistentes;
    const linhas = [];
    todosEventos.forEach(e => {
      if (e.tipo_registro === 'Adição de Dias' && e.dias_evento) {
        linhas.push(`+${e.dias_evento}d: ${e.motivo_dispensa || 'Adição de dias'}`);
      } else if ((e.tipo_registro === 'Desconto em Férias' || e.tipo_registro === 'Dispensa Desconto Férias') && e.dias_evento) {
        linhas.push(`-${e.dias_evento}d: ${e.motivo_dispensa || 'Desconto em férias'}`);
      }
    });
    return linhas.join('\n');
  };

  const handleSalvarAddDias = async () => {
    if (!addDiasModal.ferias || !addDiasModal.dias) return;
    setSavingEdit(true);
    const f = addDiasModal.ferias;
    const qtdDias = Number(addDiasModal.dias);
    const hoje = new Date().toISOString().split('T')[0];

    // dias_base: fonte de verdade imutável — se não existir, calcular agora sem adicionar o novo evento
    // Isso garante que dias_base seja gravado corretamente antes de qualquer adição futura
    const diasBase = f.dias_base || f.dias_originais || recalcularDiasLocalmente(f, null);

    const novoEvento = {
      ferias_id: f.id,
      tipo_registro: 'Adição de Dias',
      dias_evento: qtdDias,
      motivo_dispensa: addDiasModal.motivo,
    };

    const novaQtd = recalcularDiasLocalmente(f, novoEvento);
    const novaDataFim = f.data_inicio
      ? format(addDays(new Date(f.data_inicio + 'T00:00:00'), novaQtd - 1), 'yyyy-MM-dd')
      : f.data_fim;
    const novaDataRetorno = f.data_inicio
      ? format(addDays(new Date(f.data_inicio + 'T00:00:00'), novaQtd), 'yyyy-MM-dd')
      : f.data_retorno;
    const novasObs = reconstruirObservacoesDerivadas(f, novoEvento);

    // Adição NÃO gera publicação — apenas evento interno da cadeia
    await Promise.all([
      base44.entities.RegistroLivro.create({
        militar_id: f.militar_id,
        militar_nome: f.militar_nome,
        militar_posto: f.militar_posto,
        militar_matricula: f.militar_matricula,
        ferias_id: f.id,
        tipo_registro: 'Adição de Dias',
        data_registro: hoje,
        dias_evento: qtdDias,
        motivo_dispensa: addDiasModal.motivo,
        status: 'Publicado',
      }),
      base44.entities.Ferias.update(f.id, {
        dias: novaQtd,
        dias_base: diasBase, // sempre gravar para garantir fonte de verdade
        data_fim: novaDataFim,
        data_retorno: novaDataRetorno,
        observacoes: novasObs,
      }),
    ]);

    queryClient.invalidateQueries({ queryKey: ['ferias'] });
    queryClient.invalidateQueries({ queryKey: ['registros-livro-all'] });
    setSavingEdit(false);
    setAddDiasModal({ open: false, ferias: null, dias: 1, motivo: '' });
  };

  const handleSalvarDesconto = async () => {
    if (!descontoModal.ferias || !descontoModal.dias) return;
    setSavingEdit(true);
    const f = descontoModal.ferias;
    const diasDesconto = Number(descontoModal.dias);
    const hoje = new Date().toISOString().split('T')[0];

    // dias_base: fonte de verdade imutável — garantir que está gravado antes do desconto
    const diasBase = f.dias_base || f.dias_originais || recalcularDiasLocalmente(f, null);

    const novoEvento = {
      ferias_id: f.id,
      tipo_registro: 'Dispensa Desconto Férias',
      dias_evento: diasDesconto,
      motivo_dispensa: descontoModal.motivo,
    };

    const novaQtd = recalcularDiasLocalmente(f, novoEvento);
    const novaDataFim = f.data_inicio
      ? format(addDays(new Date(f.data_inicio + 'T00:00:00'), novaQtd - 1), 'yyyy-MM-dd')
      : f.data_fim;
    const novaDataRetorno = f.data_inicio
      ? format(addDays(new Date(f.data_inicio + 'T00:00:00'), novaQtd), 'yyyy-MM-dd')
      : f.data_retorno;
    const novasObs = reconstruirObservacoesDerivadas(f, novoEvento);

    // Gerar APENAS um registro no Livro com tipo 'Dispensa Desconto Férias'
    // NÃO criar PublicacaoExOfficio — desconto gera somente este lançamento no Livro
    await Promise.all([
      base44.entities.RegistroLivro.create({
        militar_id: f.militar_id,
        militar_nome: f.militar_nome,
        militar_posto: f.militar_posto,
        militar_matricula: f.militar_matricula,
        ferias_id: f.id,
        tipo_registro: 'Dispensa Desconto Férias',
        data_registro: hoje,
        dias_evento: diasDesconto,
        dias: diasDesconto,
        motivo_dispensa: descontoModal.motivo,
        periodo_aquisitivo: f.periodo_aquisitivo_ref,
        dias_restantes: novaQtd,
        status: 'Aguardando Nota',
      }),
      base44.entities.Ferias.update(f.id, {
        dias: novaQtd,
        ...(f.dias_base ? {} : { dias_base: f.dias_originais || f.dias }),
        data_fim: novaDataFim,
        data_retorno: novaDataRetorno,
        observacoes: novasObs,
      }),
    ]);

    queryClient.invalidateQueries({ queryKey: ['ferias'] });
    queryClient.invalidateQueries({ queryKey: ['registros-livro-all'] });
    setSavingEdit(false);
    setDescontoModal({ open: false, ferias: null, dias: 1, motivo: '' });
  };

  const stats = {
    total: ferias.length,
    emCurso: ferias.filter(f => f.status === 'Em Curso').length,
    previstas: ferias.filter(f => f.status === 'Prevista').length,
    gozadas: ferias.filter(f => f.status === 'Gozada').length
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#1e3a5f]">Férias</h1>
            <p className="text-slate-500">Plano de férias por período</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(createPageUrl('PeriodosAquisitivos'))} className="border-slate-300">
              <Settings className="w-4 h-4 mr-2" />
              Períodos Aquisitivos
            </Button>
            <Button onClick={() => navigate(createPageUrl('CadastrarFerias'))} className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white">
              <Plus className="w-5 h-5 mr-2" />
              Nova Férias
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total', value: stats.total, icon: Calendar, iconBg: 'bg-[#1e3a5f]/10', iconText: 'text-[#1e3a5f]', valueText: 'text-[#1e3a5f]' },
            { label: 'Em Curso', value: stats.emCurso, icon: Clock, iconBg: 'bg-amber-100', iconText: 'text-amber-600', valueText: 'text-amber-600' },
            { label: 'Previstas', value: stats.previstas, icon: Calendar, iconBg: 'bg-blue-100', iconText: 'text-blue-600', valueText: 'text-blue-600' },
            { label: 'Gozadas', value: stats.gozadas, icon: CheckCircle, iconBg: 'bg-emerald-100', iconText: 'text-emerald-600', valueText: 'text-emerald-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${s.iconBg} flex items-center justify-center`}>
                  <s.icon className={`w-5 h-5 ${s.iconText}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${s.valueText}`}>{s.value}</p>
                  <p className="text-xs text-slate-500">{s.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Buscar por militar, matrícula ou período..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10 border-slate-200"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 h-10 border-slate-200">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="Prevista">Prevista</SelectItem>
                <SelectItem value="Em Curso">Em Curso</SelectItem>
                <SelectItem value="Gozada">Gozada</SelectItem>
                <SelectItem value="Interrompida">Interrompida</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mb-4 text-sm text-slate-500">{filteredFerias.length} férias encontrada(s)</div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredFerias.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center">
            <Calendar className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">Nenhuma férias encontrada</h3>
            <p className="text-slate-500 mb-6">
              {searchTerm || statusFilter !== 'all' ? 'Tente ajustar os filtros' : 'Comece cadastrando as primeiras férias'}
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <Button onClick={() => navigate(createPageUrl('CadastrarFerias'))} className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white">
                <Plus className="w-5 h-5 mr-2" />Cadastrar Férias
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {gruposOrdenados.map(grupo => (
              <div key={grupo.sortKey}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-2 h-2 rounded-full bg-[#1e3a5f]" />
                  <h2 className="text-base font-semibold text-[#1e3a5f] capitalize">{grupo.label}</h2>
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-xs text-slate-400">{grupo.items.length} registro(s)</span>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Militar</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Período Aquisitivo</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Início</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Retorno</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Dias</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Fração</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                        <th className="text-center px-3 py-3 font-semibold text-slate-600 w-10" title="Rastro da família">
                          <GitBranch className="w-4 h-4 mx-auto text-slate-400" />
                        </th>
                        <th className="text-right px-4 py-3 font-semibold text-slate-600">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grupo.items.map(f => {
                        // Calcular saldo de dias para férias interrompidas
                        let saldoDias = null;
                        if (f.status === 'Interrompida' && f.observacoes) {
                          const match = f.observacoes.match(/Saldo: (\d+) dias/);
                          if (match) saldoDias = parseInt(match[1]);
                        }

                        return (
                        <tr key={f.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <span className="font-medium text-slate-900">{f.militar_posto && <span className="text-slate-500 mr-1 text-xs">{f.militar_posto}</span>}{f.militar_nome}</span>
                            <p className="text-xs text-slate-400">Mat: {f.militar_matricula}</p>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{f.periodo_aquisitivo_ref || '-'}</td>
                          <td className="px-4 py-3 text-slate-700">
                            <div className="flex items-center gap-1 group">
                              <span>{formatDate(f.data_inicio)}</span>
                              {f.status !== 'Gozada' && (
                                <button
                                  className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-[#1e3a5f]"
                                  title="Alterar data de início"
                                  onClick={() => setEditDataModal({ open: true, ferias: f, novaData: f.data_inicio || '' })}
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-700">{formatDate(f.data_retorno)}</td>
                          <td className="px-4 py-3 text-slate-700">
                            <span>{f.dias}d</span>
                            {saldoDias !== null && (
                              <p className="text-xs text-orange-600 font-medium">Saldo: {saldoDias}d</p>
                            )}
                            {/* Indicativos derivados em tempo real dos eventos do RegistroLivro */}
                            {(() => {
                              const ajustes = registrosLivro.filter(r =>
                                r.ferias_id === f.id &&
                                (r.tipo_registro === 'Adição de Dias' || r.tipo_registro === 'Desconto em Férias') &&
                                r.dias_evento
                              );
                              if (ajustes.length === 0) return null;
                              return (
                                <div className="mt-1 space-y-0.5">
                                  {ajustes.map(ev => {
                                    const isAdd = ev.tipo_registro === 'Adição de Dias';
                                    const motivo = ev.motivo_dispensa || '';
                                    const label = `${isAdd ? '+' : '-'}${ev.dias_evento}d${motivo ? ': ' + motivo : ''}`;
                                    return (
                                      <p key={ev.id} className={`text-xs font-medium ${isAdd ? 'text-green-600' : 'text-orange-600'}`}>{label}</p>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-3">
                            {f.fracionamento && <Badge className="bg-purple-100 text-purple-700 text-xs">{f.fracionamento}</Badge>}
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={`${statusColors[f.status] || 'bg-slate-100 text-slate-700'} text-xs`}>{f.status}</Badge>
                          </td>
                          <td className="px-3 py-3 text-center">
                            {(() => {
                              const temEventos = registrosLivro.some(r => r.ferias_id === f.id);
                              return temEventos ? (
                                <button
                                  title="Ver rastro da família"
                                  onClick={() => setFamiliaPanel({ open: true, ferias: f })}
                                  className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#1e3a5f]/8 hover:bg-[#1e3a5f]/15 text-[#1e3a5f] transition-colors"
                                >
                                  <GitBranch className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <span className="text-slate-200">
                                  <GitBranch className="w-3.5 h-3.5 mx-auto" />
                                </span>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-[#1e3a5f] hover:bg-slate-100">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                  {/* Prevista ou Interrompida: iniciar / reiniciar */}
                                  {(f.status === 'Prevista' || f.status === 'Autorizada' || f.status === 'Interrompida') && (
                                    <DropdownMenuItem onClick={() => setRegistroLivroModal({
                                      open: true,
                                      ferias: f,
                                      tipo: f.status === 'Interrompida' ? 'Nova Saída / Retomada' : 'Saída Férias'
                                    })}>
                                      <LogOut className="w-4 h-4 mr-2 text-emerald-600" />
                                      <span>{f.status === 'Interrompida' ? 'Reiniciar / Nova Saída' : 'Iniciar Férias (Registrar Saída)'}</span>
                                    </DropdownMenuItem>
                                  )}
                                  {/* Em Curso: Retornar ou Interromper */}
                                  {f.status === 'Em Curso' && (
                                    <>
                                      <DropdownMenuItem onClick={() => setRegistroLivroModal({ open: true, ferias: f, tipo: 'Retorno Férias' })}>
                                        <LogIn className="w-4 h-4 mr-2 text-blue-600" />
                                        <span>Registrar Retorno</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => setRegistroLivroModal({ open: true, ferias: f, tipo: 'Interrupção de Férias' })}>
                                        <PauseCircle className="w-4 h-4 mr-2 text-orange-600" />
                                        <span>Interromper Férias</span>
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {/* Adicionar/Desconto: apenas Prevista, Em Curso ou Interrompida */}
                                  {f.status !== 'Gozada' && (
                                    <>
                                      <DropdownMenuItem onClick={() => setAddDiasModal({ open: true, ferias: f, dias: 1, motivo: '' })}>
                                        <PlusCircle className="w-4 h-4 mr-2 text-purple-600" />
                                        <span>Adicionar Dias</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => setDescontoModal({ open: true, ferias: f, dias: 1, motivo: '' })}>
                                        <MinusCircle className="w-4 h-4 mr-2 text-orange-500" />
                                        <span>Desconto em Férias</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => setEditDataModal({ open: true, ferias: f, novaData: f.data_inicio || '' })}>
                                        <Pencil className="w-4 h-4 mr-2 text-slate-500" />
                                        <span>Alterar Data de Início</span>
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {/* Editar e Excluir: apenas se não Gozada */}
                                  {f.status !== 'Gozada' && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => navigate(createPageUrl('CadastrarFerias') + `?id=${f.id}`)}>
                                        <Pencil className="w-4 h-4 mr-2 text-slate-500" />
                                        <span>Editar Férias</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleDelete(f)} className="text-red-600 focus:text-red-600">
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        <span>Excluir Férias</span>
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {/* Gozada: somente leitura da família */}
                                  {f.status === 'Gozada' && (
                                    <DropdownMenuItem disabled className="text-slate-400 text-xs italic">
                                      Férias encerrada — sem ações operacionais
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialog: lançamentos de livro vinculados */}
      <Dialog open={livrosDialogOpen} onOpenChange={setLivrosDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              Lançamentos de Livro Vinculados
            </DialogTitle>
            <DialogDescription>
              Estas férias possuem {livrosVinculados.length} lançamento(s) de livro vinculados. Você pode excluí-los antes de excluir as férias, ou cancelar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {livrosVinculados.map(l => (
              <div key={l.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-slate-50">
                <div>
                  <p className="text-sm font-medium text-slate-800">{l.tipo_registro}</p>
                  <p className="text-xs text-slate-500">Data: {formatDate(l.data_registro)}{l.dias ? ` — ${l.dias} dias` : ''}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  disabled={deletingLivroId === l.id}
                  onClick={() => handleDeleteLivro(l.id)}
                >
                  {deletingLivroId === l.id ? (
                    <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setLivrosDialogOpen(false); setFeriasToDelete(null); }}>
              Cancelar
            </Button>
            {livrosVinculados.length === 0 && (
              <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => { setLivrosDialogOpen(false); setDeleteDialogOpen(true); }}>
                Prosseguir com exclusão
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Registro no Livro */}
      <RegistroLivroModal
        open={registroLivroModal.open}
        onClose={() => setRegistroLivroModal({ open: false, ferias: null, tipo: 'Saída Férias' })}
        ferias={registroLivroModal.ferias}
        tipoInicial={registroLivroModal.tipo}
      />

      {/* Modal: Alterar Data de Início */}
      <Dialog open={editDataModal.open} onOpenChange={v => !v && setEditDataModal({ open: false, ferias: null, novaData: '' })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[#1e3a5f]">Alterar Data de Início</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {editDataModal.ferias && (
              <p className="text-sm text-slate-500">
                {editDataModal.ferias.militar_posto} {editDataModal.ferias.militar_nome} — {editDataModal.ferias.dias} dias
              </p>
            )}
            <div>
              <Label className="text-sm font-medium text-slate-700">Nova data de início</Label>
              <Input
                type="date"
                value={editDataModal.novaData}
                onChange={e => setEditDataModal(p => ({ ...p, novaData: e.target.value }))}
                className="mt-1.5"
              />
              {editDataModal.novaData && editDataModal.ferias && (
                <p className="text-xs text-slate-500 mt-1">
                  Retorno: {formatDate(format(addDays(new Date(editDataModal.novaData + 'T00:00:00'), editDataModal.ferias.dias), 'yyyy-MM-dd'))}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditDataModal({ open: false, ferias: null, novaData: '' })}>Cancelar</Button>
              <Button
                disabled={savingEdit || !editDataModal.novaData}
                onClick={handleSalvarEditData}
                className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white"
              >
                {savingEdit ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> : null}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Adicionar Dias */}
      <Dialog open={addDiasModal.open} onOpenChange={v => !v && setAddDiasModal({ open: false, ferias: null, dias: 1, motivo: '' })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[#1e3a5f]">Adicionar Dias</DialogTitle>
            <DialogDescription>Adicione dias extras às férias e informe o motivo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {addDiasModal.ferias && (
              <p className="text-sm text-slate-500">
                {addDiasModal.ferias.militar_posto} {addDiasModal.ferias.militar_nome} — Atual: {addDiasModal.ferias.dias} dias
              </p>
            )}
            <div>
              <Label className="text-sm font-medium text-slate-700">Quantidade de dias a adicionar</Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={addDiasModal.dias}
                onChange={e => setAddDiasModal(p => ({ ...p, dias: Number(e.target.value) }))}
                className="mt-1.5 w-24"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">Motivo <span className="text-red-500">*</span></Label>
              <Textarea
                value={addDiasModal.motivo}
                onChange={e => setAddDiasModal(p => ({ ...p, motivo: e.target.value }))}
                rows={2}
                placeholder="Ex: Doação de sangue — Art. 46, §1º, Lei X.XXX"
                className="mt-1.5"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddDiasModal({ open: false, ferias: null, dias: 1, motivo: '' })}>Cancelar</Button>
              <Button
                disabled={savingEdit || !addDiasModal.motivo || !addDiasModal.dias}
                onClick={handleSalvarAddDias}
                className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white"
              >
                {savingEdit ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> : null}
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* interromperModal removido — agora usa RegistroLivroModal com tipo 'Interrupção de Férias' */}

      {/* Modal: Desconto em Férias */}
      <Dialog open={descontoModal.open} onOpenChange={v => !v && setDescontoModal({ open: false, ferias: null, dias: 1, motivo: '' })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-orange-600 flex items-center gap-2">
              <MinusCircle className="w-5 h-5" /> Desconto em Férias
            </DialogTitle>
            <DialogDescription>
              Registra o desconto e gera automaticamente a publicação <strong>Dispensa com Desconto em Férias</strong> (Aguardando Nota).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {descontoModal.ferias && (
              <div className="bg-slate-50 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600">
                <p className="font-medium text-slate-800">{descontoModal.ferias.militar_posto} {descontoModal.ferias.militar_nome}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Base: {descontoModal.ferias.dias_base || descontoModal.ferias.dias}d &nbsp;|&nbsp; Atual: {descontoModal.ferias.dias}d &nbsp;|&nbsp; Período: {descontoModal.ferias.periodo_aquisitivo_ref || '—'}
                </p>
              </div>
            )}
            <div>
              <Label className="text-sm font-medium text-slate-700">Dias a descontar</Label>
              <Input
                type="number"
                min={1}
                max={descontoModal.ferias?.dias || 30}
                value={descontoModal.dias}
                onChange={e => setDescontoModal(p => ({ ...p, dias: Number(e.target.value) }))}
                className="mt-1.5 w-24"
              />
              {descontoModal.ferias && (
                <p className="text-xs text-slate-500 mt-1">
                  Resultado após desconto: <strong className="text-orange-700">{recalcularDiasLocalmente(descontoModal.ferias, { tipo_registro: 'Desconto em Férias', dias_evento: Number(descontoModal.dias), ferias_id: descontoModal.ferias.id })} dias</strong>
                </p>
              )}
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">Motivo <span className="text-red-500">*</span></Label>
              <Textarea
                value={descontoModal.motivo}
                onChange={e => setDescontoModal(p => ({ ...p, motivo: e.target.value }))}
                rows={2}
                placeholder="Ex: Art. XX — desconto por falta injustificada"
                className="mt-1.5"
              />
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
              Será gerada uma publicação <strong>Dispensa com Desconto em Férias</strong> com status <strong>Aguardando Nota</strong>.
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDescontoModal({ open: false, ferias: null, dias: 1, motivo: '' })}>Cancelar</Button>
              <Button
                disabled={savingEdit || !descontoModal.motivo || !descontoModal.dias}
                onClick={handleSalvarDesconto}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                {savingEdit ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> : null}
                Confirmar Desconto
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Painel Família Férias — sempre usa a versão mais atualizada da férias do cache */}
      {familiaPanel.open && (() => {
        // Sincroniza com o dado mais recente do cache (após invalidateQueries)
        const feriasSinc = ferias.find(f => f.id === familiaPanel.ferias?.id) || familiaPanel.ferias;
        return (
          <>
            <div
              className="fixed inset-0 bg-black/30 z-40"
              onClick={() => setFamiliaPanel({ open: false, ferias: null })}
            />
            <FamiliaFeriasPanel
              ferias={feriasSinc}
              registrosLivro={registrosLivro}
              onClose={() => setFamiliaPanel({ open: false, ferias: null })}
              currentUser={currentUser}
            />
          </>
        );
      })()}

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir estas férias de <strong>{feriasToDelete?.militar_nome}</strong>?
              {feriasToDelete?.periodo_aquisitivo_id && (
                <span className="block mt-2 text-amber-700 bg-amber-50 p-2 rounded">
                  O período aquisitivo <strong>{feriasToDelete?.periodo_aquisitivo_ref}</strong> voltará ao status <strong>Disponível</strong>.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}