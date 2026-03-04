import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import PublicacaoCard from '@/components/publicacao/PublicacaoCard';

const statusColors = {
  'Aguardando Nota': 'bg-amber-100 text-amber-700',
  'Aguardando Publicação': 'bg-blue-100 text-blue-700',
  'Publicado': 'bg-emerald-100 text-emerald-700'
};

export default function Publicacoes() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: registrosLivro = [], isLoading: loadingLivro } = useQuery({
    queryKey: ['registros-livro'],
    queryFn: () => base44.entities.RegistroLivro.list('-created_date')
  });

  const { data: publicacoesExOfficio = [], isLoading: loadingExOfficio } = useQuery({
    queryKey: ['publicacoes-ex-officio'],
    queryFn: () => base44.entities.PublicacaoExOfficio.list('-created_date')
  });

  const { data: atestados = [], isLoading: loadingAtestados } = useQuery({
    queryKey: ['atestados-publicacao'],
    queryFn: async () => {
      const all = await base44.entities.Atestado.list('-created_date');
      return all.filter(a => a.homologado_comandante || a.encaminhado_jiso);
    }
  });

  const isLoading = loadingLivro || loadingExOfficio || loadingAtestados;
  const registros = [...registrosLivro, ...publicacoesExOfficio, ...atestados].sort((a, b) => 
    new Date(b.created_date) - new Date(a.created_date)
  );

  const updateMutation = useMutation({
    mutationFn: ({ id, data, tipo }) => {
      if (tipo === 'ex-officio') return base44.entities.PublicacaoExOfficio.update(id, data);
      else if (tipo === 'atestado') return base44.entities.Atestado.update(id, data);
      return base44.entities.RegistroLivro.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registros-livro'] });
      queryClient.invalidateQueries({ queryKey: ['publicacoes-ex-officio'] });
      queryClient.invalidateQueries({ queryKey: ['atestados-publicacao'] });
      queryClient.invalidateQueries({ queryKey: ['atestados'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, tipo }) => {
      if (tipo === 'ex-officio') return base44.entities.PublicacaoExOfficio.delete(id);
      if (tipo === 'atestado') return base44.entities.Atestado.delete(id);
      return base44.entities.RegistroLivro.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registros-livro'] });
      queryClient.invalidateQueries({ queryKey: ['publicacoes-ex-officio'] });
      queryClient.invalidateQueries({ queryKey: ['atestados-publicacao'] });
    }
  });

  const filteredRegistros = registros.filter(r => {
    const status = r.status_publicacao || r.status;
    const matchesStatus = statusFilter === 'all' || status === statusFilter;
    const matchesSearch = 
      r.militar_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.militar_matricula?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.numero_bg?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const stats = {
    total: registros.length,
    aguardandoNota: registros.filter(r => (r.status_publicacao || r.status) === 'Aguardando Nota').length,
    aguardandoPublicacao: registros.filter(r => (r.status_publicacao || r.status) === 'Aguardando Publicação').length,
    publicados: registros.filter(r => (r.status_publicacao || r.status) === 'Publicado').length
  };

  const handleUpdate = (id, data, tipo) => {
    updateMutation.mutate({ id, data, tipo });
  };

  const handleDelete = (id, tipo) => {
    deleteMutation.mutate({ id, tipo });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#1e3a5f]">Publicações</h1>
          <p className="text-slate-500">Controle de notas e boletins gerais</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#1e3a5f]/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-[#1e3a5f]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#1e3a5f]">{stats.total}</p>
                  <p className="text-xs text-slate-500">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-600">{stats.aguardandoNota}</p>
                  <p className="text-xs text-slate-500">Aguardando Nota</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600">{stats.aguardandoPublicacao}</p>
                  <p className="text-xs text-slate-500">Aguardando Publ.</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-600">{stats.publicados}</p>
                  <p className="text-xs text-slate-500">Publicados</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Buscar por militar, matrícula ou número do BG..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border-slate-200"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="Aguardando Nota">Aguardando Nota</SelectItem>
                <SelectItem value="Aguardando Publicação">Aguardando Publicação</SelectItem>
                <SelectItem value="Publicado">Publicado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results */}
        <div className="mb-4 text-sm text-slate-500">
          {filteredRegistros.length} registro(s) encontrado(s)
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredRegistros.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center">
            <FileText className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">
              Nenhum registro encontrado
            </h3>
            <p className="text-slate-500">
              {searchTerm || statusFilter !== 'all'
                ? 'Tente ajustar os filtros de busca'
                : 'Os registros de livro aparecerão aqui'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRegistros.map((registro) => (
              <PublicacaoCard
                key={registro.id}
                registro={registro}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}