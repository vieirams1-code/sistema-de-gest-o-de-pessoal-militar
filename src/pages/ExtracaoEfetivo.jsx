import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Database,
  Download,
  FileSearch,
  FileText,
  Info,
  ListChecks,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';

import AccessDenied from '@/components/auth/AccessDenied';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
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
  EXTRACAO_EFETIVO_FIELDS,
  getLotacaoNomeEfetivo,
  getPrimeiroValorEfetivo,
  getQuadroEfetivo,
  getValorCampoEfetivo,
} from '@/pages/extracaoEfetivo/catalogoCamposEfetivo';
import { QUADROS_FIXOS } from '@/utils/postoQuadroCompatibilidade';
import { exportarRegistrosParaExcel } from '@/utils/indicadosExcelExport';
import { base44 } from '@/api/base44Client';

const BACKEND_LIMIT = 200;
const STALE_TIME_MS = 5 * 60 * 1000;
const TODOS_VALUE = '__todos__';
const SEM_LOTACAO_VALUE = '__sem_lotacao__';
const DEFAULT_SORT_FIELD = 'posto_graduacao';
const DEFAULT_SORT_DIRECTION = 'asc';

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

const STATUS_CADASTRO_ORDER = Object.freeze(['Ativo', 'Reserva', 'Reforma', 'Inativo', 'Falecido']);
const SITUACAO_MILITAR_OPTIONS = Object.freeze([
  'Ativa',
  'Reserva Remunerada',
  'Reformado',
  'Designado',
  'Convocado',
]);
const CONDICAO_OPTIONS = Object.freeze(['Efetivo', 'Adido', 'Agregado', 'Cedido', 'À Disposição']);
const textCollator = new Intl.Collator('pt-BR', { sensitivity: 'base' });
const naturalTextCollator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });

function buildRankMap(values = []) {
  return new Map(values.map((value, index) => [normalizeText(value), index]));
}

const postoGraduacaoRank = buildRankMap(POSTO_GRADUACAO_OPTIONS);
const statusCadastroRank = buildRankMap(STATUS_CADASTRO_ORDER);
const quadroRank = buildRankMap(QUADROS_FIXOS);

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

function hojeISO() {
  return new Date().toISOString().split('T')[0];
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

  const searchableFields = Object.values(EXTRACAO_EFETIVO_FIELDS)
    .filter((field) => field.searchable === true)
    .map((column) =>
    getValorCampoEfetivo(militar, column.id),
  );

  return searchableFields.some((field) => normalizeText(field).includes(normalizedSearch));
}

function compareByRank(firstValue, secondValue, rankMap) {
  const fallbackRank = Number.MAX_SAFE_INTEGER;
  const firstRank = rankMap.get(normalizeText(firstValue)) ?? fallbackRank;
  const secondRank = rankMap.get(normalizeText(secondValue)) ?? fallbackRank;

  if (firstRank !== secondRank) return firstRank - secondRank;

  return textCollator.compare(String(firstValue || ''), String(secondValue || ''));
}

function compareCampoEfetivo(firstRecord, secondRecord, field) {
  const firstValue = field.accessor(firstRecord);
  const secondValue = field.accessor(secondRecord);

  switch (field.sortType) {
    case 'postoGraduacao':
      return compareByRank(firstValue, secondValue, postoGraduacaoRank);
    case 'statusCadastro':
      return compareByRank(firstValue, secondValue, statusCadastroRank);
    case 'quadro':
      return compareByRank(firstValue, secondValue, quadroRank);
    case 'naturalText':
      return naturalTextCollator.compare(String(firstValue || ''), String(secondValue || ''));
    case 'text':
    default:
      return textCollator.compare(String(firstValue || ''), String(secondValue || ''));
  }
}

function uniqueSorted(values = []) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, 'pt-BR'),
  );
}

function getDefaultColumnIds() {
  return EXTRACAO_EFETIVO_DEFAULT_COLUMNS.map((column) => column.id);
}

function getSelectableColumns() {
  return Object.values(EXTRACAO_EFETIVO_FIELDS)
    .filter((field) => field.selectable === true)
    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
}

function resolveSelectedColumns(selectedColumnIds = [], selectableColumns = []) {
  const selectedIds = new Set(selectedColumnIds);
  const selectedColumns = selectableColumns.filter(
    (column) => column.required === true || selectedIds.has(column.id),
  );

  if (selectedColumns.length > 0) return selectedColumns;

  return selectableColumns.filter((column) => column.required === true);
}

function getMilitarDedupeKey(militar = {}) {
  const id = String(militar.id || '').trim();
  if (id) return `id:${id}`;

  const matricula = String(getValorCampoEfetivo(militar, 'matricula') || '').trim();
  if (matricula) return `matricula:${matricula}`;

  const nome = normalizeText(
    getValorCampoEfetivo(militar, 'nome_completo') || militar.nome_completo,
  );
  if (nome) return `nome:${nome}`;

  return null;
}

function mergeMilitaresSemDuplicidade(currentMilitares = [], novosMilitares = []) {
  const mergedByKey = new Map();
  const unkeyedMilitares = [];

  currentMilitares.forEach((militar) => {
    const key = getMilitarDedupeKey(militar);
    if (key) {
      mergedByKey.set(key, militar);
      return;
    }

    unkeyedMilitares.push(militar);
  });

  novosMilitares.forEach((militar) => {
    const key = getMilitarDedupeKey(militar);
    if (!key) {
      unkeyedMilitares.push(militar);
      return;
    }

    if (!mergedByKey.has(key)) {
      mergedByKey.set(key, militar);
    }
  });

  return [...mergedByKey.values(), ...unkeyedMilitares];
}


function buildFiltrosSanitizadosAuditoria(filtrosExecutados) {
  const filtros = filtrosExecutados || {};
  const searchTamanho = String(filtros.search || '').trim().length;
  const filterKeys = [
    'postoGraduacao',
    'quadro',
    'status',
    'situacaoMilitar',
    'funcao',
    'condicao',
    'lotacao',
  ];

  return {
    search_aplicado: searchTamanho > 0,
    ...(searchTamanho > 0 ? { search_tamanho: searchTamanho } : {}),
    ...filterKeys.reduce((acc, key) => {
      const value = filtros[key];
      acc[key] = Boolean(value && value !== TODOS_VALUE);
      return acc;
    }, {}),
  };
}

function buildConsultaMetaAuditoria(consultaMeta, tipoExportacao, totalCarregados, totalExportados) {
  return {
    hasMore: consultaMeta?.hasMore === true,
    limit: Number(consultaMeta?.limit || BACKEND_LIMIT),
    offset: Number(consultaMeta?.offset || 0),
    returned: Number(consultaMeta?.returned || totalCarregados),
    tipo_exportacao: tipoExportacao,
    busca_limitada_por_amostra: Boolean(
      consultaMeta?.busca_limitada_por_amostra || consultaMeta?.buscaLimitadaPorAmostra,
    ),
    quantidade_carregada: totalCarregados,
    quantidade_exportada: totalExportados,
    escopo_resumido: {
      tipo: String(consultaMeta?.scope_tipo || 'indefinido'),
      aplicou_filtro_lotacao: consultaMeta?.aplicou_filtro_lotacao === true,
      aplicou_filtro_posto: consultaMeta?.aplicou_filtro_posto === true,
      aplicou_filtro_status: consultaMeta?.aplicou_filtro_status === true,
      aplicou_filtro_situacao: consultaMeta?.aplicou_filtro_situacao === true,
    },
  };
}

async function registrarAuditoriaExportacaoEfetivo(payload) {
  const response = await base44.functions.invoke('registrarAuditoriaExportacaoEfetivo', payload);
  const data = response?.data ?? response ?? {};

  if (data?.ok !== true) {
    throw new Error(data?.error || 'Falha ao registrar auditoria de exportação.');
  }

  return data;
}

function buildFetchMilitaresPayload(filtrosExecutados, lotacoesIds, offset) {
  return {
    limit: BACKEND_LIMIT,
    offset,
    includeFoto: false,
    ...(filtrosExecutados?.search ? { search: filtrosExecutados.search } : {}),
    ...(filtrosExecutados?.postoGraduacao && filtrosExecutados.postoGraduacao !== TODOS_VALUE
      ? { postoGraduacaoFiltros: [filtrosExecutados.postoGraduacao] }
      : {}),
    ...(filtrosExecutados?.status && filtrosExecutados.status !== TODOS_VALUE
      ? { statusCadastro: filtrosExecutados.status }
      : {}),
    ...(filtrosExecutados?.situacaoMilitar && filtrosExecutados.situacaoMilitar !== TODOS_VALUE
      ? { situacaoMilitar: filtrosExecutados.situacaoMilitar }
      : {}),
    ...(filtrosExecutados?.lotacao && lotacoesIds.has(filtrosExecutados.lotacao)
      ? { lotacaoFiltro: filtrosExecutados.lotacao }
      : {}),
  };
}

export default function ExtracaoEfetivo() {
  const {
    isAdmin,
    modoAcesso,
    userEmail,
    effectiveUserEmail,
    isAccessResolved,
    isLoading: loadingUser,
    canAccessModule,
    canAccessAction,
    resolvedAccessContext,
  } = useCurrentUser();
  const { toast } = useToast();

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
  const [statusFilter, setStatusFilter] = useState('Ativo');
  const [situacaoMilitarFilter, setSituacaoMilitarFilter] = useState(TODOS_VALUE);
  const [funcaoFilter, setFuncaoFilter] = useState(TODOS_VALUE);
  const [condicaoFilter, setCondicaoFilter] = useState(TODOS_VALUE);
  const [lotacaoFilter, setLotacaoFilter] = useState(TODOS_VALUE);
  const [selectedColumnIds, setSelectedColumnIds] = useState(getDefaultColumnIds);
  const [sortConfig, setSortConfig] = useState({
    fieldId: DEFAULT_SORT_FIELD,
    direction: DEFAULT_SORT_DIRECTION,
  });

  const selectableColumns = useMemo(() => getSelectableColumns(), []);
  const selectedColumns = useMemo(
    () => resolveSelectedColumns(selectedColumnIds, selectableColumns),
    [selectableColumns, selectedColumnIds],
  );
  const selectedColumnIdsResolved = useMemo(
    () => new Set(selectedColumns.map((column) => column.id)),
    [selectedColumns],
  );

  const toggleSelectedColumn = (fieldId, checked) => {
    setSelectedColumnIds((currentIds) => {
      const column = selectableColumns.find((item) => item.id === fieldId);
      if (!column) return currentIds;

      if (checked) {
        return currentIds.includes(fieldId) ? currentIds : [...currentIds, fieldId];
      }

      if (column.required) return currentIds;

      const nextIds = currentIds.filter((currentId) => currentId !== fieldId);
      const nextColumns = resolveSelectedColumns(nextIds, selectableColumns);

      return nextColumns.length > 0 ? nextIds : currentIds;
    });
  };

  const resetSelectedColumns = () => {
    setSelectedColumnIds(getDefaultColumnIds());
  };

  const podeVisualizarExtracao = canAccessAction('visualizar_extracao_efetivo');
  const podeExportarExtracao = canAccessAction('exportar_extracao_efetivo');

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
  const lotacoesIdsRef = useRef(lotacoesIds);

  useEffect(() => {
    lotacoesIdsRef.current = lotacoesIds;
  }, [lotacoesIds]);

  useEffect(() => {
    if (lotacaoFilter === TODOS_VALUE || lotacaoFilter === SEM_LOTACAO_VALUE) return;
    if (lotacoesIds.has(lotacaoFilter)) return;
    setLotacaoFilter(TODOS_VALUE);
  }, [lotacaoFilter, lotacoesIds]);

  const [filtrosExecutados, setFiltrosExecutados] = useState(null);
  const [executionId, setExecutionId] = useState(0);
  const [militares, setMilitares] = useState([]);
  const [consultaMeta, setConsultaMeta] = useState({});
  const [nextOffset, setNextOffset] = useState(0);
  const [isLoadingMilitares, setIsLoadingMilitares] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [militaresError, setMilitaresError] = useState(null);

  const filtrosAtuais = useMemo(
    () => ({
      includeFoto: false,
      limit: BACKEND_LIMIT,
      offset: 0,
      search: searchTerm.trim() || null,
      postoGraduacao: postoFilter,
      quadro: quadroFilter,
      status: statusFilter,
      situacaoMilitar: situacaoMilitarFilter,
      funcao: funcaoFilter,
      condicao: condicaoFilter,
      lotacao: lotacaoFilter,
    }),
    [
      condicaoFilter,
      funcaoFilter,
      lotacaoFilter,
      postoFilter,
      quadroFilter,
      searchTerm,
      situacaoMilitarFilter,
      statusFilter,
    ],
  );

  const loadMilitaresPage = useCallback(
    async ({ filtros, offset, reset = false }) => {
      if (!filtros) return;

      if (reset) {
        setIsLoadingMilitares(true);
      } else {
        setIsLoadingMore(true);
      }
      setMilitaresError(null);

      try {
        const data = await fetchScopedMilitares(
          buildFetchMilitaresPayload(filtros, lotacoesIdsRef.current, offset),
        );
        const novosMilitares = Array.isArray(data?.militares) ? data.militares : [];

        setMilitares((currentMilitares) =>
          reset
            ? mergeMilitaresSemDuplicidade([], novosMilitares)
            : mergeMilitaresSemDuplicidade(currentMilitares, novosMilitares),
        );
        setConsultaMeta(data?.meta || {});
        setNextOffset(offset + BACKEND_LIMIT);
      } catch (loadError) {
        setMilitaresError(loadError);
      } finally {
        setIsLoadingMilitares(false);
        setIsLoadingMore(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!isAccessResolved || !filtrosExecutados) return;

    loadMilitaresPage({ filtros: filtrosExecutados, offset: 0, reset: true });
  }, [executionId, filtrosExecutados, isAccessResolved, loadMilitaresPage]);

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


  const situacoesMilitaresDisponiveis = useMemo(
    () =>
      uniqueSorted([
        ...SITUACAO_MILITAR_OPTIONS,
        ...militares.map((militar) => getValorCampoEfetivo(militar, 'situacao_militar')),
      ]),
    [militares],
  );

  const funcoesDisponiveis = useMemo(
    () => uniqueSorted(militares.map((militar) => getValorCampoEfetivo(militar, 'funcao'))),
    [militares],
  );

  const condicoesDisponiveis = useMemo(
    () =>
      uniqueSorted([
        ...CONDICAO_OPTIONS,
        ...militares.map((militar) => getValorCampoEfetivo(militar, 'condicao')),
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
      const situacaoMilitar = getValorCampoEfetivo(militar, 'situacao_militar');
      const funcao = getValorCampoEfetivo(militar, 'funcao');
      const condicao = getValorCampoEfetivo(militar, 'condicao');

      if (!filtrosExecutados) return false;
      if (filtrosExecutados.postoGraduacao !== TODOS_VALUE && posto !== filtrosExecutados.postoGraduacao) {
        return false;
      }
      if (filtrosExecutados.quadro !== TODOS_VALUE && quadroNormalizado !== filtrosExecutados.quadro) {
        return false;
      }
      if (filtrosExecutados.status !== TODOS_VALUE && status !== filtrosExecutados.status) return false;
      if (
        filtrosExecutados.situacaoMilitar !== TODOS_VALUE &&
        situacaoMilitar !== filtrosExecutados.situacaoMilitar
      ) {
        return false;
      }
      if (filtrosExecutados.funcao !== TODOS_VALUE && funcao !== filtrosExecutados.funcao) return false;
      if (filtrosExecutados.condicao !== TODOS_VALUE && condicao !== filtrosExecutados.condicao) return false;
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

  const sortedMilitares = useMemo(() => {
    const sortField = EXTRACAO_EFETIVO_FIELDS[sortConfig.fieldId];

    if (!sortField?.sortable) return filteredMilitares;

    const directionFactor = sortConfig.direction === 'desc' ? -1 : 1;

    return [...filteredMilitares].sort((firstRecord, secondRecord) => {
      const result = compareCampoEfetivo(firstRecord, secondRecord, sortField);
      return result * directionFactor;
    });
  }, [filteredMilitares, sortConfig]);

  const toggleSort = (fieldId) => {
    const field = EXTRACAO_EFETIVO_FIELDS[fieldId];
    if (!field?.sortable) return;

    setSortConfig((currentSort) => ({
      fieldId,
      direction:
        currentSort.fieldId === fieldId && currentSort.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const getSortIcon = (fieldId) => {
    if (sortConfig.fieldId !== fieldId) return <ArrowUpDown className="h-3.5 w-3.5" />;

    return sortConfig.direction === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5" />
    );
  };

  const executeExtraction = () => {
    setMilitares([]);
    setConsultaMeta({});
    setNextOffset(0);
    setMilitaresError(null);
    setFiltrosExecutados(filtrosAtuais);
    setExecutionId((currentExecutionId) => currentExecutionId + 1);
  };

  const loadMoreMilitares = () => {
    if (!filtrosExecutados || consultaMeta?.hasMore !== true || isLoadingMore || isLoadingMilitares) {
      return;
    }

    loadMilitaresPage({ filtros: filtrosExecutados, offset: nextOffset });
  };

  const exportarRegistrosCarregados = async () => {
    if (!hasExecutedExtraction) {
      toast({
        title: 'Execute uma extração antes de exportar',
        description: 'A exportação usa somente os registros já carregados na tela.',
        variant: 'destructive',
      });
      return;
    }

    if (!podeVisualizarExtracao || !podeExportarExtracao) {
      toast({
        title: 'Exportação não autorizada',
        description: 'Você não possui permissão para exportar a Extração do Efetivo.',
        variant: 'destructive',
      });
      return;
    }

    if (!sortedMilitares.length || !selectedColumns.length) {
      toast({
        title: 'Sem registros exportáveis',
        description: 'Não há registros carregados e filtrados para exportar com as colunas selecionadas.',
        variant: 'destructive',
      });
      return;
    }

    const statusArquivo = consultaMeta?.hasMore === true ? 'parcial' : 'completo';
    const totalCarregados = militares.length;
    const totalExportados = sortedMilitares.length;
    const nomeArquivo = `extracao_efetivo_${hojeISO()}_${statusArquivo}_carregados-${totalCarregados}_exportados-${totalExportados}.xlsx`;

    try {
      await registrarAuditoriaExportacaoEfetivo({
        effectiveEmail: effectiveEmailForQuery || undefined,
        tipo_exportacao: statusArquivo,
        quantidade_carregada: totalCarregados,
        quantidade_exportada: totalExportados,
        colunas_exportadas: selectedColumns.map((column) => ({
          id: column.id,
          label: column.label,
        })),
        filtros_sanitizados: buildFiltrosSanitizadosAuditoria(filtrosExecutados),
        consulta_meta: buildConsultaMetaAuditoria(
          consultaMeta,
          statusArquivo,
          totalCarregados,
          totalExportados,
        ),
        nome_arquivo: nomeArquivo,
        versao: '1F-C',
      });
    } catch (_auditError) {
      toast({
        title: 'Exportação bloqueada',
        description: 'Exportação bloqueada porque não foi possível registrar auditoria.',
        variant: 'destructive',
      });
      return;
    }

    exportarRegistrosParaExcel({
      registros: sortedMilitares,
      camposSelecionados: selectedColumns.map((column) => ({
        key: column.id,
        label: column.label,
        getValue: (militar) => getValorCampoEfetivo(militar, column.id),
      })),
      nomeArquivo,
      nomeAba: statusArquivo === 'parcial' ? 'Efetivo parcial' : 'Efetivo completo',
    });

    if (consultaMeta?.hasMore === true) {
      toast({
        title: 'Exportação parcial concluída',
        description: 'Esta exportação contém apenas os registros carregados na tela. Ainda há mais registros disponíveis.',
      });
      return;
    }

    toast({
      title: 'Exportação concluída',
      description: `${totalExportados} registro(s) carregado(s) foram exportado(s).`,
    });
  };

  const clearFilters = () => {
    setSearchTerm('');
    setPostoFilter(TODOS_VALUE);
    setQuadroFilter(TODOS_VALUE);
    setStatusFilter('Ativo');
    setSituacaoMilitarFilter(TODOS_VALUE);
    setFuncaoFilter(TODOS_VALUE);
    setCondicaoFilter(TODOS_VALUE);
    setLotacaoFilter(TODOS_VALUE);
  };

  const clearExtraction = () => {
    clearFilters();
    setFiltrosExecutados(null);
    setMilitares([]);
    setConsultaMeta({});
    setNextOffset(0);
    setMilitaresError(null);
  };

  if (
    !loadingUser &&
    isAccessResolved &&
    (!canAccessModule('extracao_efetivo') || !podeVisualizarExtracao)
  ) {
    return <AccessDenied modulo="Extração do Efetivo" />;
  }

  const totalRetornado = militares.length;
  const totalFiltrado = sortedMilitares.length;
  const hasMoreMilitares = consultaMeta?.hasMore === true;
  const isBuscaLimitadaPorAmostra = Boolean(
    consultaMeta?.busca_limitada_por_amostra || consultaMeta?.buscaLimitadaPorAmostra,
  );
  const isBusy = hasExecutedExtraction && (isLoadingMilitares || isLoadingMore);
  const isInitialPageBusy = hasExecutedExtraction && isLoadingMilitares;
  const isError = Boolean(militaresError);
  const shouldShowExportButton = Boolean(
    hasExecutedExtraction &&
    sortedMilitares.length > 0 &&
    podeVisualizarExtracao &&
    podeExportarExtracao,
  );
  const isRateLimitError = String(militaresError?.message || '').toLowerCase().includes('rate limit');

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
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center md:justify-end">
            {shouldShowExportButton && (
              <Button
                type="button"
                variant="outline"
                onClick={exportarRegistrosCarregados}
                disabled={isBusy}
                title="Exporta somente os registros já carregados na tela"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar registros carregados
              </Button>
            )}
            <Badge variant="outline" className="w-fit border-blue-200 bg-blue-50 text-blue-700">
              <ShieldCheck className="w-3.5 h-3.5 mr-1" />
              Somente leitura
            </Badge>
          </div>
        </div>

        <div className="rounded-xl border border-blue-100 bg-blue-50/80 p-4 text-sm text-blue-900 flex gap-3">
          <Info className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Módulo inicial com campos funcionais comuns.</p>
            <p>
              Esta versão não inclui dados sensíveis ou cruzamentos com outros módulos.
              A visualização e a exportação usam apenas campos comuns previamente permitidos no catálogo.
              Dados protegidos e análises combinadas serão tratados em lotes futuros.
            </p>
          </div>
        </div>

        {hasExecutedExtraction ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-slate-100 shadow-sm">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="rounded-xl bg-slate-100 p-3 text-slate-700">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Registros carregados</p>
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
            <Card className="border-slate-100 shadow-sm">
              <CardContent className="p-5 flex items-center gap-4">
                <div
                  className={`rounded-xl p-3 ${
                    hasMoreMilitares ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  <ListChecks className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Estado do carregamento</p>
                  <p className="text-lg font-bold text-slate-800">
                    {hasMoreMilitares ? 'Parcial' : 'Completo'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {hasMoreMilitares
                      ? 'Há mais registros no escopo.'
                      : 'Não há mais registros a carregar.'}
                  </p>
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

        {hasExecutedExtraction && (
          <div
            className={`rounded-xl border p-4 text-sm flex gap-3 ${
              hasMoreMilitares
                ? 'border-amber-200 bg-amber-50 text-amber-900'
                : 'border-emerald-200 bg-emerald-50 text-emerald-900'
            }`}
          >
            {hasMoreMilitares ? (
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            ) : (
              <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <p className="font-semibold">
                {hasMoreMilitares
                  ? 'Resultado parcial carregado.'
                  : 'Resultado carregado completo.'}
              </p>
              <p>
                {hasMoreMilitares
                  ? `Foram carregados ${totalRetornado} registros até agora. Use Carregar mais para buscar o próximo lote de até ${BACKEND_LIMIT} registros.`
                  : `Foram carregados ${totalRetornado} registros e o backend informou que não há mais registros a carregar.`}
              </p>
              <p className="text-xs">
                Ordenação, quadro, função, condição e sem lotação são refinos locais e atuam somente
                sobre os registros já carregados.
              </p>
            </div>
          </div>
        )}

        {hasExecutedExtraction && isBuscaLimitadaPorAmostra && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 flex gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Busca textual limitada por amostra.</p>
              <p>
                O backend indicou que a busca pode ter sido avaliada sobre uma amostra; portanto, o
                resultado carregado pode não representar todo o universo disponível no escopo.
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
                  <SelectItem value={TODOS_VALUE}>Todos os status (sem filtro backend)</SelectItem>
                  {statusDisponiveis.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Select value={situacaoMilitarFilter} onValueChange={setSituacaoMilitarFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Situação militar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS_VALUE}>Todas as situações militares</SelectItem>
                  {situacoesMilitaresDisponiveis.map((situacao) => (
                    <SelectItem key={situacao} value={situacao}>
                      {situacao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={funcaoFilter} onValueChange={setFuncaoFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Função" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS_VALUE}>Todas as funções (refino local)</SelectItem>
                  {funcoesDisponiveis.map((funcao) => (
                    <SelectItem key={funcao} value={funcao}>
                      {funcao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={condicaoFilter} onValueChange={setCondicaoFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Condição" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS_VALUE}>Todas as condições (refino local)</SelectItem>
                  {condicoesDisponiveis.map((condicao) => (
                    <SelectItem key={condicao} value={condicao}>
                      {condicao}
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


        <Card className="border-slate-100 shadow-sm">
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <ListChecks className="w-4 h-4" />
                  Colunas da tabela
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Escolha quais colunas comuns permitidas serão exibidas. Esta seleção altera apenas
                  a visualização da tabela.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={resetSelectedColumns}>
                Restaurar padrão
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              {selectableColumns.map((column) => {
                const isChecked = selectedColumnIdsResolved.has(column.id);
                const isLocked = column.required === true;

                return (
                  <label
                    key={column.id}
                    htmlFor={`coluna-${column.id}`}
                    className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 hover:border-blue-200 hover:bg-blue-50/40"
                  >
                    <Checkbox
                      id={`coluna-${column.id}`}
                      checked={isChecked}
                      disabled={isLocked}
                      onCheckedChange={(checked) => toggleSelectedColumn(column.id, checked === true)}
                      className="mt-0.5"
                    />
                    <span className="space-y-1">
                      <span className="block font-medium leading-none">{column.label}</span>
                      <span className="block text-xs text-slate-500">
                        {isLocked ? 'Obrigatória' : column.category || 'Campo comum'}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              {selectedColumns.length} coluna{selectedColumns.length === 1 ? '' : 's'} selecionada
              {selectedColumns.length === 1 ? '' : 's'}. Campos desconhecidos são descartados antes da renderização. A ordenação é local e atua somente sobre o resultado carregado.
            </div>
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
        ) : isInitialPageBusy ? (
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
                      : militaresError?.message || 'Ocorreu uma falha controlada ao consultar o efetivo escopado.'}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() =>
                  loadMilitaresPage({
                    filtros: filtrosExecutados,
                    offset: militares.length ? nextOffset : 0,
                    reset: militares.length === 0,
                  })
                }
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        ) : sortedMilitares.length === 0 ? (
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
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-600">
              Exibindo {totalFiltrado} registro{totalFiltrado === 1 ? '' : 's'} após refinos locais,
              de {totalRetornado} registro{totalRetornado === 1 ? '' : 's'} carregado
              {totalRetornado === 1 ? '' : 's'}. O resultado está{' '}
              {hasMoreMilitares ? 'parcial' : 'completo'}.
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    {selectedColumns.map((column) => {
                      const isSortable = column.sortable === true;
                      const isActiveSort = sortConfig.fieldId === column.id;

                      return (
                        <th key={column.id} className="px-4 py-3 text-left font-semibold">
                          {isSortable ? (
                            <button
                              type="button"
                              onClick={() => toggleSort(column.id)}
                              className={`inline-flex items-center gap-1.5 rounded-md text-left hover:text-[#1e3a5f] ${
                                isActiveSort ? 'text-[#1e3a5f]' : ''
                              }`}
                              title="Ordenar localmente o resultado carregado"
                            >
                              <span>{column.label}</span>
                              {getSortIcon(column.id)}
                            </button>
                          ) : (
                            column.label
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {sortedMilitares.map((militar) => (
                    <tr
                      key={militar.id || `${militar.nome_completo}-${getValorCampoEfetivo(militar, 'matricula')}`}
                      className="hover:bg-slate-50/80"
                    >
                      {selectedColumns.map((column) => {
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
            <div className="flex flex-col gap-3 border-t border-slate-100 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                {hasMoreMilitares
                  ? 'Há mais registros disponíveis para carregar neste resultado parcial.'
                  : 'Não há mais registros a carregar para a consulta executada.'}
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={loadMoreMilitares}
                disabled={!hasMoreMilitares || isLoadingMore || isLoadingMilitares}
              >
                {isLoadingMore ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Database className="w-4 h-4 mr-2" />
                )}
                {isLoadingMore ? 'Carregando...' : 'Carregar mais'}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
