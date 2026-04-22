import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import {
  TIPOS_CREDITO_EXTRA_FERIAS,
  STATUS_CREDITO_EXTRA_FERIAS,
  criarPayloadCreditoExtraFerias,
  formatarTipoCreditoExtra,
  filtrarCreditosExtraFerias,
} from '@/services/creditoExtraFeriasService';

const initialForm = {
  id: '',
  militar_id: '',
  tipo_credito: TIPOS_CREDITO_EXTRA_FERIAS.OUTRO,
  quantidade_dias: 1,
  data_referencia: new Date().toISOString().slice(0, 10),
  origem_documental: '',
  numero_boletim: '',
  data_boletim: '',
  observacoes: '',
  status: STATUS_CREDITO_EXTRA_FERIAS.DISPONIVEL,
};

const STATUS_COLORS = {
  DISPONIVEL: 'bg-emerald-100 text-emerald-700',
  VINCULADO: 'bg-blue-100 text-blue-700',
  USADO: 'bg-slate-100 text-slate-700',
  CANCELADO: 'bg-red-100 text-red-700',
};

function formatDate(v) {
  if (!v) return '—';
  try {
    return new Date(`${v}T00:00:00`).toLocaleDateString('pt-BR');
  } catch {
    return v;
  }
}

export default function CreditosExtraordinariosFerias() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { canAccessModule, isLoading: loadingUser, isAccessResolved } = useCurrentUser();
  const [filtros, setFiltros] = useState({
    militar_id: '',
    tipo_credito: '',
    status: '',
    unidade: '',
    data_inicio: '',
    data_fim: '',
  });
  const [form, setForm] = useState(initialForm);

  const { data: militares = [] } = useQuery({
    queryKey: ['creditos-extra-ferias-militares'],
    queryFn: () => base44.entities.Militar.list('nome_completo'),
    enabled: isAccessResolved && canAccessModule('ferias'),
  });

  const militarById = useMemo(
    () => new Map(militares.map((militar) => [militar.id, militar])),
    [militares],
  );

  const { data: creditos = [], isLoading } = useQuery({
    queryKey: ['creditos-extra-ferias'],
    queryFn: () => base44.entities.CreditoExtraFerias.list('-data_referencia'),
    enabled: isAccessResolved && canAccessModule('ferias'),
  });

  const creditosFiltrados = useMemo(
    () => filtrarCreditosExtraFerias(creditos, filtros, militarById),
    [creditos, filtros, militarById],
  );

  const salvarMutation = useMutation({
    mutationFn: async () => {
      const militar = militarById.get(form.militar_id);
      if (!militar) throw new Error('Selecione um militar para salvar o crédito extraordinário.');

      const payload = criarPayloadCreditoExtraFerias(form, {
        id: militar.id,
        nome_completo: militar.nome_completo,
        posto_grad: militar.posto_graduacao,
        matricula: militar.matricula,
      });

      if (form.id) {
        return base44.entities.CreditoExtraFerias.update(form.id, payload);
      }

      return base44.entities.CreditoExtraFerias.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creditos-extra-ferias'] });
      toast({ title: form.id ? 'Crédito atualizado com sucesso' : 'Crédito cadastrado com sucesso' });
      setForm(initialForm);
    },
    onError: (error) => {
      toast({ title: 'Falha ao salvar crédito extraordinário', description: error?.message || 'Erro inesperado.' });
    },
  });

  const cancelarMutation = useMutation({
    mutationFn: async (credito) => {
      return base44.entities.CreditoExtraFerias.update(credito.id, {
        status: STATUS_CREDITO_EXTRA_FERIAS.CANCELADO,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creditos-extra-ferias'] });
      toast({ title: 'Crédito cancelado' });
    },
    onError: (error) => {
      toast({ title: 'Falha ao cancelar crédito', description: error?.message || 'Erro inesperado.' });
    },
  });

  if (!loadingUser && isAccessResolved && !canAccessModule('ferias')) return <AccessDenied modulo="Férias" />;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#1e3a5f]">Créditos Extraordinários</h1>
          <p className="text-slate-600 mt-1">Gestão operacional de créditos extraordinários vinculáveis ao gozo.</p>
        </div>
        <Button variant="outline" onClick={() => navigate(createPageUrl('Ferias'))}>Voltar para Férias</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Filtros</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label>Militar</Label>
            <select className="mt-1.5 w-full border border-slate-200 rounded-md px-3 py-2 text-sm" value={filtros.militar_id} onChange={(e) => setFiltros((p) => ({ ...p, militar_id: e.target.value }))}>
              <option value="">Todos</option>
              {militares.map((militar) => <option key={militar.id} value={militar.id}>{militar.nome_completo}</option>)}
            </select>
          </div>
          <div>
            <Label>Tipo de crédito</Label>
            <select className="mt-1.5 w-full border border-slate-200 rounded-md px-3 py-2 text-sm" value={filtros.tipo_credito} onChange={(e) => setFiltros((p) => ({ ...p, tipo_credito: e.target.value }))}>
              <option value="">Todos</option>
              {Object.values(TIPOS_CREDITO_EXTRA_FERIAS).map((tipo) => <option key={tipo} value={tipo}>{formatarTipoCreditoExtra(tipo)}</option>)}
            </select>
          </div>
          <div>
            <Label>Status</Label>
            <select className="mt-1.5 w-full border border-slate-200 rounded-md px-3 py-2 text-sm" value={filtros.status} onChange={(e) => setFiltros((p) => ({ ...p, status: e.target.value }))}>
              <option value="">Todos</option>
              {Object.values(STATUS_CREDITO_EXTRA_FERIAS).map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
          <div>
            <Label>Unidade</Label>
            <Input value={filtros.unidade} onChange={(e) => setFiltros((p) => ({ ...p, unidade: e.target.value }))} placeholder="Ex.: 1º BPM" />
          </div>
          <div>
            <Label>Data inicial</Label>
            <Input type="date" value={filtros.data_inicio} onChange={(e) => setFiltros((p) => ({ ...p, data_inicio: e.target.value }))} />
          </div>
          <div>
            <Label>Data final</Label>
            <Input type="date" value={filtros.data_fim} onChange={(e) => setFiltros((p) => ({ ...p, data_fim: e.target.value }))} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{form.id ? 'Editar crédito' : 'Novo crédito extraordinário'}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Militar</Label>
              <select className="mt-1.5 w-full border border-slate-200 rounded-md px-3 py-2 text-sm" value={form.militar_id} onChange={(e) => setForm((p) => ({ ...p, militar_id: e.target.value }))}>
                <option value="">Selecione</option>
                {militares.map((militar) => <option key={militar.id} value={militar.id}>{militar.nome_completo}</option>)}
              </select>
            </div>
            <div>
              <Label>Tipo</Label>
              <select className="mt-1.5 w-full border border-slate-200 rounded-md px-3 py-2 text-sm" value={form.tipo_credito} onChange={(e) => setForm((p) => ({ ...p, tipo_credito: e.target.value }))}>
                {Object.values(TIPOS_CREDITO_EXTRA_FERIAS).map((tipo) => <option key={tipo} value={tipo}>{formatarTipoCreditoExtra(tipo)}</option>)}
              </select>
            </div>
            <div>
              <Label>Status</Label>
              <select className="mt-1.5 w-full border border-slate-200 rounded-md px-3 py-2 text-sm" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                {Object.values(STATUS_CREDITO_EXTRA_FERIAS).map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
            <div>
              <Label>Quantidade de dias</Label>
              <Input type="number" min={1} value={form.quantidade_dias} onChange={(e) => setForm((p) => ({ ...p, quantidade_dias: Number(e.target.value || 0) }))} />
            </div>
            <div>
              <Label>Data referência</Label>
              <Input type="date" value={form.data_referencia} onChange={(e) => setForm((p) => ({ ...p, data_referencia: e.target.value }))} />
            </div>
            <div>
              <Label>Data boletim</Label>
              <Input type="date" value={form.data_boletim} onChange={(e) => setForm((p) => ({ ...p, data_boletim: e.target.value }))} />
            </div>
            <div>
              <Label>Origem documental</Label>
              <Input value={form.origem_documental} onChange={(e) => setForm((p) => ({ ...p, origem_documental: e.target.value }))} />
            </div>
            <div>
              <Label>Número boletim</Label>
              <Input value={form.numero_boletim} onChange={(e) => setForm((p) => ({ ...p, numero_boletim: e.target.value }))} />
            </div>
            <div className="md:col-span-3">
              <Label>Observações</Label>
              <Input value={form.observacoes} onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button disabled={salvarMutation.isPending || !form.militar_id || Number(form.quantidade_dias || 0) <= 0} onClick={() => salvarMutation.mutate()}>
              {form.id ? 'Salvar alterações' : 'Cadastrar crédito'}
            </Button>
            {form.id && <Button variant="outline" onClick={() => setForm(initialForm)}>Cancelar edição</Button>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CalendarDays className="w-4 h-4" /> Créditos cadastrados ({creditosFiltrados.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-slate-500">Carregando créditos...</p>
          ) : creditosFiltrados.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum crédito encontrado para os filtros atuais.</p>
          ) : (
            creditosFiltrados.map((credito) => (
              <div key={credito.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-800">
                      {credito.militar_posto ? `${credito.militar_posto} ` : ''}
                      {credito.militar_nome || militarById.get(credito.militar_id)?.nome_completo || 'Militar não identificado'}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{formatarTipoCreditoExtra(credito.tipo_credito)} · {Number(credito.quantidade_dias || 0)} dia(s)</p>
                  </div>
                  <Badge className={STATUS_COLORS[credito.status] || 'bg-slate-100 text-slate-700'}>{credito.status || '—'}</Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 text-xs text-slate-600">
                  <p>Referência: <strong>{formatDate(credito.data_referencia)}</strong></p>
                  <p>Boletim/Documento: <strong>{credito.numero_boletim || credito.origem_documental || '—'}</strong></p>
                  <p>Vínculo com gozo: <strong>{credito.gozo_ferias_id || 'Não vinculado'}</strong></p>
                  <p>Unidade: <strong>{militarById.get(credito.militar_id)?.unidade || '—'}</strong></p>
                </div>

                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setForm({ ...initialForm, ...credito, gozo_ferias_id: credito.gozo_ferias_id || '' })}>Editar</Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={credito.status === STATUS_CREDITO_EXTRA_FERIAS.CANCELADO}
                    onClick={() => cancelarMutation.mutate(credito)}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
