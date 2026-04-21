import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CalendarClock, Plus, RefreshCw } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';
import AccessDenied from '@/components/auth/AccessDenied';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import {
  calcularStatusContratoTemporario,
  encerrarOuExtinguirContrato,
  prepararRenovacaoContrato,
  validarSobreposicaoContrato,
} from '@/services/vinculosTemporariosService';

const STATUS_OPTIONS = ['RASCUNHO', 'VIGENTE', 'A_VENCER', 'EM_RENOVACAO', 'AGUARDANDO_PUBLICACAO', 'EXPIRADO', 'ENCERRADO', 'EXTINTO'];
const TIPO_OPTIONS = ['DESIGNADO', 'CONVOCADO'];
const ORIGEM_OPTIONS = ['CADASTRO', 'IMPORTACAO', 'RENOVACAO', 'AJUSTE'];

const defaultForm = {
  militar_id: '',
  tipo_vinculo: 'DESIGNADO',
  numero_referencia: '',
  origem_registro: 'CADASTRO',
  data_inicio: '',
  data_fim_prevista: '',
  status: 'RASCUNHO',
  permite_renovacao: true,
  processo_referencia: '',
  comunicacao_interna_referencia: '',
  observacoes: '',
};

const ACTIVE_FILTERS = {
  a_vencer: (item) => item.status_calculado === 'A_VENCER',
  expirados: (item) => item.status_calculado === 'EXPIRADO',
  aguardando_publicacao: (item) => item.status_calculado === 'AGUARDANDO_PUBLICACAO',
};

function formatDate(value) {
  if (!value) return '-';
  const iso = String(value).slice(0, 10);
  return iso.split('-').reverse().join('/');
}

function daysUntil(endDate) {
  if (!endDate) return null;
  const end = new Date(`${String(endDate).slice(0, 10)}T00:00:00Z`);
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return Math.floor((end.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

export default function VinculosTemporarios() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canAccessModule, isAccessResolved, isLoading: loadingUser, user } = useCurrentUser();

  const [filters, setFilters] = useState({
    militar: '',
    tipo_vinculo: 'all',
    status: 'all',
    periodo_inicio: '',
    periodo_fim: '',
    quick: 'all',
  });
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState(null);

  const { data: militares = [] } = useQuery({
    queryKey: ['vt-militares'],
    queryFn: () => base44.entities.Militar.list(),
    enabled: isAccessResolved,
  });

  const { data: contratos = [], isLoading } = useQuery({
    queryKey: ['contratos-temporarios'],
    queryFn: () => base44.entities.ContratoTemporario.list('-created_date'),
    enabled: isAccessResolved,
  });

  const { data: eventos = [] } = useQuery({
    queryKey: ['eventos-contrato-temporario'],
    queryFn: () => base44.entities.EventoContratoTemporario.list('-created_date'),
    enabled: isAccessResolved,
  });

  const militarLookup = useMemo(() => {
    const map = new Map();
    militares.forEach((m) => map.set(m.id, m));
    return map;
  }, [militares]);

  const contratosComStatus = useMemo(() => contratos.map((item) => ({
    ...item,
    status_calculado: calcularStatusContratoTemporario(item),
  })), [contratos]);

  const filtered = useMemo(() => contratosComStatus.filter((item) => {
    const militar = militarLookup.get(item.militar_id);
    const nome = String(militar?.nome_completo || '').toLowerCase();
    const matricula = String(militar?.matricula_atual || militar?.matricula || '').toLowerCase();
    const filtroMilitar = filters.militar.toLowerCase().trim();
    if (filtroMilitar && !nome.includes(filtroMilitar) && !matricula.includes(filtroMilitar)) return false;

    if (filters.tipo_vinculo !== 'all' && item.tipo_vinculo !== filters.tipo_vinculo) return false;
    if (filters.status !== 'all' && item.status_calculado !== filters.status) return false;
    if (filters.quick !== 'all' && !ACTIVE_FILTERS[filters.quick]?.(item)) return false;

    if (filters.periodo_inicio && String(item.data_inicio || '').slice(0, 10) < filters.periodo_inicio) return false;
    if (filters.periodo_fim && String(item.data_fim_prevista || '').slice(0, 10) > filters.periodo_fim) return false;

    return true;
  }), [contratosComStatus, filters, militarLookup]);

  const upsertMutation = useMutation({
    mutationFn: async (payload) => {
      const basePayload = {
        ...payload,
        status: calcularStatusContratoTemporario(payload),
      };
      const validacao = validarSobreposicaoContrato({ contrato: { ...basePayload, id: editingId }, contratosExistentes: contratosComStatus });
      if (!validacao.ok) throw new Error(validacao.message);

      if (editingId) {
        await base44.entities.ContratoTemporario.update(editingId, basePayload);
      } else {
        const novo = await base44.entities.ContratoTemporario.create(basePayload);
        await base44.entities.EventoContratoTemporario.create({
          contrato_temporario_id: novo.id,
          tipo_evento: 'INICIO',
          data_evento: payload.data_inicio,
          titulo: 'Início de vigência',
          descricao: payload.observacoes || 'Contrato temporário criado.',
          numero_referencia: payload.numero_referencia || '',
          processo_referencia: payload.processo_referencia || '',
          created_by: user?.email || '',
        });
      }
    },
    onSuccess: () => {
      setForm(defaultForm);
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['contratos-temporarios'] });
      queryClient.invalidateQueries({ queryKey: ['eventos-contrato-temporario'] });
    },
  });

  const mudarStatusMutation = useMutation({
    mutationFn: async ({ contrato, tipo, motivo, dataEfetiva }) => {
      const atualizado = encerrarOuExtinguirContrato(contrato, { tipo, motivo, dataEfetiva });
      await base44.entities.ContratoTemporario.update(contrato.id, atualizado);
      await base44.entities.EventoContratoTemporario.create({
        contrato_temporario_id: contrato.id,
        tipo_evento: tipo === 'EXTINTO' ? 'EXTINCAO' : 'ENCERRAMENTO',
        data_evento: dataEfetiva,
        titulo: `${tipo === 'EXTINTO' ? 'Extinção' : 'Encerramento'} do contrato`,
        descricao: motivo,
        created_by: user?.email || '',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contratos-temporarios'] });
      queryClient.invalidateQueries({ queryKey: ['eventos-contrato-temporario'] });
    },
  });

  const renovarMutation = useMutation({
    mutationFn: async (contratoAnterior) => {
      const payload = prepararRenovacaoContrato(contratoAnterior, {
        militar_id: contratoAnterior.militar_id,
        tipo_vinculo: contratoAnterior.tipo_vinculo,
        numero_referencia: '',
        data_inicio: contratoAnterior.data_fim_prevista,
        data_fim_prevista: '',
        permite_renovacao: contratoAnterior.permite_renovacao,
        status: 'EM_RENOVACAO',
      });
      const novo = await base44.entities.ContratoTemporario.create(payload);
      await base44.entities.ContratoTemporario.update(contratoAnterior.id, { status: 'EM_RENOVACAO' });
      await base44.entities.EventoContratoTemporario.create({
        contrato_temporario_id: contratoAnterior.id,
        tipo_evento: 'RENOVACAO',
        data_evento: new Date().toISOString().slice(0, 10),
        titulo: 'Renovação iniciada',
        descricao: `Novo contrato ${novo.id} criado sem sobrescrever a vigência anterior.`,
        created_by: user?.email || '',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contratos-temporarios'] });
      queryClient.invalidateQueries({ queryKey: ['eventos-contrato-temporario'] });
    },
  });

  const registrarEventoMutation = useMutation({
    mutationFn: ({ contratoId, titulo, descricao }) => base44.entities.EventoContratoTemporario.create({
      contrato_temporario_id: contratoId,
      tipo_evento: 'OBSERVACAO',
      data_evento: new Date().toISOString().slice(0, 10),
      titulo,
      descricao,
      created_by: user?.email || '',
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['eventos-contrato-temporario'] }),
  });

  const startEdit = (contrato) => {
    setEditingId(contrato.id);
    setForm({
      militar_id: contrato.militar_id || '',
      tipo_vinculo: contrato.tipo_vinculo || 'DESIGNADO',
      numero_referencia: contrato.numero_referencia || '',
      origem_registro: contrato.origem_registro || 'CADASTRO',
      data_inicio: String(contrato.data_inicio || '').slice(0, 10),
      data_fim_prevista: String(contrato.data_fim_prevista || '').slice(0, 10),
      status: contrato.status || 'RASCUNHO',
      permite_renovacao: contrato.permite_renovacao !== false,
      processo_referencia: contrato.processo_referencia || '',
      comunicacao_interna_referencia: contrato.comunicacao_interna_referencia || '',
      observacoes: contrato.observacoes || '',
    });
  };

  if (!loadingUser && isAccessResolved && !canAccessModule('militares')) return <AccessDenied modulo="Vínculos Temporários" />;

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarClock className="w-8 h-8 text-[#1e3a5f]" />
          <div>
            <h1 className="text-3xl font-bold text-[#1e3a5f]">Vínculos Temporários</h1>
            <p className="text-slate-500">Controle de designados e convocados com histórico rastreável.</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Filtros</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Input placeholder="Militar / matrícula" value={filters.militar} onChange={(e) => setFilters((p) => ({ ...p, militar: e.target.value }))} />
          <Select value={filters.tipo_vinculo} onValueChange={(value) => setFilters((p) => ({ ...p, tipo_vinculo: value }))}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos tipos</SelectItem>{TIPO_OPTIONS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filters.status} onValueChange={(value) => setFilters((p) => ({ ...p, status: value }))}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos status</SelectItem>{STATUS_OPTIONS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="date" value={filters.periodo_inicio} onChange={(e) => setFilters((p) => ({ ...p, periodo_inicio: e.target.value }))} />
          <Input type="date" value={filters.periodo_fim} onChange={(e) => setFilters((p) => ({ ...p, periodo_fim: e.target.value }))} />
          <Select value={filters.quick} onValueChange={(value) => setFilters((p) => ({ ...p, quick: value }))}>
            <SelectTrigger><SelectValue placeholder="Atalho" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="a_vencer">A vencer</SelectItem>
              <SelectItem value="expirados">Expirados</SelectItem>
              <SelectItem value="aguardando_publicacao">Aguardando publicação</SelectItem>
            </SelectContent>
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
          <Select value={form.origem_registro} onValueChange={(value) => setForm((p) => ({ ...p, origem_registro: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ORIGEM_OPTIONS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select>
          <Input placeholder="Nº referência" value={form.numero_referencia} onChange={(e) => setForm((p) => ({ ...p, numero_referencia: e.target.value }))} />
          <Input type="date" value={form.data_inicio} onChange={(e) => setForm((p) => ({ ...p, data_inicio: e.target.value }))} />
          <Input type="date" value={form.data_fim_prevista} onChange={(e) => setForm((p) => ({ ...p, data_fim_prevista: e.target.value }))} />
          <Input placeholder="Processo" value={form.processo_referencia} onChange={(e) => setForm((p) => ({ ...p, processo_referencia: e.target.value }))} />
          <Input placeholder="Comunicação interna" value={form.comunicacao_interna_referencia} onChange={(e) => setForm((p) => ({ ...p, comunicacao_interna_referencia: e.target.value }))} />
          <Input className="md:col-span-4" placeholder="Observações" value={form.observacoes} onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))} />
          <div className="md:col-span-4 flex gap-2">
            <Button onClick={() => upsertMutation.mutate(form)}><Plus className="w-4 h-4 mr-2" />{editingId ? 'Salvar edição' : 'Criar contrato'}</Button>
            {editingId && <Button variant="outline" onClick={() => { setEditingId(null); setForm(defaultForm); }}>Cancelar edição</Button>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Listagem de contratos</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? <p>Carregando...</p> : filtered.map((item) => {
            const militar = militarLookup.get(item.militar_id);
            const dias = daysUntil(item.data_fim_prevista);
            const alerta = dias !== null && dias >= 0 && dias <= 60;
            return (
              <div key={item.id} className="border rounded-lg p-3 bg-white">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <p className="font-semibold text-slate-800">{militar?.nome_completo || 'Militar não encontrado'}</p>
                    <p className="text-sm text-slate-500">Matrícula: {militar?.matricula_atual || militar?.matricula || '-'} • Tipo: {item.tipo_vinculo}</p>
                    <p className="text-sm text-slate-500">Início: {formatDate(item.data_inicio)} • Fim prevista: {formatDate(item.data_fim_prevista)}</p>
                    <p className="text-sm text-slate-500">Processo: {item.processo_referencia || '-'} • DO: {item.numero_diario_oficial || '-'}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge>{item.status_calculado}</Badge>
                    {alerta && <Badge variant="secondary">Vence em {dias} dia(s)</Badge>}
                    <Button size="sm" variant="outline" onClick={() => startEdit(item)}>Editar</Button>
                    <Button size="sm" variant="outline" onClick={() => {
                      const motivo = window.prompt('Motivo do encerramento/extinção:');
                      const dataEfetiva = window.prompt('Data efetiva (YYYY-MM-DD):', new Date().toISOString().slice(0, 10));
                      const tipo = window.confirm('Clique em OK para EXTINTO. Cancelar = ENCERRADO.') ? 'EXTINTO' : 'ENCERRADO';
                      if (motivo && dataEfetiva) mudarStatusMutation.mutate({ contrato: item, motivo, dataEfetiva, tipo });
                    }}>Encerrar/Extinguir</Button>
                    <Button size="sm" variant="outline" onClick={() => {
                      const titulo = window.prompt('Título do evento:', 'Observação administrativa');
                      const descricao = window.prompt('Descrição do evento:');
                      if (titulo && descricao) registrarEventoMutation.mutate({ contratoId: item.id, titulo, descricao });
                    }}>Registrar evento</Button>
                    <Button size="sm" onClick={() => renovarMutation.mutate(item)} disabled={!item.permite_renovacao}><RefreshCw className="w-4 h-4 mr-1" />Renovar</Button>
                    <Button size="sm" variant="ghost" onClick={() => navigate(`${createPageUrl('VerMilitar')}?id=${item.militar_id}&tab=vinculo-temporario`)}>Perfil</Button>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-2">Eventos: {eventos.filter((ev) => ev.contrato_temporario_id === item.id).length}</p>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
