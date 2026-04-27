import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
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
import { Plus, Search, Users, Grid3X3, List, GitBranch } from 'lucide-react';
import MilitarCard from '@/components/militar/MilitarCard';
import MapaDeLotacao from '@/components/militar/MapaDeLotacao';
import {
  carregarMilitaresComMatriculas,
  filtrarMilitaresOperacionais,
  militarCorrespondeBusca,
} from '@/services/matriculaMilitarViewService';
import { excluirMilitarComDependencias } from '@/services/militarExclusaoService';
import { isPostoOficial } from '@/utils/postoQuadroCompatibilidade';

export default function Militares() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const {
    isAdmin,
    subgrupamentoId,
    subgrupamentoTipo,
    modoAcesso,
    userEmail,
    linkedMilitarId,
    linkedMilitarEmail,
    hasSelfAccess,
    canAccessModule,
    canAccessAction,
    getMilitarScopeFilters,
    isLoading: loadingUser,
    isAccessResolved,
  } = useCurrentUser();

  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState('all');
  const [postoFilter, setPostoFilter] = useState('all');
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [visualizacaoMode, setVisualizacaoMode] = useState('lista');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [militarToDelete, setMilitarToDelete] = useState(null);

  const { data: militares = [], isLoading } = useQuery({
    queryKey: ['militares', isAdmin, subgrupamentoId, subgrupamentoTipo, modoAcesso, userEmail, linkedMilitarId, linkedMilitarEmail],
    queryFn: async () => {
      if (isAdmin) {
        const lista = await base44.entities.Militar.list('-created_date');
        return carregarMilitaresComMatriculas(lista);
      }

      if (modoAcesso === 'proprio') {
        const knownEmails = [userEmail, linkedMilitarEmail].filter(Boolean);
        if (!linkedMilitarId && knownEmails.length === 0) return [];

        const requests = [];
        if (linkedMilitarId) requests.push(base44.entities.Militar.filter({ id: linkedMilitarId }, '-created_date'));
        for (const email of knownEmails) {
          requests.push(base44.entities.Militar.filter({ email }, '-created_date'));
          requests.push(base44.entities.Militar.filter({ email_particular: email }, '-created_date'));
          requests.push(base44.entities.Militar.filter({ email_funcional: email }, '-created_date'));
          requests.push(base44.entities.Militar.filter({ created_by: email }, '-created_date'));
          requests.push(base44.entities.Militar.filter({ militar_email: email }, '-created_date'));
        }

        const batches = await Promise.all(requests);
        const ids = new Set();
        const vinculados = batches.flat().filter((m) => {
          if (!hasSelfAccess(m) || ids.has(m.id)) return false;
          ids.add(m.id);
          return true;
        });
        return carregarMilitaresComMatriculas(vinculados);
      }

      const filters = getMilitarScopeFilters();
      if (!filters.length) return [];
      
      const requests = filters.map(f => base44.entities.Militar.filter(f, '-created_date'));
      const batches = await Promise.all(requests);
      const ids = new Set();
      const merged = [];
      for (const m of batches.flat()) {
        if (!ids.has(m.id)) { ids.add(m.id); merged.push(m); }
      }
      return carregarMilitaresComMatriculas(merged);
    },
    enabled: isAccessResolved,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => excluirMilitarComDependencias(id, { executadoPor: userEmail || '' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['militares'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-pendencias-comportamento'] });
      queryClient.invalidateQueries({ queryKey: ['militares-ativos'] });
      setDeleteDialogOpen(false);
      setMilitarToDelete(null);
    }
  });

  const operacionais = filtrarMilitaresOperacionais(militares, { incluirInativos: mostrarInativos });
  const filteredMilitares = operacionais.filter(m => {
    const matchesSearch = militarCorrespondeBusca(m, searchTerm);
    
    const matchesStatus = statusFilter === 'all' || m.status_cadastro === statusFilter;
    const matchesPosto = postoFilter === 'all' || m.posto_graduacao === postoFilter;
    const matchesAtivo = mostrarInativos || m.status_cadastro !== 'Inativo';
    
    return matchesSearch && matchesStatus && matchesPosto && matchesAtivo;
  });

  // Agrupar por posto/graduação
  const militaresAgrupados = filteredMilitares.reduce((acc, m) => {
    const posto = m.posto_graduacao || 'Sem Posto';
    if (!acc[posto]) acc[posto] = [];
    acc[posto].push(m);
    return acc;
  }, {});

  const orderedPostos = [
    'Coronel', 'Tenente Coronel', 'Major', 'Capitão', '1º Tenente', '2º Tenente', 'Aspirante',
    'Subtenente', '1º Sargento', '2º Sargento', '3º Sargento', 'Cabo', 'Soldado', 'Sem Posto'
  ];

  const handleEdit = (militar) => {
    if (!canAccessAction('editar_militares')) {
      alert('Ação negada: você não tem permissão para editar militares.');
      return;
    }
    navigate(createPageUrl('CadastrarMilitar') + `?id=${militar.id}`);
  };

  const handleDelete = (militar) => {
    if (!canAccessAction('excluir_militares')) {
      alert('Ação negada: você não tem permissão para excluir militares.');
      return;
    }
    setMilitarToDelete(militar);
    setDeleteDialogOpen(true);
  };

  const handleView = (militar) => {
    navigate(createPageUrl('VerMilitar') + `?id=${militar.id}`);
  };

  const confirmDelete = () => {
    if (militarToDelete) {
      deleteMutation.mutate(militarToDelete.id);
    }
  };

  const militaresAtivos = filtrarMilitaresOperacionais(militares, { incluirInativos: false });
  const militaresOperacionaisComInativos = filtrarMilitaresOperacionais(militares, { incluirInativos: true });

  if (!loadingUser && isAccessResolved && !canAccessModule('militares')) return <AccessDenied modulo="Efetivo" />;
  
  const stats = {
    total: militaresAtivos.length,
    ativos: militaresAtivos.filter(m => m.status_cadastro === 'Ativo' || !m.status_cadastro).length,
    oficiais: militaresAtivos.filter(m => isPostoOficial(m.posto_graduacao)).length,
    pracas: militaresAtivos.filter(m => ['Soldado', 'Cabo', '3º Sargento', '2º Sargento', '1º Sargento', 'Subtenente'].includes(m.posto_graduacao)).length,
    inativos: militaresOperacionaisComInativos.filter(m => m.status_cadastro === 'Inativo').length
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#1e3a5f]">Efetivo</h1>
            <p className="text-slate-500">Gerenciamento de pessoal da unidade</p>
          </div>
          <div className="flex gap-3">
            {canAccessAction('adicionar_militares') && (
              <Button
                onClick={() => navigate(createPageUrl('CadastrarMilitar'))}
                className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white"
              >
                <Plus className="w-5 h-5 mr-2" />
                Novo Militar
              </Button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#1e3a5f]/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-[#1e3a5f]" />
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
                <Users className="w-5 h-5 text-emerald-600" />
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
                <Users className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">{stats.oficiais}</p>
                <p className="text-xs text-slate-500">Oficiais</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">{stats.pracas}</p>
                <p className="text-xs text-slate-500">Praças</p>
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
                placeholder="Buscar por nome, nome de guerra ou matrícula..."
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
                  <SelectItem value="Inativo">Inativo</SelectItem>
                  <SelectItem value="Reserva">Reserva</SelectItem>
                  <SelectItem value="Reforma">Reforma</SelectItem>
                </SelectContent>
              </Select>
              <Select value={postoFilter} onValueChange={setPostoFilter}>
                <SelectTrigger className="w-40 h-10 border-slate-200">
                  <SelectValue placeholder="Posto/Grad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Postos</SelectItem>
                  <SelectItem value="Coronel">Coronel</SelectItem>
                  <SelectItem value="Tenente-Coronel">Tenente-Coronel</SelectItem>
                  <SelectItem value="Major">Major</SelectItem>
                  <SelectItem value="Capitão">Capitão</SelectItem>
                  <SelectItem value="1º Tenente">1º Tenente</SelectItem>
                  <SelectItem value="2º Tenente">2º Tenente</SelectItem>
                  <SelectItem value="Subtenente">Subtenente</SelectItem>
                  <SelectItem value="1º Sargento">1º Sargento</SelectItem>
                  <SelectItem value="2º Sargento">2º Sargento</SelectItem>
                  <SelectItem value="3º Sargento">3º Sargento</SelectItem>
                  <SelectItem value="Cabo">Cabo</SelectItem>
                  <SelectItem value="Soldado">Soldado</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex border border-slate-200 rounded-lg overflow-hidden">
                <Button
                  variant={visualizacaoMode === 'lista' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setVisualizacaoMode('lista')}
                  className={visualizacaoMode === 'lista' ? 'bg-[#1e3a5f] hover:bg-[#2d4a6f] rounded-none' : 'rounded-none'}
                >
                  Lista
                </Button>
                <Button
                  variant={visualizacaoMode === 'mapa' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setVisualizacaoMode('mapa')}
                  className={visualizacaoMode === 'mapa' ? 'bg-[#1e3a5f] hover:bg-[#2d4a6f] rounded-none' : 'rounded-none'}
                >
                  <GitBranch className="w-4 h-4 mr-1" />
                  Mapa
                </Button>
              </div>
              {visualizacaoMode === 'lista' && (
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
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <Button
              variant={mostrarInativos ? "default" : "outline"}
              size="sm"
              onClick={() => setMostrarInativos(!mostrarInativos)}
              className={mostrarInativos ? "bg-slate-600" : ""}
            >
              {mostrarInativos ? 'Ocultar Inativos' : 'Mostrar Inativos'}
              {stats.inativos > 0 && ` (${stats.inativos})`}
            </Button>
          </div>
        </div>

        {/* Results count */}
        <div className="mb-4 text-sm text-slate-500">
          {filteredMilitares.length} militar(es) encontrado(s)
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredMilitares.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center">
            <Users className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">
              Nenhum militar encontrado
            </h3>
            <p className="text-slate-500 mb-6">
              {searchTerm || statusFilter !== 'all' || postoFilter !== 'all'
                ? 'Tente ajustar os filtros de busca'
                : 'Comece cadastrando o primeiro militar'}
            </p>
            {!searchTerm && statusFilter === 'all' && postoFilter === 'all' && (
              <Button
                onClick={() => navigate(createPageUrl('CadastrarMilitar'))}
                className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white"
              >
                <Plus className="w-5 h-5 mr-2" />
                Cadastrar Militar
              </Button>
            )}
          </div>
        ) : visualizacaoMode === 'mapa' ? (
          <MapaDeLotacao militares={filteredMilitares} onViewMilitar={handleView} />
        ) : (
          <div className="space-y-6">
            {orderedPostos
              .filter(posto => militaresAgrupados[posto] && militaresAgrupados[posto].length > 0)
              .map(posto => (
                <div key={posto}>
                  <h3 className="text-lg font-bold text-[#1e3a5f] mb-3 pb-2 border-b-2 border-[#1e3a5f]">
                    {posto} ({militaresAgrupados[posto].length})
                  </h3>
                  <div className={
                    viewMode === 'grid'
                      ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
                      : 'space-y-3'
                  }>
                    {militaresAgrupados[posto].map((militar) => (
                <MilitarCard
                  key={militar.id}
                  militar={militar}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onView={handleView}
                  canEdit={canAccessAction('editar_militares')}
                  canDelete={canAccessAction('excluir_militares')}
                />
                    ))}
                  </div>
                </div>
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
              Tem certeza que deseja excluir o militar {militarToDelete?.nome_completo}? 
              Esta ação não pode ser desfeita.
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
