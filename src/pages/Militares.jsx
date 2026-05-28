import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Plus, Search, Users, Filter, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  carregarMilitaresComMatriculas,
  filtrarMilitaresOperacionais,
  getLotacaoAtualMilitar,
} from '@/services/matriculaMilitarViewService';
import MultiSelectFiltro from '@/components/militar/MultiSelectFiltro';
import IconeCatalogo from '@/components/funcoes-tags/IconeCatalogo';
import MilitarConsultaRow from '@/components/militar/MilitarConsultaRow';
import { excluirMilitarComDependencias } from '@/services/militarExclusaoService';
import { fetchScopedMilitares, getEffectiveEmail } from '@/services/getScopedMilitaresClient';
import { fetchScopedLotacoes } from '@/services/getScopedLotacoesClient';
import { fetchPreviaAntiguidadeMilitares } from '@/services/getPreviaAntiguidadeMilitaresClient';
import DataDebugPanel from '@/components/debug/DataDebugPanel';
import PromocaoAtualModal from '@/components/antiguidade/PromocaoAtualModal';
import { QUADROS_FIXOS } from '@/utils/postoQuadroCompatibilidade';
import { getEmojisEfetivo } from '@/utils/funcoesTags/tagsCompactasEfetivo';
import { resolveTagVisual } from '@/utils/tags/tagPresenter';
import { APLICABILIDADE_TAG_MILITAR } from '@/utils/funcoesTags/militarTags';
import { buildFuncoesTagsScopeKey, funcoesTagsKeys } from '@/utils/funcoesTags/queryKeys';
import { getFuncaoMilitarId, getMilitarTagMilitarId, getMilitarTagTagId, isCatalogoAtivo } from '@/utils/funcoesTags/contratoCampos';
import { base44 } from '@/api/base44Client';
import MilitarTagsBulkPanel from '@/components/militar/MilitarTagsBulkPanel';
import SelectionActionBar from '@/components/shared/SelectionActionBar';
import { bulkMilitarFuncoesEscopado, bulkMilitarTagsEscopado } from '@/services/cudFuncoesTagsEscopadoClient';
import { BULK_TAGS_MAX_MILITARES, excedeLimiteMilitaresSelecionados, isErroDuplicidade, montarTagsPresentesNosSelecionados } from '@/utils/funcoesTags/militarTagsBulk';
import {
  CONSULTA_MILITAR_COLUNAS_GROUP_ORDER,
  CONSULTA_MILITAR_COLUNAS_STORAGE_KEY,
  getAllowedConsultaMilitarColumns,
} from '@/pages/consultaMilitar/consultaMilitarColumns';
import {
  applyColumnFilters,
  buildMultiselectOptionsByColumn,
  normalizeColumnFilters,
} from '@/pages/consultaMilitar/consultaMilitarFilters';
import { exportConsultaMilitarToPdf, exportConsultaMilitarToXlsx } from '@/pages/consultaMilitar/consultaMilitarExport';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { calcularPreviaAntiguidadeGeral } from '@/utils/antiguidade/calcularPreviaAntiguidadeGeral';
import { getPosicaoOficialAntiguidadeFromCache } from '@/utils/antiguidade/getPosicaoOficialAntiguidade';

const TODAS_LOTACOES_VALUE = '__todas_lotacoes__';
const PAGE_SIZE = 300;
const FRONTEND_PAGE_SIZE_OPTIONS = [25, 50, 100];
const DEFAULT_FRONTEND_PAGE_SIZE = 50;
const STALE_TIME_MS = 5 * 60 * 1000;
const VALOR_AUSENTE_ORDENACAO = Number.POSITIVE_INFINITY;

const CONSULTA_MILITAR_GRID_WIDTHS = {
  nome: 'minmax(300px, 1.6fr)',
  nome_completo: 'minmax(320px, 1.8fr)',
  nome_guerra: 'minmax(220px, 1.2fr)',
  posto_graduacao: '150px',
  graduacao: '150px',
  matricula: '130px',
  quadro: '130px',
  lotacao: 'minmax(200px, 1fr)',
  municipio: 'minmax(160px, 1fr)',
  cidade: 'minmax(160px, 1fr)',
  municipio_cidade: 'minmax(170px, 1fr)',
  email: 'minmax(230px, 1.2fr)',
  email_pessoal: 'minmax(230px, 1.2fr)',
  endereco: 'minmax(360px, 2fr)',
  logradouro: 'minmax(360px, 2fr)',
  situacao_militar: '130px',
  situacao_condicao_militar: '160px',
  status_cadastro: '130px',
  origem_destino: 'minmax(220px, 1fr)',
  obs: 'minmax(260px, 1.2fr)',
  observacao: 'minmax(260px, 1.2fr)',
  observacoes_administrativas: 'minmax(260px, 1.2fr)',
};
const WRAP_COLUMN_KEYS = new Set([
  'nome_completo',
  'endereco',
  'logradouro',
  'lotacao',
  'origem_destino',
  'obs',
  'observacao',
  'observacoes_administrativas',
]);
const DEFAULT_GRID_COLUMN_WIDTH = 'minmax(180px, 1fr)';
const SELECTION_COLUMN_WIDTH = '44px';
const ACTIONS_COLUMN_WIDTH = '140px';

const POSTOS_GRADUACOES_OPCOES = [
  { value: 'Coronel', label: 'Coronel' },
  { value: 'Tenente Coronel', label: 'Tenente Coronel' },
  { value: 'Major', label: 'Major' },
  { value: 'Capitão', label: 'Capitão' },
  { value: '1º Tenente', label: '1º Tenente' },
  { value: '2º Tenente', label: '2º Tenente' },
  { value: 'Aspirante', label: 'Aspirante' },
  { value: 'Subtenente', label: 'Subtenente' },
  { value: '1º Sargento', label: '1º Sargento' },
  { value: '2º Sargento', label: '2º Sargento' },
  { value: '3º Sargento', label: '3º Sargento' },
  { value: 'Cabo', label: 'Cabo' },
  { value: 'Soldado', label: 'Soldado' },
];

const SITUACOES_OPCOES = [
  { value: 'Ativa', label: 'Ativa' },
  { value: 'Designado', label: 'Designado' },
  { value: 'Convocado', label: 'Convocado' },
  { value: 'Reserva Remunerada', label: 'Reserva Remunerada' },
  { value: 'Reformado', label: 'Reformado' },
];

const CONDICOES_TODAS = '__todas_condicoes__';
const CONDICOES_OPCOES = ['Efetivo', 'Adido', 'Agregado', 'Cedido', 'À Disposição', 'LTIP'];

const MOVIMENTO_TODOS = 'todos';
const MOVIMENTO_OPCOES = [
  { value: MOVIMENTO_TODOS, label: 'Entradas e saídas' },
  { value: 'entrada', label: 'Somente entradas' },
  { value: 'saida', label: 'Somente saídas' },
];
const CONSULTA_MILITAR_COLUMN_FILTERS_STORAGE_KEY = 'consulta_militar_column_filters_v1';


const normalizeScopedId = (value) => {
  if (value === null || value === undefined) return value;
  if (typeof value === 'number') return value;
  const text = String(value).trim();
  if (!text) return text;
  if (/^-?\d+$/.test(text)) return Number(text);
  return text;
};


function normalizeVisibleColumns(rawValue, allowedColumns) {
  const validKeys = new Set((allowedColumns || []).map((col) => col.key));
  const defaultKeys = (allowedColumns || []).filter((col) => col.defaultVisible).map((col) => col.key);
  const fallbackColumnKey = allowedColumns?.[0]?.key || 'nome';
  const source = Array.isArray(rawValue) ? rawValue : defaultKeys;
  const normalized = source.filter((key, index) => validKeys.has(key) && source.indexOf(key) === index);
  if (normalized.length > 0) return normalized;
  return defaultKeys.length > 0 ? defaultKeys : [fallbackColumnKey];
}


export default function Militares() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const debugFieldsEnabled = searchParams.get('debugFields') === 'true';
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
  const [postosSelecionados, setPostosSelecionados] = useState([]);
  const [debouncedPostos, setDebouncedPostos] = useState([]);
  const [quadrosSelecionados, setQuadrosSelecionados] = useState([]);
  const [situacoesSelecionadas, setSituacoesSelecionadas] = useState([]);
  const [tagsSelecionadas, setTagsSelecionadas] = useState([]);
  const [gruposSelecionados, setGruposSelecionados] = useState([]);
  const [condicaoFilter, setCondicaoFilter] = useState(CONDICOES_TODAS);
  const [movimentoFilter, setMovimentoFilter] = useState(MOVIMENTO_TODOS);
  const [lotacaoFilter, setLotacaoFilter] = useState(TODAS_LOTACOES_VALUE);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [militarToDelete, setMilitarToDelete] = useState(null);
  const [militarPromocaoAtual, setMilitarPromocaoAtual] = useState(null);
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [pageOffset, setPageOffset] = useState(0);
  const [militaresAcumulados, setMilitaresAcumulados] = useState([]);
  const [selectedMilitarIds, setSelectedMilitarIds] = useState(new Set());
  const [bulkPanelOpen, setBulkPanelOpen] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [columnsDialogOpen, setColumnsDialogOpen] = useState(false);
  const allowedColumns = useMemo(
    () => getAllowedConsultaMilitarColumns({ userContext: { isAdmin, canAccessAction, modoAcesso } }),
    [isAdmin, canAccessAction, modoAcesso],
  );
  const [visibleColumnKeys, setVisibleColumnKeys] = useState([]);
  const [draftVisibleColumnKeys, setDraftVisibleColumnKeys] = useState([]);
  const previousColumnsDialogOpenRef = useRef(false);
  const [columnFilters, setColumnFilters] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [frontendPageSize, setFrontendPageSize] = useState(DEFAULT_FRONTEND_PAGE_SIZE);
  const { toast } = useToast();

  const allowedColumnKeysSignature = useMemo(
    () => allowedColumns.map((col) => col.key).join('|'),
    [allowedColumns],
  );

  useEffect(() => {
    try {
      const savedColumnsRaw = localStorage.getItem(CONSULTA_MILITAR_COLUNAS_STORAGE_KEY);
      const savedColumns = savedColumnsRaw ? JSON.parse(savedColumnsRaw) : null;
      setVisibleColumnKeys(normalizeVisibleColumns(savedColumns, allowedColumns));
    } catch {
      setVisibleColumnKeys(normalizeVisibleColumns(null, allowedColumns));
    }

    try {
      const savedFiltersRaw = localStorage.getItem(CONSULTA_MILITAR_COLUMN_FILTERS_STORAGE_KEY);
      const savedFilters = savedFiltersRaw ? JSON.parse(savedFiltersRaw) : {};
      setColumnFilters(normalizeColumnFilters(savedFilters, allowedColumns));
    } catch {
      setColumnFilters({});
    }
  }, [allowedColumnKeysSignature]);

  useEffect(() => {
    const wasOpen = previousColumnsDialogOpenRef.current;
    if (!wasOpen && columnsDialogOpen) {
      setDraftVisibleColumnKeys(normalizeVisibleColumns(visibleColumnKeys, allowedColumns));
    }
    previousColumnsDialogOpenRef.current = columnsDialogOpen;
  }, [columnsDialogOpen, visibleColumnKeys, allowedColumns]);

  useEffect(() => {
    localStorage.setItem(CONSULTA_MILITAR_COLUNAS_STORAGE_KEY, JSON.stringify(visibleColumnKeys));
  }, [visibleColumnKeys]);

  useEffect(() => {
    localStorage.setItem(CONSULTA_MILITAR_COLUMN_FILTERS_STORAGE_KEY, JSON.stringify(columnFilters));
  }, [columnFilters]);

  const columnMetaByKey = useMemo(() => new Map(allowedColumns.map((col) => [col.key, col])), [allowedColumns]);
  const getColumnClassName = useCallback((column, { isHeader = false } = {}) => {
    const align = column?.align === 'center' ? 'text-center' : 'text-left';
    const nowrap = column?.nowrap ? 'whitespace-nowrap' : '';
    const truncate = column?.truncate ? 'truncate' : '';
    const base = isHeader ? 'font-semibold text-slate-500' : '';
    return [align, nowrap, truncate, base].filter(Boolean).join(' ');
  }, []);
  const groupedColumns = useMemo(() => {
    const grouped = allowedColumns.reduce((acc, col) => {
      const group = col.group || 'Outros';
      acc[group] = acc[group] || [];
      acc[group].push(col);
      return acc;
    }, {});
    return CONSULTA_MILITAR_COLUNAS_GROUP_ORDER
      .map((group) => ({ group, columns: grouped[group] || [] }))
      .filter((item) => item.columns.length > 0);
  }, [allowedColumnKeysSignature]);
  const sanitizedVisibleColumnKeys = useMemo(() => normalizeVisibleColumns(visibleColumnKeys, allowedColumns), [visibleColumnKeys, allowedColumns]);
  const visibleColumnSet = useMemo(() => new Set(sanitizedVisibleColumnKeys), [sanitizedVisibleColumnKeys]);
  const militaresGridTemplate = useMemo(() => {
    const visibleWidths = sanitizedVisibleColumnKeys.map((key) => (
      CONSULTA_MILITAR_GRID_WIDTHS[key] || DEFAULT_GRID_COLUMN_WIDTH
    ));

    return [
      SELECTION_COLUMN_WIDTH,
      ...visibleWidths,
      ACTIONS_COLUMN_WIDTH,
    ].join(' ');
  }, [sanitizedVisibleColumnKeys]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedPostos(postosSelecionados), 300);
    return () => clearTimeout(t);
  }, [postosSelecionados]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchTerm(searchTerm.trim()), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const selectedPostos = debouncedPostos;

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

  // Árvore hierárquica de lotações vem pronta do backend (getScopedLotacoes).
  // Aqui apenas envelopamos com o nó raiz "Todas as lotações" usado pelo seletor.
  const lotacoesTree = useMemo(() => {
    const lotacoesEstruturadas = Array.isArray(lotacoesData?.lotacoesTree) ? lotacoesData.lotacoesTree : [];
    return [{
      id: TODAS_LOTACOES_VALUE,
      label: 'Todas as lotações',
      subtitle: 'Escopo atual',
      type: 'root',
      children: lotacoesEstruturadas,
    }];
  }, [lotacoesData]);

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
  const incluirInativos = isAdmin && mostrarInativos;

  // Filtros que são empurrados para o backend — quando mudam, reseta a paginação
  const backendFiltersKey = [
    isAdmin,
    debugFieldsEnabled ? 'debugFields' : 'noDebugFields',
    lotacaoFilter,
    selectedPostos.join('|'),
    quadrosSelecionados.join('|'),
    condicaoFilter,
    movimentoFilter,
    tagsSelecionadas.join('|'),
    gruposSelecionados.join('|'),
    situacoesSelecionadas.join('|'),
    debouncedSearchTerm,
    effectiveEmail || 'self',
    incluirInativos ? 'todos' : 'ativos',
  ].join('::');

  // Reset de paginação quando filtros de backend mudam
  useEffect(() => {
    setPageOffset(0);
    setMilitaresAcumulados([]);
  }, [backendFiltersKey]);

  const militaresQueryKey = [
    'militares-consulta-rapida-scoped',
    backendFiltersKey,
    pageOffset,
  ];

  const { data: militaresData, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: militaresQueryKey,
    enabled: shouldQuery,
    staleTime: STALE_TIME_MS,
    retry: 1,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const payload = {
        limit: PAGE_SIZE,
        offset: pageOffset,
        includeFoto: false,
        debugFields: debugFieldsEnabled,
      };
      if (!incluirInativos) {
        payload.statusCadastro = 'Ativo';
      }
      if (selectedPostos.length > 0) payload.postoGraduacaoFiltros = selectedPostos;
      if (quadrosSelecionados.length > 0) payload.quadrosFiltros = quadrosSelecionados;
      if (condicaoFilter && condicaoFilter !== CONDICOES_TODAS) payload.condicaoFiltro = condicaoFilter;
      if (movimentoFilter && movimentoFilter !== MOVIMENTO_TODOS) payload.movimentoFiltro = movimentoFilter;
      if (tagsSelecionadas.length > 0) payload.tagsIds = tagsSelecionadas.map(normalizeScopedId);
      if (gruposSelecionados.length > 0) payload.gruposIds = gruposSelecionados.map(normalizeScopedId);
      if (situacoesSelecionadas.length > 0) payload.situacaoMilitarFiltros = situacoesSelecionadas;
      if (debouncedSearchTerm) {
        // O mesmo termo digitado é avaliado pelo backend como busca (nome,
        // nome_guerra, matricula) e também como busca em origem/destino.
        // Mantém o comportamento OR anterior (client-side) sem onerar a UI.
        payload.search = debouncedSearchTerm;
        payload.origemDestinoBusca = debouncedSearchTerm;
      }
      if (
        shouldShowLotacaoFilter
        && lotacaoFilter !== TODAS_LOTACOES_VALUE
        && lotacoesDisponiveisIds.has(String(lotacaoFilter))
      ) {
        payload.lotacaoFiltro = lotacaoFilter;
      }

      const { militares: lista, meta } = await fetchScopedMilitares(payload);
      if (debugFieldsEnabled && typeof window !== 'undefined') {
        console.info('[ConsultaMilitar][debugFields] meta.debugFields:', meta?.debugFields || null);
      }
      const enriquecidos = await carregarMilitaresComMatriculas(lista);
      const comLotacao = enriquecidos.map((m) => ({ ...m, lotacao_atual: getLotacaoAtualMilitar(m) }));
      if (debugFieldsEnabled && typeof window !== 'undefined') {
        console.info('[ConsultaMilitar][debugFields] Object.keys(militaresAcumulados[0]):', Object.keys((comLotacao || [])[0] || {}));
      }

      return {
        militares: comLotacao,
        meta,
        totalRetornado: comLotacao.length,
      };
    },
  });

  // Acumula páginas conforme avança o offset (deduplica por id)
  useEffect(() => {
    if (!militaresData?.militares) return;
    setMilitaresAcumulados((prev) => {
      if (pageOffset === 0) return militaresData.militares;
      const mapa = new Map();
      prev.forEach((m) => m?.id && mapa.set(m.id, m));
      militaresData.militares.forEach((m) => m?.id && mapa.set(m.id, m));
      return Array.from(mapa.values());
    });
  }, [militaresData, pageOffset]);

  const hasMoreBackend = Boolean(militaresData?.meta?.hasMore);
  const carregarMais = () => {
    if (isFetching || !hasMoreBackend) return;
    setPageOffset((prev) => prev + PAGE_SIZE);
  };

  const militares = militaresAcumulados;
  const operacionais = useMemo(
    () => filtrarMilitaresOperacionais(militares, { incluirInativos }),
    [militares, incluirInativos],
  );
  const idsMilitaresCarregados = useMemo(
    () => operacionais.map((m) => String(m?.id || '')).filter(Boolean),
    [operacionais],
  );
  const idsHash = useMemo(() => idsMilitaresCarregados.join('|'), [idsMilitaresCarregados]);
  const cacheAntiguidade = getPosicaoOficialAntiguidadeFromCache(queryClient);
  const hasOrdemOficialAntiguidade = cacheAntiguidade.hasOrdemOficialAntiguidade;
  const { data: historicoPromocoesEfetivo = [] } = useQuery({
    queryKey: ['historico-promocao-militares-efetivo', effectiveEmail || 'self', idsHash],
    staleTime: STALE_TIME_MS,
    enabled: shouldQuery && !hasOrdemOficialAntiguidade && idsMilitaresCarregados.length > 0,
    queryFn: async () => {
      const { historicoPromocoes } = await fetchPreviaAntiguidadeMilitares({
        idsMilitares: idsMilitaresCarregados,
      });
      return historicoPromocoes;
    },
  });

  const ordemAntiguidadeMap = useMemo(() => {
    const { posicaoOficialByMilitarId } = cacheAntiguidade;
    if (hasOrdemOficialAntiguidade) return posicaoOficialByMilitarId;

    // Fallback read-only: usa o mesmo motor da Prévia Geral quando o cache oficial não estiver disponível.
    const previaAntiguidade = calcularPreviaAntiguidadeGeral({
      militares: operacionais,
      historicoPromocoes: historicoPromocoesEfetivo,
    });
    return new Map((previaAntiguidade?.itens || []).map((item) => [String(item?.militar_id || ''), Number(item?.posicao)]));
  }, [cacheAntiguidade, hasOrdemOficialAntiguidade, operacionais, historicoPromocoesEfetivo]);

  const funcoesTagsScopeKey = useMemo(
    () => buildFuncoesTagsScopeKey({ effectiveEmail, userEmail, modoAcesso, linkedMilitarId: linkedMilitarEmail }),
    [effectiveEmail, userEmail, modoAcesso, linkedMilitarEmail],
  );

  const { data: funcoesInstitucionais = [] } = useQuery({
    queryKey: funcoesTagsKeys.catalogo(funcoesTagsScopeKey, 'funcoes-institucionais'),
    staleTime: STALE_TIME_MS,
    enabled: shouldQuery,
    queryFn: async () => {
      const funcoes = await base44.entities.FuncaoMilitar.filter({ ativa: true }, 'prioridade_lista');
      return funcoes.filter((f) => ['comandante', 'subcomandante'].includes(String(f?.institucional_chave || '').toLowerCase()));
    },
  });

  const { data: funcoesAtivas = [] } = useQuery({
    queryKey: funcoesTagsKeys.catalogo(funcoesTagsScopeKey, 'funcoes'),
    staleTime: STALE_TIME_MS,
    enabled: shouldQuery,
    queryFn: () => base44.entities.FuncaoMilitar.filter({ ativa: true }, 'prioridade_lista'),
  });

  const { data: tagsAtivas = [] } = useQuery({
    queryKey: funcoesTagsKeys.catalogo(funcoesTagsScopeKey, 'tags'),
    staleTime: STALE_TIME_MS,
    enabled: shouldQuery,
    queryFn: async () => {
      const tags = await base44.entities.Tag.list('ordem_exibicao');
      return tags.filter((tag) => isCatalogoAtivo(tag) && APLICABILIDADE_TAG_MILITAR.has(String(tag?.aplicabilidade || '').toLowerCase()));
    },
  });

  const { data: gruposAtivos = [] } = useQuery({
    queryKey: funcoesTagsKeys.catalogo(funcoesTagsScopeKey, 'grupos'),
    staleTime: STALE_TIME_MS,
    enabled: shouldQuery,
    queryFn: async () => {
      const grupos = await base44.entities.TagGrupo.list('ordem_exibicao');
      return grupos.filter((grupo) => isCatalogoAtivo(grupo));
    },
  });

  const { data: vinculosFuncoesAtivosFiltros = [] } = useQuery({
    queryKey: funcoesTagsKeys.militaresFuncoesFiltros(funcoesTagsScopeKey, idsHash),
    staleTime: STALE_TIME_MS,
    enabled: shouldQuery && idsMilitaresCarregados.length > 0,
    queryFn: () => base44.entities.MilitarFuncao.filter({
      status: 'ativa',
      militar_id: { '$in': idsMilitaresCarregados },
    }),
  });

  const { data: vinculosTagsAtivosFiltros = [] } = useQuery({
    queryKey: funcoesTagsKeys.militaresTagsFiltros(funcoesTagsScopeKey, idsHash),
    staleTime: STALE_TIME_MS,
    enabled: shouldQuery && idsMilitaresCarregados.length > 0,
    queryFn: () => base44.entities.MilitarTag.filter({
      status: 'ativa',
      militar_id: { '$in': idsMilitaresCarregados },
    }),
  });

  const quadrosDisponiveis = useMemo(
    () => QUADROS_FIXOS.map((quadro) => ({ value: quadro, label: quadro })),
    [],
  );

  // Todos os filtros relevantes (quadro, condição, movimento, funções, tags,
  // grupos, situação militar, busca por nome/matrícula e busca por
  // origem/destino) são aplicados no backend (getScopedMilitares P1/P2).
  // Aqui não há mais filtragem client-side desses critérios — a página passa
  // a renderizar o conjunto operacional retornado pelo backend conforme a
  // paginação acumulada.
  const filteredMilitaresComFuncoesTags = operacionais;

  const filteredMilitares = useMemo(
    () => {
      const filtradosPorColuna = applyColumnFilters(filteredMilitaresComFuncoesTags, allowedColumns, columnFilters);

      const compararFallbackEstavel = (a, b) => {
        const nomeA = String(a?.nome || '').trim();
        const nomeB = String(b?.nome || '').trim();
        if (nomeA !== nomeB) return nomeA.localeCompare(nomeB, 'pt-BR', { numeric: true });

        const matriculaA = String(a?.matricula || '').trim();
        const matriculaB = String(b?.matricula || '').trim();
        if (matriculaA !== matriculaB) return matriculaA.localeCompare(matriculaB, 'pt-BR', { numeric: true });

        return String(a?.id || '').localeCompare(String(b?.id || ''), 'pt-BR', { numeric: true });
      };

      return filtradosPorColuna
        .map((militar, index) => ({ militar, index }))
        .sort((a, b) => {
          const posA = ordemAntiguidadeMap.get(String(a?.militar?.id || ''));
          const posB = ordemAntiguidadeMap.get(String(b?.militar?.id || ''));
          const ordemA = Number.isFinite(posA) ? posA : VALOR_AUSENTE_ORDENACAO;
          const ordemB = Number.isFinite(posB) ? posB : VALOR_AUSENTE_ORDENACAO;
          if (ordemA !== ordemB) return ordemA - ordemB;

          if (!Number.isFinite(posA) && !Number.isFinite(posB)) {
            return compararFallbackEstavel(a.militar, b.militar);
          }

          return a.index - b.index;
        })
        .map((item) => item.militar);
    },
    [filteredMilitaresComFuncoesTags, allowedColumns, columnFilters, ordemAntiguidadeMap],
  );
  const activeColumnFilterKeys = useMemo(() => Object.keys(normalizeColumnFilters(columnFilters, allowedColumns)), [columnFilters]);
  const hiddenColumnFilterKeys = useMemo(
    () => activeColumnFilterKeys.filter((key) => !visibleColumnSet.has(key)),
    [activeColumnFilterKeys, visibleColumnSet],
  );
  const hiddenColumnFilterCount = hiddenColumnFilterKeys.length;
  const hiddenColumnFilterLabels = useMemo(() => hiddenColumnFilterKeys
    .map((key) => columnMetaByKey.get(key)?.label || key), [hiddenColumnFilterKeys, columnMetaByKey]);
  const hasAnyColumnFilter = activeColumnFilterKeys.length > 0;
  const multiselectColumns = useMemo(() => allowedColumns
    .filter((column) => column.futureFilterType === 'multiselect'), [allowedColumns]);
  const columnFilterOptionsByKey = useMemo(
    () => buildMultiselectOptionsByColumn(filteredMilitaresComFuncoesTags, multiselectColumns),
    [filteredMilitaresComFuncoesTags, multiselectColumns],
  );
  const emojisEfetivoByMilitar = useMemo(() => {
    const mapa = new Map();
    filteredMilitares.forEach((militar) => {
      mapa.set(String(militar?.id || ''), getEmojisEfetivo({
        militarId: militar?.id,
        funcoesInstitucionais,
        vinculosFuncoesAtivos: vinculosFuncoesAtivosFiltros,
        tagsAtivas,
        vinculosTagsAtivos: vinculosTagsAtivosFiltros,
      }));
    });
    return mapa;
  }, [filteredMilitares, funcoesInstitucionais, vinculosFuncoesAtivosFiltros, tagsAtivas, vinculosTagsAtivosFiltros]);
  const idsFiltradosSet = useMemo(() => new Set(filteredMilitares.map((m) => String(m.id))), [filteredMilitares]);
  const selectedMilitaresBulk = useMemo(
    () => operacionais.filter((militar) => selectedMilitarIds.has(String(militar.id))),
    [operacionais, selectedMilitarIds],
  );

  const selectedMilitarIdsArray = useMemo(() => Array.from(selectedMilitarIds), [selectedMilitarIds]);
  const selectedMilitaresById = useMemo(
    () => new Map(operacionais.map((militar) => [String(militar?.id || ""), militar]).filter(([id]) => Boolean(id))),
    [operacionais],
  );
  const atualizarDraftColunas = (columnKey, shouldEnable) => {
    const validKeys = new Set((allowedColumns || []).map((col) => col.key));
    if (!validKeys.has(columnKey)) return;
    setDraftVisibleColumnKeys((prev) => {
      const base = Array.isArray(prev)
        ? prev.filter((key, index) => validKeys.has(key) && prev.indexOf(key) === index)
        : [];

      if (shouldEnable) {
        if (base.includes(columnKey)) return base;
        return [...base, columnKey];
      }

      if (!base.includes(columnKey)) return base;
      if (base.length <= 1) return base;
      return base.filter((key) => key !== columnKey);
    });
  };

  const totalPages = Math.max(1, Math.ceil(filteredMilitares.length / frontendPageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, [frontendPageSize, backendFiltersKey, debouncedSearchTerm, activeColumnFilterKeys.join('|')]);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const paginatedMilitares = useMemo(() => {
    const start = (currentPage - 1) * frontendPageSize;
    return filteredMilitares.slice(start, start + frontendPageSize);
  }, [filteredMilitares, currentPage, frontendPageSize]);

  const allFilteredSelected = paginatedMilitares.length > 0 && paginatedMilitares.every((m) => selectedMilitarIds.has(String(m.id)));
  const tagsPresentesSelecionados = useMemo(() => montarTagsPresentesNosSelecionados({
    selectedMilitarIds: selectedMilitarIdsArray,
    vinculosTagsAtivos: vinculosTagsAtivosFiltros,
    tagsAtivas,
  }), [selectedMilitarIdsArray, vinculosTagsAtivosFiltros, tagsAtivas]);
  const tagsStatusById = useMemo(() => {
    const totalSelecionados = selectedMilitarIdsArray.length;
    const mapa = {};
    (tagsAtivas || []).forEach((tag) => {
      const tagId = String(tag?.id || '');
      if (tagId) mapa[tagId] = 'none';
    });
    tagsPresentesSelecionados.forEach(({ tagId, presentes }) => {
      const key = String(tagId || '');
      if (!key) return;
      if (presentes >= totalSelecionados && totalSelecionados > 0) mapa[key] = 'all';
      else if (presentes > 0) mapa[key] = 'partial';
      else mapa[key] = 'none';
    });
    return mapa;
  }, [tagsAtivas, tagsPresentesSelecionados, selectedMilitarIdsArray.length]);

  const funcoesStatusById = useMemo(() => {
    const totalSelecionados = selectedMilitarIdsArray.length;
    const mapa = {};
    (funcoesAtivas || []).forEach((funcao) => {
      const funcaoId = String(funcao?.id || '');
      if (funcaoId) mapa[funcaoId] = 'none';
    });

    const selectedSet = new Set(selectedMilitarIdsArray.map(String));
    const contadorPorFuncao = new Map();

    (vinculosFuncoesAtivosFiltros || []).forEach((vinculo) => {
      const militarId = String(vinculo?.militar_id || '');
      const funcaoId = String(getFuncaoMilitarId(vinculo) || '');
      if (!militarId || !funcaoId || !selectedSet.has(militarId)) return;
      contadorPorFuncao.set(funcaoId, (contadorPorFuncao.get(funcaoId) || 0) + 1);
    });

    contadorPorFuncao.forEach((presentes, funcaoId) => {
      if (presentes >= totalSelecionados && totalSelecionados > 0) mapa[funcaoId] = 'all';
      else if (presentes > 0) mapa[funcaoId] = 'partial';
      else mapa[funcaoId] = 'none';
    });

    return mapa;
  }, [funcoesAtivas, selectedMilitarIdsArray, vinculosFuncoesAtivosFiltros]);

  useEffect(() => {
    setSelectedMilitarIds((prev) => {
      const next = new Set(Array.from(prev).filter((id) => idsFiltradosSet.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [idsFiltradosSet]);

  const executarBulk = async ({ finalSelectedTagIds, finalSelectedFuncaoIds, motivo }) => {
    if (bulkSaving) return;

    if (excedeLimiteMilitaresSelecionados(selectedMilitarIds.size)) {
      toast({ title: 'Limite excedido', description: `Selecione no máximo ${BULK_TAGS_MAX_MILITARES} militares nesta versão inicial.`, variant: 'destructive' });
      return;
    }

    const hoje = new Date().toISOString().slice(0, 10);
    const selectedMilitarSet = new Set(selectedMilitarIdsArray.map(String));
    const desejadasSet = new Set((finalSelectedTagIds || []).map(String));
    const vinculosTagsSelecionados = (vinculosTagsAtivosFiltros || []).filter((v) => selectedMilitarSet.has(String(getMilitarTagMilitarId(v) || '')));
    const ativosTagsSet = new Set(vinculosTagsSelecionados.map((v) => `${String(getMilitarTagMilitarId(v) || '')}::${String(getMilitarTagTagId(v) || '')}`));
    const paraCriar = [];

    selectedMilitarIdsArray.forEach((militarId) => {
      const militarOriginalId = selectedMilitaresById.get(String(militarId))?.id ?? militarId;
      desejadasSet.forEach((tagId) => {
        const chave = `${String(militarId)}::${String(tagId)}`;
        if (!ativosTagsSet.has(chave)) paraCriar.push({ militar_id: normalizeScopedId(militarOriginalId), tag_id: normalizeScopedId(tagId) });
      });
    });

    const paraRemover = vinculosTagsSelecionados.filter((v) => !desejadasSet.has(String(getMilitarTagTagId(v) || '')));

    const desejadasFuncoesSet = new Set((finalSelectedFuncaoIds || []).map(String));
    const vinculosFuncoesSelecionados = (vinculosFuncoesAtivosFiltros || []).filter((v) => selectedMilitarSet.has(String(v?.militar_id || '')));
    const ativosFuncoesSet = new Set(vinculosFuncoesSelecionados.map((v) => `${String(v?.militar_id || '')}::${String(getFuncaoMilitarId(v) || '')}`));
    const deltaFuncoesCriar = [];

    selectedMilitarIdsArray.forEach((militarId) => {
      const militarOriginalId = selectedMilitaresById.get(String(militarId))?.id ?? militarId;
      desejadasFuncoesSet.forEach((funcaoId) => {
        const chave = `${String(militarId)}::${String(funcaoId)}`;
        if (!ativosFuncoesSet.has(chave)) deltaFuncoesCriar.push({ militar_id: normalizeScopedId(militarOriginalId), funcao_militar_id: normalizeScopedId(funcaoId) });
      });
    });

    const deltaFuncoesRemover = vinculosFuncoesSelecionados.filter((v) => !desejadasFuncoesSet.has(String(getFuncaoMilitarId(v) || '')));

    if (paraCriar.length === 0 && paraRemover.length === 0 && deltaFuncoesCriar.length === 0 && deltaFuncoesRemover.length === 0) {
      setBulkPanelOpen(false);
      toast({ title: 'Nenhuma alteração para salvar.' });
      return;
    }

    setBulkSaving(true);

    let aplicadas = 0;
    let removidas = 0;
    let funcoesCriadas = 0;
    let funcoesEncerradas = 0;
    let erros = 0;

    try {
      // Funções — UMA chamada bulk (aplicar + encerrar)
      const itensFuncoes = [
        ...deltaFuncoesCriar.map((it) => ({ acao: 'aplicar', militar_id: it.militar_id, funcao_militar_id: it.funcao_militar_id, motivo: motivo || undefined, data: hoje })),
        ...deltaFuncoesRemover.map((v) => ({ acao: 'encerrar', id: v.id, militar_id: v.militar_id, funcao_militar_id: getFuncaoMilitarId(v), motivo: motivo || undefined, data: hoje })),
      ];
      if (itensFuncoes.length > 0) {
        const resFn = await bulkMilitarFuncoesEscopado(itensFuncoes);
        (resFn?.resultados || []).forEach((r) => {
          if (r.ok && r.acao === 'aplicar' && !r.skipped) funcoesCriadas += 1;
          else if (r.ok && r.acao === 'encerrar' && !r.skipped) funcoesEncerradas += 1;
          else if (!r.ok && !isErroDuplicidade({ message: r.error })) erros += 1;
        });
      }

      // Tags — UMA chamada bulk (aplicar + remover)
      const itensTags = [
        ...paraCriar.map((it) => ({ acao: 'aplicar', militar_id: it.militar_id, tag_id: it.tag_id, motivo: motivo || undefined, data: hoje })),
        ...paraRemover.map((v) => ({ acao: 'remover', id: v.id, militar_id: v.militar_id, tag_id: getMilitarTagTagId(v), motivo: motivo || undefined, data: hoje })),
      ];
      if (itensTags.length > 0) {
        const resTag = await bulkMilitarTagsEscopado(itensTags);
        (resTag?.resultados || []).forEach((r) => {
          if (r.ok && r.acao === 'aplicar' && !r.skipped) aplicadas += 1;
          else if (r.ok && r.acao === 'remover' && !r.skipped) removidas += 1;
          else if (!r.ok && !isErroDuplicidade({ message: r.error })) erros += 1;
        });
      }

      setSelectedMilitarIds(new Set());
      setBulkPanelOpen(false);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: funcoesTagsKeys.militaresFuncoesFiltros(funcoesTagsScopeKey, idsHash) }),
        queryClient.invalidateQueries({ queryKey: funcoesTagsKeys.militaresTagsFiltros(funcoesTagsScopeKey, idsHash) }),
        queryClient.invalidateQueries({ queryKey: funcoesTagsKeys.catalogo(funcoesTagsScopeKey, 'tags') }),
        queryClient.invalidateQueries({ queryKey: funcoesTagsKeys.catalogo(funcoesTagsScopeKey, 'grupos') }),
        queryClient.invalidateQueries({ queryKey: ['militares-consulta-rapida-scoped'] }),
      ]);

      toast({
        title: 'Funções e tags atualizadas com sucesso.',
        description: `${funcoesCriadas} função(ões) criada(s), ${funcoesEncerradas} função(ões) encerrada(s), ${aplicadas} tag(s) adicionada(s), ${removidas} tag(s) removida(s).`,
        variant: erros > 0 ? 'destructive' : 'default',
      });
    } finally {
      setBulkSaving(false);
    }
  };


  const filteredSelectedMilitares = useMemo(
    () => filteredMilitares.filter((militar) => selectedMilitarIds.has(String(militar.id))),
    [filteredMilitares, selectedMilitarIds],
  );

  // Handlers estáveis para a lista virtualizada (evita re-render desnecessário das linhas)
  const handleToggleRowSelection = useCallback((id, checked) => {
    setSelectedMilitarIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  const handleAskDeleteRow = useCallback((militar) => {
    setMilitarToDelete(militar);
    setDeleteDialogOpen(true);
  }, []);
  const handlePromocaoAtualRow = useCallback((militar) => {
    setMilitarPromocaoAtual(militar);
  }, []);

  const handleExportExcel = ({ mode }) => {
    const isSelectedMode = mode === 'selected';
    const militaresParaExportar = isSelectedMode ? filteredSelectedMilitares : filteredMilitares;
    if (militaresParaExportar.length === 0) return;
    try {
      const fileDate = new Date().toISOString().slice(0, 10);
      exportConsultaMilitarToXlsx({
        militares: militaresParaExportar,
        visibleColumns: sanitizedVisibleColumnKeys,
        columnsCatalog: allowedColumns,
        fileName: isSelectedMode
          ? `consulta-militar-selecionados-${fileDate}.xlsx`
          : `consulta-militar-filtrados-${fileDate}.xlsx`,
      });
      toast({
        title: 'Exportação concluída',
        description: isSelectedMode
          ? 'Arquivo Excel dos militares selecionados gerado com sucesso.'
          : 'Arquivo Excel dos militares filtrados gerado com sucesso.',
      });
    } catch {
      toast({ title: 'Erro na exportação', description: 'Não foi possível gerar o arquivo Excel.', variant: 'destructive' });
    }
  };



  const handleExportPdf = ({ mode }) => {
    const isSelectedMode = mode === 'selected';
    const militaresParaExportar = isSelectedMode ? filteredSelectedMilitares : filteredMilitares;
    if (militaresParaExportar.length === 0) return;
    try {
      const fileDate = new Date().toISOString().slice(0, 10);
      exportConsultaMilitarToPdf({
        militares: militaresParaExportar,
        visibleColumns: sanitizedVisibleColumnKeys,
        columnsCatalog: allowedColumns,
        subtitle: isSelectedMode ? 'Selecionados' : 'Filtrados',
        fileName: isSelectedMode
          ? `consulta-militar-selecionados-${fileDate}.pdf`
          : `consulta-militar-filtrados-${fileDate}.pdf`,
      });
      toast({
        title: 'Exportação concluída',
        description: isSelectedMode
          ? 'Arquivo PDF dos militares selecionados gerado com sucesso.'
          : 'Arquivo PDF dos militares filtrados gerado com sucesso.',
      });
    } catch {
      toast({ title: 'Erro na exportação', description: 'Não foi possível gerar o arquivo PDF.', variant: 'destructive' });
    }
  };
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
      <div className="w-full px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-[#1e3a5f]">Efetivo</h1>
            <p className="text-slate-500">Consulta rápida por lotação e graduação</p>
            <p className="text-xs text-slate-500 mt-1">
              Escopo atual: {isAdmin ? 'Administrador' : (linkedMilitarEmail || userEmail || 'Usuário')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setColumnFilters({})}
              disabled={!hasAnyColumnFilter}
            >
              Limpar filtros de colunas
            </Button>
            <Button variant="outline" onClick={() => setColumnsDialogOpen(true)}>
              Colunas ({sanitizedVisibleColumnKeys.length}/{allowedColumns.length})
            </Button>
            <TooltipProvider delayDuration={120}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" disabled={filteredMilitares.length === 0}>
                        <FileSpreadsheet className="w-4 h-4 mr-2" />
                        Exportar Excel
                        <ChevronDown className="w-4 h-4 ml-2" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      <DropdownMenuItem
                        disabled={filteredSelectedMilitares.length === 0}
                        onClick={() => handleExportExcel({ mode: 'selected' })}
                      >
                        Exportar selecionados ({filteredSelectedMilitares.length})
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExportExcel({ mode: 'filtered' })}>
                        Exportar filtrados ({filteredMilitares.length})
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TooltipTrigger>
                <TooltipContent className="max-w-[280px] text-xs">
                  Exporta apenas militares carregados, conforme colunas visíveis e permissões atuais.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={filteredMilitares.length === 0}>
                  <FileText className="w-4 h-4 mr-2" />
                  Exportar PDF
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuItem
                  disabled={filteredSelectedMilitares.length === 0}
                  onClick={() => handleExportPdf({ mode: 'selected' })}
                >
                  Exportar selecionados ({filteredSelectedMilitares.length})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportPdf({ mode: 'filtered' })}>
                  Exportar filtrados ({filteredMilitares.length})
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {canAccessAction('adicionar_militares') && (
              <Button onClick={() => navigate(createPageUrl('CadastrarMilitar'))} className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white">
                <Plus className="w-5 h-5 mr-2" />Novo Militar
              </Button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {shouldShowLotacaoFilter && (
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Lotação</label>
                <HierarchicalLotacaoSelect
                  tree={lotacoesTree}
                  value={lotacaoFilter}
                  onChange={setLotacaoFilter}
                  placeholder="Todas as lotações"
                />
              </div>
            )}
            <MultiSelectFiltro
              label="Postos/Graduações"
              placeholder="Todos"
              options={POSTOS_GRADUACOES_OPCOES}
              value={postosSelecionados}
              onChange={setPostosSelecionados}
              triggerClassName="w-full"
            />
            <MultiSelectFiltro
              label="Quadros"
              placeholder="Todos"
              options={quadrosDisponiveis}
              value={quadrosSelecionados}
              onChange={setQuadrosSelecionados}
              triggerClassName="w-full"
            />
            <MultiSelectFiltro
              label="Situação Militar"
              placeholder="Todas"
              options={SITUACOES_OPCOES}
              value={situacoesSelecionadas}
              onChange={setSituacoesSelecionadas}
              triggerClassName="w-full"
            />
            <MultiSelectFiltro
              label="Tags"
              placeholder="Todas"
              options={tagsAtivas.map((tag) => ({
                value: String(tag.id),
                labelText: `${resolveTagVisual(tag).nome}`,
                label: <span className="inline-flex items-center gap-1"><IconeCatalogo value={resolveTagVisual(tag).emoji} />{resolveTagVisual(tag).nome}</span>,
              }))}
              value={tagsSelecionadas}
              onChange={setTagsSelecionadas}
              triggerClassName="w-full"
            />
            <MultiSelectFiltro
              label="Grupos de tags"
              placeholder="Todos"
              options={gruposAtivos.map((grupo) => ({
                value: String(grupo.id),
                label: `${grupo.emoji || '🗂️'} ${grupo.nome}`,
              }))}
              value={gruposSelecionados}
              onChange={setGruposSelecionados}
              triggerClassName="w-full"
            />
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Condição</label>
              <Select value={condicaoFilter} onValueChange={setCondicaoFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CONDICOES_TODAS}>Todas</SelectItem>
                  {CONDICOES_OPCOES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Movimento</label>
              <Select value={movimentoFilter} onValueChange={setMovimentoFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MOVIMENTO_OPCOES.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col md:flex-row gap-3 items-end">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Buscar nome, matrícula, origem ou destino..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {isAdmin && (
              <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none whitespace-nowrap">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-[#1e3a5f] focus:ring-[#1e3a5f]"
                  checked={mostrarInativos}
                  onChange={(e) => setMostrarInativos(e.target.checked)}
                />
                Mostrar militares inativos
              </label>
            )}
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
        ) : isLoading || (isFetching && pageOffset === 0 && militaresAcumulados.length === 0) ? (
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
                quadrosSelecionados,
                situacoesSelecionadas,
                condicaoFilter,
                movimentoFilter,
                debouncedSearchTerm,
                meta: militaresData?.meta || null,
                totalRetornado: militaresData?.totalRetornado || 0,
              }}
              className="text-left mt-4"
            />
          </div>
        ) : (
          <TooltipProvider delayDuration={120}>
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-3 py-2 border-b bg-slate-50 flex flex-wrap items-center gap-3 justify-between">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedMilitarIds((prev) => new Set([...prev, ...paginatedMilitares.map((m) => String(m.id))]));
                    else setSelectedMilitarIds(new Set());
                  }}
                />
                <span>Selecionar visíveis</span>
              </label>
            </div>
            {selectedMilitarIds.size > 0 && (
              <SelectionActionBar
                count={selectedMilitarIds.size}
                label="militares selecionados"
                helperText="Ação aplicada apenas aos militares selecionados nesta tela."
                onManageTags={() => setBulkPanelOpen(true)}
                onClear={() => setSelectedMilitarIds(new Set())}
              />
            )}
            <div className="overflow-x-auto">
              <div
                className="grid min-w-full items-center border-b bg-slate-50 text-xs font-medium text-slate-600"
                style={{ gridTemplateColumns: militaresGridTemplate }}
              >
                <div className="min-w-0 px-2 py-2" />
                {sanitizedVisibleColumnKeys.map((key) => {
                const column = columnMetaByKey.get(key);
                const filterType = column?.futureFilterType;
                const currentFilter = columnFilters[key];
                const isFilterActive = Boolean(
                  (currentFilter?.type === 'text' && String(currentFilter?.text || '').trim())
                  || (currentFilter?.type === 'multiselect' && Array.isArray(currentFilter?.selected) && currentFilter.selected.length > 0),
                );
                const multiselectOptions = columnFilterOptionsByKey.get(key) || [];
                  return (
                    <div key={key} className={`min-w-0 px-2 py-2 ${getColumnClassName(column, { isHeader: true })}`}>
                      <div className="flex items-center gap-1 min-w-0">
                    <span className="truncate">{column?.label || key}</span>
                    {filterType && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button type="button" className={`rounded p-1 hover:bg-slate-200 ${isFilterActive ? 'text-blue-700' : 'text-slate-400'}`}>
                            <Filter className="w-3.5 h-3.5" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-3 space-y-2" align="start">
                          <p className="text-xs font-semibold text-slate-700">{column?.label}</p>
                          {filterType === 'text' && (
                            <>
                              <Input
                                value={currentFilter?.type === 'text' ? currentFilter.text : ''}
                                onChange={(e) => {
                                  const text = e.target.value;
                                  setColumnFilters((prev) => normalizeColumnFilters({
                                    ...prev,
                                    [key]: { type: 'text', text },
                                  }, allowedColumns));
                                }}
                                placeholder="Filtrar..."
                                className="h-8 text-xs"
                              />
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => {
                                setColumnFilters((prev) => {
                                  const next = { ...prev };
                                  delete next[key];
                                  return normalizeColumnFilters(next, allowedColumns);
                                });
                              }}>Limpar</Button>
                            </>
                          )}
                          {filterType === 'multiselect' && (
                            <>
                              <div className="max-h-48 overflow-auto space-y-1">
                                {multiselectOptions.map((option) => {
                                  const selected = currentFilter?.type === 'multiselect' && currentFilter.selected?.includes(option);
                                  return (
                                    <label key={option} className="flex items-center gap-2 text-xs text-slate-700">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(selected)}
                                        onChange={(e) => {
                                          const current = currentFilter?.type === 'multiselect' ? currentFilter.selected || [] : [];
                                          const nextSelected = e.target.checked
                                            ? [...current, option]
                                            : current.filter((item) => item !== option);
                                          setColumnFilters((prev) => normalizeColumnFilters({
                                            ...prev,
                                            [key]: { type: 'multiselect', selected: nextSelected },
                                          }, allowedColumns));
                                        }}
                                      />
                                      <span className="truncate">{option}</span>
                                    </label>
                                  );
                                })}
                              </div>
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => {
                                setColumnFilters((prev) => {
                                  const next = { ...prev };
                                  delete next[key];
                                  return normalizeColumnFilters(next, allowedColumns);
                                });
                              }}>Limpar</Button>
                            </>
                          )}
                        </PopoverContent>
                      </Popover>
                    )}
                      </div>
                    </div>
                  );
                })}
                <div className="min-w-0 bg-slate-50 px-2 py-2 text-right font-semibold text-slate-500">
                  Ações
                </div>
              </div>
            {hiddenColumnFilterCount > 0 && (
              <div className="px-3 py-2 border-b bg-amber-50 text-xs text-amber-800 flex flex-wrap items-center gap-3 justify-between">
                <div>
                  <p className="font-medium">Filtros ativos em:</p>
                  <ul className="list-disc list-inside">
                    {hiddenColumnFilterLabels.map((label) => <li key={label}>{label}</li>)}
                  </ul>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="h-7" onClick={() => setColumnsDialogOpen(true)}>Mostrar colunas</Button>
                  <Button size="sm" variant="ghost" className="h-7" onClick={() => {
                    setColumnFilters((prev) => {
                      const next = { ...prev };
                      hiddenColumnFilterKeys.forEach((key) => {
                        delete next[key];
                      });
                      return normalizeColumnFilters(next, allowedColumns);
                    });
                  }}>Limpar filtros ocultos</Button>
                </div>
              </div>
            )}
              {paginatedMilitares.map((militar) => (
                <MilitarConsultaRow
                  key={militar.id}
                  militar={militar}
                  militaresGridTemplate={militaresGridTemplate}
                  sanitizedVisibleColumnKeys={sanitizedVisibleColumnKeys}
                  columnMetaByKey={columnMetaByKey}
                  getColumnClassName={getColumnClassName}
                  emojisEfetivoByMilitar={emojisEfetivoByMilitar}
                  isSelected={selectedMilitarIds.has(String(militar.id))}
                  onToggleSelection={handleToggleRowSelection}
                  isAdmin={isAdmin}
                  canAccessAction={canAccessAction}
                  onPromocaoAtual={handlePromocaoAtualRow}
                  onAskDelete={handleAskDeleteRow}
                />
              ))}
            </div>
            <div className="px-3 py-3 flex flex-col gap-3 border-t bg-slate-50/60">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <p className="text-xs text-slate-600">
                  Exibindo <span className="font-semibold text-slate-800">{paginatedMilitares.length}</span> de <span className="font-semibold text-slate-800">{filteredMilitares.length}</span> filtrados
                  {filteredMilitares.length !== militares.length && (
                    <> • <span className="font-semibold text-slate-800">{militares.length}</span> carregados</>
                  )}
                  {hasMoreBackend && (
                    <span className="ml-1 text-amber-700">• há mais resultados não carregados</span>
                  )}
                </p>
                {hasMoreBackend && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={carregarMais}
                    disabled={isFetching}
                    className="border-[#1e3a5f] text-[#1e3a5f] hover:bg-[#1e3a5f] hover:text-white"
                  >
                    {isFetching ? 'Carregando…' : 'Carregar mais militares'}
                  </Button>
                )}
              </div>
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span>Militares por página</span>
                  <Select value={String(frontendPageSize)} onValueChange={(value) => setFrontendPageSize(Number(value))}>
                    <SelectTrigger className="h-8 w-[90px] bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FRONTEND_PAGE_SIZE_OPTIONS.map((size) => (
                        <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 self-end md:self-auto">
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))} disabled={currentPage <= 1}>Anterior</Button>
                  <span className="text-xs text-slate-600">Página <span className="font-semibold text-slate-800">{currentPage}</span> de <span className="font-semibold text-slate-800">{totalPages}</span></span>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))} disabled={currentPage >= totalPages}>Próxima</Button>
                </div>
              </div>
            </div>
          </div>
          </TooltipProvider>
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

      <PromocaoAtualModal
        open={Boolean(militarPromocaoAtual)}
        onOpenChange={(open) => { if (!open) setMilitarPromocaoAtual(null); }}
        militar={militarPromocaoAtual}
      />
      <MilitarTagsBulkPanel
        open={bulkPanelOpen}
        onClose={() => setBulkPanelOpen(false)}
        selectedCount={selectedMilitarIds.size}
        selectedMilitares={selectedMilitaresBulk}
        tagsAtivas={tagsAtivas}
        gruposAtivos={gruposAtivos}
        tagsStatusById={tagsStatusById}
        funcoesAtivas={funcoesAtivas}
        funcoesStatusById={funcoesStatusById}
        vinculosTagsAtivos={vinculosTagsAtivosFiltros}
        onConfirm={({ finalSelectedTagIds, finalSelectedFuncaoIds, motivo }) => executarBulk({ finalSelectedTagIds, finalSelectedFuncaoIds, motivo })}
        saving={bulkSaving}
      />

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

      <AlertDialog open={columnsDialogOpen} onOpenChange={(open) => {
        setColumnsDialogOpen(open);
        if (!open) setDraftVisibleColumnKeys([]);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Colunas da Consulta Militar</AlertDialogTitle>
            <AlertDialogDescription>Escolha as colunas visíveis na tabela. Mantenha pelo menos uma selecionada.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-80 overflow-auto rounded-md border border-slate-200 p-3 text-sm text-slate-700 space-y-3">
            {groupedColumns.map(({ group, columns }) => (
              <div key={group}>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">{group}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {columns.map((coluna) => {
                    const isChecked = draftVisibleColumnKeys.includes(coluna.key);
                    return (
                      <label key={coluna.key} className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => atualizarDraftColunas(coluna.key, e.target.checked)}
                        />
                        <span>{coluna.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDraftVisibleColumnKeys([])}>Cancelar</AlertDialogCancel>
            <Button type="button" variant="outline" onClick={() => setDraftVisibleColumnKeys(normalizeVisibleColumns(null, allowedColumns))}>Restaurar padrão</Button>
            <AlertDialogAction onClick={() => setVisibleColumnKeys(normalizeVisibleColumns(draftVisibleColumnKeys, allowedColumns))}>Aplicar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
