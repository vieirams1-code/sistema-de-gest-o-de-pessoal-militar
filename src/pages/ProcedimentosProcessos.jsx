import React, { useMemo, useState } from 'react';
import { AlertTriangle, Clock3, FileStack, Filter, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AssistenteProcedimentosModal from '@/components/assistente-procedimentos/AssistenteProcedimentosModal';
import ProcedimentoFormModal from '@/components/procedimentos/ProcedimentoFormModal';
import { useProcedimentosProcessos } from '@/hooks/procedimentos/useProcedimentosProcessos';
import { calcularDashboard, filtrarProcedimentos } from '@/services/procedimentos/procedimentosService';
import { STATUS_PROCEDIMENTO, TIPOS_PROCEDIMENTO } from '@/utils/procedimentos/procedimentosConstants';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';

const statusClass = {
  'Em andamento': 'bg-blue-100 text-blue-700',
  Vencido: 'bg-red-100 text-red-700',
  Concluído: 'bg-emerald-100 text-emerald-700',
  Encerrado: 'bg-slate-200 text-slate-700',
  Suspenso: 'bg-amber-100 text-amber-700',
  Arquivado: 'bg-slate-100 text-slate-700',
};

export default function ProcedimentosProcessos() {
  const { canAccessModule, canAccessAction } = useCurrentUser();
  const hasAccess = canAccessModule('procedimentos_processos');
  const canCreate = canAccessAction('criar_procedimento');
  const canEdit = canAccessAction('editar_procedimento') || canAccessAction('encerrar_procedimento') || canAccessAction('gerir_prazos_procedimento');

  const [filters, setFilters] = useState({
    tipo: 'todos',
    status: 'todos',
    responsavel: 'todos',
    unidade: 'todos',
    prazo: 'todos',
    textoLivre: '',
  });
  const [selected, setSelected] = useState(null);

  const { data = [], isLoading, saveProcedimento, isSaving } = useProcedimentosProcessos();

  const list = useMemo(() => filtrarProcedimentos(data, filters), [data, filters]);
  const dashboard = useMemo(() => calcularDashboard(data), [data]);

  const responsaveis = useMemo(() => [...new Set(data.map((item) => item.responsavel_nome).filter(Boolean))], [data]);
  const unidades = useMemo(() => [...new Set(data.map((item) => item.unidade).filter(Boolean))], [data]);

  if (!hasAccess) {
    return <AccessDenied moduleName="Procedimentos e Processos" />;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Procedimentos e Processos</h1>
          <p className="text-sm text-slate-500">Controle externo de responsáveis, envolvidos, prazos e pendências.</p>
        </div>
        <div className="flex gap-2">
          <AssistenteProcedimentosModal
            tipoProcedimento={selected?.tipo_procedimento || ''}
            procedimento={selected || {}}
            disabled={!selected}
          />
          {canCreate && (
            <ProcedimentoFormModal
              onSubmit={saveProcedimento}
              saving={isSaving}
              triggerLabel="Novo procedimento"
            />
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-6 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Total em andamento</p><p className="text-2xl font-bold">{dashboard.totalAndamento}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Vencidos</p><p className="text-2xl font-bold text-red-600">{dashboard.vencidos}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Vencem em 7 dias</p><p className="text-2xl font-bold text-amber-600">{dashboard.vencem7}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Concluídos no mês</p><p className="text-2xl font-bold text-emerald-600">{dashboard.concluidosMes}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Por responsável</p><p className="text-sm font-semibold">{Object.keys(dashboard.porResponsavel).length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Por tipo</p><p className="text-sm font-semibold">{Object.keys(dashboard.porTipo).length}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-slate-700 font-medium"><Filter className="w-4 h-4" /> Filtros</div>
          <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div><Label>Tipo</Label><Select value={filters.tipo} onValueChange={(v) => setFilters((p) => ({ ...p, tipo: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos</SelectItem>{TIPOS_PROCEDIMENTO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Status</Label><Select value={filters.status} onValueChange={(v) => setFilters((p) => ({ ...p, status: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos</SelectItem>{[...STATUS_PROCEDIMENTO, 'Vencido'].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Responsável</Label><Select value={filters.responsavel} onValueChange={(v) => setFilters((p) => ({ ...p, responsavel: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos</SelectItem>{responsaveis.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Unidade</Label><Select value={filters.unidade} onValueChange={(v) => setFilters((p) => ({ ...p, unidade: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos</SelectItem>{unidades.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Prazo</Label><Select value={filters.prazo} onValueChange={(v) => setFilters((p) => ({ ...p, prazo: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos</SelectItem><SelectItem value="vencidos">Vencidos</SelectItem><SelectItem value="vencem7">Vencem em 7 dias</SelectItem><SelectItem value="vencem30">Vencem em 30 dias</SelectItem></SelectContent></Select></div>
            <div><Label>Texto livre</Label><Input value={filters.textoLivre} onChange={(e) => setFilters((p) => ({ ...p, textoLivre: e.target.value }))} placeholder="Número, objeto, envolvidos..." /></div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {isLoading && <p className="text-sm text-slate-500">Carregando procedimentos...</p>}
        {!isLoading && list.length === 0 && <p className="text-sm text-slate-500">Nenhum procedimento encontrado.</p>}

        {list.map((item) => (
          <Card key={item.id} className="border-slate-200">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileStack className="w-4 h-4 text-slate-500" />
                  <p className="font-semibold text-slate-800">{item.tipo_procedimento} • {item.numero_procedimento || 'Sem número'}</p>
                  <Badge className={statusClass[item.status_calculado] || 'bg-slate-100 text-slate-700'}>{item.status_calculado}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  {canEdit && (
                    <ProcedimentoFormModal
                      initialData={item}
                      onSubmit={saveProcedimento}
                      saving={isSaving}
                      triggerLabel="Detalhar"
                    />
                  )}
                  <Button type="button" variant="outline" size="sm" onClick={() => setSelected(item)}>Selecionar</Button>
                </div>
              </div>

              <div className="grid md:grid-cols-4 gap-3 mt-3 text-sm">
                <div><p className="text-slate-500">Portaria</p><p>{item.numero_portaria || '-'}</p></div>
                <div><p className="text-slate-500">Responsável</p><p>{item.responsavel_nome || '-'}</p></div>
                <div><p className="text-slate-500">Unidade/Setor</p><p>{item.unidade || '-'}</p></div>
                <div><p className="text-slate-500">Instauração</p><p>{item.data_instauracao || '-'}</p></div>
                <div><p className="text-slate-500">Prazo final</p><p>{item.prazo_final || '-'}</p></div>
                <div><p className="text-slate-500">Dias restantes</p><p className={(item.dias_restantes ?? 0) < 0 ? 'text-red-600 font-semibold' : ''}>{item.dias_restantes ?? '-'}</p></div>
                <div><p className="text-slate-500">Prioridade/risco</p><p>{item.prioridade_risco || '-'}</p></div>
                <div><p className="text-slate-500">Envolvidos</p><p>{item.envolvidos.length}</p></div>
              </div>

              <div className="mt-3 p-3 rounded bg-slate-50 text-sm">
                <p className="text-slate-500 mb-1">Objeto / resumo</p>
                <p>{item.objeto || '-'}</p>
              </div>

              {item.pendencias.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm font-medium text-slate-700 mb-2">Pendências</p>
                  <div className="space-y-2">
                    {item.pendencias.slice(0, 3).map((pendencia) => (
                      <div key={pendencia.id} className="text-xs border rounded p-2 flex items-center justify-between gap-2">
                        <span>{pendencia.descricao}</span>
                        <Badge variant="outline">{pendencia.status}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {item.tipo_procedimento === 'Inquérito Técnico' && item.viaturas.length > 0 && (
                <div className="mt-3 rounded border border-amber-200 p-3 bg-amber-50">
                  <p className="text-sm font-medium text-amber-800 mb-2">Bloco técnico de viaturas/materiais</p>
                  {item.viaturas.map((v) => (
                    <div key={v.id} className="text-xs grid md:grid-cols-4 gap-2 mb-2">
                      <span><strong>Viatura:</strong> {v.viatura || '-'}</span>
                      <span><strong>Prefixo:</strong> {v.prefixo || '-'}</span>
                      <span><strong>Placa:</strong> {v.placa || '-'}</span>
                      <span><strong>Prejuízo:</strong> {v.estimativa_prejuizo || '-'}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4 text-sm text-slate-600 flex flex-wrap gap-4">
          <span className="inline-flex items-center gap-1"><Clock3 className="w-4 h-4" />Sem fluxo processual interno detalhado nesta V1.</span>
          <span className="inline-flex items-center gap-1"><AlertTriangle className="w-4 h-4" />Sem automações com Quadro, Central, Livro, Publicações ou RP.</span>
          <span className="inline-flex items-center gap-1"><Plus className="w-4 h-4" />Cadastro/listagem e controle externo concluídos nesta etapa.</span>
        </CardContent>
      </Card>
    </div>
  );
}
