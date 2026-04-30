import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import HierarchicalLotacaoSelect from '@/components/militar/HierarchicalLotacaoSelect';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Eye, Pencil, Trash2, Users } from 'lucide-react';
import {
  carregarMilitaresComMatriculas,
  filtrarMilitaresOperacionais,
  getLotacaoAtualMilitar,
  militarCorrespondeBusca,
} from '@/services/matriculaMilitarViewService';
import { excluirMilitarComDependencias } from '@/services/militarExclusaoService';
import { fetchScopedMilitares, getEffectiveEmail } from '@/services/getScopedMilitaresClient';
import { fetchScopedLotacoes } from '@/services/getScopedLotacoesClient';
import DataDebugPanel from '@/components/debug/DataDebugPanel';
import { isQuadroComDestaque, normalizarQuadroLegado, QUADROS_FIXOS } from '@/utils/postoQuadroCompatibilidade';

const TODAS_LOTACOES_VALUE = '__todas_lotacoes__';
const BACKEND_LIMIT = 100;
const STALE_TIME_MS = 5 * 60 * 1000;

const TIPO_ORDEM = { root: 0, setor: 1, subsetor: 2, unidade: 3 };

function normalizeLotacaoType(item = {}) {
  const tipoRaw = String(item?.estrutura_tipo || item?.tipo || item?.subgrupamento_tipo || '').toLowerCase();
  if (tipoRaw.includes('setor') || tipoRaw.includes('grupamento')) return 'setor';
  if (tipoRaw.includes('subsetor') || tipoRaw.includes('subgrupamento')) return 'subsetor';
  if (tipoRaw.includes('unidade')) return 'unidade';

  if (!item?.parent_id && !item?.grupamento_id) return 'setor';
  return 'unidade';
}

function buildLotacoesTree(flatLotacoes = []) {
  const byId = new Map();

  flatLotacoes.forEach((item) => {
    const id = String(item?.id || '');
    if (!id) return;

    const nome = String(item?.nome || '').trim();
    const sigla = String(item?.sigla || '').trim();
    const tipo = normalizeLotacaoType(item);
    const subtitle = [sigla, tipo !== 'unidade' ? tipo.toUpperCase() : ''].filter(Boolean).join(' • ');

    const parentId = String(
      item?.parent_id
      || item?.setor_pai_id
      || item?.grupamento_id
      || item?.grupamento_raiz_id
      || ''
    ).trim();

    byId.set(id, {
      id,
      label: nome || sigla || id,
      subtitle: subtitle || undefined,
      type: tipo,
      parentId,
      children: [],
    });
  });

  const roots = [];
  byId.forEach((node) => {
    if (node.parentId && byId.has(node.parentId) && node.parentId !== node.id) {
      byId.get(node.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortNodes = (nodes) => {
    nodes.sort((a, b) => {
      const typeDiff = (TIPO_ORDEM[a.type] ?? 99) - (TIPO_ORDEM[b.type] ?? 99);
      if (typeDiff !== 0) return typeDiff;
      return a.label.localeCompare(b.label, 'pt-BR');
    });
    nodes.forEach((node) => sortNodes(node.children));
    return nodes;
  };

  return sortNodes(roots).map(({ parentId, ...node }) => node);
}

const statusBadgeClass = {
  Ativo: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Inativo: 'bg-slate-100 text-slate-700 border-slate-200',
  Reserva: 'bg-amber-100 text-amber-700 border-amber-200',
  Reforma: 'bg-blue-100 text-blue-700 border-blue-200',
  Falecido: 'bg-red-100 text-red-700 border-red-200',
};

const GRADUACAO_GROUPS = [
  { key: 'oficiais', label: 'Oficiais', postos: ['Coronel', 'Tenente Coronel', 'Tenente-Coronel', 'Major', 'Capitão', '1º Tenente', '2º Tenente', 'Aspirante'] },
  { key: 'sargentos', label: 'Sargentos', postos: ['Subtenente', '1º Sargento', '2º Sargento', '3º Sargento'] },
  { key: 'cabos', label: 'Cabos', postos: ['Cabo'] },
  { key: 'soldados', label: 'Soldados', postos: ['Soldado'] },
];

export default function Militares() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const {
    isAdmin,
    modoAcesso,
    userEmail,
    linkedMilitarEmail,
    canAccessModule,
    canAccessAction,
    isLoading: loadingUser,
    isAccessResolved,
  } = useCurrentUser();

  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('q') || '');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(() => searchParams.get('q') || '');
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [debouncedGroups, setDebouncedGroups] = useState([]);
  const [lotacaoFilter, setLotacaoFilter] = useState(TODAS_LOTACOES_VALUE);
  const [quadroFilter, setQuadroFilter] = useState('todos');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [militarToDelete, setMilitarToDelete] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedGroups(selectedGroups), 300);
    return () => clearTimeout(t);
  }, [selectedGroups]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchTerm(searchTerm.trim()), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const selectedPostos = useMemo(() => {
    const postos = GRADUACAO_GROUPS.filter((g) => debouncedGroups.includes(g.key)).flatMap((g) => g.postos);
    return [...new Set(postos)];
  }, [debouncedGroups]);

  const effectiveEmail = getEffectiveEmail();
  const shouldQuery = isAccessResolved;

  // ===================================================================
  // Lotações (filtro escopado) — via getScopedLotacoes
  // ===================================================================
  const shouldShowLotacaoFilter = isAdmin || ['setor', 'subsetor', 'unidade'].includes(modoAcesso);
  const lotacoesQueryKey = ['militares-lotacoes-scoped', effectiveEmail || 'self'];
  const {
    data: lotacoesData = { lotacoes: [], meta: {} },
    isLoading: isLoadingLotacoes,
    isError: isErrorLotacoes,
    error: lotacoesError,
    refetch: refetchLotacoes,
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
      .filter((item) => String(item?.id || '').trim() && String(item?.nome || '').trim());
  }, [lotacoesData]);

  const lotacoesTree = useMemo(() => {
    const lotacoesEstruturadas = buildLotacoesTree(lotacoesDisponiveis);
    return [{
      id: TODAS_LOTACOES_VALUE,
      label: 'Todas as lotações',
      subtitle: 'Escopo atual',
      type: 'root',
      children: lotacoesEstruturadas,
    }];
  }, [lotacoesDisponiveis]);

  const lotacoesDisponiveisIds = useMemo(
    () => new Set(lotacoesDisponiveis.map((item) => String(item.id))),
    [lotacoesDisponiveis],
  );

  useEffect(() => {
    if (lotacaoFilter === TODAS_LOTACOES_VALUE) return;
    if (lotacoesDisponiveisIds.has(String(lotacaoFilter))) return;
    setLotacaoFilter(TODAS_LOTACOES_VALUE);
  }, [lotacaoFilter, lotacoesDisponiveisIds]);

  // ===================================================================
  // Militares — via getScopedMilitares (sem fallback em loop)
  // ===================================================================
  const militaresQueryKey = [
    'militares-consulta-rapida-scoped',
    isAdmin,
    lotacaoFilter,
    selectedPostos.join('|'),
    quadroFilter,
    debouncedSearchTerm,
    effectiveEmail || 'self',
  ];

  const { data: militaresData, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: militaresQueryKey,
    enabled: shouldQuery,
    staleTime: STALE_TIME_MS,
    retry: 1,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const payload = {
        statusCadastro: 'Ativo',
        limit: BACKEND_LIMIT,
        offset: 0,
        includeFoto: false,
      };
      if (selectedPostos.length > 0) payload.postoGraduacaoFiltros = selectedPostos;
      if (debouncedSearchTerm) payload.search = debouncedSearchTerm;
      if (
        shouldShowLotacaoFilter
        && lotacaoFilter !== TODAS_LOTACOES_VALUE
        && lotacoesDisponiveisIds.has(String(lotacaoFilter))
      ) {
        payload.lotacaoFiltro = lotacaoFilter;
      }

      const { militares: lista, meta } = await fetchScopedMilitares(payload);
      const enriquecidos = await carregarMilitaresComMatriculas(lista);
      const comLotacao = enriquecidos.map((m) => ({ ...m, lotacao_atual: getLotacaoAtualMilitar(m) }));

      return {
        militares: comLotacao,
        meta,
        totalRetornado: comLotacao.length,
      };
    },
  });

  const militares = useMemo(() => militaresData?.militares || [], [militaresData]);
  const operacionais = filtrarMilitaresOperacionais(militares, { incluirInativos: true });
  const quadrosDisponiveis = useMemo(() => QUADROS_FIXOS.map((quadro) => ({ value: quadro, label: quadro })), []);

  const filteredMilitares = operacionais
    .filter((m) => {
      if (quadroFilter === 'todos') return true;
      return normalizarQuadroLegado(m?.quadro) === quadroFilter;
    })
    .filter((m) => militarCorrespondeBusca(m, searchTerm));

  const isLotacoesRateLimit = String(lotacoesError?.message || '').toLowerCase().includes('rate limit');
  const lotacoesEmptyForScopedUser = shouldShowLotacaoFilter && !isLoadingLotacoes && !isErrorLotacoes && lotacoesDisponiveis.length === 0;
  const shouldShowLotacoesDebugPanel = shouldShowLotacaoFilter && (isErrorLotacoes || lotacoesEmptyForScopedUser);

  const deleteMutation = useMutation({
    mutationFn: (id) => excluirMilitarComDependencias(id, { executadoPor: userEmail || '' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['militares-consulta-rapida-scoped'] });
      setDeleteDialogOpen(false);
      setMilitarToDelete(null);
    },
  });

  if (!loadingUser && isAccessResolved && !canAccessModule('militares')) {
    return <AccessDenied modulo="Efetivo" />;
  }

  const emptyInstruction = 'Ajuste os filtros para carregar o efetivo.';
  const isRateLimitError = String(error?.message || '').toLowerCase().includes('rate limit');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-[#1e3a5f]">Efetivo</h1>
            <p className="text-slate-500">Consulta rápida por lotação e graduação</p>
            <p className="text-xs text-slate-500 mt-1">
              Escopo atual: {isAdmin ? 'Administrador' : (linkedMilitarEmail || userEmail || 'Usuário')}
            </p>
          </div>
          {canAccessAction('adicionar_militares') && (
            <Button onClick={() => navigate(createPageUrl('CadastrarMilitar'))} className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white">
              <Plus className="w-5 h-5 mr-2" />Novo Militar
            </Button>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {GRADUACAO_GROUPS.map((group) => (
              <Button
                key={group.key}
                size="sm"
                variant={selectedGroups.includes(group.key) ? 'default' : 'outline'}
                onClick={() => setSelectedGroups((prev) =>
                  prev.includes(group.key) ? prev.filter((k) => k !== group.key) : [...prev, group.key]
                )}
                className={selectedGroups.includes(group.key) ? 'bg-[#1e3a5f]' : ''}
              >
                {group.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-col md:flex-row gap-3">
            {shouldShowLotacaoFilter && (
              <HierarchicalLotacaoSelect
                tree={lotacoesTree}
                value={lotacaoFilter}
                onChange={setLotacaoFilter}
                placeholder="Todas as lotações"
              />
            )}
            <Select value={quadroFilter} onValueChange={setQuadroFilter}>
              <SelectTrigger className="md:w-56">
                <SelectValue placeholder="Selecione um quadro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os quadros</SelectItem>
                {quadrosDisponiveis.map((quadro) => (
                  <SelectItem key={quadro.value} value={quadro.value}>{quadro.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Buscar nome ou matrícula..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {shouldShowLotacaoFilter && isErrorLotacoes && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 mb-4">
            <p className="text-sm font-medium">
              {isLotacoesRateLimit
                ? 'Rate limit excedido ao carregar lotações. Você ainda pode consultar por graduação.'
                : 'Não foi possível carregar lotações. Você ainda pode consultar por graduação.'}
            </p>
            <Button onClick={() => refetchLotacoes()} variant="outline" size="sm" className="mt-2">
              Tentar carregar lotações
            </Button>
          </div>
        )}

        {!shouldQuery ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center">
            <Users className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">{emptyInstruction}</h3>
          </div>
        ) : isLoading || isFetching ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
            {[...Array(6)].map((_, idx) => <div key={idx} className="h-10 bg-slate-100 animate-pulse rounded mb-2" />)}
          </div>
        ) : isError ? (
          <div className="bg-white rounded-xl shadow-sm border border-red-200 p-8 text-center">
            <h3 className="text-lg font-semibold text-slate-700 mb-2">Falha ao carregar dados</h3>
            <p className="text-sm text-slate-600 mb-4">
              {isRateLimitError
                ? 'Muitas requisições em pouco tempo. Aguarde alguns segundos e tente novamente.'
                : 'Não foi possível carregar os dados da consulta.'}
            </p>
            <Button onClick={() => refetch()} className="bg-[#1e3a5f] text-white">Tentar novamente</Button>
            <DataDebugPanel
              debugData={{
                pagina: 'Militares',
                erroPrincipal: error ? { message: error.message } : null,
                estagioProvavel: 'getScopedMilitares',
              }}
              className="text-left"
            />
          </div>
        ) : filteredMilitares.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center">
            <h3 className="text-lg font-semibold text-slate-700">Nenhum militar encontrado para os filtros selecionados.</h3>
            <DataDebugPanel
              debugData={{
                pagina: 'Militares',
                lotacaoFilter,
                selectedPostos,
                quadroFilter,
                debouncedSearchTerm,
                meta: militaresData?.meta || null,
                totalRetornado: militaresData?.totalRetornado || 0,
              }}
              className="text-left mt-4"
            />
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-semibold text-slate-500 border-b bg-slate-50">
              <div className="col-span-2">Graduação</div>
              <div className="col-span-3">Nome/Nome de guerra</div>
              <div className="col-span-2">Matrícula</div>
              <div className="col-span-1">Quadro</div>
              <div className="col-span-2">Lotação</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-1 text-right">Ações</div>
            </div>
            {filteredMilitares.map((militar) => {
              const destacarQuadro = isQuadroComDestaque(militar?.quadro);

              return (
                <div
                  key={militar.id}
                  className={`grid grid-cols-12 gap-2 px-3 py-2 border-b text-sm items-center ${destacarQuadro ? 'bg-amber-50 border-amber-100' : ''}`}
                >
                <div className="col-span-2 font-semibold text-[#1e3a5f]">{militar.posto_graduacao || 'Sem posto'}</div>
                <div className="col-span-3">
                  <div className="font-medium truncate">{militar.nome_guerra || militar.nome_completo}</div>
                  <div className="text-xs text-slate-500 truncate">{militar.nome_completo}</div>
                </div>
                <div className="col-span-2 truncate">{militar.matricula || '—'}</div>
                <div className="col-span-1 truncate">{militar.quadro || '—'}</div>
                <div className="col-span-2 truncate">{militar.lotacao_atual || 'Sem lotação'}</div>
                <div className="col-span-1">
                  <Badge className={`${statusBadgeClass[militar.status_cadastro] || statusBadgeClass.Ativo} border`}>
                    {militar.status_cadastro || 'Ativo'}
                  </Badge>
                </div>
                <div className="col-span-1 flex justify-end gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(createPageUrl('VerMilitar') + `?id=${militar.id}`)}>
                    <Eye className="w-4 h-4" />
                  </Button>
                  {canAccessAction('editar_militares') && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(createPageUrl('CadastrarMilitar') + `?id=${militar.id}`)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                  )}
                  {canAccessAction('excluir_militares') && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => { setMilitarToDelete(militar); setDeleteDialogOpen(true); }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                </div>
              );
            })}
          </div>
        )}

        {shouldShowLotacoesDebugPanel && (
          <DataDebugPanel
            debugData={{
              pagina: 'Militares',
              estagioProvavel: 'getScopedLotacoes',
              lotacoes: {
                isLoading: isLoadingLotacoes,
                isError: isErrorLotacoes,
                erro: lotacoesError ? { message: lotacoesError.message } : null,
                quantidadeRetornada: lotacoesDisponiveis.length,
                meta: lotacoesData?.meta || null,
                queryKey: lotacoesQueryKey,
              },
            }}
            className="text-left mt-4"
          />
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o militar {militarToDelete?.nome_completo}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => militarToDelete && deleteMutation.mutate(militarToDelete.id)} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
