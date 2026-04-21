import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CalendarClock, Plus, RefreshCw, FileText, XCircle, History } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';
import AccessDenied from '@/components/auth/AccessDenied';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import {
  aplicarRenovacaoContrato,
  calcularStatusContratoTemporario,
  criarHistoricoContrato,
  encerrarContratoTemporario,
  montarCardsContratosTemporarios,
  validarContratoAtivoUnico,
} from '@/services/vinculosTemporariosService';

const TIPO_OPTIONS = ['DESIGNADO', 'CONVOCADO'];
const STATUS_OPTIONS = ['VIGENTE', 'A_VENCER', 'EXPIRADO', 'ENCERRADO'];

const defaultForm = {
  militar_id: '',
  tipo_vinculo: 'DESIGNADO',
  data_inicio: '',
  data_fim_atual: '',
  observacoes_gerais: '',
};

function formatDate(value) {
  if (!value) return '-';
  const iso = String(value).slice(0, 10);
  return iso.split('-').reverse().join('/');
}

export default function VinculosTemporarios() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canAccessModule, isAccessResolved, isLoading: loadingUser } = useCurrentUser();

  const [filters, setFilters] = useState({ militar: '', tipo_vinculo: 'all', status: 'all' });
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState(null);
  const [historicoAberto, setHistoricoAberto] = useState({});

  const { data: militares = [] } = useQuery({
    queryKey: ['vt-militares'],
    queryFn: () => base44.entities.Militar.list(),
    enabled: isAccessResolved,
  });

  const { data: contratos = [], isLoading } = useQuery({
    queryKey: ['contratos-temporarios'],
    queryFn: () => base44.entities.ContratoTemporario.list('-updated_date'),
    enabled: isAccessResolved,
  });

  const { data: historicos = [] } = useQuery({
    queryKey: ['historico-contratos-temporarios'],
    queryFn: () => base44.entities.HistoricoContratoTemporario.list('-data_registro'),
    enabled: isAccessResolved,
  });

  const cards = useMemo(() => montarCardsContratosTemporarios({ contratos, militares, historicos }), [contratos, militares, historicos]);

  const filtered = useMemo(() => cards.filter((item) => {
    const filtroMilitar = filters.militar.toLowerCase().trim();
    const nome = String(item.militar_nome || '').toLowerCase();
    const matricula = String(item.militar_matricula || '').toLowerCase();

    if (filtroMilitar && !nome.includes(filtroMilitar) && !matricula.includes(filtroMilitar)) return false;
    if (filters.tipo_vinculo !== 'all' && item.tipo_vinculo !== filters.tipo_vinculo) return false;
    if (filters.status !== 'all' && item.status_calculado !== filters.status) return false;
    return true;
  }), [cards, filters]);

  const upsertMutation = useMutation({
    mutationFn: async (payload) => {
      const basePayload = {
        militar_id: payload.militar_id,
        tipo_vinculo: payload.tipo_vinculo,
        data_inicio: payload.data_inicio,
        data_fim_atual: payload.data_fim_atual,
        observacoes_gerais: payload.observacoes_gerais,
        status: calcularStatusContratoTemporario(payload),
      };

      if (editingId) {
        await base44.entities.ContratoTemporario.update(editingId, basePayload);
        await base44.entities.HistoricoContratoTemporario.create({
          contrato_temporario_id: editingId,
          ...criarHistoricoContrato({
            tipoRegistro: 'OBSERVACAO',
            detalhes: 'Contrato editado manualmente.',
            dataRegistro: new Date(),
          }),
        });
        return;
      }

      const validacao = validarContratoAtivoUnico({ contrato: basePayload, contratosExistentes: cards });
      if (!validacao.ok) throw new Error(validacao.message);

      const novoContrato = await base44.entities.ContratoTemporario.create(basePayload);
      await base44.entities.HistoricoContratoTemporario.create({
        contrato_temporario_id: novoContrato.id,
        ...criarHistoricoContrato({
          tipoRegistro: 'CRIACAO',
          detalhes: 'Contrato temporário criado.',
          dataRegistro: new Date(),
          dataFimNova: basePayload.data_fim_atual,
        }),
      });
    },
    onSuccess: () => {
      setForm(defaultForm);
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['contratos-temporarios'] });
      queryClient.invalidateQueries({ queryKey: ['historico-contratos-temporarios'] });
    },
    onError: (error) => window.alert(error.message),
  });

  const renovarMutation = useMutation({
    mutationFn: async (contrato) => {
      const novaDataFim = window.prompt('Nova data final vigente (YYYY-MM-DD):', String(contrato.data_fim_atual || '').slice(0, 10));
      if (!novaDataFim) return;
      const boletim = window.prompt('Boletim da renovação:') || '';
      const detalhes = window.prompt('Detalhes da renovação:') || '';

      const { contratoAtualizado, historico } = aplicarRenovacaoContrato(contrato, {
        dataRegistro: new Date(),
        boletim,
        detalhes,
        novaDataFim,
      });

      await base44.entities.ContratoTemporario.update(contrato.id, contratoAtualizado);
      await base44.entities.HistoricoContratoTemporario.create({
        contrato_temporario_id: contrato.id,
        ...historico,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contratos-temporarios'] });
      queryClient.invalidateQueries({ queryKey: ['historico-contratos-temporarios'] });
    },
  });

  const boletimMutation = useMutation({
    mutationFn: async (contrato) => {
      const boletim = window.prompt('Número do boletim:');
      if (!boletim) return;
      const detalhes = window.prompt('Detalhes do boletim:') || '';
      await base44.entities.HistoricoContratoTemporario.create({
        contrato_temporario_id: contrato.id,
        ...criarHistoricoContrato({
          tipoRegistro: 'BOLETIM',
          dataRegistro: new Date(),
          boletim,
          detalhes,
        }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['historico-contratos-temporarios'] }),
  });

  const encerrarMutation = useMutation({
    mutationFn: async (contrato) => {
      const boletim = window.prompt('Boletim de encerramento (opcional):') || '';
      const detalhes = window.prompt('Motivo/detalhes do encerramento:') || '';
      const { contratoAtualizado, historico } = encerrarContratoTemporario(contrato, {
        dataRegistro: new Date(),
        boletim,
        detalhes,
      });

      await base44.entities.ContratoTemporario.update(contrato.id, contratoAtualizado);
      await base44.entities.HistoricoContratoTemporario.create({
        contrato_temporario_id: contrato.id,
        ...historico,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contratos-temporarios'] });
      queryClient.invalidateQueries({ queryKey: ['historico-contratos-temporarios'] });
    },
  });

  const startEdit = (contrato) => {
    setEditingId(contrato.id);
    setForm({
      militar_id: contrato.militar_id || '',
      tipo_vinculo: contrato.tipo_vinculo || 'DESIGNADO',
      data_inicio: String(contrato.data_inicio || '').slice(0, 10),
      data_fim_atual: String(contrato.data_fim_atual || contrato.data_fim_prevista || '').slice(0, 10),
      observacoes_gerais: contrato.observacoes_gerais || '',
    });
  };

  if (!loadingUser && isAccessResolved && !canAccessModule('militares')) return <AccessDenied modulo="Vínculos Temporários" />;

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      <div className="flex items-center gap-3">
        <CalendarClock className="w-8 h-8 text-[#1e3a5f]" />
        <div>
          <h1 className="text-3xl font-bold text-[#1e3a5f]">Vínculos Temporários</h1>
          <p className="text-slate-500">Controle operacional simples do contrato atual e histórico.</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Filtros</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input placeholder="Militar / matrícula" value={filters.militar} onChange={(e) => setFilters((p) => ({ ...p, militar: e.target.value }))} />
          <Select value={filters.tipo_vinculo} onValueChange={(value) => setFilters((p) => ({ ...p, tipo_vinculo: value }))}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos tipos</SelectItem>{TIPO_OPTIONS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filters.status} onValueChange={(value) => setFilters((p) => ({ ...p, status: value }))}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos status</SelectItem>{STATUS_OPTIONS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{editingId ? 'Editar contrato' : 'Novo contrato temporário'}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Select value={form.militar_id} onValueChange={(value) => setForm((p) => ({ ...p, militar_id: value }))}>
            <SelectTrigger><SelectValue placeholder="Militar" /></SelectTrigger>
            <SelectContent>{militares.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome_completo}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={form.tipo_vinculo} onValueChange={(value) => setForm((p) => ({ ...p, tipo_vinculo: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TIPO_OPTIONS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select>
          <Input type="date" value={form.data_inicio} onChange={(e) => setForm((p) => ({ ...p, data_inicio: e.target.value }))} />
          <Input type="date" value={form.data_fim_atual} onChange={(e) => setForm((p) => ({ ...p, data_fim_atual: e.target.value }))} />
          <Input className="md:col-span-4" placeholder="Observações gerais" value={form.observacoes_gerais} onChange={(e) => setForm((p) => ({ ...p, observacoes_gerais: e.target.value }))} />
          <div className="md:col-span-4 flex gap-2">
            <Button onClick={() => upsertMutation.mutate(form)}><Plus className="w-4 h-4 mr-2" />{editingId ? 'Salvar edição' : 'Criar contrato'}</Button>
            {editingId && <Button variant="outline" onClick={() => { setEditingId(null); setForm(defaultForm); }}>Cancelar edição</Button>}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {isLoading ? <p>Carregando...</p> : filtered.map((item) => (
          <Card key={item.id} className="bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between gap-2">
                <span>{item.militar_nome}</span>
                <Badge>{item.status_calculado}</Badge>
              </CardTitle>
              <p className="text-sm text-slate-500">Matrícula: {item.militar_matricula}</p>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-slate-600">Tipo: {item.tipo_vinculo}</p>
              <p className="text-sm text-slate-600">Início: {formatDate(item.data_inicio)}</p>
              <p className="text-sm text-slate-600">Fim atual: {formatDate(item.data_fim_atual || item.data_fim_prevista)}</p>
              <p className="text-sm text-slate-600">Último boletim: {item.ultimo_boletim || '-'}</p>

              <div className="flex gap-2 flex-wrap pt-2">
                <Button size="sm" variant="outline" onClick={() => startEdit(item)}>Editar</Button>
                <Button size="sm" variant="outline" onClick={() => renovarMutation.mutate(item)}><RefreshCw className="w-4 h-4 mr-1" />Renovar</Button>
                <Button size="sm" variant="outline" onClick={() => boletimMutation.mutate(item)}><FileText className="w-4 h-4 mr-1" />Registrar boletim</Button>
                <Button size="sm" variant="outline" onClick={() => encerrarMutation.mutate(item)}><XCircle className="w-4 h-4 mr-1" />Encerrar</Button>
                <Button size="sm" variant="ghost" onClick={() => navigate(`${createPageUrl('VerMilitar')}?id=${item.militar_id}&tab=vinculo-temporario`)}>Perfil</Button>
                <Button size="sm" variant="outline" onClick={() => setHistoricoAberto((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}><History className="w-4 h-4 mr-1" />Ver histórico</Button>
              </div>

              {historicoAberto[item.id] && (
                <div className="mt-3 border-t pt-3 space-y-2">
                  {item.historico.length === 0 ? (
                    <p className="text-sm text-slate-500">Sem histórico registrado.</p>
                  ) : item.historico.map((evento) => (
                    <div key={evento.id} className="rounded border border-slate-200 p-2 bg-slate-50">
                      <p className="text-sm text-slate-700">{evento.tipo_registro} • {formatDate(evento.data_registro)}</p>
                      <p className="text-xs text-slate-500">Boletim: {evento.boletim || '-'} • {evento.detalhes || 'Sem detalhes'}</p>
                      {(evento.data_fim_anterior || evento.data_fim_nova) && (
                        <p className="text-xs text-slate-500">Fim anterior: {formatDate(evento.data_fim_anterior)} → Novo fim: {formatDate(evento.data_fim_nova)}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
