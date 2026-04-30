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
import { ArrowLeft, CalendarDays, Check, CheckCircle, ChevronDown, ChevronRight, ChevronsUpDown, Link2, PlusCircle, Settings2, Trash2, Unlink2, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { formatNomeMilitarTexto } from '@/components/militar/NomeMilitar';
import {
  TIPOS_CREDITO_EXTRA_FERIAS,
  STATUS_CREDITO_EXTRA_FERIAS,
  formatarTipoCreditoExtra,
  filtrarCreditosExtraFerias,
  listarCreditosExtraFerias,
  salvarCreditoExtraFerias,
} from '@/services/creditoExtraFeriasService';
import { atualizarEscopado, excluirEscopado } from '@/services/cudEscopadoClient';

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
  DISPONIVEL: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  VINCULADO: 'bg-blue-100 text-blue-700 border border-blue-200',
  USADO: 'bg-slate-100 text-slate-700 border border-slate-200',
  CANCELADO: 'bg-red-100 text-red-700 border border-red-200',
};
const STATUS_GOZO_BLOQUEADO = new Set(['Gozada', 'Concluída', 'Concluida', 'Finalizada']);

function formatDate(v) {
  if (!v) return '—';
  try {
    return new Date(`${v}T00:00:00`).toLocaleDateString('pt-BR');
  } catch {
    return v;
  }
}

function formatarTipoGozo(gozo) {
  const fracao = String(gozo?.fracionamento || '').trim().toLowerCase();
  if (fracao.includes('1')) return '1ª fração';
  if (fracao.includes('2')) return '2ª fração';
  if (fracao.includes('3')) return '3ª fração';
  return 'Integral';
}

function isCreditoBloqueadoPorUso(credito, gozoById) {
  if (!credito) return false;
  if (credito.status === STATUS_CREDITO_EXTRA_FERIAS.USADO) return true;

  if (!credito.gozo_ferias_id) return false;
  const gozo = gozoById.get(credito.gozo_ferias_id);
  if (!gozo) return false;

  return STATUS_GOZO_BLOQUEADO.has(gozo.status);
}

function formatarNomeMilitarPesquisa(militar) {
  const nomeGuerra = String(militar?.nome_guerra || militar?.nome_completo || '').trim();
  const nomeCompleto = String(militar?.nome_completo || militar?.nome_guerra || '').trim();
  const postoNome = formatNomeMilitarTexto(militar?.posto_graduacao, '', nomeGuerra).trim();
  const prefixo = postoNome || nomeGuerra;
  return [prefixo, nomeCompleto].filter(Boolean).join(' - ').trim() || 'Militar não identificado';
}

export default function CreditosExtraordinariosFerias() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { canAccessModule, isLoading: loadingUser, isAccessResolved } = useCurrentUser();

  const [filtros, setFiltros] = useState({
    militar_id: 'all',
    tipo_credito: 'all',
    status: 'all',
    unidade: '',
    data_inicio: '',
    data_fim: '',
  });
  const [form, setForm] = useState(initialForm);
  const [modalEdicaoAberto, setModalEdicaoAberto] = useState(false);
  const [expandedMilitares, setExpandedMilitares] = useState({});

  const [creditoVinculoModal, setCreditoVinculoModal] = useState(null);
  const [gozoSelecionadoId, setGozoSelecionadoId] = useState('');
  const [militarPopoverOpen, setMilitarPopoverOpen] = useState(false);
  const [buscaMilitar, setBuscaMilitar] = useState('');

  const { data: militares = [] } = useQuery({
    queryKey: ['creditos-extra-ferias-militares'],
    queryFn: () => base44.entities.Militar.list('nome_completo'),
    enabled: isAccessResolved && canAccessModule('ferias'),
  });

  const militarById = useMemo(
    () => new Map(militares.map((militar) => [militar.id, militar])),
    [militares],
  );
  const militaresFiltradosBusca = useMemo(() => {
    const termo = String(buscaMilitar || '').trim().toLowerCase();
    if (!termo) return militares;

    return militares.filter((militar) => {
      const alvo = [
        formatarNomeMilitarPesquisa(militar),
        militar?.matricula,
        militar?.matricula_atual,
        militar?.rg,
        militar?.cpf,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return alvo.includes(termo);
    });
  }, [buscaMilitar, militares]);

  const { data: gozosFerias = [] } = useQuery({
    queryKey: ['creditos-extra-ferias-gozos'],
    queryFn: () => base44.entities.Ferias.list('-data_inicio'),
    enabled: isAccessResolved && canAccessModule('ferias'),
  });

  const gozoById = useMemo(
    () => new Map(gozosFerias.map((gozo) => [gozo.id, gozo])),
    [gozosFerias],
  );

  const { data: creditos = [], isLoading } = useQuery({
    queryKey: ['creditos-extra-ferias'],
    queryFn: () => listarCreditosExtraFerias('-data_referencia'),
    enabled: isAccessResolved && canAccessModule('ferias'),
  });

  const creditosFiltrados = useMemo(
    () => filtrarCreditosExtraFerias(creditos, {
      ...filtros,
      militar_id: filtros.militar_id === 'all' ? '' : filtros.militar_id,
      tipo_credito: filtros.tipo_credito === 'all' ? '' : filtros.tipo_credito,
      status: filtros.status === 'all' ? '' : filtros.status,
    }, militarById),
    [creditos, filtros, militarById],
  );

  const gozosDoCreditoSelecionado = useMemo(() => {
    if (!creditoVinculoModal?.militar_id) return [];

    return (gozosFerias || [])
      .filter((gozo) => gozo.militar_id === creditoVinculoModal.militar_id)
      .sort((a, b) => String(b.data_inicio || '').localeCompare(String(a.data_inicio || '')));
  }, [creditoVinculoModal, gozosFerias]);

  const stats = useMemo(() => ({
    total: creditos.length,
    disponiveis: creditos.filter((credito) => credito.status === STATUS_CREDITO_EXTRA_FERIAS.DISPONIVEL).length,
    vinculados: creditos.filter((credito) => credito.status === STATUS_CREDITO_EXTRA_FERIAS.VINCULADO).length,
    usados: creditos.filter((credito) => credito.status === STATUS_CREDITO_EXTRA_FERIAS.USADO).length,
  }), [creditos]);

  const creditosAgrupadosPorMilitar = useMemo(() => {
    const grupos = new Map();
    (creditosFiltrados || []).forEach((credito) => {
      const militarId = credito.militar_id || 'sem-militar';
      if (!grupos.has(militarId)) grupos.set(militarId, []);
      grupos.get(militarId).push(credito);
    });

    return Array.from(grupos.entries())
      .map(([militarId, itens]) => ({
        militarId,
        militar: militarById.get(militarId),
        itens: itens.sort((a, b) => String(b.data_referencia || '').localeCompare(String(a.data_referencia || ''))),
      }))
      .sort((a, b) => {
        const nomeA = a.itens[0]?.militar_nome || a.militar?.nome_completo || '';
        const nomeB = b.itens[0]?.militar_nome || b.militar?.nome_completo || '';
        return nomeA.localeCompare(nomeB, 'pt-BR');
      });
  }, [creditosFiltrados, militarById]);

  const salvarMutation = useMutation({
    mutationFn: async () => {
      const militar = militarById.get(form.militar_id);
      if (!militar) throw new Error('Selecione um militar para salvar o crédito extraordinário.');
      if (form.id) {
        const atual = creditos.find((item) => item.id === form.id);
        if (isCreditoBloqueadoPorUso(atual, gozoById)) {
          throw new Error('Este crédito já foi efetivamente utilizado e não pode mais ser alterado.');
        }
      }

      return salvarCreditoExtraFerias({
        form,
        militar: {
          id: militar.id,
          nome_completo: militar.nome_completo,
          posto_grad: militar.posto_graduacao,
          matricula: militar.matricula,
        },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['creditos-extra-ferias'] });
      toast({
        title: form.id ? 'Crédito atualizado com sucesso' : 'Crédito cadastrado com sucesso',
        description: 'Listagem atualizada automaticamente.',
      });
      setForm(initialForm);
      setModalEdicaoAberto(false);
    },
    onError: (error) => {
      toast({ title: 'Falha ao salvar crédito extraordinário', description: error?.message || 'Erro inesperado.' });
    },
  });

  const cancelarMutation = useMutation({
    mutationFn: async (credito) => {
      if (isCreditoBloqueadoPorUso(credito, gozoById)) {
        throw new Error('Crédito já utilizado não pode ser cancelado.');
      }
      return atualizarEscopado('CreditoExtraFerias', credito.id, {
        status: STATUS_CREDITO_EXTRA_FERIAS.CANCELADO,
        gozo_ferias_id: '',
      });
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['creditos-extra-ferias'] });
      queryClient.invalidateQueries({ queryKey: ['ferias-creditos-extra'] });
      queryClient.invalidateQueries({ queryKey: ['ferias'] });
      toast({ title: 'Crédito cancelado' });
    },
    onError: (error) => {
      toast({ title: 'Falha ao cancelar crédito', description: error?.message || 'Erro inesperado.' });
    },
  });

  const excluirMutation = useMutation({
    mutationFn: async (credito) => {
      if (isCreditoBloqueadoPorUso(credito, gozoById)) {
        throw new Error('Crédito já utilizado não pode ser excluído.');
      }

      return excluirEscopado('CreditoExtraFerias', credito.id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['creditos-extra-ferias'] });
      await queryClient.invalidateQueries({ queryKey: ['ferias-creditos-extra'] });
      await queryClient.invalidateQueries({ queryKey: ['ferias'] });
      toast({ title: 'Crédito excluído' });
    },
    onError: (error) => {
      toast({ title: 'Falha ao excluir crédito', description: error?.message || 'Erro inesperado.' });
    },
  });

  const vincularGozoMutation = useMutation({
    mutationFn: async ({ credito, gozoFeriasId }) => {
      if (isCreditoBloqueadoPorUso(credito, gozoById)) {
        throw new Error('Crédito já utilizado não pode ser alterado.');
      }
      if (!gozoFeriasId) {
        throw new Error('Selecione um gozo de férias para vincular.');
      }

      const gozo = gozoById.get(gozoFeriasId);
      if (!gozo) throw new Error('Gozo selecionado não encontrado. Atualize a página e tente novamente.');
      if (gozo.militar_id !== credito.militar_id) throw new Error('O gozo deve pertencer ao mesmo militar do crédito.');

      return atualizarEscopado('CreditoExtraFerias', credito.id, {
        gozo_ferias_id: gozoFeriasId,
        status: STATUS_CREDITO_EXTRA_FERIAS.VINCULADO,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['creditos-extra-ferias'] });
      await queryClient.invalidateQueries({ queryKey: ['ferias-creditos-extra'] });
      await queryClient.invalidateQueries({ queryKey: ['ferias'] });
      toast({ title: 'Crédito vinculado ao gozo', description: 'Status atualizado para VINCULADO.' });
      setCreditoVinculoModal(null);
      setGozoSelecionadoId('');
    },
    onError: (error) => {
      toast({ title: 'Falha ao vincular crédito', description: error?.message || 'Erro inesperado.' });
    },
  });

  const removerVinculoMutation = useMutation({
    mutationFn: async (credito) => {
      if (isCreditoBloqueadoPorUso(credito, gozoById)) {
        throw new Error('Crédito utilizado não pode ter vínculo removido por esta tela.');
      }

      return atualizarEscopado('CreditoExtraFerias', credito.id, {
        gozo_ferias_id: '',
        status: STATUS_CREDITO_EXTRA_FERIAS.DISPONIVEL,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['creditos-extra-ferias'] });
      await queryClient.invalidateQueries({ queryKey: ['ferias-creditos-extra'] });
      await queryClient.invalidateQueries({ queryKey: ['ferias'] });
      toast({ title: 'Vínculo removido', description: 'Crédito retornou para DISPONIVEL.' });
    },
    onError: (error) => {
      toast({ title: 'Falha ao remover vínculo', description: error?.message || 'Erro inesperado.' });
    },
  });

  const toggleMilitar = (militarId) => {
    setExpandedMilitares((prev) => ({ ...prev, [militarId]: !prev[militarId] }));
  };

  if (!loadingUser && isAccessResolved && !canAccessModule('ferias')) return <AccessDenied modulo="Férias" />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('Ferias'))} className="hover:bg-slate-200">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-[#1e3a5f]">Créditos Extraordinários</h1>
              <p className="text-slate-500">Gestão completa de créditos extras vinculáveis ao gozo de férias</p>
            </div>
          </div>

          <Button variant="outline" onClick={() => navigate(createPageUrl('Ferias'))}>
            Voltar para Férias
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#1e3a5f]/10 flex items-center justify-center">
                <CalendarDays className="w-5 h-5 text-[#1e3a5f]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1e3a5f]">{stats.total}</p>
                <p className="text-xs text-slate-500">Total</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600">{stats.disponiveis}</p>
                <p className="text-xs text-slate-500">Disponíveis</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Link2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">{stats.vinculados}</p>
                <p className="text-xs text-slate-500">Vinculados</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                <Settings2 className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-700">{stats.usados}</p>
                <p className="text-xs text-slate-500">Usados</p>
              </div>
            </div>
          </div>
        </div>

        <Card className="rounded-xl border border-slate-100 shadow-sm">
          <CardHeader>
            <CardTitle className="text-[#1e3a5f]">Filtros</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Militar</Label>
              <Select value={filtros.militar_id} onValueChange={(v) => setFiltros((p) => ({ ...p, militar_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {militares.map((militar) => <SelectItem key={militar.id} value={militar.id}>{militar.nome_completo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Tipo de crédito</Label>
              <Select value={filtros.tipo_credito} onValueChange={(v) => setFiltros((p) => ({ ...p, tipo_credito: v }))}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.values(TIPOS_CREDITO_EXTRA_FERIAS).map((tipo) => <SelectItem key={tipo} value={tipo}>{formatarTipoCreditoExtra(tipo)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={filtros.status} onValueChange={(v) => setFiltros((p) => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.values(STATUS_CREDITO_EXTRA_FERIAS).map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Unidade</Label>
              <Input value={filtros.unidade} onChange={(e) => setFiltros((p) => ({ ...p, unidade: e.target.value }))} placeholder="Ex.: 1º BPM" />
            </div>
            <div className="space-y-1.5">
              <Label>Data inicial</Label>
              <Input type="date" value={filtros.data_inicio} onChange={(e) => setFiltros((p) => ({ ...p, data_inicio: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Data final</Label>
              <Input type="date" value={filtros.data_fim} onChange={(e) => setFiltros((p) => ({ ...p, data_fim: e.target.value }))} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button
            className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
            onClick={() => {
              setForm(initialForm);
              setModalEdicaoAberto(true);
            }}
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            Novo crédito extraordinário
          </Button>
        </div>

        <Card className="rounded-xl border border-slate-100 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#1e3a5f]"><Users className="w-4 h-4" /> Créditos cadastrados ({creditosFiltrados.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <p className="text-sm text-slate-500">Carregando créditos...</p>
            ) : creditosFiltrados.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum crédito encontrado para os filtros atuais.</p>
            ) : (
              creditosAgrupadosPorMilitar.map((grupo) => {
                const isExpanded = expandedMilitares[grupo.militarId] ?? false;
                const resumo = grupo.itens.reduce((acc, credito) => {
                  if (credito.status === STATUS_CREDITO_EXTRA_FERIAS.DISPONIVEL) acc.disponiveis += 1;
                  if (credito.status === STATUS_CREDITO_EXTRA_FERIAS.VINCULADO) acc.vinculados += 1;
                  if (credito.status === STATUS_CREDITO_EXTRA_FERIAS.USADO) acc.usados += 1;
                  return acc;
                }, { disponiveis: 0, vinculados: 0, usados: 0 });

                return (
                <div key={grupo.militarId} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                  <button type="button" onClick={() => toggleMilitar(grupo.militarId)} className="w-full px-4 py-4 hover:bg-slate-50 transition-colors">
                    <div className="grid lg:grid-cols-[minmax(220px,1fr)_minmax(220px,1.3fr)_auto] gap-4 items-center text-left">
                      <div className="flex items-center gap-3 text-left">
                        {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-500 shrink-0" /> : <ChevronRight className="w-5 h-5 text-slate-500 shrink-0" />}
                        <div className="w-10 h-10 rounded-lg bg-[#1e3a5f]/10 flex items-center justify-center shrink-0">
                          <Users className="w-5 h-5 text-[#1e3a5f]" />
                        </div>
                        <div>
                          <p className="text-sm md:text-base font-semibold text-slate-900 leading-tight">
                            {grupo.itens[0]?.militar_posto ? `${grupo.itens[0].militar_posto} ` : ''}
                            {grupo.itens[0]?.militar_nome || grupo.militar?.nome_completo || 'Militar não identificado'}
                          </p>
                          <p className="text-xs text-slate-500">Mat: {grupo.militar?.matricula || grupo.itens[0]?.militar_matricula || '—'}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm text-slate-600">
                        <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-700 font-medium">{grupo.itens.length} crédito(s)</span>
                        <span className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700">Disponíveis: {resumo.disponiveis}</span>
                        <span className="px-2 py-1 rounded-md bg-blue-50 text-blue-700">Vinculados: {resumo.vinculados}</span>
                        <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-700">Usados: {resumo.usados}</span>
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-100 p-4 bg-slate-50/50">
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    {grupo.itens.map((credito) => {
                      const gozoVinculado = credito.gozo_ferias_id ? gozoById.get(credito.gozo_ferias_id) : null;
                      const podeRemoverVinculo = Boolean(credito.gozo_ferias_id) && credito.status !== STATUS_CREDITO_EXTRA_FERIAS.USADO;
                      const bloqueadoPorUso = isCreditoBloqueadoPorUso(credito, gozoById);

                      return (
                        <div key={credito.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-800">{formatarTipoCreditoExtra(credito.tipo_credito)} · {Number(credito.quantidade_dias || 0)} dia(s)</p>
                              <p className="text-xs text-slate-500 mt-0.5">Ref.: {formatDate(credito.data_referencia)}</p>
                            </div>
                            <Badge className={STATUS_COLORS[credito.status] || 'bg-slate-100 text-slate-700 border border-slate-200'}>{credito.status || '—'}</Badge>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3 text-xs text-slate-600">
                            <p>Boletim/Documento: <strong>{credito.numero_boletim || credito.origem_documental || '—'}</strong></p>
                            <p>Vínculo com gozo (ID): <strong>{credito.gozo_ferias_id || 'Não vinculado'}</strong></p>
                            <p>Gozo vinculado: <strong>{gozoVinculado ? `${gozoVinculado.periodo_aquisitivo_ref || 'Sem período'} · início ${formatDate(gozoVinculado.data_inicio)}` : '—'}</strong></p>
                            <p>Unidade: <strong>{militarById.get(credito.militar_id)?.unidade || '—'}</strong></p>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={bloqueadoPorUso}
                              onClick={() => {
                                setForm({ ...initialForm, ...credito, gozo_ferias_id: credito.gozo_ferias_id || '' });
                                setModalEdicaoAberto(true);
                              }}
                            >
                              Editar
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              disabled={credito.status === STATUS_CREDITO_EXTRA_FERIAS.CANCELADO || bloqueadoPorUso}
                              onClick={() => {
                                setCreditoVinculoModal(credito);
                                setGozoSelecionadoId(credito.gozo_ferias_id || '');
                              }}
                            >
                              <Link2 className="w-4 h-4 mr-2" />
                              Vincular gozo
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!podeRemoverVinculo || removerVinculoMutation.isPending || bloqueadoPorUso}
                              onClick={() => removerVinculoMutation.mutate(credito)}
                            >
                              <Unlink2 className="w-4 h-4 mr-2" />
                              Remover vínculo
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              disabled={credito.status === STATUS_CREDITO_EXTRA_FERIAS.CANCELADO || bloqueadoPorUso}
                              onClick={() => cancelarMutation.mutate(credito)}
                            >
                              Cancelar
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              disabled={excluirMutation.isPending || bloqueadoPorUso}
                              onClick={() => {
                                const confirmado = window.confirm(
                                  'Deseja excluir permanentemente este crédito extraordinário? Esta ação não pode ser desfeita.',
                                );
                                if (!confirmado) return;
                                excluirMutation.mutate(credito);
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Excluir
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                      </div>
                    </div>
                  )}
                </div>
              );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={modalEdicaoAberto} onOpenChange={(open) => {
        setModalEdicaoAberto(open);
        if (!open) setForm(initialForm);
      }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Gerenciar crédito extraordinário' : 'Novo crédito extraordinário'}</DialogTitle>
            <DialogDescription>
              {form.id ? 'Atualize dados cadastrais e status do crédito com segurança.' : 'Cadastre o crédito extraordinário e vincule ao militar correto.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Militar</Label>
                <Popover open={militarPopoverOpen} onOpenChange={setMilitarPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                      <span className="truncate text-left">
                        {form.militar_id ? formatarNomeMilitarPesquisa(militarById.get(form.militar_id)) : 'Selecione'}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[520px] max-w-[calc(100vw-2rem)] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Buscar por posto/graduação, nome de guerra, nome completo, matrícula, CPF ou RG..."
                        value={buscaMilitar}
                        onValueChange={setBuscaMilitar}
                      />
                      <CommandEmpty>Nenhum militar encontrado.</CommandEmpty>
                      <CommandGroup className="max-h-72 overflow-auto">
                        <CommandItem
                          value="Selecione"
                          onSelect={() => {
                            setForm((p) => ({ ...p, militar_id: '' }));
                            setMilitarPopoverOpen(false);
                            setBuscaMilitar('');
                          }}
                        >
                          <Check className={cn('mr-2 h-4 w-4', !form.militar_id ? 'opacity-100' : 'opacity-0')} />
                          Selecione
                        </CommandItem>
                        {militaresFiltradosBusca.map((militar) => (
                          <CommandItem
                            key={militar.id}
                            value={formatarNomeMilitarPesquisa(militar)}
                            onSelect={() => {
                              setForm((p) => ({ ...p, militar_id: militar.id }));
                              setMilitarPopoverOpen(false);
                              setBuscaMilitar('');
                            }}
                          >
                            <Check className={cn('mr-2 h-4 w-4', form.militar_id === militar.id ? 'opacity-100' : 'opacity-0')} />
                            <span className="whitespace-normal break-words leading-tight py-0.5">{formatarNomeMilitarPesquisa(militar)}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={form.tipo_credito} onValueChange={(v) => setForm((p) => ({ ...p, tipo_credito: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.values(TIPOS_CREDITO_EXTRA_FERIAS).map((tipo) => <SelectItem key={tipo} value={tipo}>{formatarTipoCreditoExtra(tipo)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.values(STATUS_CREDITO_EXTRA_FERIAS).map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Quantidade de dias</Label>
                <Input type="number" min={1} value={form.quantidade_dias} onChange={(e) => setForm((p) => ({ ...p, quantidade_dias: Number(e.target.value || 0) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Data referência</Label>
                <Input type="date" value={form.data_referencia} onChange={(e) => setForm((p) => ({ ...p, data_referencia: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Data boletim</Label>
                <Input type="date" value={form.data_boletim} onChange={(e) => setForm((p) => ({ ...p, data_boletim: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Origem documental</Label>
                <Input value={form.origem_documental} onChange={(e) => setForm((p) => ({ ...p, origem_documental: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Número boletim</Label>
                <Input value={form.numero_boletim} onChange={(e) => setForm((p) => ({ ...p, numero_boletim: e.target.value }))} />
              </div>
              <div className="space-y-1.5 md:col-span-3">
                <Label>Observações</Label>
                <Input value={form.observacoes} onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))} />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setForm(initialForm); setModalEdicaoAberto(false); }}>
                Cancelar
              </Button>
              <Button className="bg-[#1e3a5f] hover:bg-[#2d4a6f]" disabled={salvarMutation.isPending || !form.militar_id || Number(form.quantidade_dias || 0) <= 0} onClick={() => salvarMutation.mutate()}>
                {form.id ? 'Salvar alterações' : 'Cadastrar crédito'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(creditoVinculoModal)} onOpenChange={(open) => {
        if (!open) {
          setCreditoVinculoModal(null);
          setGozoSelecionadoId('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular crédito a gozo</DialogTitle>
            <DialogDescription>
              Selecione um gozo do mesmo militar para reservar este crédito. O consumo efetivo permanece no fluxo de Saída Férias.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="font-medium text-slate-700">
                {creditoVinculoModal?.militar_posto ? `${creditoVinculoModal.militar_posto} ` : ''}
                {creditoVinculoModal?.militar_nome || militarById.get(creditoVinculoModal?.militar_id)?.nome_completo || 'Militar não identificado'}
              </p>
              <p className="text-xs text-slate-600 mt-1">
                {formatarTipoCreditoExtra(creditoVinculoModal?.tipo_credito)} · {Number(creditoVinculoModal?.quantidade_dias || 0)} dia(s)
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Gozo de férias</Label>
              <Select value={gozoSelecionadoId || 'none'} onValueChange={(v) => setGozoSelecionadoId(v === 'none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o gozo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione</SelectItem>
                  {gozosDoCreditoSelecionado.map((gozo) => (
                    <SelectItem key={gozo.id} value={gozo.id}>
                      {formatarTipoGozo(gozo)} · {gozo.periodo_aquisitivo_ref || 'Sem período'} · início {formatDate(gozo.data_inicio)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {gozosDoCreditoSelecionado.length === 0 && (
                <p className="text-xs text-amber-700">Não há gozos cadastrados para este militar.</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setCreditoVinculoModal(null);
              setGozoSelecionadoId('');
            }}>
              Cancelar
            </Button>
            <Button
              className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
              disabled={!gozoSelecionadoId || vincularGozoMutation.isPending}
              onClick={() => vincularGozoMutation.mutate({ credito: creditoVinculoModal, gozoFeriasId: gozoSelecionadoId })}
            >
              Confirmar vínculo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}