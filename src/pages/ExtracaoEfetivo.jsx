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
import {
  EXTRACAO_EFETIVO_DEFAULT_COLUMNS,
  getLotacaoNomeEfetivo,
  getPrimeiroValorEfetivo,
  getQuadroEfetivo,
  getValorCampoEfetivo,
} from '@/pages/extracaoEfetivo/catalogoCamposEfetivo';
import { QUADROS_FIXOS } from '@/utils/postoQuadroCompatibilidade';

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

function getLotacaoId(militar = {}) {
  return getPrimeiroValorEfetivo(militar, [
    'estrutura_id',
    'subgrupamento_id',
    'lotacao_id',
    'unidade_id',
  ]);
}

function militarMatchesSearch(militar = {}, normalizedSearch = '') {
  if (!normalizedSearch) return true;

  const searchableFields = EXTRACAO_EFETIVO_DEFAULT_COLUMNS.map((column) =>
    getValorCampoEfetivo(militar, column.id),
  );

  return searchableFields.some((field) => normalizeText(field).includes(normalizedSearch));
}

function uniqueSorted(values = []) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, 'pt-BR'),
  );
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
  const [postoFilter, setPostoFilter] = useState(TODOS_VALUE);
  const [quadroFilter, setQuadroFilter] = useState(TODOS_VALUE);
  const [statusFilter, setStatusFilter] = useState(TODOS_VALUE);
  const [lotacaoFilter, setLotacaoFilter] = useState(TODOS_VALUE);

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

  const [filtrosExecutados, setFiltrosExecutados] = useState(null);
  const [executionId, setExecutionId] = useState(0);

  const filtrosAtuais = useMemo(
    () => ({
      statusCadastro: 'Ativo',
      includeFoto: false,
      limit: BACKEND_LIMIT,
      offset: 0,
      search: searchTerm.trim() || null,
      postoGraduacao: postoFilter,
      quadro: quadroFilter,
      status: statusFilter,
      lotacao: lotacaoFilter,
    }),
    [lotacaoFilter, postoFilter, quadroFilter, searchTerm, statusFilter],
  );

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
    filtrosExecutados || 'consulta-nao-executada',
    executionId,
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
    enabled: isAccessResolved && Boolean(filtrosExecutados),
    queryFn: () =>
      fetchScopedMilitares({
        statusCadastro: 'Ativo',
        limit: BACKEND_LIMIT,
        offset: 0,
        includeFoto: false,
        ...(filtrosExecutados?.search ? { search: filtrosExecutados.search } : {}),
        ...(filtrosExecutados?.postoGraduacao && filtrosExecutados.postoGraduacao !== TODOS_VALUE
          ? { postoGraduacaoFiltros: [filtrosExecutados.postoGraduacao] }
          : {}),
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
        ...militares.map((militar) => getValorCampoEfetivo(militar, 'posto_graduacao')),
      ]),
    [militares],
  );

  const quadrosDisponiveis = useMemo(
    () =>
      uniqueSorted([
        ...QUADROS_FIXOS,
        ...militares.map((militar) => getQuadroEfetivo(militar)),
      ]),
    [militares],
  );

  const statusDisponiveis = useMemo(
    () =>
      uniqueSorted([
        ...Object.keys(statusBadgeClass),
        ...militares.map((militar) => getValorCampoEfetivo(militar, 'status_cadastro')),
      ]),
    [militares],
  );

  const hasExecutedExtraction = Boolean(filtrosExecutados);
  const normalizedExecutedSearch = useMemo(
    () => normalizeText(filtrosExecutados?.search),
    [filtrosExecutados],
  );
  const filtersChangedAfterExecution =
    hasExecutedExtraction && JSON.stringify(filtrosAtuais) !== JSON.stringify(filtrosExecutados);

  const filteredMilitares = useMemo(() => {
    return militares.filter((militar) => {
      const posto = getValorCampoEfetivo(militar, 'posto_graduacao');
      const quadroNormalizado = getQuadroEfetivo(militar);
      const status = getValorCampoEfetivo(militar, 'status_cadastro');
      const lotacaoId = getLotacaoId(militar);
      const lotacaoNome = getLotacaoNomeEfetivo(militar);

      if (!filtrosExecutados) return false;
      if (filtrosExecutados.postoGraduacao !== TODOS_VALUE && posto !== filtrosExecutados.postoGraduacao) {
        return false;
      }
      if (filtrosExecutados.quadro !== TODOS_VALUE && quadroNormalizado !== filtrosExecutados.quadro) {
        return false;
      }
      if (filtrosExecutados.status !== TODOS_VALUE && status !== filtrosExecutados.status) return false;
      if (filtrosExecutados.lotacao === SEM_LOTACAO_VALUE && lotacaoNome) return false;
      if (
        filtrosExecutados.lotacao !== TODOS_VALUE &&
        filtrosExecutados.lotacao !== SEM_LOTACAO_VALUE &&
        lotacaoId !== filtrosExecutados.lotacao
      ) {
        return false;
      }
      if (!militarMatchesSearch(militar, normalizedExecutedSearch)) return false;

      return true;
    });
  }, [filtrosExecutados, militares, normalizedExecutedSearch]);

  const executeExtraction = () => {
    setFiltrosExecutados(filtrosAtuais);
    setExecutionId((currentExecutionId) => currentExecutionId + 1);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setPostoFilter(TODOS_VALUE);
    setQuadroFilter(TODOS_VALUE);
    setStatusFilter(TODOS_VALUE);
    setLotacaoFilter(TODOS_VALUE);
  };

  const clearExtraction = () => {
    clearFilters();
    setFiltrosExecutados(null);
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
  const isBusy = hasExecutedExtraction && (isLoading || isFetching);
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
                  Construtor read-only de consultas baseado no escopo atual de acesso.
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

        {hasExecutedExtraction ? (
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
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 flex gap-3">
            <Database className="w-5 h-5 shrink-0 mt-0.5 text-slate-400" />
            <div>
              <p className="font-semibold text-slate-700">Nenhuma extração executada.</p>
              <p>
                Configure os filtros e clique em Executar extração para carregar os totais e a
                tabela.
              </p>
            </div>
          </div>
        )}

        {hasExecutedExtraction && totalRetornado >= BACKEND_LIMIT && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 flex gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Resultado gerado possivelmente limitado.</p>
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
              Filtros da extração
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
                  <SelectItem value={TODOS_VALUE}>Todos os status retornados da base ativa</SelectItem>
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

                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    type="button"
                    onClick={executeExtraction}
                    disabled={!isAccessResolved || isBusy}
                  >
                    {isBusy ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <FileSearch className="w-4 h-4 mr-2" />
                    )}
                    Executar extração
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={clearExtraction}
                    disabled={isBusy}
                  >
                    Limpar consulta
                  </Button>
                </div>
              </div>
            )}

            {!shouldShowLotacaoFilter && (
              <div className="flex justify-end">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    type="button"
                    onClick={executeExtraction}
                    disabled={!isAccessResolved || isBusy}
                  >
                    {isBusy ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <FileSearch className="w-4 h-4 mr-2" />
                    )}
                    Executar extração
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={clearExtraction}
                    disabled={isBusy}
                  >
                    Limpar consulta
                  </Button>
                </div>
              </div>
            )}

            {shouldShowLotacaoFilter && isErrorLotacoes && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                O filtro de lotação não pôde ser carregado com segurança pelo escopo atual. A
                extração permanece disponível sem filtrar por lotação.
                {lotacoesError?.message ? ` Detalhe: ${lotacoesError.message}` : ''}
              </div>
            )}

            {filtersChangedAfterExecution && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                Os filtros foram alterados depois da última execução. Clique em Executar extração para
                gerar um novo resultado com os parâmetros atuais.
              </div>
            )}
          </CardContent>
        </Card>

        {!isAccessResolved ? (
          <Card className="border-slate-100 shadow-sm">
            <CardContent className="p-12 text-center text-slate-500">
              Resolvendo contexto de acesso para liberar a extração.
            </CardContent>
          </Card>
        ) : !hasExecutedExtraction ? (
          <Card className="border-slate-100 shadow-sm">
            <CardContent className="p-12 text-center">
              <FileSearch className="w-14 h-14 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">
                Configure os filtros e clique em Executar extração.
              </h3>
              <p className="text-sm text-slate-500">
                Nenhum militar será carregado até a consulta escopada ser executada manualmente.
              </p>
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
                    {EXTRACAO_EFETIVO_DEFAULT_COLUMNS.map((column) => (
                      <th key={column.id} className="px-4 py-3 text-left font-semibold">
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {filteredMilitares.map((militar) => (
                    <tr
                      key={militar.id || `${militar.nome_completo}-${getValorCampoEfetivo(militar, 'matricula')}`}
                      className="hover:bg-slate-50/80"
                    >
                      {EXTRACAO_EFETIVO_DEFAULT_COLUMNS.map((column) => {
                        const value = getValorCampoEfetivo(militar, column.id);

                        return (
                          <td key={column.id} className={`px-4 py-3 ${column.cellClassName || ''}`}>
                            {column.renderAs === 'statusBadge' ? (
                              <Badge
                                className={`${
                                  statusBadgeClass[value] || statusBadgeClass.Ativo
                                } border`}
                              >
                                {textoOuTraco(value || 'Ativo')}
                              </Badge>
                            ) : (
                              textoOuTraco(value)
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}