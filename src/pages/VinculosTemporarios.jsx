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
  calcularBadgeVigenciaContrato,
  calcularStatusContratoTemporario,
  encerrarOuExtinguirContrato,
  listarContratosAtuais,
  listarHistoricoCadeia,
  prepararRenovacaoContrato,
  validarSobreposicaoContrato,
} from '@/services/vinculosTemporariosService';

const STATUS_OPTIONS = ['RASCUNHO', 'VIGENTE', 'RENOVADO', 'ENCERRADO'];
const TIPO_OPTIONS = ['DESIGNADO', 'CONVOCADO'];

const defaultForm = {
  militar_id: '',
  tipo_vinculo: 'DESIGNADO',
  numero_referencia: '',
  data_inicio: '',
  data_fim_prevista: '',
  numero_doems: '',
  data_doems: '',
  observacoes: '',
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

  const [filters, setFilters] = useState({
    militar: '',
    tipo_vinculo: 'all',
    status: 'all',
    quick: 'all',
  });
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
    queryFn: () => base44.entities.ContratoTemporario.list('-created_date'),
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
    badge_vigencia: calcularBadgeVigenciaContrato(item),
  })), [contratos]);

  const contratosAtuais = useMemo(() => listarContratosAtuais(contratosComStatus), [contratosComStatus]);

  const filtered = useMemo(() => contratosAtuais.filter((item) => {
    const militar = militarLookup.get(item.militar_id);
    const nome = String(militar?.nome_completo || '').toLowerCase();
    const matricula = String(militar?.matricula_atual || militar?.matricula || '').toLowerCase();
    const filtroMilitar = filters.militar.toLowerCase().trim();
    if (filtroMilitar && !nome.includes(filtroMilitar) && !matricula.includes(filtroMilitar)) return false;

    if (filters.tipo_vinculo !== 'all' && item.tipo_vinculo !== filters.tipo_vinculo) return false;
    if (filters.status !== 'all' && item.status_calculado !== filters.status) return false;
    if (filters.quick === 'a_vencer' && item.badge_vigencia !== 'A_VENCER') return false;
    if (filters.quick === 'expirado' && item.badge_vigencia !== 'EXPIRADO') return false;

    return true;
  }), [contratosAtuais, filters, militarLookup]);

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
        if (!novo.contrato_raiz_id) {
          await base44.entities.ContratoTemporario.update(novo.id, { contrato_raiz_id: novo.id });
        }
      }
    },
    onSuccess: () => {
      setForm(defaultForm);
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['contratos-temporarios'] });
    },
    onError: (error) => window.alert(error.message),
  });

  const encerrarMutation = useMutation({
    mutationFn: async ({ contrato, motivo, dataEfetiva }) => {
      const atualizado = encerrarOuExtinguirContrato(contrato, { motivo, dataEfetiva });
      await base44.entities.ContratoTemporario.update(contrato.id, atualizado);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contratos-temporarios'] }),
  });

  const renovarMutation = useMutation({
    mutationFn: async (contratoAnterior) => {
      const preparacao = prepararRenovacaoContrato(contratoAnterior, {
        militar_id: contratoAnterior.militar_id,
        tipo_vinculo: contratoAnterior.tipo_vinculo,
        numero_referencia: '',
        data_inicio: contratoAnterior.data_fim_prevista,
        data_fim_prevista: '',
        numero_doems: '',
        data_doems: '',
        observacoes: '',
      }, contratosComStatus);

      if (!preparacao.ok) throw new Error(preparacao.message);

      const novo = await base44.entities.ContratoTemporario.create(preparacao.novoContrato);
      await base44.entities.ContratoTemporario.update(contratoAnterior.id, {
        status: 'RENOVADO',
        contrato_raiz_id: preparacao.contratoAnteriorAtualizado.contrato_raiz_id,
      });
      await base44.entities.ContratoTemporario.update(novo.id, {
        contrato_raiz_id: preparacao.contratoAnteriorAtualizado.contrato_raiz_id,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contratos-temporarios'] }),
    onError: (error) => window.alert(error.message),
  });

  const startEdit = (contrato) => {
    setEditingId(contrato.id);
    setForm({
      militar_id: contrato.militar_id || '',
      tipo_vinculo: contrato.tipo_vinculo || 'DESIGNADO',
      numero_referencia: contrato.numero_referencia || '',
      data_inicio: String(contrato.data_inicio || '').slice(0, 10),
      data_fim_prevista: String(contrato.data_fim_prevista || '').slice(0, 10),
      numero_doems: contrato.numero_doems || contrato.numero_diario_oficial || '',
      data_doems: String(contrato.data_doems || contrato.data_publicacao || '').slice(0, 10),
      observacoes: contrato.observacoes || '',
    });
  };

  if (!loadingUser && isAccessResolved && !canAccessModule('militares')) return <AccessDenied modulo="Vínculos Temporários" />;

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      <div className="flex items-center gap-3">
        <CalendarClock className="w-8 h-8 text-[#1e3a5f]" />
        <div>
          <h1 className="text-3xl font-bold text-[#1e3a5f]">Vínculos Temporários</h1>
          <p className="text-slate-500">Controle de contrato, vigência, renovação e DOEMS.</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Filtros</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input placeholder="Militar / matrícula" value={filters.militar} onChange={(e) => setFilters((p) => ({ ...p, militar: e.target.value }))} />
          <Select value={filters.tipo_vinculo} onValueChange={(value) => setFilters((p) => ({ ...p, tipo_vinculo: value }))}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos tipos</SelectItem>{TIPO_OPTIONS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filters.status} onValueChange={(value) => setFilters((p) => ({ ...p, status: value }))}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos status</SelectItem>{STATUS_OPTIONS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filters.quick} onValueChange={(value) => setFilters((p) => ({ ...p, quick: value }))}>
            <SelectTrigger><SelectValue placeholder="Situação" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas situações</SelectItem>
              <SelectItem value="a_vencer">A vencer</SelectItem>
              <SelectItem value="expirado">Expirado</SelectItem>
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
          <Input placeholder="Nº referência" value={form.numero_referencia} onChange={(e) => setForm((p) => ({ ...p, numero_referencia: e.target.value }))} />
          <Input type="date" value={form.data_inicio} onChange={(e) => setForm((p) => ({ ...p, data_inicio: e.target.value }))} />
          <Input type="date" value={form.data_fim_prevista} onChange={(e) => setForm((p) => ({ ...p, data_fim_prevista: e.target.value }))} />
          <Input placeholder="Nº DOEMS" value={form.numero_doems} onChange={(e) => setForm((p) => ({ ...p, numero_doems: e.target.value }))} />
          <Input type="date" value={form.data_doems} onChange={(e) => setForm((p) => ({ ...p, data_doems: e.target.value }))} />
          <Input className="md:col-span-4" placeholder="Observações" value={form.observacoes} onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))} />
          <div className="md:col-span-4 flex gap-2">
            <Button onClick={() => upsertMutation.mutate(form)}><Plus className="w-4 h-4 mr-2" />{editingId ? 'Salvar edição' : 'Criar contrato'}</Button>
            {editingId && <Button variant="outline" onClick={() => { setEditingId(null); setForm(defaultForm); }}>Cancelar edição</Button>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Listagem de contratos (somente atual por cadeia)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? <p>Carregando...</p> : filtered.map((item) => {
            const militar = militarLookup.get(item.militar_id);
            const historico = listarHistoricoCadeia(contratosComStatus, item);
            return (
              <div key={item.id} className="border rounded-lg p-3 bg-white">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <p className="font-semibold text-slate-800">{militar?.nome_completo || 'Militar não encontrado'}</p>
                    <p className="text-sm text-slate-500">Matrícula: {militar?.matricula_atual || militar?.matricula || '-'} • Tipo: {item.tipo_vinculo}</p>
                    <p className="text-sm text-slate-500">Início: {formatDate(item.data_inicio)} • Fim prevista: {formatDate(item.data_fim_prevista)} • Fim efetiva: {formatDate(item.data_fim_efetiva)}</p>
                    <p className="text-sm text-slate-500">DOEMS: {item.numero_doems || item.numero_diario_oficial || '-'} • Data DOEMS: {formatDate(item.data_doems || item.data_publicacao)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge>{item.status_calculado}</Badge>
                    {item.badge_vigencia && <Badge variant="secondary">{item.badge_vigencia === 'A_VENCER' ? 'A vencer' : 'Expirado'}</Badge>}
                    <Button size="sm" variant="outline" onClick={() => startEdit(item)}>Editar</Button>
                    <Button size="sm" variant="outline" onClick={() => {
                      const motivo = window.prompt('Motivo do encerramento:');
                      const dataEfetiva = window.prompt('Data efetiva (YYYY-MM-DD):', new Date().toISOString().slice(0, 10));
                      if (motivo && dataEfetiva) encerrarMutation.mutate({ contrato: item, motivo, dataEfetiva });
                    }}>Encerrar</Button>
                    <Button size="sm" onClick={() => renovarMutation.mutate(item)}><RefreshCw className="w-4 h-4 mr-1" />Renovar</Button>
                    <Button size="sm" variant="ghost" onClick={() => navigate(`${createPageUrl('VerMilitar')}?id=${item.militar_id}&tab=vinculo-temporario`)}>Perfil</Button>
                    <Button size="sm" variant="outline" onClick={() => setHistoricoAberto((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}>
                      {historicoAberto[item.id] ? 'Ocultar histórico' : 'Ver histórico'}
                    </Button>
                  </div>
                </div>

                {historicoAberto[item.id] && (
                  <div className="mt-3 border-t pt-3 space-y-2">
                    {historico.length === 0 ? (
                      <p className="text-sm text-slate-500">Sem contratos anteriores nesta cadeia.</p>
                    ) : historico.map((ant) => (
                      <div key={ant.id} className="rounded border border-slate-200 p-2 bg-slate-50">
                        <p className="text-sm text-slate-700">Ref: {ant.numero_referencia || '-'} • Início {formatDate(ant.data_inicio)} • Fim {formatDate(ant.data_fim_prevista)}</p>
                        <p className="text-xs text-slate-500">Status: {ant.status_calculado} • DOEMS: {ant.numero_doems || ant.numero_diario_oficial || '-'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
