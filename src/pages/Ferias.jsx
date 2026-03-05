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
import { Plus, Search, Calendar, CheckCircle, Clock, Settings, Trash2, Pencil, AlertTriangle } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusColors = {
  'Prevista': 'bg-slate-100 text-slate-700',
  'Em Curso': 'bg-amber-100 text-amber-700',
  'Gozada': 'bg-emerald-100 text-emerald-700',
  'Interrompida': 'bg-orange-100 text-orange-700',
};

export default function Ferias() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Delete flow states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [feriasToDelete, setFeriasToDelete] = useState(null);
  const [livrosVinculados, setLivrosVinculados] = useState([]);
  const [livrosDialogOpen, setLivrosDialogOpen] = useState(false);
  const [deletingLivroId, setDeletingLivroId] = useState(null);
  const [deletingLivro, setDeletingLivro] = useState(false);

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
            { label: 'Total', value: stats.total, icon: Calendar, color: '[#1e3a5f]', bg: '[#1e3a5f]/10' },
            { label: 'Em Curso', value: stats.emCurso, icon: Clock, color: 'amber-600', bg: 'amber-100' },
            { label: 'Previstas', value: stats.previstas, icon: Calendar, color: 'blue-600', bg: 'blue-100' },
            { label: 'Gozadas', value: stats.gozadas, icon: CheckCircle, color: 'emerald-600', bg: 'emerald-100' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg bg-${s.bg} flex items-center justify-center`}>
                  <s.icon className={`w-5 h-5 text-${s.color}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold text-${s.color}`}>{s.value}</p>
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
                        <th className="text-right px-4 py-3 font-semibold text-slate-600">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grupo.items.map(f => (
                        <tr key={f.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <span className="font-medium text-slate-900">{f.militar_posto && <span className="text-slate-500 mr-1 text-xs">{f.militar_posto}</span>}{f.militar_nome}</span>
                            <p className="text-xs text-slate-400">Mat: {f.militar_matricula}</p>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{f.periodo_aquisitivo_ref || '-'}</td>
                          <td className="px-4 py-3 text-slate-700">{formatDate(f.data_inicio)}</td>
                          <td className="px-4 py-3 text-slate-700">{formatDate(f.data_retorno)}</td>
                          <td className="px-4 py-3 text-slate-700">{f.dias}d</td>
                          <td className="px-4 py-3">
                            {f.fracionamento && <Badge className="bg-purple-100 text-purple-700 text-xs">{f.fracionamento}</Badge>}
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={`${statusColors[f.status] || 'bg-slate-100 text-slate-700'} text-xs`}>{f.status}</Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-[#1e3a5f]"
                                onClick={() => navigate(createPageUrl('CadastrarFerias') + `?id=${f.id}`)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600"
                                onClick={() => handleDelete(f)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
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