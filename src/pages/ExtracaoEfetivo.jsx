import React, { useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { AlertTriangle, Database, FileSearch, Info, Search, ShieldCheck, Users } from 'lucide-react';
import AccessDenied from '@/components/auth/AccessDenied';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchScopedMilitares, getEffectiveEmail } from '@/services/getScopedMilitaresClient';
import { normalizarQuadroLegado, QUADROS_FIXOS } from '@/utils/postoQuadroCompatibilidade';

const BACKEND_LIMIT = 500;
const STALE_TIME_MS = 5 * 60 * 1000;
const TODOS_VALUE = 'todos';

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

const SORT_OPTIONS = [
  { value: 'posto_graduacao', label: 'Posto/Graduação' },
  { value: 'nome_guerra', label: 'Nome de guerra' },
  { value: 'nome_completo', label: 'Nome completo' },
  { value: 'matricula', label: 'Matrícula' },
  { value: 'quadro', label: 'Quadro' },
  { value: 'lotacao', label: 'Lotação' },
  { value: 'status', label: 'Status' },
  { value: 'situacao_militar', label: 'Situação militar' },
  { value: 'funcao', label: 'Função' },
];

const statusBadgeClass = {
  Ativo: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Inativo: 'bg-slate-100 text-slate-700 border-slate-200',
  Reserva: 'bg-amber-100 text-amber-700 border-amber-200',
  Reforma: 'bg-blue-100 text-blue-700 border-blue-200',
  Falecido: 'bg-red-100 text-red-700 border-red-200',
};

const normalizarTexto = (value) => String(value || '').trim().toLowerCase();
const textoOuTraco = (value) => String(value || '').trim() || '—';

function getLotacaoLabel(militar = {}) {
  const estruturaNome = String(militar?.estrutura_nome || '').trim();
  const subgrupamentoNome = String(militar?.subgrupamento_nome || '').trim();
  const grupamentoNome = String(militar?.grupamento_nome || '').trim();
  const lotacaoAtual = String(militar?.lotacao_atual || '').trim();
  const lotacao = String(militar?.lotacao || '').trim();

  if (estruturaNome) return estruturaNome;
  if (subgrupamentoNome) return subgrupamentoNome;
  if (grupamentoNome) return grupamentoNome;
  if (lotacaoAtual) return lotacaoAtual;
  if (lotacao) return lotacao;
  return 'Sem lotação';
}

function militarCorrespondeBuscaFuncional(militar = {}, termo = '') {
  const query = normalizarTexto(termo);
  if (!query) return true;

  return [
    militar?.posto_graduacao,
    militar?.nome_guerra,
    militar?.nome_completo,
    militar?.matricula,
    militar?.matricula_atual,
    militar?.quadro,
    getLotacaoLabel(militar),
    militar?.status_cadastro,
    militar?.situacao_militar,
    militar?.funcao,
  ].some((value) => normalizarTexto(value).includes(query));
}

function uniqueSorted(values = []) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function getSortValue(militar = {}, sortField = 'posto_graduacao') {
  const sortGetters = {
    posto_graduacao: () => militar?.posto_graduacao,
    nome_guerra: () => militar?.nome_guerra,
    nome_completo: () => militar?.nome_completo,
    matricula: () => militar?.matricula_atual || militar?.matricula,
    quadro: () => militar?.quadro,
    lotacao: () => militar?.lotacao_funcional,
    status: () => militar?.status_cadastro,
    situacao_militar: () => militar?.situacao_militar,
    funcao: () => militar?.funcao,
  };

  return normalizarTexto((sortGetters[sortField] || sortGetters.posto_graduacao)());
}

function getPageOffset(meta = {}, fallbackOffset = 0, currentOffset = 0) {
  const offsetCandidates = [meta?.nextOffset, meta?.proximoOffset, meta?.offsetProximo];
  const foundOffset = offsetCandidates.find((value) => Number.isFinite(Number(value)) && Number(value) > currentOffset);
  return Number.isFinite(Number(foundOffset)) ? Number(foundOffset) : fallbackOffset;
}

function pageCanHaveMore(page = {}) {
  const meta = page?.meta || {};
  const explicitHasMore = meta?.hasMore ?? meta?.has_more ?? meta?.temMais ?? meta?.tem_mais;
  if (typeof explicitHasMore === 'boolean') return explicitHasMore;

  const totalKnown = meta?.total ?? meta?.totalRegistros ?? meta?.total_registros;
  if (Number.isFinite(Number(totalKnown))) {
    return page.offset + page.militares.length < Number(totalKnown);
  }

  return page.militares.length === BACKEND_LIMIT;
}

export default function ExtracaoEfetivo() {
  const {
    isAdmin,
    modoAcesso,
    userEmail,
    canAccessModule,
    canAccessAction,
    isAccessResolved,
    isLoading: loadingUser,
    resolvedAccessContext,
  } = useCurrentUser();

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [postoGraduacaoFilter, setPostoGraduacaoFilter] = useState(TODOS_VALUE);
  const [quadroFilter, setQuadroFilter] = useState(TODOS_VALUE);
  const [statusFilter, setStatusFilter] = useState(TODOS_VALUE);
  const [lotacaoFilter, setLotacaoFilter] = useState(TODOS_VALUE);
  const [sortField, setSortField] = useState('posto_graduacao');
  const [sortDirection, setSortDirection] = useState('asc');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const effectiveEmail = getEffectiveEmail();
  const effectiveUserEmail = resolvedAccessContext?.effectiveEmail || null;
  const shouldQuery = isAccessResolved;

  const queryKey = [
    'extracao-efetivo-scoped-readonly',
    isAdmin,
    modoAcesso || 'indefinido',
    userEmail || 'sem-email',
    effectiveEmail || 'self',
    effectiveUserEmail || 'sem-email-efetivo',
    {
      statusCadastro: 'Ativo',
      includeFoto: false,
      limit: BACKEND_LIMIT,
      pagination: 'offset-limit',
    },
  ];

  const {
    data: militaresData,
    isLoading,
    isFetching,
    isFetchingNextPage,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey,
    enabled: shouldQuery,
    staleTime: STALE_TIME_MS,
    retry: 1,
    refetchOnWindowFocus: false,
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      const offset = Number(pageParam) || 0;
      const { militares, meta } = await fetchScopedMilitares({
        statusCadastro: 'Ativo',
        limit: BACKEND_LIMIT,
        offset,
        includeFoto: false,
      });

      return {
        offset,
        militares: militares.map((militar) => ({
          ...militar,
          lotacao_funcional: getLotacaoLabel(militar),
        })),
        meta,
      };
    },
    getNextPageParam: (lastPage) => {
      if (!pageCanHaveMore(lastPage)) return undefined;
      const fallbackOffset = lastPage.offset + lastPage.militares.length;
      return getPageOffset(lastPage.meta, fallbackOffset, lastPage.offset);
    },
  });

  const pages = militaresData?.pages || [];
  const militares = useMemo(() => pages.flatMap((page) => page?.militares || []), [pages]);

  const filtrosDisponiveis = useMemo(() => ({
    postos: uniqueSorted([...POSTO_GRADUACAO_OPTIONS, ...militares.map((militar) => militar?.posto_graduacao)]),
    quadros: uniqueSorted([...QUADROS_FIXOS, ...militares.map((militar) => normalizarQuadroLegado(militar?.quadro) || militar?.quadro)]),
    statuses: uniqueSorted(militares.map((militar) => militar?.status_cadastro)),
    lotacoes: uniqueSorted(militares.map((militar) => militar?.lotacao_funcional)),
  }), [militares]);

  const filteredMilitares = useMemo(() => {
    return militares
      .filter((militar) => militarCorrespondeBuscaFuncional(militar, debouncedSearchTerm))
      .filter((militar) => postoGraduacaoFilter === TODOS_VALUE || militar?.posto_graduacao === postoGraduacaoFilter)
      .filter((militar) => quadroFilter === TODOS_VALUE || normalizarQuadroLegado(militar?.quadro) === quadroFilter)
      .filter((militar) => statusFilter === TODOS_VALUE || militar?.status_cadastro === statusFilter)
      .filter((militar) => lotacaoFilter === TODOS_VALUE || militar?.lotacao_funcional === lotacaoFilter);
  }, [militares, debouncedSearchTerm, postoGraduacaoFilter, quadroFilter, statusFilter, lotacaoFilter]);

  const sortedMilitares = useMemo(() => {
    const directionModifier = sortDirection === 'desc' ? -1 : 1;
    return [...filteredMilitares].sort((a, b) => {
      const comparison = getSortValue(a, sortField).localeCompare(getSortValue(b, sortField), 'pt-BR', {
        numeric: true,
        sensitivity: 'base',
      });
      return comparison * directionModifier;
    });
  }, [filteredMilitares, sortField, sortDirection]);

  if (!loadingUser && isAccessResolved && !canAccessModule('extracao_efetivo') && !canAccessAction('visualizar_extracao_efetivo')) {
    return <AccessDenied modulo="Extração do Efetivo" />;
  }

  const totalRetornado = militares.length;
  const totalFiltrado = filteredMilitares.length;
  const totalPaginasCarregadas = pages.length;
  const podeHaverMaisRegistros = Boolean(hasNextPage);
  const isInitialLoading = isLoading && totalRetornado === 0;
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
                <h1 className="text-2xl md:text-3xl font-bold text-[#1e3a5f]">Extração do Efetivo</h1>
                <p className="text-sm text-slate-500">Consulta inicial read-only baseada no escopo atual de acesso.</p>
              </div>
            </div>
          </div>
          <Badge variant="outline" className="w-fit border-blue-200 bg-blue-50 text-blue-700">
            <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Somente leitura
          </Badge>
        </div>

        <div className="rounded-xl border border-blue-100 bg-blue-50/80 p-4 text-sm text-blue-900 flex gap-3">
          <Info className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Módulo inicial com campos funcionais comuns.</p>
            <p>
              Esta versão não inclui dados sensíveis, exportação, seleção dinâmica de colunas ou cruzamentos com outros módulos.
              Dados sensíveis e análises combinadas serão tratados em lotes futuros.
            </p>
          </div>
        </div>

        {podeHaverMaisRegistros && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-900 flex gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">Listagem possivelmente parcial.</p>
              <p>
                Foram carregados {totalRetornado} registros do seu escopo em {totalPaginasCarregadas} lote(s). Pode haver mais registros ativos;
                use “Carregar mais” para ampliar a base antes de interpretar os filtros locais.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-slate-100 shadow-sm">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="rounded-xl bg-slate-100 p-3 text-slate-700">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Registros carregados</p>
                <p className="text-3xl font-bold text-slate-800">{totalRetornado}</p>
                <p className="text-xs text-slate-500">{totalPaginasCarregadas} lote(s) de até {BACKEND_LIMIT}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-100 shadow-sm">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="rounded-xl bg-emerald-100 p-3 text-emerald-700">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Após filtros locais</p>
                <p className="text-3xl font-bold text-slate-800">{totalFiltrado}</p>
                <p className="text-xs text-slate-500">Ordenados no navegador</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-100 shadow-sm">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="rounded-xl bg-amber-100 p-3 text-amber-700">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Pode haver mais registros?</p>
                <p className="text-3xl font-bold text-slate-800">{podeHaverMaisRegistros ? 'Sim' : 'Não'}</p>
                <p className="text-xs text-slate-500">Inferido pelo retorno paginado</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-100 shadow-sm">
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
              <div className="relative md:col-span-2 lg:col-span-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  className="pl-9"
                  placeholder="Buscar por campos funcionais..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>

              <Select value={postoGraduacaoFilter} onValueChange={setPostoGraduacaoFilter}>
                <SelectTrigger><SelectValue placeholder="Posto/graduação" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS_VALUE}>Todos os postos</SelectItem>
                  {filtrosDisponiveis.postos.map((posto) => (
                    <SelectItem key={posto} value={posto}>{posto}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={quadroFilter} onValueChange={setQuadroFilter}>
                <SelectTrigger><SelectValue placeholder="Quadro" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS_VALUE}>Todos os quadros</SelectItem>
                  {filtrosDisponiveis.quadros.map((quadro) => (
                    <SelectItem key={quadro} value={quadro}>{quadro}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS_VALUE}>Todos os status</SelectItem>
                  {filtrosDisponiveis.statuses.map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={lotacaoFilter} onValueChange={setLotacaoFilter}>
                <SelectTrigger><SelectValue placeholder="Lotação" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS_VALUE}>Todas as lotações</SelectItem>
                  {filtrosDisponiveis.lotacoes.map((lotacao) => (
                    <SelectItem key={lotacao} value={lotacao}>{lotacao}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortField} onValueChange={setSortField}>
                <SelectTrigger><SelectValue placeholder="Ordenar por" /></SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortDirection} onValueChange={setSortDirection}>
                <SelectTrigger><SelectValue placeholder="Direção" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Ascendente</SelectItem>
                  <SelectItem value="desc">Descendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {!shouldQuery ? (
          <Card className="border-slate-100 shadow-sm">
            <CardContent className="p-12 text-center text-slate-500">Resolvendo contexto de acesso para carregar a extração.</CardContent>
          </Card>
        ) : isInitialLoading ? (
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
                      : 'Ocorreu uma falha controlada ao consultar o efetivo escopado.'}
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={() => refetch()}>Tentar novamente</Button>
            </CardContent>
          </Card>
        ) : filteredMilitares.length === 0 ? (
          <Card className="border-slate-100 shadow-sm">
            <CardContent className="p-12 text-center">
              <Users className="w-14 h-14 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">Nenhum registro encontrado</h3>
              <p className="text-sm text-slate-500 mb-4">Ajuste os filtros ou carregue mais registros ativos do seu escopo.</p>
              <Button
                type="button"
                variant="outline"
                disabled={!podeHaverMaisRegistros || isFetchingNextPage}
                onClick={() => fetchNextPage()}
              >
                {isFetchingNextPage ? 'Carregando...' : 'Carregar mais'}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Posto/Graduação</th>
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
                  {sortedMilitares.map((militar) => (
                    <tr key={militar.id || `${militar.nome_completo}-${militar.matricula}`} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-semibold text-[#1e3a5f] whitespace-nowrap">{textoOuTraco(militar?.posto_graduacao)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{textoOuTraco(militar?.nome_guerra)}</td>
                      <td className="px-4 py-3 min-w-60">{textoOuTraco(militar?.nome_completo)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{textoOuTraco(militar?.matricula_atual || militar?.matricula)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{textoOuTraco(militar?.quadro)}</td>
                      <td className="px-4 py-3 min-w-56">{textoOuTraco(militar?.lotacao_funcional)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge className={`${statusBadgeClass[militar?.status_cadastro] || statusBadgeClass.Ativo} border`}>
                          {textoOuTraco(militar?.status_cadastro)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{textoOuTraco(militar?.situacao_militar)}</td>
                      <td className="px-4 py-3 min-w-44">{textoOuTraco(militar?.funcao)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-100 bg-slate-50 px-4 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-slate-600">
                <p className="font-medium text-slate-700">
                  {totalRetornado} carregado(s), {totalFiltrado} após filtros locais.
                </p>
                <p>
                  {podeHaverMaisRegistros
                    ? 'Ainda pode haver registros ativos não carregados dentro do seu escopo.'
                    : 'Não há indicação de registros adicionais no retorno paginado atual.'}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={!podeHaverMaisRegistros || isFetchingNextPage}
                onClick={() => fetchNextPage()}
              >
                {isFetchingNextPage ? 'Carregando...' : 'Carregar mais'}
              </Button>
            </div>
          </Card>
        )}

        {isFetching && !isInitialLoading && !isFetchingNextPage && (
          <p className="text-xs text-slate-500 text-right">Atualizando cache escopado...</p>
        )}
      </div>
    </div>
  );
}
