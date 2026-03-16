import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Plus, Search, Trash2, Edit } from 'lucide-react';
import { format } from 'date-fns';
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
import AccessDenied from '@/components/auth/AccessDenied';
import { useCurrentUser } from '@/components/auth/useCurrentUser';

export default function Punicoes() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, getMilitarScopeFilters, canAccessModule, isLoading: loadingUser, isAccessResolved } = useCurrentUser();
  const [searchTerm, setSearchTerm] = useState('');
  const [agruparPor, setAgruparPor] = useState('ano');
  const [ordenarPor, setOrdenarPor] = useState('data');
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null });

  const { data: punicoes = [], isLoading } = useQuery({
    queryKey: ['punicoes', isAdmin],
    queryFn: async () => {
      if (isAdmin) return base44.entities.Punicao.list('-data_aplicacao');
      const scopeFilters = getMilitarScopeFilters();
      if (!scopeFilters.length) return [];
      const militarQueries = await Promise.all(scopeFilters.map(f => base44.entities.Militar.filter(f)));
      const militaresAcess = militarQueries.flat();
      const militarIds = [...new Set(militaresAcess.map(m => m.id).filter(Boolean))];
      if (!militarIds.length) return [];
      const queryPromises = militarIds.map(id => base44.entities.Punicao.filter({ militar_id: id }, '-data_aplicacao'));
      const arrays = await Promise.all(queryPromises);
      const m = new Map();
      arrays.flat().forEach(item => m.set(item.id, item));
      return Array.from(m.values()).sort((a,b) => new Date(b.data_aplicacao||0) - new Date(a.data_aplicacao||0));
    },
    enabled: isAccessResolved
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Punicao.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['punicoes'] });
      setDeleteDialog({ open: false, id: null });
    }
  });

  const filteredPunicoes = punicoes.filter(p =>
    p.militar_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.militar_matricula?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Ordenar
  const sortedPunicoes = [...filteredPunicoes].sort((a, b) => {
    if (ordenarPor === 'data') {
      return new Date(b.data_aplicacao) - new Date(a.data_aplicacao);
    } else if (ordenarPor === 'militar') {
      return (a.militar_nome || '').localeCompare(b.militar_nome || '');
    }
    return 0;
  });

  // Agrupar
  const punicoesAgrupadas = sortedPunicoes.reduce((acc, p) => {
    if (agruparPor === 'ano') {
      const ano = p.data_aplicacao ? new Date(p.data_aplicacao + 'T00:00:00').getFullYear() : 'Sem Data';
      if (!acc[ano]) acc[ano] = [];
      acc[ano].push(p);
    } else if (agruparPor === 'militar') {
      const militar = p.militar_nome || 'Sem Nome';
      if (!acc[militar]) acc[militar] = [];
      acc[militar].push(p);
    } else {
      if (!acc['todas']) acc['todas'] = [];
      acc['todas'].push(p);
    }
    return acc;
  }, {});

  const gruposOrdenados = Object.keys(punicoesAgrupadas).sort((a, b) => {
    if (agruparPor === 'ano') {
      if (a === 'Sem Data') return 1;
      if (b === 'Sem Data') return -1;
      return b - a;
    }
    return a.localeCompare(b);
  });

  if (!loadingUser && isAccessResolved && !canAccessModule('militares')) return <AccessDenied modulo="Efetivo" />;

  const tipoColors = {
    'Advertência Verbal': 'bg-blue-100 text-blue-700',
    'Repreensão': 'bg-yellow-100 text-yellow-700',
    'Detenção': 'bg-orange-100 text-orange-700',
    'Prisão': 'bg-red-100 text-red-700'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-[#1e3a5f]" />
            <div>
              <h1 className="text-3xl font-bold text-[#1e3a5f]">Punições</h1>
              <p className="text-slate-500">Gerenciar punições disciplinares</p>
            </div>
          </div>
          <Button
            onClick={() => navigate(createPageUrl('CadastrarPunicao'))}
            className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nova Punição
          </Button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Buscar por nome ou matrícula..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={agruparPor} onValueChange={setAgruparPor}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Agrupar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">Sem Agrupamento</SelectItem>
                <SelectItem value="ano">Agrupar por Ano</SelectItem>
                <SelectItem value="militar">Agrupar por Militar</SelectItem>
              </SelectContent>
            </Select>
            <Select value={ordenarPor} onValueChange={setOrdenarPor}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="data">Ordenar por Data</SelectItem>
                <SelectItem value="militar">Ordenar por Militar</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sortedPunicoes.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <Shield className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">Nenhuma punição encontrada</h3>
          </div>
        ) : (
          <div className="space-y-6">
            {gruposOrdenados.map((grupo) => (
              <div key={grupo}>
                {agruparPor !== 'nenhum' && (
                  <h3 className="text-lg font-bold text-[#1e3a5f] mb-3 pb-2 border-b-2 border-[#1e3a5f]">
                    {grupo} ({punicoesAgrupadas[grupo].length})
                  </h3>
                )}
                <div className="space-y-3">
                  {punicoesAgrupadas[grupo].map((punicao) => (
              <div key={punicao.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-slate-900">
                        {punicao.militar_posto} {punicao.militar_nome}
                      </h3>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${tipoColors[punicao.tipo]}`}>
                        {punicao.tipo}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mb-1">Mat: {punicao.militar_matricula}</p>
                    <p className="text-sm text-slate-600">
                      Data: {format(new Date(punicao.data_aplicacao + 'T00:00:00'), 'dd/MM/yyyy')}
                    </p>
                    {punicao.motivo && (
                      <p className="text-sm text-slate-600 mt-2">{punicao.motivo}</p>
                    )}
                    {(punicao.data_inicio || punicao.data_termino) && (
                      <p className="text-sm text-slate-500 mt-2">
                        Período: {punicao.data_inicio ? format(new Date(punicao.data_inicio + 'T00:00:00'), 'dd/MM/yyyy') : '-'} até {punicao.data_termino ? format(new Date(punicao.data_termino + 'T00:00:00'), 'dd/MM/yyyy') : '-'}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate(createPageUrl('CadastrarPunicao') + `?id=${punicao.id}`)}
                      className="text-[#1e3a5f] hover:text-[#2d4a6f]"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteDialog({ open: true, id: punicao.id })}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                  </div>
                ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir esta punição? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteMutation.mutate(deleteDialog.id)} className="bg-red-600 hover:bg-red-700">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}