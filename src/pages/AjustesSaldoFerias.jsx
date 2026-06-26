import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Ban, CalendarDays, MinusCircle, PlusCircle, RefreshCw } from 'lucide-react';
import { AjusteSaldoFerias } from '@/api/entities';
import { createPageUrl } from '@/utils';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { criarAjusteSaldoFerias } from '@/services/criarAjusteSaldoFeriasClient';
import { cancelarAjusteSaldoFerias } from '@/services/cancelarAjusteSaldoFeriasClient';
import { getEffectiveEmail } from '@/services/getScopedMilitaresClient';
import { fetchScopedPeriodosAquisitivosBundle } from '@/services/getScopedPeriodosAquisitivosBundleClient';
import {
  STATUS_AJUSTE_SALDO_FERIAS,
  TIPOS_AJUSTE_SALDO_FERIAS,
  calcularSaldoLiquidoPeriodo,
} from '@/services/calculadoraSaldoFeriasService';
import { formatNomeMilitarTexto } from '@/components/militar/NomeMilitar';

const ALL = 'all';
const STATUS_CANCELAVEIS = new Set([
  STATUS_AJUSTE_SALDO_FERIAS.ATIVO,
  STATUS_AJUSTE_SALDO_FERIAS.RASCUNHO,
  STATUS_AJUSTE_SALDO_FERIAS.PENDENTE_PUBLICACAO,
  'pendente',
]);

const formInicial = {
  tipo: TIPOS_AJUSTE_SALDO_FERIAS.CREDITO,
  militar_id: '',
  periodo_aquisitivo_id: '',
  dias: 1,
  motivo: '',
};

function texto(value, fallback = '—') {
  const normalizado = String(value ?? '').trim();
  return normalizado || fallback;
}

function formatarData(value) {
  if (!value) return '—';
  const data = String(value).slice(0, 10);
  const [ano, mes, dia] = data.split('-');
  if (!ano || !mes || !dia) return String(value);
  return `${dia}/${mes}/${ano}`;
}

function formatarDataHora(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return formatarData(value);
  return parsed.toLocaleString('pt-BR');
}

function normalizar(value) {
  return String(value ?? '').trim().toLowerCase();
}

function obterPeriodoRef(periodo = {}) {
  return texto(periodo?.ano_referencia || periodo?.referencia || periodo?.periodo_aquisitivo_ref, 'Sem referência');
}

function formatarNomeMilitar(militar = {}) {
  return formatNomeMilitarTexto(
    militar?.posto_graduacao,
    '',
    militar?.nome_guerra || militar?.nome_completo || militar?.nome || 'Militar não identificado',
  );
}

function obterMilitarNomeAjuste(ajuste = {}, militarById = new Map()) {
  const militar = militarById.get(String(ajuste?.militar_id || ''));
  return texto(ajuste?.militar_nome || (militar ? formatarNomeMilitar(militar) : ''), 'Militar não identificado');
}

function obterPeriodoRefAjuste(ajuste = {}, periodoById = new Map()) {
  const periodo = periodoById.get(String(ajuste?.periodo_aquisitivo_id || ''));
  return texto(ajuste?.periodo_aquisitivo_ref || (periodo ? obterPeriodoRef(periodo) : ''), 'Período não identificado');
}

function badgeStatus(status) {
  const s = normalizar(status || STATUS_AJUSTE_SALDO_FERIAS.RASCUNHO);
  if (s === STATUS_AJUSTE_SALDO_FERIAS.ATIVO) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (s === STATUS_AJUSTE_SALDO_FERIAS.CANCELADO) return 'bg-red-100 text-red-700 border-red-200';
  if (s === STATUS_AJUSTE_SALDO_FERIAS.PENDENTE_PUBLICACAO || s === 'pendente') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function badgeTipo(tipo) {
  return normalizar(tipo) === TIPOS_AJUSTE_SALDO_FERIAS.DEBITO
    ? 'bg-red-50 text-red-700 border-red-200'
    : 'bg-blue-50 text-blue-700 border-blue-200';
}

export default function AjustesSaldoFerias() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { canAccessModule, canAccessAction, isLoading: loadingUser, isAccessResolved, user = {}, modoAcesso = null } = useCurrentUser();
  const effectiveEmail = getEffectiveEmail();

  const canVisualizar = canAccessModule('ferias') && (canAccessAction('visualizar_creditos_ferias') || canAccessAction('visualizar_ferias'));
  const canCriar = canAccessAction('criar_credito_extra_ferias') || canAccessAction('editar_credito_extra_ferias');
  const canCancelar = canAccessAction('cancelar_credito_extra_ferias') || canAccessAction('editar_credito_extra_ferias');

  const [filtros, setFiltros] = useState({ militar_id: ALL, periodo_id: ALL, tipo: ALL, status: ALL, origem: ALL });
  const [form, setForm] = useState(formInicial);
  const [motivoCancelamento, setMotivoCancelamento] = useState({});

  const enabled = isAccessResolved && !loadingUser && canVisualizar;
  const bundleKey = ['ajustes-saldo-ferias-bundle', modoAcesso || null, user?.email || null, effectiveEmail || null];
  const ajustesKey = ['ajustes-saldo-ferias-list', modoAcesso || null, user?.email || null, effectiveEmail || null];

  const { data: bundle = {}, isLoading: loadingBundle } = useQuery({ queryKey: bundleKey, queryFn: () => fetchScopedPeriodosAquisitivosBundle(), enabled });
  const { data: ajustes = [], isLoading: loadingAjustes } = useQuery({ queryKey: ajustesKey, queryFn: () => AjusteSaldoFerias.list('-created_date'), enabled });

  const militares = bundle?.militares || [];
  const periodos = bundle?.periodosAquisitivos || [];
  const ferias = bundle?.ferias || [];

  const militarById = useMemo(() => new Map(militares.map((m) => [String(m.id), m])), [militares]);
  const periodoById = useMemo(() => new Map(periodos.map((p) => [String(p.id), p])), [periodos]);

  const periodosDoMilitar = useMemo(() => {
    if (!form.militar_id) return periodos;
    return periodos.filter((p) => String(p?.militar_id || '') === String(form.militar_id));
  }, [form.militar_id, periodos]);

  const periodoSelecionado = periodoById.get(String(filtros.periodo_id !== ALL ? filtros.periodo_id : form.periodo_aquisitivo_id || '')) || null;
  const ajustesPeriodoSelecionado = useMemo(() => {
    if (!periodoSelecionado?.id) return [];
    return ajustes.filter((a) => String(a?.periodo_aquisitivo_id || '') === String(periodoSelecionado.id));
  }, [ajustes, periodoSelecionado]);

  const resumo = useMemo(() => {
    if (!periodoSelecionado) return null;
    return calcularSaldoLiquidoPeriodo({ periodo: periodoSelecionado, ajustes: ajustesPeriodoSelecionado, ferias });
  }, [ajustesPeriodoSelecionado, ferias, periodoSelecionado]);

  const ajustesFiltrados = useMemo(() => ajustes.filter((ajuste) => {
    if (filtros.militar_id !== ALL && String(ajuste?.militar_id || '') !== filtros.militar_id) return false;
    if (filtros.periodo_id !== ALL && String(ajuste?.periodo_aquisitivo_id || '') !== filtros.periodo_id) return false;
    if (filtros.tipo !== ALL && normalizar(ajuste?.tipo) !== filtros.tipo) return false;
    if (filtros.status !== ALL && normalizar(ajuste?.status) !== filtros.status) return false;
    if (filtros.origem !== ALL && normalizar(ajuste?.origem) !== filtros.origem) return false;
    return true;
  }), [ajustes, filtros]);

  const origens = useMemo(() => [...new Set(ajustes.map((a) => normalizar(a?.origem)).filter(Boolean))].sort(), [ajustes]);

  const salvarMutation = useMutation({
    mutationFn: async () => {
      const dias = Number(form.dias);
      const periodo = periodoById.get(String(form.periodo_aquisitivo_id));
      const motivo = String(form.motivo || '').trim();
      if (!form.militar_id) throw new Error('Militar é obrigatório.');
      if (!form.periodo_aquisitivo_id || !periodo) throw new Error('Período aquisitivo é obrigatório.');
      if (!Number.isFinite(dias) || dias <= 0) throw new Error('Dias deve ser maior que zero.');
      if (!motivo) throw new Error('Motivo é obrigatório.');
      if (form.tipo === TIPOS_AJUSTE_SALDO_FERIAS.DEBITO) {
        const saldoComDebito = calcularSaldoLiquidoPeriodo({
          periodo,
          ajustes: [...ajustesPeriodoSelecionado, { tipo: TIPOS_AJUSTE_SALDO_FERIAS.DEBITO, dias, status: STATUS_AJUSTE_SALDO_FERIAS.ATIVO }],
          ferias,
        }).saldo_liquido;
        if (saldoComDebito < 0) throw new Error('Débito não permitido: deixaria o saldo líquido negativo.');
      }
      return criarAjusteSaldoFerias({
        militar_id: form.militar_id,
        periodo_aquisitivo_id: form.periodo_aquisitivo_id,
        tipo: form.tipo,
        dias,
        motivo,
      });
    },
    onSuccess: () => {
      toast({ title: 'Ajuste criado', description: 'O ajuste manual foi registrado como ativo.' });
      setForm(formInicial);
      queryClient.invalidateQueries({ queryKey: ajustesKey });
      queryClient.invalidateQueries({ queryKey: bundleKey });
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey?.[0] || '').includes('periodos-aquisitivos') || String(query.queryKey?.[0] || '').includes('ferias') || String(query.queryKey?.[0] || '').includes('ajustes-saldo-ferias') || String(query.queryKey?.[0] || '').includes('diagnostico-saldo-ferias') || String(query.queryKey?.[0] || '').includes('pa-bundle') });
    },
    onError: (error) => toast({ title: 'Não foi possível criar o ajuste', description: error?.message, variant: 'destructive' }),
  });

  const cancelarMutation = useMutation({
    mutationFn: async (ajuste) => {
      const motivo = String(motivoCancelamento[ajuste.id] || '').trim();
      if (!STATUS_CANCELAVEIS.has(normalizar(ajuste?.status))) throw new Error('Somente ajustes ativos, rascunho ou pendentes podem ser cancelados.');
      if (!motivo) throw new Error('Informe o motivo do cancelamento.');
      return cancelarAjusteSaldoFerias({
        ajuste_id: ajuste.id,
        motivo_cancelamento: motivo,
      });
    },
    onSuccess: () => {
      toast({ title: 'Ajuste cancelado', description: 'O registro foi mantido e marcado como cancelado.' });
      setMotivoCancelamento({});
      queryClient.invalidateQueries({ queryKey: ajustesKey });
      queryClient.invalidateQueries({ queryKey: bundleKey });
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey?.[0] || '').includes('periodos-aquisitivos') || String(query.queryKey?.[0] || '').includes('ferias') || String(query.queryKey?.[0] || '').includes('ajustes-saldo-ferias') || String(query.queryKey?.[0] || '').includes('diagnostico-saldo-ferias') || String(query.queryKey?.[0] || '').includes('pa-bundle') });
    },
    onError: (error) => toast({ title: 'Não foi possível cancelar', description: error?.message, variant: 'destructive' }),
  });

  if (!loadingUser && isAccessResolved && !canVisualizar) return <AccessDenied modulo="Ajustes de Saldo de Férias" />;

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('Ferias'))} className="mt-1 hover:bg-slate-200"><ArrowLeft className="w-5 h-5" /></Button>
            <div>
              <h1 className="text-3xl font-bold text-[#1e3a5f]">Ajustes de Saldo de Férias</h1>
              <p className="text-slate-600 mt-1">Produção controlada: cria créditos e débitos manuais sem substituir o cálculo oficial.</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => { queryClient.invalidateQueries({ queryKey: bundleKey }); queryClient.invalidateQueries({ queryKey: ajustesKey }); }}>
            <RefreshCw className="w-4 h-4 mr-2" />Atualizar
          </Button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <div className="xl:col-span-3 space-y-6">
            <Card>
              <CardHeader><CardTitle>Filtros</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <Select value={filtros.militar_id} onValueChange={(v) => setFiltros((p) => ({ ...p, militar_id: v }))}><SelectTrigger><SelectValue placeholder="Militar" /></SelectTrigger><SelectContent><SelectItem value={ALL}>Todos</SelectItem>{militares.map((m) => <SelectItem key={m.id} value={String(m.id)}>{formatarNomeMilitar(m)}</SelectItem>)}</SelectContent></Select>
                <Select value={filtros.periodo_id} onValueChange={(v) => setFiltros((p) => ({ ...p, periodo_id: v }))}><SelectTrigger><SelectValue placeholder="Período" /></SelectTrigger><SelectContent><SelectItem value={ALL}>Todos</SelectItem>{periodos.map((p) => <SelectItem key={p.id} value={String(p.id)}>{obterPeriodoRef(p)} — {texto(militarById.get(String(p.militar_id))?.nome_guerra, 'militar')}</SelectItem>)}</SelectContent></Select>
                <Select value={filtros.tipo} onValueChange={(v) => setFiltros((p) => ({ ...p, tipo: v }))}><SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger><SelectContent><SelectItem value={ALL}>Todos</SelectItem><SelectItem value="credito">Crédito</SelectItem><SelectItem value="debito">Débito</SelectItem></SelectContent></Select>
                <Select value={filtros.status} onValueChange={(v) => setFiltros((p) => ({ ...p, status: v }))}><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value={ALL}>Todos</SelectItem><SelectItem value="ativo">Ativo</SelectItem><SelectItem value="rascunho">Rascunho</SelectItem><SelectItem value="pendente_publicacao">Pendente</SelectItem><SelectItem value="cancelado">Cancelado</SelectItem><SelectItem value="revertido">Revertido</SelectItem></SelectContent></Select>
                <Select value={filtros.origem} onValueChange={(v) => setFiltros((p) => ({ ...p, origem: v }))}><SelectTrigger><SelectValue placeholder="Origem" /></SelectTrigger><SelectContent><SelectItem value={ALL}>Todas</SelectItem>{origens.map((origem) => <SelectItem key={origem} value={origem}>{origem}</SelectItem>)}</SelectContent></Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Ajustes cadastrados</CardTitle></CardHeader>
              <CardContent>
                {(loadingBundle || loadingAjustes) ? <p className="text-slate-500">Carregando...</p> : ajustesFiltrados.length === 0 ? <p className="text-slate-500">Nenhum ajuste encontrado.</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="text-left text-slate-500 border-b"><th className="py-2 pr-3">Militar</th><th className="py-2 pr-3">Período</th><th className="py-2 pr-3">Tipo</th><th className="py-2 pr-3">Dias</th><th className="py-2 pr-3">Motivo</th><th className="py-2 pr-3">Origem</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Publicação</th><th className="py-2 pr-3">Criado em</th><th className="py-2">Cancelar</th></tr></thead>
                      <tbody>{ajustesFiltrados.map((ajuste) => (
                        <tr key={ajuste.id} className="border-b last:border-b-0 align-top"><td className="py-3 pr-3 font-medium">{obterMilitarNomeAjuste(ajuste, militarById)}</td><td className="py-3 pr-3">{obterPeriodoRefAjuste(ajuste, periodoById)}</td><td className="py-3 pr-3"><Badge className={badgeTipo(ajuste.tipo)}>{normalizar(ajuste.tipo) === 'debito' ? 'Débito' : 'Crédito'}</Badge></td><td className="py-3 pr-3">{ajuste.dias}</td><td className="py-3 pr-3 min-w-48">{texto(ajuste.motivo)}</td><td className="py-3 pr-3">{texto(ajuste.origem)}</td><td className="py-3 pr-3"><Badge className={badgeStatus(ajuste.status)}>{texto(ajuste.status)}</Badge></td><td className="py-3 pr-3">{texto(ajuste.publicacao_numero || ajuste.publicacao_id || ajuste.registro_livro_id)}</td><td className="py-3 pr-3">{formatarDataHora(ajuste.created_date || ajuste.created_at || ajuste.criado_em)}</td><td className="py-3 min-w-56">{STATUS_CANCELAVEIS.has(normalizar(ajuste.status)) && canCancelar ? <div className="space-y-2"><Input placeholder="Motivo do cancelamento" value={motivoCancelamento[ajuste.id] || ''} onChange={(e) => setMotivoCancelamento((p) => ({ ...p, [ajuste.id]: e.target.value }))} /><Button size="sm" variant="outline" className="text-red-700" onClick={() => cancelarMutation.mutate(ajuste)} disabled={cancelarMutation.isPending}><Ban className="w-4 h-4 mr-1" />Cancelar</Button></div> : <span className="text-slate-400">—</span>}</td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Novo ajuste</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div><Label>Tipo</Label><Select value={form.tipo} onValueChange={(v) => setForm((p) => ({ ...p, tipo: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="credito"><PlusCircle className="w-4 h-4 inline mr-1" />Crédito</SelectItem><SelectItem value="debito"><MinusCircle className="w-4 h-4 inline mr-1" />Débito</SelectItem></SelectContent></Select></div>
                <div><Label>Militar</Label><Select value={form.militar_id || undefined} onValueChange={(v) => setForm((p) => ({ ...p, militar_id: v, periodo_aquisitivo_id: '' }))}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{militares.map((m) => <SelectItem key={m.id} value={String(m.id)}>{formatarNomeMilitar(m)}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>Período aquisitivo</Label><Select value={form.periodo_aquisitivo_id || undefined} onValueChange={(v) => setForm((p) => ({ ...p, periodo_aquisitivo_id: v }))}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{periodosDoMilitar.map((p) => <SelectItem key={p.id} value={String(p.id)}>{obterPeriodoRef(p)}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>Dias</Label><Input type="number" min="1" step="1" value={form.dias} onChange={(e) => setForm((p) => ({ ...p, dias: e.target.value }))} /></div>
                <div><Label>Motivo obrigatório</Label><Textarea value={form.motivo} onChange={(e) => setForm((p) => ({ ...p, motivo: e.target.value }))} placeholder="Descreva o motivo do ajuste manual" /></div>
                <Button className="w-full bg-[#1e3a5f] hover:bg-[#2d4a6f]" onClick={() => salvarMutation.mutate()} disabled={!canCriar || salvarMutation.isPending}>{form.tipo === 'debito' ? 'Criar Débito' : 'Criar Crédito'}</Button>
                {!canCriar && <p className="text-xs text-amber-700">Seu perfil pode visualizar, mas não criar ajustes.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="w-5 h-5" />Resumo do período</CardTitle></CardHeader>
              <CardContent>{resumo ? <div className="space-y-3 text-sm"><p className="font-semibold text-slate-800">{obterPeriodoRef(periodoSelecionado)}</p><div className="flex justify-between"><span>Base</span><strong>{resumo.dias_base}</strong></div><div className="flex justify-between text-blue-700"><span>Créditos ativos</span><strong>{resumo.creditos_ativos}</strong></div><div className="flex justify-between text-red-700"><span>Débitos ativos</span><strong>{resumo.debitos_ativos}</strong></div><div className="flex justify-between"><span>Férias previstas/gozadas</span><strong>{resumo.dias_gozados_previstos}</strong></div><div className="flex justify-between border-t pt-3 text-lg"><span>Saldo líquido</span><strong>{resumo.saldo_liquido}</strong></div></div> : <p className="text-sm text-slate-500">Selecione um período no filtro ou no formulário para ver o resumo.</p>}</CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
