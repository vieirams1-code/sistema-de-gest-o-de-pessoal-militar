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
import { Medal, Plus, Search, Edit, Trash2 } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';

const statusColors = {
  'Indicado': 'bg-yellow-100 text-yellow-700',
  'Concedido': 'bg-green-100 text-green-700',
  'Negado': 'bg-red-100 text-red-700',
};

function formatDate(d) {
  if (!d) return '—';
  try { return format(new Date(`${d}T00:00:00`), 'dd/MM/yyyy'); } catch { return d; }
}

export default function Medalhas() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, getMilitarScopeFilters, canAccessModule, isLoading: loadingUser, isAccessResolved } = useCurrentUser();
  const hasMedalhasAccess = canAccessModule('medalhas');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null });

  const { data: medalhas = [], isLoading } = useQuery({
    queryKey: ['medalhas', isAdmin],
    queryFn: async () => {
      if (isAdmin) return base44.entities.Medalha.list('-data_indicacao');
      const scopeFilters = getMilitarScopeFilters();
      if (!scopeFilters.length) return [];
      const militarQueries = await Promise.all(scopeFilters.map(f => base44.entities.Militar.filter(f)));
      const militarIds = [...new Set(militarQueries.flat().map(m => m.id).filter(Boolean))];
      if (!militarIds.length) return [];
      const arrays = await Promise.all(militarIds.map(id => base44.entities.Medalha.filter({ militar_id: id }, '-data_indicacao')));
      const m = new Map();
      arrays.flat().forEach(item => m.set(item.id, item));
      return Array.from(m.values()).sort((a, b) => new Date(b.data_indicacao || 0) - new Date(a.data_indicacao || 0));
    },
    enabled: isAccessResolved && hasMedalhasAccess,
  });

  const { data: tiposMedalha = [] } = useQuery({
    queryKey: ['tipos-medalha'],
    queryFn: () => base44.entities.TipoMedalha.filter({ ativa: true }),
    enabled: isAccessResolved && hasMedalhasAccess,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Medalha.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medalhas'] });
      setDeleteDialog({ open: false, id: null });
    },
  });

  const filteredMedalhas = medalhas.filter(m => {
    const matchSearch =
      m.militar_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.militar_matricula?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.tipo_medalha_nome?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'all' || m.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (loadingUser || !isAccessResolved) return null;
  if (!hasMedalhasAccess) return <AccessDenied modulo="Medalhas" />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Medal className="w-8 h-8 text-[#1e3a5f]" />
            <div>
              <h1 className="text-3xl font-bold text-[#1e3a5f]">Medalhas</h1>
              <p className="text-slate-500">Controle de indicações e concessões</p>
            </div>
          </div>
          <Button
            onClick={() => navigate(createPageUrl('CadastrarMedalha'))}
            className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nova Indicação
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Indicadas', value: medalhas.filter(m => m.status === 'Indicado').length, color: 'text-yellow-600', bg: 'bg-yellow-100' },
            { label: 'Concedidas', value: medalhas.filter(m => m.status === 'Concedido').length, color: 'text-green-600', bg: 'bg-green-100' },
            { label: 'Negadas', value: medalhas.filter(m => m.status === 'Negado').length, color: 'text-red-600', bg: 'bg-red-100' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center`}>
                  <Medal className={`w-5 h-5 ${s.color}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
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
                placeholder="Buscar por militar, matrícula ou tipo de medalha..."
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
                <SelectItem value="Indicado">Indicado</SelectItem>
                <SelectItem value="Concedido">Concedido</SelectItem>
                <SelectItem value="Negado">Negado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredMedalhas.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center">
            <Medal className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">Nenhuma medalha encontrada</h3>
            <p className="text-slate-500">
              {searchTerm || statusFilter !== 'all' ? 'Tente ajustar os filtros' : 'Comece indicando a primeira medalha'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMedalhas.map((medalha) => (
              <div key={medalha.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className="font-semibold text-slate-900">
                        {medalha.militar_posto} {medalha.militar_nome}
                      </h3>
                      <Badge className={statusColors[medalha.status] || 'bg-slate-100 text-slate-700'}>
                        {medalha.status}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-slate-700 mb-1">{medalha.tipo_medalha_nome}</p>
                    <p className="text-sm text-slate-500">Mat: {medalha.militar_matricula}</p>
                    <div className="flex gap-4 mt-2 text-xs text-slate-500">
                      <span>Indicação: {formatDate(medalha.data_indicacao)}</span>
                      {medalha.data_concessao && <span>Concessão: {formatDate(medalha.data_concessao)}</span>}
                      {medalha.documento_referencia && <span>Doc: {medalha.documento_referencia}</span>}
                    </div>
                    {medalha.observacoes && (
                      <p className="text-sm text-slate-500 mt-2">{medalha.observacoes}</p>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate(createPageUrl('CadastrarMedalha') + `?id=${medalha.id}`)}
                      className="text-[#1e3a5f] hover:text-[#2d4a6f]"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteDialog({ open: true, id: medalha.id })}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta medalha? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(deleteDialog.id)}
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