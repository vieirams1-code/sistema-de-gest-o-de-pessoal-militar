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
import { Plus, Search, Calendar, CheckCircle, Clock, Grid3X3, List } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { format } from 'date-fns';

const statusColors = {
  'Prevista': 'bg-slate-100 text-slate-700',
  'Autorizada': 'bg-blue-100 text-blue-700',
  'Em Curso': 'bg-amber-100 text-amber-700',
  'Gozada': 'bg-emerald-100 text-emerald-700',
  'Interrompida': 'bg-orange-100 text-orange-700',
  'Cancelada': 'bg-red-100 text-red-700'
};

export default function Ferias() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [feriasToDelete, setFeriasToDelete] = useState(null);

  const { data: ferias = [], isLoading } = useQuery({
    queryKey: ['ferias'],
    queryFn: () => base44.entities.Ferias.list('-data_inicio')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Ferias.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ferias'] });
      setDeleteDialogOpen(false);
      setFeriasToDelete(null);
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

  const handleEdit = (f) => {
    navigate(createPageUrl('CadastrarFerias') + `?id=${f.id}`);
  };

  const handleDelete = (f) => {
    setFeriasToDelete(f);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (feriasToDelete) {
      deleteMutation.mutate(feriasToDelete.id);
    }
  };

  const stats = {
    total: ferias.length,
    emCurso: ferias.filter(f => f.status === 'Em Curso').length,
    previstas: ferias.filter(f => f.status === 'Prevista' || f.status === 'Autorizada').length,
    gozadas: ferias.filter(f => f.status === 'Gozada').length
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return format(new Date(dateString + 'T00:00:00'), "dd/MM/yyyy");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#1e3a5f]">Férias</h1>
            <p className="text-slate-500">Controle de férias concedidas</p>
          </div>
          <Button
            onClick={() => navigate(createPageUrl('CadastrarFerias'))}
            className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nova Férias
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#1e3a5f]/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-[#1e3a5f]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1e3a5f]">{stats.total}</p>
                <p className="text-xs text-slate-500">Total</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">{stats.emCurso}</p>
                <p className="text-xs text-slate-500">Em Curso</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">{stats.previstas}</p>
                <p className="text-xs text-slate-500">Previstas</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600">{stats.gozadas}</p>
                <p className="text-xs text-slate-500">Gozadas</p>
              </div>
            </div>
          </div>
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
            <div className="flex gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 h-10 border-slate-200">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Status</SelectItem>
                  <SelectItem value="Prevista">Prevista</SelectItem>
                  <SelectItem value="Autorizada">Autorizada</SelectItem>
                  <SelectItem value="Em Curso">Em Curso</SelectItem>
                  <SelectItem value="Gozada">Gozada</SelectItem>
                  <SelectItem value="Cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex border border-slate-200 rounded-lg overflow-hidden">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="icon"
                  onClick={() => setViewMode('grid')}
                  className={viewMode === 'grid' ? 'bg-[#1e3a5f] hover:bg-[#2d4a6f]' : ''}
                >
                  <Grid3X3 className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="icon"
                  onClick={() => setViewMode('list')}
                  className={viewMode === 'list' ? 'bg-[#1e3a5f] hover:bg-[#2d4a6f]' : ''}
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Results count */}
        <div className="mb-4 text-sm text-slate-500">
          {filteredFerias.length} férias encontrada(s)
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredFerias.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center">
            <Calendar className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">
              Nenhuma férias encontrada
            </h3>
            <p className="text-slate-500 mb-6">
              {searchTerm || statusFilter !== 'all'
                ? 'Tente ajustar os filtros de busca'
                : 'Comece cadastrando as primeiras férias'}
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <Button
                onClick={() => navigate(createPageUrl('CadastrarFerias'))}
                className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white"
              >
                <Plus className="w-5 h-5 mr-2" />
                Cadastrar Férias
              </Button>
            )}
          </div>
        ) : (
          <div className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
              : 'space-y-3'
          }>
            {filteredFerias.map((f) => (
              <Card key={f.id} className="hover:shadow-md transition-all cursor-pointer" onClick={() => handleEdit(f)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {f.militar_posto && `${f.militar_posto} `}
                        {f.militar_nome}
                      </h3>
                      <p className="text-sm text-slate-500">Mat: {f.militar_matricula}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <Badge className={statusColors[f.status] || statusColors['Prevista']}>
                      {f.status}
                    </Badge>
                    {f.periodo_aquisitivo_ref && (
                      <Badge variant="outline">{f.periodo_aquisitivo_ref}</Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-slate-500">Início</p>
                      <p className="font-medium">{formatDate(f.data_inicio)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Retorno</p>
                      <p className="font-medium">{formatDate(f.data_retorno)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Dias</p>
                      <p className="font-medium">{f.dias} dias</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Tipo</p>
                      <p className="font-medium text-xs">{f.tipo}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este registro de férias? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}