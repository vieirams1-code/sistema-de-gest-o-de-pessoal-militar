import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getTarefaOperacionalEntity } from '@/services/tarefaOperacionalEntityResolver';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ClipboardCheck, Clock3, Filter, Plus, Search, Users } from 'lucide-react';
import { createPageUrl } from '@/utils';
import {
  STATUS_OPTIONS,
  TIPO_FILTER_OPTIONS,
  formatDateBR,
  getPrioridadeBadgeClass,
  getStatusBadgeClass,
} from '@/components/tarefasOperacionaisConfig';

function containsTerm(value, term) {
  if (!term) return true;
  if (value === null || value === undefined) return false;
  return String(value).toLowerCase().includes(term);
}

export default function TarefasOperacionais() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tipoFilter, setTipoFilter] = useState('all');
  const { canAccessModule, canAccessAction, isLoading: loadingUser, isAccessResolved } = useCurrentUser();

  const hasAccess = canAccessModule('tarefas_operacionais');
  const canCreate = canAccessAction('criar_tarefa_operacional') || canAccessAction('admin_mode');

  const { data: tarefas = [], isLoading: loadingTarefas } = useQuery({
    queryKey: ['tarefas-operacionais'],
    queryFn: async () => {
      const entity = await getTarefaOperacionalEntity();
      return entity.list('-created_date');
    },
    enabled: isAccessResolved && hasAccess,
  });

  const tarefasFiltradas = useMemo(() => {
    const termo = searchTerm.trim().toLowerCase();
    return tarefas.filter((tarefa) => {
      if (statusFilter !== 'all' && tarefa.status_tarefa !== statusFilter) return false;
      if (tipoFilter !== 'all' && tarefa.tipo_tarefa !== tipoFilter) return false;

      return (
        containsTerm(tarefa.titulo, termo) ||
        containsTerm(tarefa.descricao, termo) ||
        containsTerm(tarefa.setor_origem, termo) ||
        containsTerm(tarefa.publico_resumo, termo)
      );
    });
  }, [tarefas, statusFilter, tipoFilter, searchTerm]);

  const resumo = useMemo(() => {
    return {
      total: tarefas.length,
      abertas: tarefas.filter((item) => item.status_tarefa === 'Aberta').length,
      emAndamento: tarefas.filter((item) => item.status_tarefa === 'Em andamento').length,
      concluidas: tarefas.filter((item) => item.status_tarefa === 'Concluída').length,
    };
  }, [tarefas]);

  if (loadingUser || !isAccessResolved) return null;
  if (!hasAccess) return <AccessDenied modulo="Tarefas Operacionais" />;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Tarefas Operacionais</h1>
          <p className="text-sm text-slate-500 mt-1">Painel inicial para gestão e conferência de tarefas operacionais distribuídas ao efetivo.</p>
        </div>

        {canCreate && (
          <Button className="bg-[#173764] hover:bg-[#10294c]" onClick={() => navigate(createPageUrl('CadastrarTarefaOperacional'))}>
            <Plus className="w-4 h-4 mr-2" />
            Nova tarefa
          </Button>
        )}
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-slate-500">Total de tarefas</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-slate-800">{resumo.total}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-slate-500">Abertas</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-amber-700">{resumo.abertas}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-slate-500">Em andamento</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-blue-700">{resumo.emAndamento}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-slate-500">Concluídas</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-emerald-700">{resumo.concluidas}</p></CardContent>
        </Card>
      </section>

      <Card>
        <CardContent className="p-4 md:p-5">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Buscar por título, setor ou resumo público"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="Filtrar status" /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((statusOption) => (
                  <SelectItem key={statusOption.value} value={statusOption.value}>{statusOption.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger><SelectValue placeholder="Filtrar tipo" /></SelectTrigger>
              <SelectContent>
                {TIPO_FILTER_OPTIONS.map((tipoOption) => (
                  <SelectItem key={tipoOption.value} value={tipoOption.value}>{tipoOption.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        {loadingTarefas ? (
          <Card><CardContent className="p-6 text-sm text-slate-500">Carregando tarefas...</CardContent></Card>
        ) : tarefasFiltradas.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <ClipboardCheck className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-500">Nenhuma tarefa encontrada com os filtros atuais.</p>
            </CardContent>
          </Card>
        ) : (
          tarefasFiltradas.map((tarefa) => (
            <Card key={tarefa.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 md:p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <h3 className="text-base font-semibold text-slate-800">{tarefa.titulo || 'Sem título'}</h3>
                    <p className="text-sm text-slate-600 line-clamp-2">{tarefa.publico_resumo || tarefa.descricao || 'Sem orientações cadastradas.'}</p>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <Badge variant="outline" className={getStatusBadgeClass(tarefa.status_tarefa)}>{tarefa.status_tarefa || 'Aberta'}</Badge>
                      <Badge variant="outline" className="border-slate-200 text-slate-700">{tarefa.tipo_tarefa || 'Sem tipo'}</Badge>
                      <Badge variant="outline" className={getPrioridadeBadgeClass(tarefa.prioridade)}>{tarefa.prioridade || 'Sem prioridade'}</Badge>
                    </div>
                  </div>

                  <div className="text-xs text-slate-500 min-w-[180px] space-y-1">
                    <div className="flex items-center gap-2"><Clock3 className="w-3.5 h-3.5" /> Prazo: {formatDateBR(tarefa.prazo)}</div>
                    <div className="flex items-center gap-2"><Filter className="w-3.5 h-3.5" /> Setor: {tarefa.setor_origem || 'Não informado'}</div>
                    <div className="flex items-center gap-2"><ClipboardCheck className="w-3.5 h-3.5" /> Criado por: {tarefa.criado_por || 'N/I'}</div>
                    <div className="flex items-center gap-2"><Users className="w-3.5 h-3.5" /> Destinatários: {tarefa.total_destinatarios || 0}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      <footer className="text-xs text-slate-400 flex items-center gap-2">
        <Clock3 className="w-3.5 h-3.5" />
        LOTE 1: listagem e criação inicial do módulo.
      </footer>
    </div>
  );
}
