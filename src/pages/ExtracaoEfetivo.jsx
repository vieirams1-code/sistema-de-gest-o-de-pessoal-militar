import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Database,
  FileSearch,
  FileText,
  Info,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';

import AccessDenied from '@/components/auth/AccessDenied';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { fetchScopedMilitares, getEffectiveEmail } from '@/services/getScopedMilitaresClient';
import { fetchScopedLotacoes } from '@/services/getScopedLotacoesClient';
import { normalizarQuadroLegado, QUADROS_FIXOS } from '@/utils/postoQuadroCompatibilidade';

const BACKEND_LIMIT = 200;
const STALE_TIME_MS = 5 * 60 * 1000;
const TODOS_VALUE = '__todos__';
const SEM_LOTACAO_VALUE = '__sem_lotacao__';

const POSTO_GRADUACAO_OPTIONS = [
  'Coronel',
  'Tenente Coronel',
  'Tenente-Coronel',
  'Major',
  'Capitão',
  '1º Tenente',
  '2º Tenente',
  'Aspirante',
  'Subtenente',
  '1º Sargento',
  '2º Sargento',
  '3º Sargento',
  'Cabo',
  'Soldado',
];

const statusBadgeClass = {
  Ativo: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Inativo: 'bg-slate-100 text-slate-700 border-slate-200',
  Reserva: 'bg-amber-100 text-amber-700 border-amber-200',
  Reforma: 'bg-blue-100 text-blue-700 border-blue-200',
  Falecido: 'bg-red-100 text-red-700 border-red-200',
};

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function textoOuTraco(value) {
  return String(value || '').trim() || '—';
}

function getFirstValue(record, keys = []) {
  for (const key of keys) {
    const value = record?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
}

function getLotacaoNome(militar = {}) {
  return getFirstValue(militar, [
    'estrutura_nome',
    'subgrupamento_nome',
    'grupamento_nome',
    'lotacao_atual',
    'lotacao_nome',
    'lotacao',
    'subgrupamento',
    'unidade_nome',
  ]);
}

function getLotacaoId(militar = {}) {
  return getFirstValue(militar, [
    'estrutura_id',
    'subgrupamento_id',
    'lotacao_id',
    'unidade_id',
  ]);
}

function militarMatchesSearch(militar = {}, normalizedSearch = '') {
  if (!normalizedSearch) return true;

  const searchableFields = [
    militar.posto_graduacao,
    militar.nome_guerra,
    militar.nome_completo,
    militar.matricula,
    militar.matricula_atual,
    militar.quadro,
    normalizarQuadroLegado(militar.quadro),
    getLotacaoNome(militar),
    militar.status_cadastro,
    militar.situacao_militar,
    militar.funcao,
  ];

  return searchableFields.some((field) => normalizeText(field).includes(normalizedSearch));
}

function uniqueSorted(values = []) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, 'pt-BR'),
  );
}

function uniqueSortedByGetter(records = [], getter) {
  return uniqueSorted(records.map(getter));
}

export default function ExtracaoEfetivo() {
  const {
    isAdmin,
    modoAcesso,
    userEmail,
    authUserEmail,
    effectiveUserEmail,
    isImpersonating,
    isAccessResolved,
    isLoading: loadingUser,
    canAccessModule,
    canAccessAction,
    resolvedAccessContext,
  } = useCurrentUser();

  const effectiveEmailFromStorage = getEffectiveEmail();
  const effectiveEmailForQuery =
    effectiveUserEmail ||
    resolvedAccessContext?.effectiveEmail ||
    effectiveEmailFromStorage ||
    null;

  const shouldShowLotacaoFilter = isAdmin || ['setor', 'subsetor', 'unidade'].includes(modoAcesso);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [postoFilter, setPostoFilter] = useState(TODOS_VALUE);
  const [quadroFilter, setQuadroFilter] = useState(TODOS_VALUE);
  const [statusFilter, setStatusFilter] = useState(TODOS_VALUE);
  const [lotacaoFilter, setLotacaoFilter] = useState(TODOS_VALUE);

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedSearchTerm(searchTerm.trim()), 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const lotacoesQueryKey = [
    'extracao-efetivo-lotacoes-scoped',
    isAdmin,
    modoAcesso || 'indefinido',
    userEmail || 'sem-email',
    effectiveUserEmail || 'sem-effective-user-email',
    effectiveEmailFromStorage || 'sem-effective-email-storage',
    effectiveEmailForQuery || 'self',
  ];

  const {
    data: lotacoesData = { lotacoes: [] },
    isLoading: isLoadingLotacoes,
    isError: isErrorLotacoes,
    error: lotacoesError,
  } = useQuery({
    queryKey: lotacoesQueryKey,
    enabled: isAccessResolved && shouldShowLotacaoFilter,
    queryFn: () => fetchScopedLotacoes({}),
    staleTime: STALE_TIME_MS,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const lotacoesDisponiveis = useMemo(() => {
    return (lotacoesData?.lotacoes || [])
      .map((lotacao) => ({
        id: String(lotacao?.id || '').trim(),
        nome: String(lotacao?.nome || lotacao?.sigla || '').trim(),
      }))
      .filter((lotacao) => lotacao.id && lotacao.nome)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [lotacoesData]);

  const lotacoesIds = useMemo(
    () => new Set(lotacoesDisponiveis.map((lotacao) => lotacao.id)),
    [lotacoesDisponiveis],
  );

  useEffect(() => {
    if (lotacaoFilter === TODOS_VALUE || lotacaoFilter === SEM_LOTACAO_VALUE) return;
    if (lotacoesIds.has(lotacaoFilter)) return;
    setLotacaoFilter(TODOS_VALUE);
  }, [lotacaoFilter, lotacoesIds]);

  const filtrosQueryKey = {
    statusCadastro: 'Ativo',
    includeFoto: false,
    limit: BACKEND_LIMIT,
    search: debouncedSearchTerm || null,
    postoGraduacao: postoFilter,
    quadro: quadroFilter,
    status: statusFilter,
    lotacao: lotacaoFilter,
  };

  const militaresQueryKey = [
    'extracao-efetivo-militares-scoped',
    isAdmin,
    modoAcesso || 'indefinido',
    userEmail || 'sem-email',
    authUserEmail || 'sem-auth-email',
    effectiveUserEmail || 'sem-effective-user-email',
    effectiveEmailFromStorage || 'sem-effective-email-storage',
    effectiveEmailForQuery || 'self',
    isImpersonating,
    filtrosQueryKey,
  ];

  const {
    data: militaresData = { militares: [], meta: {} },
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: militaresQueryKey,
    enabled: isAccessResolved,
    queryFn: () =>
      fetchScopedMilitares({
        statusCadastro: 'Ativo',
        limit: BACKEND_LIMIT,
        offset: 0,
        includeFoto: false,
        ...(debouncedSearchTerm ? { search: debouncedSearchTerm } : {}),
        ...(postoFilter !== TODOS_VALUE ? { postoGraduacaoFiltros: [postoFilter] } : {}),
      }),
    staleTime: STALE_TIME_MS,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const militares = useMemo(() => militaresData?.militares || [], [militaresData]);

  const postosDisponiveis = useMemo(
    () =>
      uniqueSorted([
        ...POSTO_GRADUACAO_OPTIONS,
        ...militares.map((militar) => getFirstValue(militar, ['posto_graduacao'])),
      ]),
    [militares],
  );

  const quadrosDisponiveis = useMemo(
    () =>
      uniqueSorted([
        ...QUADROS_FIXOS,
        ...militares.map((militar) => normalizarQuadroLegado(militar?.quadro) || militar?.quadro),
      ]),
    [militares],
  );

  const statusDisponiveis = useMemo(
    () => uniqueSortedByGetter(militares, (militar) => getFirstValue(militar, ['status_cadastro'])),
    [militares],
  );

  const normalizedSearch = useMemo(() => normalizeText(searchTerm), [searchTerm]);

  const filteredMilitares = useMemo(() => {
    return militares.filter((militar) => {
      const posto = getFirstValue(militar, ['posto_graduacao']);
      const quadroNormalizado = normalizarQuadroLegado(militar?.quadro) || getFirstValue(militar, ['quadro']);
      const status = getFirstValue(militar, ['status_cadastro']);
      const lotacaoId = getLotacaoId(militar);
      const lotacaoNome = getLotacaoNome(militar);

      if (postoFilter !== TODOS_VALUE && posto !== postoFilter) return false;
      if (quadroFilter !== TODOS_VALUE && quadroNormalizado !== quadroFilter) return false;
      if (statusFilter !== TODOS_VALUE && status !== statusFilter) return false;
      if (lotacaoFilter === SEM_LOTACAO_VALUE && lotacaoNome) return false;
      if (
        lotacaoFilter !== TODOS_VALUE &&
        lotacaoFilter !== SEM_LOTACAO_VALUE &&
        lotacaoId !== lotacaoFilter
      ) {
        return false;
      }
      if (!militarMatchesSearch(militar, normalizedSearch)) return false;

      return true;
    });
  }, [militares, lotacaoFilter, normalizedSearch, postoFilter, quadroFilter, statusFilter]);

  const clearFilters = () => {
    setSearchTerm('');
    setPostoFilter(TODOS_VALUE);
    setQuadroFilter(TODOS_VALUE);
    setStatusFilter(TODOS_VALUE);
    setLotacaoFilter(TODOS_VALUE);
  };

  if (
    !loadingUser &&
    isAccessResolved &&
    (!canAccessModule('extracao_efetivo') || !canAccessAction('visualizar_extracao_efetivo'))
  ) {
    return <AccessDenied modulo="Extração do Efetivo" />;
  }

  const totalRetornado = militares.length;
  const totalFiltrado = filteredMilitares.length;
  const isBusy = isLoading || isFetching;
  const isRateLimitError = String(error?.message || '').toLowerCase().includes('rate limit');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-2xl bg-[#1e3a5f] p-3 text-white shadow-sm">
                <FileSearch className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-[#1e3a5f]">
                  Extração do Efetivo
                </h1>
                <p className="text-sm text-slate-500">
                  Consulta inicial read-only baseada no escopo atual de acesso.
                </p>
              </div>
            </div>
          </div>
          <Badge variant="outline" className="w-fit border-blue-200 bg-blue-50 text-blue-700">
            <ShieldCheck className="w-3.5 h-3.5 mr-1" />
            Somente leitura
          </Badge>
        </div>

        <div className="rounded-xl border border-blue-100 bg-blue-50/80 p-4 text-sm text-blue-900 flex gap-3">
          <Info className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Módulo inicial com campos funcionais comuns.</p>
            <p>
              Esta versão não inclui dados sensíveis, exportação, seleção dinâmica de colunas ou
              cruzamentos com outros módulos. Dados protegidos e análises combinadas serão tratados
              em lotes futuros.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-slate-100 shadow-sm">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="rounded-xl bg-slate-100 p-3 text-slate-700">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Registros retornados</p>
                <p className="text-3xl font-bold text-slate-800">{totalRetornado}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-100 shadow-sm">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="rounded-xl bg-emerald-100 p-3 text-emerald-700">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Após filtros</p>
                <p className="text-3xl font-bold text-slate-800">{totalFiltrado}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {totalRetornado >= BACKEND_LIMIT && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 flex gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Resultado inicial limitado.</p>
              <p>
                Esta tela ainda usa limite controlado de {BACKEND_LIMIT} registros. Paginação e
                carregamento incremental serão tratados em lote próprio.
              </p>
            </div>
          </div>
        )}

        <Card className="border-slate-100 shadow-sm">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <FileText className="w-4 h-4" />
              Filtros simples
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
              <div className="relative xl:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  className="pl-9"
                  placeholder="Buscar por nome, matrícula, quadro, função..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>

              <Select value={postoFilter} onValueChange={setPostoFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Posto/graduação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS_VALUE}>Todos os postos</SelectItem>
                  {postosDisponiveis.map((posto) => (
                    <SelectItem key={posto} value={posto}>
                      {posto}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={quadroFilter} onValueChange={setQuadroFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Quadro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS_VALUE}>Todos os quadros</SelectItem>
                  {quadrosDisponiveis.map((quadro) => (
                    <SelectItem key={quadro} value={quadro}>
                      {quadro}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS_VALUE}>Todos os status</SelectItem>
                  {statusDisponiveis.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {shouldShowLotacaoFilter && (
              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-3 items-center">
                <Select
                  value={lotacaoFilter}
                  onValueChange={setLotacaoFilter}
                  disabled={isLoadingLotacoes || isErrorLotacoes}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Lotação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TODOS_VALUE}>Todas as lotações do escopo</SelectItem>
                    <SelectItem value={SEM_LOTACAO_VALUE}>Sem lotação informada</SelectItem>
                    {lotacoesDisponiveis.map((lotacao) => (
                      <SelectItem key={lotacao.id} value={lotacao.id}>
                        {lotacao.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button type="button" variant="outline" onClick={clearFilters}>
                  Limpar filtros
                </Button>
              </div>
            )}

            {!shouldShowLotacaoFilter && (
              <div className="flex justify-end">
                <Button type="button" variant="outline" onClick={clearFilters}>
                  Limpar filtros
                </Button>
              </div>
            )}

            {shouldShowLotacaoFilter && isErrorLotacoes && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                O filtro de lotação não pôde ser carregado com segurança pelo escopo atual. A
                extração permanece disponível sem filtrar por lotação.
                {lotacoesError?.message ? ` Detalhe: ${lotacoesError.message}` : ''}
              </div>
            )}
          </CardContent>
        </Card>

        {!isAccessResolved ? (
          <Card className="border-slate-100 shadow-sm">
            <CardContent className="p-12 text-center text-slate-500">
              Resolvendo contexto de acesso para carregar a extração.
            </CardContent>
          </Card>
        ) : isBusy ? (
          <Card className="border-slate-100 shadow-sm">
            <CardContent className="p-12 text-center">
              <div className="w-10 h-10 border-4 border-slate-200 border-t-[#1e3a5f] rounded-full animate-spin mx-auto mb-4" />
              <p className="text-slate-600">Carregando efetivo escopado...</p>
            </CardContent>
          </Card>
        ) : isError ? (
          <Card className="border-amber-200 bg-amber-50 shadow-sm">
            <CardContent className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-amber-900">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Não foi possível carregar a extração.</p>
                  <p className="text-sm">
                    {isRateLimitError
                      ? 'Limite de requisições excedido. Aguarde alguns instantes e tente novamente.'
                      : error?.message || 'Ocorreu uma falha controlada ao consultar o efetivo escopado.'}
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        ) : filteredMilitares.length === 0 ? (
          <Card className="border-slate-100 shadow-sm">
            <CardContent className="p-12 text-center">
              <Users className="w-14 h-14 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">
                Nenhum registro encontrado
              </h3>
              <p className="text-sm text-slate-500">
                Ajuste os filtros ou verifique se há militares ativos no seu escopo.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Posto/graduação</th>
                    <th className="px-4 py-3 text-left font-semibold">Nome de guerra</th>
                    <th className="px-4 py-3 text-left font-semibold">Nome completo</th>
                    <th className="px-4 py-3 text-left font-semibold">Matrícula</th>
                    <th className="px-4 py-3 text-left font-semibold">Quadro</th>
                    <th className="px-4 py-3 text-left font-semibold">Lotação</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-left font-semibold">Situação militar</th>
                    <th className="px-4 py-3 text-left font-semibold">Função</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {filteredMilitares.map((militar) => {
                    const status = getFirstValue(militar, ['status_cadastro']) || 'Ativo';

                    return (
                      <tr
                        key={militar.id || `${militar.nome_completo}-${militar.matricula}`}
                        className="hover:bg-slate-50/80"
                      >
                        <td className="px-4 py-3 font-semibold text-[#1e3a5f] whitespace-nowrap">
                          {textoOuTraco(militar?.posto_graduacao)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {textoOuTraco(militar?.nome_guerra)}
                        </td>
                        <td className="px-4 py-3 min-w-60">
                          {textoOuTraco(militar?.nome_completo)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {textoOuTraco(militar?.matricula_atual || militar?.matricula)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {textoOuTraco(normalizarQuadroLegado(militar?.quadro) || militar?.quadro)}
                        </td>
                        <td className="px-4 py-3 min-w-56">
                          {textoOuTraco(getLotacaoNome(militar))}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Badge className={`${statusBadgeClass[status] || statusBadgeClass.Ativo} border`}>
                            {textoOuTraco(status)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {textoOuTraco(militar?.situacao_militar)}
                        </td>
                        <td className="px-4 py-3 min-w-44">
                          {textoOuTraco(militar?.funcao)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}