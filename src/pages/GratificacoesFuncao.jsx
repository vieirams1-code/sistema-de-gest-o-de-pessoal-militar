import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Award, BadgeCheck, BriefcaseBusiness, Clock3, FileText, Loader2, Search, ShieldAlert, Users } from 'lucide-react';

import AccessDenied from '@/components/auth/AccessDenied';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  GRATIFICACAO_STATUS,
  GRATIFICACAO_STATUS_LABELS,
  GRATIFICACAO_TABS,
  GRATIFICACAO_TAB_LABELS,
  aplicarFiltrosGratificacoesFuncao,
  fetchPainelGratificacoesFuncao,
  filtrarGratificacoesPorAba,
  getMatriculaGratificacao,
  getNomeMilitarGratificacao,
  getTipoGratificacaoLabel,
  listarOpcoesGratificacao,
} from '@/services/gratificacoesFuncaoService';

const TODOS = 'todos';

const STATUS_BADGE = {
  [GRATIFICACAO_STATUS.RASCUNHO]: 'border-slate-200 bg-slate-50 text-slate-700',
  [GRATIFICACAO_STATUS.SOLICITADO_DP]: 'border-blue-200 bg-blue-50 text-blue-700',
  [GRATIFICACAO_STATUS.AGUARDANDO_PUBLICACAO_NOMEACAO]: 'border-amber-200 bg-amber-50 text-amber-700',
  [GRATIFICACAO_STATUS.NOMEADO_ATIVO]: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  [GRATIFICACAO_STATUS.DISPENSA_SOLICITADA]: 'border-orange-200 bg-orange-50 text-orange-700',
  [GRATIFICACAO_STATUS.AGUARDANDO_PUBLICACAO_DISPENSA]: 'border-purple-200 bg-purple-50 text-purple-700',
  [GRATIFICACAO_STATUS.DISPENSADO]: 'border-slate-200 bg-white text-slate-600',
  [GRATIFICACAO_STATUS.CANCELADO]: 'border-red-200 bg-red-50 text-red-700',
};

const CARD_CONFIG = [
  { key: 'cotasAutorizadas', title: 'Cotas autorizadas', icon: BriefcaseBusiness, tone: 'bg-blue-500' },
  { key: 'cotasOcupadas', title: 'Cotas ocupadas', icon: Users, tone: 'bg-emerald-500' },
  { key: 'cotasDisponiveis', title: 'Cotas disponíveis', icon: BadgeCheck, tone: 'bg-cyan-500' },
  { key: 'solicitacoesPendentes', title: 'Solicitações pendentes', icon: Clock3, tone: 'bg-amber-500' },
  { key: 'nomeacoesAtivas', title: 'Nomeações ativas', icon: Award, tone: 'bg-green-600' },
  { key: 'dispensasPendentes', title: 'Dispensas pendentes', icon: FileText, tone: 'bg-purple-500' },
];

const TAB_KEYS = [
  GRATIFICACAO_TABS.ATIVOS,
  GRATIFICACAO_TABS.AGUARDANDO_PUBLICACAO,
  GRATIFICACAO_TABS.DISPENSA_EM_ANDAMENTO,
  GRATIFICACAO_TABS.HISTORICO,
  GRATIFICACAO_TABS.COTAS,
  GRATIFICACAO_TABS.TIPOS,
];

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR');
}

function CounterCard({ title, value, icon: Icon, tone }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`absolute inset-y-0 left-0 w-1.5 ${tone}`} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold leading-none text-slate-950">{value ?? 0}</p>
        </div>
        <div className="rounded-xl bg-slate-100 p-2 text-slate-600">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <Badge variant="outline" className={`${STATUS_BADGE[status] || STATUS_BADGE[GRATIFICACAO_STATUS.RASCUNHO]} rounded-full px-2.5 py-1`}>
      {GRATIFICACAO_STATUS_LABELS[status] || status || '—'}
    </Badge>
  );
}

function EmptyState({ message = 'Nenhum registro encontrado para os filtros atuais.' }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <Award className="h-10 w-10 text-slate-300" />
      <h3 className="mt-3 text-base font-semibold text-slate-800">Sem dados para exibir</h3>
      <p className="mt-1 max-w-md text-sm text-slate-500">{message}</p>
    </div>
  );
}

function GratificacoesTable({ gratificacoes, tipos }) {
  const tiposById = useMemo(() => new Map((tipos || []).map((tipo) => [String(tipo?.id || ''), tipo?.nome || tipo?.sigla || tipo?.codigo || ''])), [tipos]);

  if (!gratificacoes.length) return <EmptyState />;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Militar</th>
              <th className="px-4 py-3">Função</th>
              <th className="px-4 py-3">Tipo / nível</th>
              <th className="px-4 py-3">Unidade / setor</th>
              <th className="px-4 py-3">Publicação / processo</th>
              <th className="px-4 py-3">Efeitos</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {gratificacoes.map((item) => (
              <tr key={item.id} className="align-top hover:bg-slate-50/80">
                <td className="min-w-[14rem] px-4 py-4">
                  <p className="font-semibold text-slate-900">{getNomeMilitarGratificacao(item)}</p>
                  <p className="text-xs text-slate-500">{item.posto_graduacao_snapshot || 'Posto/graduação não informado'} · Mat. {getMatriculaGratificacao(item)}</p>
                </td>
                <td className="min-w-[13rem] px-4 py-4">
                  <p className="font-medium text-slate-900">{item.funcao_gratificada || '—'}</p>
                  <p className="text-xs text-slate-500">{item.codigo_funcao || 'Código não informado'}</p>
                </td>
                <td className="min-w-[12rem] px-4 py-4">
                  <p className="font-medium text-slate-900">{getTipoGratificacaoLabel(item, tiposById)}</p>
                  <p className="text-xs text-slate-500">{item.nivel_gratificacao || 'Nível não informado'}</p>
                </td>
                <td className="min-w-[12rem] px-4 py-4">
                  <p className="font-medium text-slate-900">{item.unidade_nome_snapshot || '—'}</p>
                  <p className="text-xs text-slate-500">{item.setor_nome_snapshot || 'Setor não informado'}</p>
                </td>
                <td className="min-w-[14rem] px-4 py-4">
                  <p className="font-medium text-slate-900">{item.doems_nomeacao_numero || item.doems_dispensa_numero || item.ato_nomeacao_numero || item.ato_dispensa_numero || '—'}</p>
                  <p className="text-xs text-slate-500">{item.numero_processo || item.documento_solicitacao || 'Processo/documento não informado'}</p>
                </td>
                <td className="min-w-[10rem] px-4 py-4 text-xs text-slate-600">
                  <p>Início: <span className="font-medium text-slate-800">{formatDate(item.data_inicio_efeitos || item.data_publicacao_nomeacao || item.data_solicitacao)}</span></p>
                  <p>Fim: <span className="font-medium text-slate-800">{formatDate(item.data_fim_efeitos || item.data_publicacao_dispensa)}</span></p>
                </td>
                <td className="px-4 py-4"><StatusBadge status={item.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CotasTable({ cotas }) {
  if (!cotas.length) return <EmptyState message="Nenhuma cota cadastrada para os filtros atuais." />;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Função</th>
              <th className="px-4 py-3">Tipo / nível</th>
              <th className="px-4 py-3">Unidade / setor</th>
              <th className="px-4 py-3">Autorizadas</th>
              <th className="px-4 py-3">Ato / DOEMS</th>
              <th className="px-4 py-3">Vigência</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cotas.map((cota) => (
              <tr key={cota.id} className="align-top hover:bg-slate-50/80">
                <td className="px-4 py-4"><p className="font-semibold text-slate-900">{cota.funcao_gratificada || '—'}</p><p className="text-xs text-slate-500">{cota.codigo_funcao || 'Código não informado'}</p></td>
                <td className="px-4 py-4"><p className="font-medium text-slate-900">{cota.tipo_gratificacao || '—'}</p><p className="text-xs text-slate-500">{cota.nivel_gratificacao || 'Nível não informado'}</p></td>
                <td className="px-4 py-4"><p className="font-medium text-slate-900">{cota.unidade_nome_snapshot || '—'}</p><p className="text-xs text-slate-500">{cota.setor_nome_snapshot || 'Setor não informado'}</p></td>
                <td className="px-4 py-4 text-base font-bold text-slate-950">{cota.quantidade_autorizada || 0}</td>
                <td className="px-4 py-4"><p className="font-medium text-slate-900">{cota.ato_autorizativo || '—'}</p><p className="text-xs text-slate-500">{cota.doems_autorizacao_numero || cota.doems_autorizacao_edicao || 'DOEMS não informado'}</p></td>
                <td className="px-4 py-4 text-xs text-slate-600"><p>{formatDate(cota.data_inicio_vigencia)}</p><p>{formatDate(cota.data_fim_vigencia)}</p></td>
                <td className="px-4 py-4"><Badge variant="outline" className="rounded-full bg-slate-50 px-2.5 py-1 text-slate-700">{cota.status || '—'}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TiposTable({ tipos }) {
  if (!tipos.length) return <EmptyState message="Nenhum tipo de gratificação cadastrado." />;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {tipos.map((tipo) => (
        <div key={tipo.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-slate-900">{tipo.nome || 'Tipo sem nome'}</p>
              <p className="mt-1 text-xs text-slate-500">{tipo.sigla || tipo.codigo || 'Sem sigla/código'}</p>
            </div>
            <Badge variant="outline" className={tipo.ativo === false ? 'border-slate-200 bg-slate-50 text-slate-600' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}>
              {tipo.ativo === false ? 'Inativo' : 'Ativo'}
            </Badge>
          </div>
          <p className="mt-3 text-sm text-slate-600">{tipo.descricao || 'Sem descrição informada.'}</p>
          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">Nível: {tipo.nivel || 'não informado'}</p>
        </div>
      ))}
    </div>
  );
}

export default function GratificacoesFuncao() {
  const { isAdmin, canAccessAction, canAccessAll, permissions, modoAcesso, isLoading: loadingUser, isAccessResolved } = useCurrentUser();
  const hasAbsoluteAccess = canAccessAll || permissions === 'ALL';
  const canView = hasAbsoluteAccess || isAdmin || canAccessAction('visualizar_gratificacoes_funcao');
  const canViewAdministrativeQuotas = hasAbsoluteAccess || isAdmin || modoAcesso !== 'proprio';
  const [aba, setAba] = useState(GRATIFICACAO_TABS.ATIVOS);
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState(TODOS);
  const [tipo, setTipo] = useState(TODOS);
  const [funcao, setFuncao] = useState(TODOS);
  const [unidade, setUnidade] = useState(TODOS);

  const filtrosBackend = useMemo(() => ({
    tab: aba,
    busca,
    status: status === TODOS ? undefined : status,
    tipo_gratificacao_funcao_id: tipo === TODOS ? undefined : tipo,
    funcao_gratificada: funcao === TODOS ? undefined : funcao,
    unidade_id: unidade === TODOS ? undefined : unidade,
    limit: 200,
    offset: 0,
  }), [aba, busca, status, tipo, funcao, unidade]);

  const query = useQuery({
    queryKey: ['gratificacoes-funcao-painel', filtrosBackend],
    queryFn: () => fetchPainelGratificacoesFuncao(filtrosBackend),
    enabled: canView,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const gratificacoes = query.data?.gratificacoes || [];
  const cotasBackend = query.data?.cotas || [];
  const cotas = canViewAdministrativeQuotas ? cotasBackend : [];
  const tipos = query.data?.tipos || [];
  const resumo = query.data?.counters || {};
  const opcoes = useMemo(() => listarOpcoesGratificacao(gratificacoes, cotas, tipos), [gratificacoes, cotas, tipos]);

  const filtros = useMemo(() => ({ busca, status, tipo, funcao, unidade }), [busca, status, tipo, funcao, unidade]);
  const gratificacoesFiltradas = useMemo(() => {
    const porAba = filtrarGratificacoesPorAba(gratificacoes, aba);
    return aplicarFiltrosGratificacoesFuncao(porAba, filtros, tipos);
  }, [gratificacoes, aba, filtros, tipos]);

  const cotasFiltradas = useMemo(() => {
    const buscaNormalizada = busca.trim().toLowerCase();
    return cotas.filter((cota) => {
      if (funcao !== TODOS && cota.funcao_gratificada !== funcao) return false;
      if (tipo !== TODOS && String(cota.tipo_gratificacao_funcao_id || cota.tipo_gratificacao || '') !== tipo && String(cota.tipo_gratificacao || '').toLowerCase() !== tipo.toLowerCase()) return false;
      if (unidade !== TODOS) {
        const unidadeId = String(cota.unidade_id || cota.setor_id || '');
        const unidadeNome = String(cota.unidade_nome_snapshot || cota.setor_nome_snapshot || '').toLowerCase();
        if (unidadeId !== unidade && unidadeNome !== unidade.toLowerCase()) return false;
      }
      if (!buscaNormalizada) return true;
      return [cota.funcao_gratificada, cota.codigo_funcao, cota.tipo_gratificacao, cota.unidade_nome_snapshot, cota.setor_nome_snapshot, cota.ato_autorizativo, cota.doems_autorizacao_numero, cota.doems_autorizacao_edicao]
        .some((value) => String(value || '').toLowerCase().includes(buscaNormalizada));
    });
  }, [busca, cotas, funcao, tipo, unidade]);

  if (loadingUser || !isAccessResolved) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-slate-500" /></div>;
  }

  if (!canView) {
    return <AccessDenied modulo="Gratificação de Função" />;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
                <Award className="h-3.5 w-3.5" /> Módulo read-only
              </div>
              <h1 className="mt-3 text-2xl font-bold text-slate-950 md:text-3xl">Gratificação de Função</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-600">Primeira visão administrativa para acompanhamento de nomeações, dispensas, cotas e tipos cadastrados. Esta tela não cria, edita, exclui ou altera status.</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 lg:max-w-md">
              <div className="flex gap-2">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <p><span className="font-semibold">Leitura escopada:</span> os dados são carregados por functions backend com autorização, escopo estrutural e paginação. A tela permanece somente leitura e não oferece criação, edição, exclusão ou alteração de status.</p>
              </div>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {CARD_CONFIG.map((card) => <CounterCard key={card.key} {...card} value={resumo[card.key]} />)}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(18rem,1.4fr)_repeat(4,minmax(10rem,1fr))]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar por militar, matrícula, função, DOEMS ou processo" className="h-11 bg-slate-50 pl-9" />
            </div>
            <Select value={status} onValueChange={setStatus} disabled={aba === GRATIFICACAO_TABS.COTAS || aba === GRATIFICACAO_TABS.TIPOS}>
              <SelectTrigger className="h-11 bg-slate-50"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos os status</SelectItem>
                {Object.entries(GRATIFICACAO_STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="h-11 bg-slate-50"><SelectValue placeholder="Tipo de gratificação" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos os tipos</SelectItem>
                {opcoes.tipos.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={funcao} onValueChange={setFuncao}>
              <SelectTrigger className="h-11 bg-slate-50"><SelectValue placeholder="Função" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todas as funções</SelectItem>
                {opcoes.funcoes.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={unidade} onValueChange={setUnidade}>
              <SelectTrigger className="h-11 bg-slate-50"><SelectValue placeholder="Unidade/setor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todas as unidades/setores</SelectItem>
                {opcoes.unidades.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </section>

        <Tabs value={aba} onValueChange={setAba} className="w-full">
          <TabsList className="flex h-auto flex-wrap justify-start gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
            {TAB_KEYS.filter((tab) => canViewAdministrativeQuotas || tab !== GRATIFICACAO_TABS.COTAS).map((tab) => <TabsTrigger key={tab} value={tab} className="rounded-xl px-3 py-2 text-xs md:text-sm">{GRATIFICACAO_TAB_LABELS[tab]}</TabsTrigger>)}
          </TabsList>
        </Tabs>

        {query.isLoading && <div className="flex min-h-[18rem] items-center justify-center rounded-2xl border border-slate-200 bg-white"><Loader2 className="h-8 w-8 animate-spin text-slate-500" /></div>}
        {query.error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><p>{query.error.message || 'Erro controlado ao carregar o painel de Gratificação de Função.'}</p></div>
          </div>
        )}
        {!query.isLoading && !query.error && aba !== GRATIFICACAO_TABS.COTAS && aba !== GRATIFICACAO_TABS.TIPOS && <GratificacoesTable gratificacoes={gratificacoesFiltradas} tipos={tipos} />}
        {!query.isLoading && !query.error && aba === GRATIFICACAO_TABS.COTAS && <CotasTable cotas={cotasFiltradas} />}
        {!query.isLoading && !query.error && aba === GRATIFICACAO_TABS.TIPOS && <TiposTable tipos={tipos} />}
      </div>
    </div>
  );
}
