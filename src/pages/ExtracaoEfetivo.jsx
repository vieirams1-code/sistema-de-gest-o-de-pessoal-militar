import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
      busca: debouncedSearchTerm,
      postoGraduacao: postoGraduacaoFilter,
      quadro: quadroFilter,
      status: statusFilter,
      lotacao: lotacaoFilter,
    },
  ];

  const {
    data: militaresData,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey,
    enabled: shouldQuery,
    staleTime: STALE_TIME_MS,
    retry: 1,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { militares, meta } = await fetchScopedMilitares({
        statusCadastro: 'Ativo',
        limit: BACKEND_LIMIT,
        offset: 0,
        includeFoto: false,
      });

      return {
        militares: militares.map((militar) => ({
          ...militar,
          lotacao_funcional: getLotacaoLabel(militar),
        })),
        meta,
      };
    },
  });

  const militares = useMemo(() => militaresData?.militares || [], [militaresData]);

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

  if (!loadingUser && isAccessResolved && !canAccessModule('extracao_efetivo') && !canAccessAction('visualizar_extracao_efetivo')) {
    return <AccessDenied modulo="Extração do Efetivo" />;
  }

  const totalRetornado = militares.length;
  const totalFiltrado = filteredMilitares.length;
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

        <Card className="border-slate-100 shadow-sm">
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
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
            </div>
          </CardContent>
        </Card>

        {!shouldQuery ? (
          <Card className="border-slate-100 shadow-sm">
            <CardContent className="p-12 text-center text-slate-500">Resolvendo contexto de acesso para carregar a extração.</CardContent>
          </Card>
        ) : isLoading || isFetching ? (
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
              <p className="text-sm text-slate-500">Ajuste os filtros ou verifique se há militares ativos no seu escopo.</p>
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
                  {filteredMilitares.map((militar) => (
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
          </Card>
        )}
      </div>
    </div>
  );
}
