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
import { Plus, Search, FileText, Calendar, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import AtestadoCard from '@/components/atestado/AtestadoCard';
import { registrarExclusaoAtestadoNoCard } from '@/components/quadro/quadroHelpers';

export default function Atestados() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [tipoAfastamentoFilter, setTipoAfastamentoFilter] = useState('all');
  const [jisoFilter, setJisoFilter] = useState('all');
  const [publicacaoFilter, setPublicacaoFilter] = useState('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [atestadoToDelete, setAtestadoToDelete] = useState(null);
  const [vigentesCollapsed, setVigentesCollapsed] = useState(false);
  const [finalizadosCollapsed, setFinalizadosCollapsed] = useState(true);

  const { data: atestados = [], isLoading } = useQuery({
    queryKey: ['atestados'],
    queryFn: () => base44.entities.Atestado.list('-created_date')
  });

  const deleteMutation = useMutation({
    mutationFn: async (atestado) => {
      await registrarExclusaoAtestadoNoCard(atestado);
      await base44.entities.Atestado.delete(atestado.id);
      return atestado;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atestados'] });
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      setDeleteDialogOpen(false);
      setAtestadoToDelete(null);
    }
  });

  const applyFilters = (list) => list.filter(a => {
    const matchesSearch =
      a.militar_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.militar_matricula?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.medico?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.cid_10?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTipoAfastamento = tipoAfastamentoFilter === 'all' || a.tipo_afastamento === tipoAfastamentoFilter;
    const matchesJiso = jisoFilter === 'all' || 
      (jisoFilter === 'necessita' && a.necessita_jiso) ||
      (jisoFilter === 'nao_necessita' && !a.necessita_jiso) ||
      (jisoFilter === 'aguardando' && a.status_jiso === 'Aguardando JISO') ||
      (jisoFilter === 'homologado' && a.status_jiso === 'Homologado pela JISO');
    const matchesPublicacao = publicacaoFilter === 'all' ||
      (publicacaoFilter === 'aguardando_nota' && (!a.status_publicacao || a.status_publicacao === 'Aguardando Nota')) ||
      (publicacaoFilter === 'aguardando_pub' && a.status_publicacao === 'Aguardando Publicação') ||
      (publicacaoFilter === 'publicado' && a.status_publicacao === 'Publicado');
    return matchesSearch && matchesTipoAfastamento && matchesJiso && matchesPublicacao;
  });

  const vigentes = applyFilters(atestados.filter(a => a.status === 'Ativo'));
  const finalizados = applyFilters(atestados.filter(a => a.status !== 'Ativo'));

  const handleEdit = (atestado) => navigate(createPageUrl('CadastrarAtestado') + `?id=${atestado.id}`);
  const handleDelete = (atestado) => { setAtestadoToDelete(atestado); setDeleteDialogOpen(true); };
  const handleView = (atestado) => navigate(createPageUrl('VerAtestado') + `?id=${atestado.id}`);
  const confirmDelete = () => { if (atestadoToDelete) deleteMutation.mutate(atestadoToDelete); };

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const stats = {
    total: atestados.length,
    ativos: atestados.filter(a => a.status === 'Ativo').length,
    retornoProximo: atestados.filter(a => {
      if (a.status !== 'Ativo' || !a.data_retorno) return false;
      const diff = differenceInDays(new Date(a.data_retorno + 'T00:00:00'), hoje);
      return diff >= 0 && diff <= 7;
    }).length,
    atrasados: atestados.filter(a => {
      if (a.status !== 'Ativo' || !a.data_retorno) return false;
      return differenceInDays(new Date(a.data_retorno + 'T00:00:00'), hoje) < 0;
    }).length
  };

  const hasFilters = searchTerm || tipoAfastamentoFilter !== 'all' || jisoFilter !== 'all' || publicacaoFilter !== 'all';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#1e3a5f]">Atestados Médicos</h1>
            <p className="text-slate-500">Controle de afastamentos e atestados</p>
          </div>
          <Button onClick={() => navigate(createPageUrl('CadastrarAtestado'))} className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white">
            <Plus className="w-5 h-5 mr-2" />Novo Atestado
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total', value: stats.total, icon: FileText, color: 'text-[#1e3a5f]', bg: 'bg-[#1e3a5f]/10' },
            { label: 'Ativos', value: stats.ativos, icon: FileText, color: 'text-emerald-600', bg: 'bg-emerald-100' },
            { label: 'Retorno em 7 dias', value: stats.retornoProximo, icon: Calendar, color: 'text-amber-600', bg: 'bg-amber-100' },
            { label: 'Atrasados', value: stats.atrasados, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-100' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
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
          <div className="flex flex-col md:flex-row gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar por militar, matrícula, médico ou CID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-10 border-slate-200"
              />
            </div>
            <Select value={tipoAfastamentoFilter} onValueChange={setTipoAfastamentoFilter}>
              <SelectTrigger className="w-44 h-10 border-slate-200">
                <SelectValue placeholder="Tipo Afastamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Afastamentos</SelectItem>
                <SelectItem value="Afastamento Total">Afastamento Total</SelectItem>
                <SelectItem value="Esforço Físico">Esforço Físico</SelectItem>
              </SelectContent>
            </Select>
            <Select value={jisoFilter} onValueChange={setJisoFilter}>
              <SelectTrigger className="w-44 h-10 border-slate-200">
                <SelectValue placeholder="JISO" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas JISO</SelectItem>
                <SelectItem value="necessita">Necessita JISO</SelectItem>
                <SelectItem value="nao_necessita">Sem JISO</SelectItem>
                <SelectItem value="aguardando">Aguardando JISO</SelectItem>
                <SelectItem value="homologado">Homologado JISO</SelectItem>
              </SelectContent>
            </Select>
            <Select value={publicacaoFilter} onValueChange={setPublicacaoFilter}>
              <SelectTrigger className="w-44 h-10 border-slate-200">
                <SelectValue placeholder="Publicação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Publicações</SelectItem>
                <SelectItem value="aguardando_nota">Aguardando Nota</SelectItem>
                <SelectItem value="aguardando_pub">Aguardando Publicação</SelectItem>
                <SelectItem value="publicado">Publicado</SelectItem>
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" className="h-10 text-slate-500 hover:text-slate-700" onClick={() => { setSearchTerm(''); setTipoAfastamentoFilter('all'); setJisoFilter('all'); setPublicacaoFilter('all'); }}>
                Limpar filtros
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Grupo: Vigentes */}
            <div>
              <button
                className="flex items-center gap-3 mb-4 w-full group"
                onClick={() => setVigentesCollapsed(!vigentesCollapsed)}
              >
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <h2 className="text-lg font-bold text-[#1e3a5f] group-hover:text-[#2d4a6f]">
                  Atestados Vigentes
                </h2>
                <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">{vigentes.length}</span>
                <div className="flex-1 h-px bg-slate-200" />
                {vigentesCollapsed ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
              </button>

              {!vigentesCollapsed && (
                vigentes.length === 0 ? (
                  <div className="bg-white rounded-xl p-8 text-center border border-slate-100">
                    <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    <p className="text-slate-500">{hasFilters ? 'Nenhum atestado vigente com esses filtros' : 'Nenhum atestado vigente no momento'}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {vigentes.map(a => (
                      <AtestadoCard key={a.id} atestado={a} onEdit={handleEdit} onDelete={handleDelete} onView={handleView} />
                    ))}
                  </div>
                )
              )}
            </div>

            {/* Grupo: Finalizados */}
            <div>
              <button
                className="flex items-center gap-3 mb-4 w-full group"
                onClick={() => setFinalizadosCollapsed(!finalizadosCollapsed)}
              >
                <div className="w-3 h-3 rounded-full bg-slate-400" />
                <h2 className="text-lg font-bold text-slate-500 group-hover:text-slate-700">
                  Atestados Encerrados
                </h2>
                <span className="bg-slate-100 text-slate-500 text-xs font-bold px-2 py-0.5 rounded-full">{finalizados.length}</span>
                <div className="flex-1 h-px bg-slate-200" />
                {finalizadosCollapsed ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
              </button>

              {!finalizadosCollapsed && (
                finalizados.length === 0 ? (
                  <div className="bg-white rounded-xl p-8 text-center border border-slate-100">
                    <p className="text-slate-400">Nenhum atestado encerrado</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {finalizados.map(a => (
                      <AtestadoCard key={a.id} atestado={a} onEdit={handleEdit} onDelete={handleDelete} onView={handleView} />
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>

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
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}