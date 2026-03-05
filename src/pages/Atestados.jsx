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
import { Plus, Search, FileText, Calendar, AlertCircle } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import AtestadoCard from '@/components/atestado/AtestadoCard';

export default function Atestados() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Ativo');
  const [tipoFilter, setTipoFilter] = useState('all');
  const [showAll, setShowAll] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [atestadoToDelete, setAtestadoToDelete] = useState(null);

  const { data: atestados = [], isLoading } = useQuery({
    queryKey: ['atestados'],
    queryFn: () => base44.entities.Atestado.list('-created_date')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Atestado.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atestados'] });
      setDeleteDialogOpen(false);
      setAtestadoToDelete(null);
    }
  });

  const filteredAtestados = atestados.filter(a => {
    const matchesSearch = 
      a.militar_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.militar_matricula?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.medico?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.cid_10?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const effectiveStatus = showAll ? 'all' : statusFilter;
    const matchesStatus = effectiveStatus === 'all' || a.status === effectiveStatus;
    const matchesTipo = tipoFilter === 'all' || a.tipo === tipoFilter;
    
    return matchesSearch && matchesStatus && matchesTipo;
  });

  const handleEdit = (atestado) => {
    navigate(createPageUrl('CadastrarAtestado') + `?id=${atestado.id}`);
  };

  const handleDelete = (atestado) => {
    setAtestadoToDelete(atestado);
    setDeleteDialogOpen(true);
  };

  const handleView = (atestado) => {
    navigate(createPageUrl('VerAtestado') + `?id=${atestado.id}`);
  };

  const confirmDelete = () => {
    if (atestadoToDelete) {
      deleteMutation.mutate(atestadoToDelete.id);
    }
  };

  // Estatísticas
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const stats = {
    total: atestados.length,
    ativos: atestados.filter(a => a.status === 'Ativo').length,
    retornoProximo: atestados.filter(a => {
      if (a.status !== 'Ativo' || !a.data_retorno) return false;
      const retorno = new Date(a.data_retorno + 'T00:00:00');
      const diff = differenceInDays(retorno, hoje);
      return diff >= 0 && diff <= 7;
    }).length,
    atrasados: atestados.filter(a => {
      if (a.status !== 'Ativo' || !a.data_retorno) return false;
      const retorno = new Date(a.data_retorno + 'T00:00:00');
      return differenceInDays(retorno, hoje) < 0;
    }).length
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#1e3a5f]">Atestados Médicos</h1>
            <p className="text-slate-500">Controle de afastamentos e atestados</p>
          </div>
          <Button
            onClick={() => navigate(createPageUrl('CadastrarAtestado'))}
            className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white"
          >
            <Plus className="w-5 h-5 mr-2" />
            Novo Atestado
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#1e3a5f]/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-[#1e3a5f]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1e3a5f]">{stats.total}</p>
                <p className="text-xs text-slate-500">Total</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <FileText className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600">{stats.ativos}</p>
                <p className="text-xs text-slate-500">Ativos</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">{stats.retornoProximo}</p>
                <p className="text-xs text-slate-500">Retorno em 7 dias</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{stats.atrasados}</p>
                <p className="text-xs text-slate-500">Atrasados</p>
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
                placeholder="Buscar por militar, matrícula, médico ou CID..."
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
                  <SelectItem value="Ativo">Ativo</SelectItem>
                  <SelectItem value="Encerrado">Encerrado</SelectItem>
                  <SelectItem value="Cancelado">Cancelado</SelectItem>
                  <SelectItem value="Prorrogado">Prorrogado</SelectItem>
                </SelectContent>
              </Select>
              <Select value={tipoFilter} onValueChange={setTipoFilter}>
                <SelectTrigger className="w-40 h-10 border-slate-200">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Tipos</SelectItem>
                  <SelectItem value="Médico">Médico</SelectItem>
                  <SelectItem value="Odontológico">Odontológico</SelectItem>
                  <SelectItem value="Psicológico">Psicológico</SelectItem>
                  <SelectItem value="Acompanhamento">Acompanhamento</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
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
          {filteredAtestados.length} atestado(s) encontrado(s)
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredAtestados.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center">
            <FileText className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">
              Nenhum atestado encontrado
            </h3>
            <p className="text-slate-500 mb-6">
              {searchTerm || statusFilter !== 'all' || tipoFilter !== 'all'
                ? 'Tente ajustar os filtros de busca'
                : 'Comece cadastrando o primeiro atestado'}
            </p>
            {!searchTerm && statusFilter === 'all' && tipoFilter === 'all' && (
              <Button
                onClick={() => navigate(createPageUrl('CadastrarAtestado'))}
                className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white"
              >
                <Plus className="w-5 h-5 mr-2" />
                Cadastrar Atestado
              </Button>
            )}
          </div>
        ) : (
          <div className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
              : 'space-y-3'
          }>
            {filteredAtestados.map((atestado) => (
              <AtestadoCard
                key={atestado.id}
                atestado={atestado}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onView={handleView}
              />
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
              Tem certeza que deseja excluir este atestado? Esta ação não pode ser desfeita.
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