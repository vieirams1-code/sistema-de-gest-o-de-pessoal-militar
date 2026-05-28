import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Plus,
  Search,
  Calendar,
  CheckCircle,
  Clock,
  Settings,
  Trash2,
  Pencil,
  AlertTriangle,
  MoreHorizontal,
  LogIn,
  LogOut,
  PauseCircle,
  GitBranch,
  Lock,
  RefreshCw,
  ShieldAlert,
  MessageSquareText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import RegistroLivroModal from '@/components/ferias/RegistroLivroModal';
import FamiliaFeriasPanel from '@/components/ferias/FamiliaFeriasPanel';
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, parseISO, addDays, differenceInDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { montarCadeia } from '@/components/ferias/feriasAdminUtils';
import { getBlockingReasonForInicio } from '@/components/ferias/inicioValidation';
import { sincronizarPeriodoAquisitivoDaFerias } from '@/components/ferias/feriasService';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { useUsuarioPodeAgirSobreMilitar } from '@/hooks/useUsuarioPodeAgirSobreMilitar';
import { enriquecerFeriasComContextoMilitar, feriasCorrespondeBusca } from '@/services/feriasMilitarContextService';
import { atualizarEscopado, excluirEscopado } from '@/services/cudEscopadoClient';
import { formatarTipoCreditoExtra, liberarCreditosDoGozo, listarCreditosExtraFerias } from '@/services/creditoExtraFeriasService';
import DataDebugPanel from '@/components/debug/DataDebugPanel';
import { getEffectiveEmail as getEffectiveEmailMilitares } from '@/services/getScopedMilitaresClient';
import { fetchScopedFeriasBundle } from '@/services/getScopedFeriasBundleClient';
import { bulkFeriasTagsEscopado } from '@/services/cudFuncoesTagsEscopadoClient';
import FeriasTagsBulkPanel from '@/components/ferias/FeriasTagsBulkPanel';
import IconeCatalogo from '@/components/funcoes-tags/IconeCatalogo';
import SelectionActionBar from '@/components/shared/SelectionActionBar';
import { getFeriasTagFeriasId, getFeriasTagTagId } from '@/utils/funcoesTags/contratoCampos';
import { isFeriasTagVinculoAtivo } from '@/utils/funcoesTags/feriasTags';
import { funcoesTagsKeys } from '@/utils/funcoesTags/queryKeys';
import { resolveTagVisual } from '@/utils/tags/tagPresenter';

const statusColors = {
  Prevista: 'bg-slate-100 text-slate-700',
  Autorizada: 'bg-blue-100 text-blue-700',
  'Em Curso': 'bg-amber-100 text-amber-700',
  Gozada: 'bg-emerald-100 text-emerald-700',
  Interrompida: 'bg-orange-100 text-orange-700',
};

const TIPOS_OPERACIONAIS = [
  'Saída Férias',
  'Retorno Férias',
  'Interrupção de Férias',
  'Nova Saída / Retomada',
];

const NOMES_OPERACIONAIS = {
  'Saída Férias': 'Início',
  'Retorno Férias': 'Término',
  'Interrupção de Férias': 'Interrupção',
  'Nova Saída / Retomada': 'Continuação',
};

function parseDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`);
}

function formatDate(dateString) {
  if (!dateString) return '-';
  return format(new Date(`${dateString}T00:00:00`), 'dd/MM/yyyy');
}

function getEventDate(evento) {
  return evento?.data_registro || evento?.data_inicio || null;
}

function toIsoDate(date) {
  return format(date, 'yyyy-MM-dd');
}

function getFeriasIntervalo(ferias) {
  const inicio = ferias?.data_inicio ? parseISO(`${ferias.data_inicio}T00:00:00`) : null;
  const fimBase = ferias?.data_fim || ferias?.data_retorno || null;
  const fim = fimBase ? parseISO(`${fimBase}T00:00:00`) : null;
  return { inicio, fim };
}

function getTagEmoji(tag = {}) {
  return resolveTagVisual(tag).emoji;
}

function getTagCor(tag = {}) {
  if (typeof tag?.cor === 'string' && tag.cor.trim()) return tag.cor.trim();
  if (typeof tag?.color === 'string' && tag.color.trim()) return tag.color.trim();
  return '#64748b';
}

function parseFeriasDateStart(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const parsed = parseISO(String(value));
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function getDataInicioFerias(ferias) {
  return (
    parseFeriasDateStart(ferias?.data_inicio) ||
    parseFeriasDateStart(ferias?.data_inicio_gozo) ||
    parseFeriasDateStart(ferias?.inicio)
  );
}

function deriveInterrupcaoData(ferias, registrosLivro) {
  if (!ferias || !Array.isArray(registrosLivro)) {
    return {
      diasNoMomento: Number(ferias?.dias || 0),
      gozados: null,
      saldo: null,
      dataInterrupcao: null,
    };
  }

  const cadeia = montarCadeia(ferias, registrosLivro).filter((r) =>
    TIPOS_OPERACIONAIS.includes(r.tipo_registro)
  );

  const ultimaInterrupcao = [...cadeia]
    .reverse()
    .find((r) => r.tipo_registro === 'Interrupção de Férias');

  if (!ultimaInterrupcao) {
    return {
      diasNoMomento: Number(ferias.dias || 0),
      gozados: null,
      saldo: null,
      dataInterrupcao: null,
    };
  }

  const diasNoMomento = Number(
    ultimaInterrupcao.dias_no_momento ??
      ultimaInterrupcao.dias ??
      ferias.dias ??
      0
  );

  let gozados = null;
  let saldo = null;

  const indiceInterrupcao = cadeia.findIndex((evento) => evento?.id === ultimaInterrupcao?.id);
  const eventosAteInterrupcao = indiceInterrupcao >= 0 ? cadeia.slice(0, indiceInterrupcao + 1) : cadeia;
  const ultimoInicio = [...eventosAteInterrupcao]
    .reverse()
    .find((evento) => evento?.tipo_registro === 'Saída Férias' || evento?.tipo_registro === 'Nova Saída / Retomada');
  const dataInicioBase = ultimoInicio?.data_registro || ultimoInicio?.data_inicio || ferias?.data_inicio;

  if (dataInicioBase && ultimaInterrupcao.data_registro) {
    const inicio = parseDate(dataInicioBase);
    const dataInterrupcao = parseDate(ultimaInterrupcao.data_registro);

    gozados = Math.max(0, differenceInDays(dataInterrupcao, inicio) + 1);
    gozados = Math.min(gozados, diasNoMomento);
    saldo = Math.max(0, diasNoMomento - gozados);
  }

  if (ultimaInterrupcao.dias_gozados != null && !Number.isNaN(Number(ultimaInterrupcao.dias_gozados))) {
    gozados = Number(ultimaInterrupcao.dias_gozados);
  }

  if (ultimaInterrupcao.saldo_remanescente != null && !Number.isNaN(Number(ultimaInterrupcao.saldo_remanescente))) {
    saldo = Number(ultimaInterrupcao.saldo_remanescente);
  }

  return {
    diasNoMomento,
    gozados,
    saldo,
    dataInterrupcao: ultimaInterrupcao.data_registro || null,
  };
}

function getCadeiaOperacional(ferias, registrosLivro) {
  if (!ferias) return [];

  return montarCadeia(ferias, registrosLivro).filter((r) =>
    TIPOS_OPERACIONAIS.includes(r.tipo_registro)
  );
}

function getEstadoAtualDaCadeia(cadeia) {
  if (!cadeia.length) {
    return {
      status: 'Sem Eventos',
      ultimoEvento: null,
      ultimaSaidaOuContinuacao: null,
      ultimaInterrupcao: null,
      ultimoRetorno: null,
    };
  }

  const ultimoEvento = cadeia[cadeia.length - 1];
  const ultimaSaidaOuContinuacao = [...cadeia]
    .reverse()
    .find((e) => e.tipo_registro === 'Saída Férias' || e.tipo_registro === 'Nova Saída / Retomada');

  const ultimaInterrupcao = [...cadeia]
    .reverse()
    .find((e) => e.tipo_registro === 'Interrupção de Férias');

  const ultimoRetorno = [...cadeia]
    .reverse()
    .find((e) => e.tipo_registro === 'Retorno Férias');

  let status = 'Sem Eventos';

  if (
    ultimoEvento.tipo_registro === 'Saída Férias' ||
    ultimoEvento.tipo_registro === 'Nova Saída / Retomada'
  ) {
    status = 'Em Curso';
  } else if (ultimoEvento.tipo_registro === 'Interrupção de Férias') {
    status = 'Interrompida';
  } else if (ultimoEvento.tipo_registro === 'Retorno Férias') {
    status = 'Encerrada';
  }

  return {
    status,
    ultimoEvento,
    ultimaSaidaOuContinuacao,
    ultimaInterrupcao,
    ultimoRetorno,
  };
}

function validarEdicaoDataInicio({ ferias, novaData, registrosLivro }) {
  if (!ferias || !novaData) return null;

  const novaDataDate = parseDate(novaData);
  const cadeia = getCadeiaOperacional(ferias, registrosLivro);

  if (!cadeia.length) return null;

  const primeiroEvento = cadeia[0];
  const ultimoEvento = cadeia[cadeia.length - 1];
  const primeiroEventoDataStr = getEventDate(primeiroEvento);
  const ultimoEventoDataStr = getEventDate(ultimoEvento);
  const estadoAtual = getEstadoAtualDaCadeia(cadeia);

  if (primeiroEvento?.tipo_registro !== 'Saída Férias') {
    return 'A cadeia possui eventos sem um início operacional consistente. Revise os lançamentos antes de alterar a data de início.';
  }

  if (primeiroEventoDataStr && novaDataDate > parseDate(primeiroEventoDataStr)) {
    return `A data de início não pode ser posterior ao primeiro evento da cadeia (${NOMES_OPERACIONAIS[primeiroEvento.tipo_registro] || primeiroEvento.tipo_registro} em ${formatDate(primeiroEventoDataStr)}).`;
  }

  if (
    estadoAtual.ultimaInterrupcao &&
    getEventDate(estadoAtual.ultimaInterrupcao) &&
    novaDataDate > parseDate(getEventDate(estadoAtual.ultimaInterrupcao))
  ) {
    return `A data de início não pode ser posterior à interrupção de ${formatDate(getEventDate(estadoAtual.ultimaInterrupcao))}.`;
  }

  if (
    estadoAtual.ultimoRetorno &&
    getEventDate(estadoAtual.ultimoRetorno) &&
    novaDataDate > parseDate(getEventDate(estadoAtual.ultimoRetorno))
  ) {
    return `A data de início não pode ser posterior ao término de ${formatDate(getEventDate(estadoAtual.ultimoRetorno))}.`;
  }

  if (ultimoEventoDataStr && novaDataDate > parseDate(ultimoEventoDataStr)) {
    return `A data de início não pode ser posterior ao último evento da cadeia (${NOMES_OPERACIONAIS[ultimoEvento.tipo_registro] || ultimoEvento.tipo_registro} em ${formatDate(ultimoEventoDataStr)}).`;
  }

  return null;
}

export default function Ferias() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, modoAcesso, userEmail, getMilitarScopeFilters, canAccessModule, canAccessAction, isLoading: loadingUser, isAccessResolved } = useCurrentUser();
  const { validar: validarEscopoMilitar } = useUsuarioPodeAgirSobreMilitar();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [periodFilterType, setPeriodFilterType] = useState('none');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [customRangeError, setCustomRangeError] = useState('');

  // UI: meses iniciam recolhidos; apenas o mês atual (yyyy-MM) começa expandido.
  // O usuário pode expandir/recolher manualmente cada mês.
  const [expandedMonths, setExpandedMonths] = useState(() => {
    const now = new Date();
    return new Set([format(now, 'yyyy-MM')]);
  });
  const toggleMonth = (sortKey) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(sortKey)) next.delete(sortKey);
      else next.add(sortKey);
      return next;
    });
  };

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [feriasToDelete, setFeriasToDelete] = useState(null);
  const [deleteBlockedDialogOpen, setDeleteBlockedDialogOpen] = useState(false);
  const [cadeiaBloqueandoDelete, setCadeiaBloqueandoDelete] = useState([]);

  const [registroLivroModal, setRegistroLivroModal] = useState({
    open: false,
    ferias: null,
    tipo: 'Saída Férias',
  });

  const [editDataModal, setEditDataModal] = useState({
    open: false,
    ferias: null,
    novaData: '',
  });

  const [savingEdit, setSavingEdit] = useState(false);
  const [modoAdmin, setModoAdmin] = useState(false);
  const [familiaPanel, setFamiliaPanel] = useState({ open: false, ferias: null });
  const [selectedFeriasIds, setSelectedFeriasIds] = useState([]);
  const [feriasTagsBulkOpen, setFeriasTagsBulkOpen] = useState(false);
  const [feriasTagsBulkResultado, setFeriasTagsBulkResultado] = useState(null);

  const effectiveEmail = getEffectiveEmailMilitares();
  const {
    data: feriasData,
    isLoading,
    isFetching: isFeriasFetching,
    isSuccess: isFeriasSuccess,
    isError: isFeriasError,
    error: feriasError,
    refetch: refetchFerias,
  } = useQuery({
    queryKey: ['ferias', isAdmin, modoAcesso, userEmail, effectiveEmail || null],
    queryFn: async () => {
      const bundle = await fetchScopedFeriasBundle();
      const ferias = await enriquecerFeriasComContextoMilitar(bundle.ferias || [], { contexto: 'operacional' });
      return {
        ferias,
        feriasTags: Array.isArray(bundle.feriasTags) ? bundle.feriasTags : undefined,
        tagsCatalogo: Array.isArray(bundle.tagsCatalogo) ? bundle.tagsCatalogo : undefined,
        registrosLivro: bundle.registrosLivro || [],
        partialFailures: Number(bundle.partialFailures || 0),
        meta: bundle.meta || {},
      };
    },
    enabled: isAccessResolved && canAccessModule('ferias'),
  });
  const ferias = feriasData?.ferias || [];
  const feriasTagsFromBundle = Array.isArray(feriasData?.feriasTags) ? feriasData.feriasTags : [];
  const tagsCatalogoFromBundle = Array.isArray(feriasData?.tagsCatalogo) ? feriasData.tagsCatalogo : [];
  const feriasPartialFailures = Number(feriasData?.partialFailures || 0);

  const registrosLivro = feriasData?.registrosLivro || [];
  const registrosPartialFailures = feriasPartialFailures;
  const hasPartialDataWarning = feriasPartialFailures > 0;
  const hasFeriasLoadError = isFeriasError;
  const isPageLoading = isLoading;
  const feriasQueryKey = ['ferias', isAdmin, modoAcesso, userEmail, effectiveEmail || null];
  const militarScopeFilters = isAccessResolved ? getMilitarScopeFilters() : [];

  const getFeriasEstagioProvavel = () => {
    const feriasErrorMessage = String(feriasError?.message || '').toLowerCase();
    if (isAdmin && isFeriasError) return 'Ferias.list';
    if (feriasErrorMessage.includes('429') || feriasErrorMessage.includes('rate limit')) return 'getScopedFeriasBundle / rate limit';
    if (feriasErrorMessage.includes('férias dos militares do escopo')) return 'getScopedFeriasBundle';
    if (feriasErrorMessage.includes('escopo')) return 'Militar.filter escopo';
    if (feriasErrorMessage.includes('férias dos militares acessíveis')) return 'getScopedFeriasBundle';
    if (isFeriasError || feriasPartialFailures > 0) return 'enriquecerFeriasComContextoMilitar';
    return 'getScopedFeriasBundle';
  };

  const feriasDebugData = (isFeriasError || hasPartialDataWarning)
    ? {
      pagina: 'Ferias',
      usuario: userEmail || null,
      isAdmin,
      modoAcesso: modoAcesso || null,
      scopeFilters: militarScopeFilters,
      queryKeyFerias: feriasQueryKey,
      status: {
        ferias: {
          loading: isLoading,
          fetching: isFeriasFetching,
          isError: isFeriasError,
          isSuccess: isFeriasSuccess,
        },
      },
      erroFerias: feriasError
        ? {
          message: feriasError.message || null,
          name: feriasError.name || null,
          stack: feriasError.stack ? String(feriasError.stack).split('\n').slice(0, 5).join('\n') : null,
        }
        : null,
      partialFailures: {
        ferias: feriasPartialFailures,
        registrosLivro: registrosPartialFailures,
      },
      quantidades: {
        feriasCarregadas: ferias.length,
        registrosLivroCarregados: registrosLivro.length,
      },
      estagioProvavel: getFeriasEstagioProvavel(),
      timestamps: {
        generatedAt: new Date().toISOString(),
      },
    }
    : null;
  const isRateLimitScopedError = false;
  const retryFeriasLoad = async () => {
    await refetchFerias();
  };

  const { data: creditosExtraFerias = [] } = useQuery({
    queryKey: ['ferias-creditos-extra', isAdmin, modoAcesso, userEmail, effectiveEmail || null],
    queryFn: () => listarCreditosExtraFerias('-data_referencia'),
    enabled: isAccessResolved && canAccessModule('ferias'),
  });
  const feriasIdsEscopoTags = useMemo(
    () => ferias.map((item) => String(item.id)).filter(Boolean),
    [ferias],
  );

  // Lote 2 (SGP-FER-001): bundle sempre retorna feriasTags e tagsCatalogo —
  // fallbacks via FeriasTag.filter / Tag.list foram removidos.
  // O modal "Gerenciar tags" (FeriasTagsBulkPanel) mantém sua query própria
  // para listar todas as tags ativas, independente das vinculadas.
  const feriasTagsVinculos = feriasTagsFromBundle;
  const tagsCatalogo = tagsCatalogoFromBundle;

  const deleteMutation = useMutation({
    mutationFn: async (params) => {
      const { feriasId, periodoId, periodoRef, militarId } = params;
      await liberarCreditosDoGozo({ gozoFeriasId: feriasId });
      await excluirEscopado('Ferias', feriasId);
      await sincronizarPeriodoAquisitivoDaFerias({
        periodoAquisitivoId: periodoId,
        periodoAquisitivoRef: periodoRef,
        militarId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ferias'] });
      queryClient.invalidateQueries({ queryKey: ['ferias-creditos-extra'] });
      queryClient.invalidateQueries({ queryKey: ['periodos-aquisitivos'] });
      setDeleteDialogOpen(false);
      setFeriasToDelete(null);
      setCadeiaBloqueandoDelete([]);
    },
  });

  const filteredFerias = useMemo(() => {
    const hasPeriodFilter = Boolean(periodStart && periodEnd);
    const hasValidPeriod = !hasPeriodFilter || parseISO(`${periodEnd}T00:00:00`) >= parseISO(`${periodStart}T00:00:00`);
    return ferias.filter((f) => {
      const matchesSearch = feriasCorrespondeBusca(f, searchTerm);
      const matchesStatus = statusFilter === 'all' || f.status === statusFilter;
      if (!hasPeriodFilter || !hasValidPeriod) return matchesSearch && matchesStatus;

      const { inicio, fim } = getFeriasIntervalo(f);
      if (!inicio || !fim || Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
        return false;
      }

      const filtroInicio = parseISO(`${periodStart}T00:00:00`);
      const filtroFim = parseISO(`${periodEnd}T00:00:00`);
      const hasIntersection = inicio <= filtroFim && fim >= filtroInicio;
      return matchesSearch && matchesStatus && hasIntersection;
    }).sort((a, b) => {
      const inicioA = getDataInicioFerias(a);
      const inicioB = getDataInicioFerias(b);

      if (!inicioA && !inicioB) return 0;
      if (!inicioA) return 1;
      if (!inicioB) return -1;
      return inicioA.getTime() - inicioB.getTime();
    });
  }, [ferias, searchTerm, statusFilter, periodStart, periodEnd]);

  const periodFilterLabel = useMemo(() => {
    if (!periodStart || !periodEnd) return 'Período: Todos';
    if (periodFilterType === 'month' && selectedMonth) {
      const [year, month] = selectedMonth.split('-');
      const nome = format(new Date(Number(year), Number(month) - 1, 1), "MMMM/yyyy", { locale: ptBR });
      return `Período: ${nome.charAt(0).toUpperCase()}${nome.slice(1)}`;
    }
    return `Período: ${formatDate(periodStart)} a ${formatDate(periodEnd)}`;
  }, [periodStart, periodEnd, periodFilterType, selectedMonth]);
  const selectedFerias = useMemo(() => filteredFerias.filter((item) => selectedFeriasIds.includes(String(item.id))), [filteredFerias, selectedFeriasIds]);

  const feriasTagsAtivasMap = useMemo(() => {
    const mapa = new Map();
    feriasTagsVinculos.forEach((item) => {
      if (!isFeriasTagVinculoAtivo(item)) {
        return;
      }
      const feriasId = String(getFeriasTagFeriasId(item) || '');
      const tagId = String(getFeriasTagTagId(item) || '');
      if (!feriasId || !tagId) {
        return;
      }
      if (!mapa.has(feriasId)) mapa.set(feriasId, new Map());
      mapa.get(feriasId).set(tagId, item);
    });
    return mapa;
  }, [feriasTagsVinculos]);

  const tagsStatusById = useMemo(() => {
    const status = {};
    if (selectedFerias.length === 0) {
      return status;
    }
    const total = selectedFerias.length;
    const contagem = new Map();
    selectedFerias.forEach((f) => {
      const feriasIdStr = String(f.id);
      const tagsDaFerias = feriasTagsAtivasMap.get(feriasIdStr);
      if (!tagsDaFerias) return;
      tagsDaFerias.forEach((_, tagId) => contagem.set(tagId, (contagem.get(tagId) || 0) + 1));
    });
    contagem.forEach((qtd, tagId) => {
      status[tagId] = qtd === total ? 'all' : 'some';
    });
    return status;
  }, [selectedFerias, feriasTagsAtivasMap]);

  const tagCatalogoById = useMemo(() => {
    return new Map((tagsCatalogo || []).map((tag) => [String(tag.id), tag]));
  }, [tagsCatalogo]);

  const feriasTagsVisuaisMap = useMemo(() => {
    const mapa = new Map();
    feriasTagsAtivasMap.forEach((tagsDaFerias, feriasId) => {
      const chips = [];
      tagsDaFerias.forEach((vinculo, tagId) => {
        const tag = tagCatalogoById.get(String(tagId));
        chips.push({
          id: String(tagId),
          nome: tag?.nome || vinculo?.tag_nome || `Tag #${tagId}`,
          emoji: getTagEmoji(tag || vinculo),
          cor: getTagCor(tag || vinculo),
        });
      });
      chips.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      mapa.set(feriasId, chips);
    });
    return mapa;
  }, [feriasTagsAtivasMap, tagCatalogoById]);

  const salvarTagsBulk = async ({ finalSelectedTagIds }) => {
    const targetIds = new Set((finalSelectedTagIds || []).map(String));
    const now = new Date().toISOString().slice(0, 10);
    const operacoes = [];
    let aplicadas = 0;
    let removidas = 0;
    let semAlteracao = 0;

    const tagNomePorId = new Map((tagsCatalogo || []).map((tag) => [String(tag.id), tag.nome || `Tag #${tag.id}`]));

    selectedFerias.forEach((f) => {
      const ativos = feriasTagsAtivasMap.get(String(f.id)) || new Map();
      targetIds.forEach((tagId) => {
        if (ativos.has(tagId)) {
          semAlteracao += 1;
          return;
        }
        aplicadas += 1;
        operacoes.push({
          acao: 'aplicar',
          ferias_id: f.id,
          tag_id: tagId,
          tag_nome: tagNomePorId.get(String(tagId)),
          ferias_nome: f?.militar_nome || f?.periodo_aquisitivo_ref || `Férias #${f.id}`,
        });
      });
      ativos.forEach((vinculo, tagId) => {
        if (targetIds.has(tagId)) {
          semAlteracao += 1;
          return;
        }
        removidas += 1;
        operacoes.push({
          acao: 'remover',
          id: vinculo.id,
          ferias_id: f.id,
          tag_id: tagId,
          tag_nome: tagNomePorId.get(String(tagId)),
          ferias_nome: f?.militar_nome || f?.periodo_aquisitivo_ref || `Férias #${f.id}`,
        });
      });
    });

    // UMA única chamada bulk para todas as operações
    let resultadosBackend = [];
    if (operacoes.length > 0) {
      try {
        const itensBulk = operacoes.map((op) => ({
          acao: op.acao,
          id: op.id,
          ferias_id: op.ferias_id,
          tag_id: op.tag_id,
          motivo: 'Bulk férias',
          data: now,
        }));
        const resp = await bulkFeriasTagsEscopado(itensBulk);
        resultadosBackend = Array.isArray(resp?.resultados) ? resp.resultados : [];
      } catch (error) {
        // erro global: marca todas como falhadas
        resultadosBackend = operacoes.map(() => ({ ok: false, error: error?.message || 'Falha na requisição bulk.' }));
      }
    }

    const falhas = resultadosBackend.reduce((acc, resultado, index) => {
      if (resultado?.ok) return acc;
      const operacao = operacoes[index];
      acc.push({ ...operacao, motivo: resultado?.error || 'Falha não identificada' });
      return acc;
    }, []);

    const idsComFalha = new Set(
      falhas.map((item) => `${String(item.ferias_id || '')}::${String(item.tag_id || '')}`),
    );

    const aplicarUpdatesEmLista = (lista = []) => {
      const base = Array.isArray(lista) ? [...lista] : [];
      const byFeriasTag = new Map(base.map((item) => [`${String(getFeriasTagFeriasId(item) || '')}::${String(getFeriasTagTagId(item) || '')}`, item]));
      operacoes.forEach((op) => {
        const chave = `${String(op.ferias_id || '')}::${String(op.tag_id || '')}`;
        if (idsComFalha.has(chave)) return;
        if (op.acao === 'aplicar' && !byFeriasTag.has(chave)) {
          byFeriasTag.set(chave, { ferias_id: op.ferias_id, tag_id: op.tag_id, status: 'ativa', data_aplicacao: now });
        }
        if (op.acao === 'remover' && byFeriasTag.has(chave)) {
          const atualItem = byFeriasTag.get(chave);
          byFeriasTag.set(chave, { ...atualItem, status: 'removida', data_remocao: now });
        }
      });
      return [...byFeriasTag.values()];
    };

    // Atualiza o cache do bundle principal (fonte primária) para feedback imediato
    queryClient.setQueryData(feriasQueryKey, (atual) => {
      if (!atual) return atual;
      if (!Array.isArray(atual.feriasTags)) return atual;
      return { ...atual, feriasTags: aplicarUpdatesEmLista(atual.feriasTags) };
    });

    // Atualiza também o cache do fallback antigo (caso esteja em uso)
    queryClient.setQueryData(funcoesTagsKeys.feriasTagsBulk('local', feriasIdsEscopoTags), (atual = []) => aplicarUpdatesEmLista(atual));

    // Invalidações determinísticas para garantir refetch consistente
    queryClient.invalidateQueries({ queryKey: funcoesTagsKeys.feriasTagsBulk('local', feriasIdsEscopoTags) });
    const feriasIdsAfetadas = [...new Set(selectedFerias.map((item) => String(item.id)).filter(Boolean))];
    feriasIdsAfetadas.forEach((feriasId) => {
      queryClient.invalidateQueries({ queryKey: funcoesTagsKeys.feriasTags('local', feriasId) });
    });
    queryClient.invalidateQueries({ queryKey: funcoesTagsKeys.feriasTagsPrefix() });
    queryClient.invalidateQueries({ queryKey: ['ferias'] });
    setFeriasTagsBulkResultado({
      aplicadas: Math.max(0, aplicadas - falhas.filter((f) => f.acao === 'aplicar').length),
      removidas: Math.max(0, removidas - falhas.filter((f) => f.acao === 'remover').length),
      semAlteracao,
      falhas,
    });
  };

  const feriasAgrupadas = useMemo(() => {
    return filteredFerias.reduce((acc, f) => {
      if (!f.data_inicio) {
        const key = 'Sem data';
        if (!acc[key]) acc[key] = { label: 'Sem data', items: [], sortKey: '9999-99' };
        acc[key].items.push(f);
        return acc;
      }

      const d = parseISO(`${f.data_inicio}T00:00:00`);
      const key = format(d, 'yyyy-MM');
      const label = format(d, "MMMM 'de' yyyy", { locale: ptBR });

      if (!acc[key]) acc[key] = { label, items: [], sortKey: key };
      acc[key].items.push(f);
      return acc;
    }, {});
  }, [filteredFerias]);

  const gruposOrdenados = useMemo(() => {
    return Object.values(feriasAgrupadas).sort((a, b) =>
      a.sortKey.localeCompare(b.sortKey)
    );
  }, [feriasAgrupadas]);

  const creditosPorGozo = useMemo(() => {
    const mapa = new Map();
    (creditosExtraFerias || []).forEach((credito) => {
      const gozoId = credito?.gozo_ferias_id;
      const statusCredito = String(credito?.status || '').toUpperCase();
      if (!gozoId) return;
      if (!['VINCULADO', 'USADO'].includes(statusCredito)) return;
      if (!mapa.has(gozoId)) mapa.set(gozoId, []);
      mapa.get(gozoId).push(credito);
    });
    return mapa;
  }, [creditosExtraFerias]);

  const editDataError = useMemo(() => {
    return validarEdicaoDataInicio({
      ferias: editDataModal.ferias,
      novaData: editDataModal.novaData,
      registrosLivro,
    });
  }, [editDataModal, registrosLivro]);

  const previewEditData = useMemo(() => {
    if (!editDataModal.ferias || !editDataModal.novaData) return null;

    const f = editDataModal.ferias;
    const dias = Number(f.dias || 0);

    return {
      inicio: editDataModal.novaData,
      fim: format(addDays(parseDate(editDataModal.novaData), Math.max(dias - 1, 0)), 'yyyy-MM-dd'),
      retorno: format(addDays(parseDate(editDataModal.novaData), dias), 'yyyy-MM-dd'),
    };
  }, [editDataModal]);

  const handleDelete = async (f) => {
    if (!canAccessAction('excluir_ferias') || !canAccessAction('admin_mode') || !modoAdmin) {
      alert('Ação restrita. Exige permissão de exclusão e modo admin ativo.');
      return;
    }
    const escopo = validarEscopoMilitar(f?.militar_id);
    if (!escopo.permitido) {
      alert(escopo.motivo);
      return;
    }

    const cadeiaOperacional = registrosLivro
      .filter(
        (r) =>
          r.ferias_id === f.id &&
          TIPOS_OPERACIONAIS.includes(r.tipo_registro)
      )
      .sort((a, b) => {
        const da = new Date(`${(a.data_registro || '2000-01-01')}T00:00:00`);
        const db = new Date(`${(b.data_registro || '2000-01-01')}T00:00:00`);
        if (da.getTime() !== db.getTime()) return da.getTime() - db.getTime();
        return new Date(a.created_date || 0).getTime() - new Date(b.created_date || 0).getTime();
      });

    if (cadeiaOperacional.length > 0) {
      setCadeiaBloqueandoDelete(cadeiaOperacional);
      setDeleteBlockedDialogOpen(true);
      return;
    }

    setFeriasToDelete(f);
    setCadeiaBloqueandoDelete([]);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!feriasToDelete) return;
    if (!canAccessAction('excluir_ferias') || !canAccessAction('admin_mode') || !modoAdmin) {
      alert('Ação restrita. Exige permissão de exclusão e modo admin ativo.');
      return;
    }
    const escopo = validarEscopoMilitar(feriasToDelete?.militar_id);
    if (!escopo.permitido) {
      alert(escopo.motivo);
      return;
    }

    deleteMutation.mutate({
      feriasId: feriasToDelete.id,
      periodoId: feriasToDelete.periodo_aquisitivo_id,
      periodoRef: feriasToDelete.periodo_aquisitivo_ref,
      militarId: feriasToDelete.militar_id,
    });
  };

  const abrirRegistroLivroModal = (ferias, tipo) => {
    const escopo = validarEscopoMilitar(ferias?.militar_id);
    if (!escopo.permitido) {
      alert(escopo.motivo);
      return;
    }
    setRegistroLivroModal({ open: true, ferias, tipo });
  };

  const abrirEdicaoFerias = (ferias) => {
    const escopo = validarEscopoMilitar(ferias?.militar_id);
    if (!escopo.permitido) {
      alert(escopo.motivo);
      return;
    }
    navigate(createPageUrl('CadastrarFerias') + `?id=${ferias.id}`);
  };

  const abrirEditDataModal = (ferias) => {
    const escopo = validarEscopoMilitar(ferias?.militar_id);
    if (!escopo.permitido) {
      alert(escopo.motivo);
      return;
    }
    setEditDataModal({ open: true, ferias, novaData: ferias.data_inicio || '' });
  };

  const handleSalvarEditData = async () => {
    if (!editDataModal.ferias || !editDataModal.novaData || editDataError) return;
    const escopo = validarEscopoMilitar(editDataModal.ferias?.militar_id);
    if (!escopo.permitido) {
      alert(escopo.motivo);
      return;
    }

    setSavingEdit(true);

    try {
      const f = editDataModal.ferias;
      const novaDataFim = format(
        addDays(parseDate(editDataModal.novaData), (f.dias || 0) - 1),
        'yyyy-MM-dd'
      );
      const novaDataRetorno = format(
        addDays(parseDate(editDataModal.novaData), f.dias || 0),
        'yyyy-MM-dd'
      );

      await atualizarEscopado('Ferias', f.id, {
        data_inicio: editDataModal.novaData,
        data_fim: novaDataFim,
        data_retorno: novaDataRetorno,
      });

      await sincronizarPeriodoAquisitivoDaFerias({
        periodoAquisitivoId: f.periodo_aquisitivo_id || null,
        periodoAquisitivoRef: f.periodo_aquisitivo_ref || null,
        militarId: f.militar_id || null,
      });

      queryClient.invalidateQueries({ queryKey: ['ferias'] });
      queryClient.invalidateQueries({ queryKey: ['ferias-creditos-extra'] });
      setEditDataModal({ open: false, ferias: null, novaData: '' });
    } catch (error) {
      console.error('Erro ao alterar data de início das férias:', error);
      alert('Erro ao alterar data de início.');
    } finally {
      setSavingEdit(false);
    }
  };

  const applyPresetPeriod = (preset) => {
    const now = new Date();
    if (preset === 'none') {
      setPeriodFilterType('none');
      setPeriodStart('');
      setPeriodEnd('');
      setSelectedMonth('');
      setCustomRangeError('');
      return;
    }

    let start = null;
    let end = null;
    if (preset === 'today') {
      start = now;
      end = now;
    } else if (preset === 'this_week') {
      start = startOfWeek(now, { weekStartsOn: 1 });
      end = endOfWeek(now, { weekStartsOn: 1 });
    } else if (preset === 'last_week') {
      const base = subWeeks(now, 1);
      start = startOfWeek(base, { weekStartsOn: 1 });
      end = endOfWeek(base, { weekStartsOn: 1 });
    } else if (preset === 'this_month') {
      start = startOfMonth(now);
      end = endOfMonth(now);
    } else if (preset === 'last_month') {
      const base = subMonths(now, 1);
      start = startOfMonth(base);
      end = endOfMonth(base);
    }

    if (start && end) {
      setPeriodFilterType(preset);
      setPeriodStart(toIsoDate(start));
      setPeriodEnd(toIsoDate(end));
      setSelectedMonth('');
      setCustomRangeError('');
    }
  };

  if (!loadingUser && isAccessResolved && !canAccessModule('ferias')) return <AccessDenied modulo="Férias" />;

  const stats = {
    total: ferias.length,
    emCurso: ferias.filter((f) => f.status === 'Em Curso').length,
    previstas: ferias.filter((f) => f.status === 'Prevista').length,
    gozadas: ferias.filter((f) => f.status === 'Gozada').length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#1e3a5f]">Férias</h1>
            <p className="text-slate-500">Plano de férias por período</p>
          </div>

          <div className="flex gap-2">
            {canAccessAction('admin_mode') && (
              <Button
                variant={modoAdmin ? 'default' : 'outline'}
                onClick={() => setModoAdmin((v) => !v)}
                className={modoAdmin
                  ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                  : 'border-red-300 text-red-600 hover:bg-red-50'}
                title={modoAdmin ? 'Desativar modo admin' : 'Ativar modo admin para ações sensíveis'}
              >
                <ShieldAlert className="w-4 h-4 mr-2" />
                {modoAdmin ? 'Admin Ativo' : 'Modo Admin'}
              </Button>
            )}

            <Button
              variant="outline"
              onClick={() => navigate(createPageUrl('PeriodosAquisitivos'))}
              className="border-slate-300"
            >
              <Settings className="w-4 h-4 mr-2" />
              Períodos Aquisitivos
            </Button>

            <Button
              onClick={() => navigate(createPageUrl('CadastrarFerias'))}
              className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white"
            >
              <Plus className="w-5 h-5 mr-2" />
              Nova Férias
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: 'Total',
              value: stats.total,
              icon: Calendar,
              iconBg: 'bg-[#1e3a5f]/10',
              iconText: 'text-[#1e3a5f]',
              valueText: 'text-[#1e3a5f]',
            },
            {
              label: 'Em Curso',
              value: stats.emCurso,
              icon: Clock,
              iconBg: 'bg-amber-100',
              iconText: 'text-amber-600',
              valueText: 'text-amber-600',
            },
            {
              label: 'Previstas',
              value: stats.previstas,
              icon: Calendar,
              iconBg: 'bg-blue-100',
              iconText: 'text-blue-600',
              valueText: 'text-blue-600',
            },
            {
              label: 'Gozadas',
              value: stats.gozadas,
              icon: CheckCircle,
              iconBg: 'bg-emerald-100',
              iconText: 'text-emerald-600',
              valueText: 'text-emerald-600',
            },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${s.iconBg} flex items-center justify-center`}>
                  <s.icon className={`w-5 h-5 ${s.iconText}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${s.valueText}`}>{s.value}</p>
                  <p className="text-xs text-slate-500">{s.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Buscar por militar, matrícula ou período..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10 border-slate-200"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 h-10 border-slate-200">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="Prevista">Prevista</SelectItem>
                <SelectItem value="Autorizada">Autorizada</SelectItem>
                <SelectItem value="Em Curso">Em Curso</SelectItem>
                <SelectItem value="Gozada">Gozada</SelectItem>
                <SelectItem value="Interrompida">Interrompida</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-[220px_1fr_auto] gap-3 items-start">
            <Select
              value={periodFilterType}
              onValueChange={(value) => {
                setPeriodFilterType(value);
                setCustomRangeError('');
                if (['none', 'today', 'this_week', 'last_week', 'this_month', 'last_month'].includes(value)) {
                  applyPresetPeriod(value);
                } else if (value !== 'month') {
                  setSelectedMonth('');
                }
              }}
            >
              <SelectTrigger className="h-10 border-slate-200">
                <SelectValue placeholder="Filtro de período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem período</SelectItem>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="this_week">Esta semana</SelectItem>
                <SelectItem value="last_week">Semana passada</SelectItem>
                <SelectItem value="this_month">Este mês</SelectItem>
                <SelectItem value="last_month">Mês passado</SelectItem>
                <SelectItem value="month">Selecionar mês</SelectItem>
                <SelectItem value="custom">Período customizado</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex flex-wrap gap-2 items-center">
              {periodFilterType === 'month' && (
                <Input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => {
                    const monthValue = e.target.value;
                    setSelectedMonth(monthValue);
                    if (!monthValue) return;
                    const [year, month] = monthValue.split('-');
                    const dt = new Date(Number(year), Number(month) - 1, 1);
                    setPeriodStart(toIsoDate(startOfMonth(dt)));
                    setPeriodEnd(toIsoDate(endOfMonth(dt)));
                  }}
                  className="h-10 w-[190px] border-slate-200"
                />
              )}

              {periodFilterType === 'custom' && (
                <>
                  <Input
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    className="h-10 w-[165px] border-slate-200"
                  />
                  <span className="text-slate-400 text-sm">até</span>
                  <Input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    className="h-10 w-[165px] border-slate-200"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (!periodStart || !periodEnd) return;
                      if (parseISO(`${periodEnd}T00:00:00`) < parseISO(`${periodStart}T00:00:00`)) {
                        setCustomRangeError('Período inválido: fim anterior ao início.');
                        return;
                      }
                      setCustomRangeError('');
                    }}
                  >
                    Aplicar
                  </Button>
                </>
              )}
            </div>

            <Button type="button" variant="ghost" onClick={() => applyPresetPeriod('none')}>
              Limpar período
            </Button>
          </div>
          {customRangeError && <p className="text-xs text-red-600 mt-2">{customRangeError}</p>}
          <p className="text-xs text-slate-500 mt-2">{periodFilterLabel}</p>
        </div>

        <div className="mb-4 text-sm text-slate-500">
          {hasFeriasLoadError ? 'Falha ao carregar dados.' : `${filteredFerias.length} férias encontrada(s)`}
        </div>
        {selectedFeriasIds.length > 0 && (
          <div className="mb-4 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
            <SelectionActionBar
              count={selectedFeriasIds.length}
              label="férias selecionadas"
              helperText="Ação aplicada apenas aos registros selecionados nesta tela."
              onManageTags={() => { setFeriasTagsBulkResultado(null); setFeriasTagsBulkOpen(true); }}
              onClear={() => setSelectedFeriasIds([])}
              manageTagsLabel="Gerenciar tags"
            />
          </div>
        )}
        {!isFeriasError && hasPartialDataWarning && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Alguns dados não puderam ser carregados. Tente novamente para atualizar.
            <DataDebugPanel debugData={feriasDebugData} />
          </div>
        )}

        {isPageLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : hasFeriasLoadError ? (
          <div className="bg-white rounded-xl shadow-sm border border-red-200 p-12 text-center">
            <Calendar className="w-16 h-16 mx-auto text-red-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">
              {isRateLimitScopedError ? 'Muitas requisições ao carregar escopo' : 'Falha ao carregar dados'}
            </h3>
            <p className="text-slate-500 mb-6">
              {isRateLimitScopedError
                ? 'Houve excesso de requisições ao carregar os militares do seu escopo. Aguarde alguns segundos e tente novamente.'
                : 'Não foi possível carregar os dados de férias no momento. Tente novamente.'}
            </p>
            <Button
              onClick={() => retryFeriasLoad()}
              className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white"
            >
              Tentar novamente
            </Button>
            <DataDebugPanel debugData={feriasDebugData} className="text-left" />
          </div>
        ) : filteredFerias.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center">
            <Calendar className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">
              Nenhuma férias encontrada
            </h3>
            <p className="text-slate-500 mb-6">
              {searchTerm || statusFilter !== 'all'
                ? 'Tente ajustar os filtros'
                : 'Comece cadastrando as primeiras férias'}
            </p>

            {!searchTerm && statusFilter === 'all' && (
              <Button
                onClick={() => navigate(createPageUrl('CadastrarFerias'))}
                className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white"
              >
                <Plus className="w-5 h-5 mr-2" />
                Cadastrar Férias
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {gruposOrdenados.map((grupo) => {
              const isExpanded = expandedMonths.has(grupo.sortKey);
              return (
              <div key={grupo.sortKey}>
                <button
                  type="button"
                  onClick={() => toggleMonth(grupo.sortKey)}
                  className="flex items-center gap-3 mb-3 w-full text-left group"
                >
                  <div className="w-2 h-2 rounded-full bg-[#1e3a5f]" />
                  <h2 className="text-base font-semibold text-[#1e3a5f] capitalize group-hover:text-[#2d4a6f]">
                    {grupo.label}
                  </h2>
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-xs text-slate-400">{grupo.items.length} registro(s)</span>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>

                {isExpanded && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="text-left px-3 py-3 font-semibold text-slate-600 w-10" />
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Militar</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Tags</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Período Aquisitivo</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Início</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Retorno</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Dias</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Fração</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                        <th className="text-center px-3 py-3 font-semibold text-slate-600 w-10" title="Rastro da família">
                          <GitBranch className="w-4 h-4 mx-auto text-slate-400" />
                        </th>
                        <th className="text-right px-4 py-3 font-semibold text-slate-600">Ações</th>
                      </tr>
                    </thead>

                    <tbody>
                      {grupo.items.map((f) => {
                        const temEventos = registrosLivro.some(
                          (r) =>
                            r.ferias_id === f.id &&
                            TIPOS_OPERACIONAIS.includes(r.tipo_registro)
                        );
                        const creditosDoGozo = creditosPorGozo.get(f.id) || [];
                        const diasExtras = creditosDoGozo.reduce((acc, credito) => acc + Number(credito?.quantidade_dias || 0), 0);

                        const interrupcaoInfo =
                          f.status === 'Interrompida'
                            ? deriveInterrupcaoData(f, registrosLivro)
                            : null;

                        const inicioBlockedReason =
                          f.status === 'Prevista' || f.status === 'Autorizada'
                            ? getBlockingReasonForInicio(f, ferias)
                            : null;

                        const inicioBlocked = Boolean(inicioBlockedReason);
                        const observacaoFerias = String(f.observacao || f.observacoes || '').trim();
                        const temObservacaoFerias = observacaoFerias.length > 0;
                        const tagsVisuais = feriasTagsVisuaisMap.get(String(f.id)) || [];
                        const tagsPreview = tagsVisuais.slice(0, 3);
                        const tagsOverflow = Math.max(0, tagsVisuais.length - 3);

                        return (
                          <tr
                            key={f.id}
                            className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                          >
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={selectedFeriasIds.includes(String(f.id))}
                                onChange={(e) => setSelectedFeriasIds((prev) => e.target.checked ? [...new Set([...prev, String(f.id)])] : prev.filter((id) => id !== String(f.id)))}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-900">
                                  {f.militar_posto && (
                                    <span className="text-slate-500 mr-1 text-xs">{f.militar_posto}</span>
                                  )}
                                  {f.militar_nome}
                                </span>
                                {temObservacaoFerias && (
                                  <TooltipProvider delayDuration={100}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 cursor-help">
                                          <MessageSquareText className="w-3 h-3" />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-[340px] whitespace-pre-wrap break-words p-3 bg-slate-50 border border-slate-200 text-slate-700 shadow-lg">
                                        <p className="text-xs font-semibold text-[#1e3a5f] mb-1">Observação</p>
                                        <p className="text-xs text-slate-600">{observacaoFerias}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                              <p className="text-xs text-slate-400">Mat: {f.militar_matricula_label || f.militar_matricula || '—'}</p>
                              {f.militar_mesclado && (
                                <p className="text-[11px] text-amber-700">Registro vinculado a militar mesclado (somente histórico documental).</p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {tagsVisuais.length === 0 ? (
                                <span className="text-slate-300">—</span>
                              ) : (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {tagsPreview.map((tag) => (
                                    <TooltipProvider key={tag.id} delayDuration={100}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span
                                            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium cursor-help"
                                            style={{ backgroundColor: `${tag.cor}1A`, borderColor: `${tag.cor}4D`, color: tag.cor }}
                                          >
                                            <span aria-hidden="true"><IconeCatalogo value={resolveTagVisual(tag).emoji} /></span>
                                            <span className="max-w-[90px] truncate">{tag.nome}</span>
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p className="text-xs">{tag.nome}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  ))}
                                  {tagsOverflow > 0 && (
                                    <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                      +{tagsOverflow}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>

                            <td className="px-4 py-3 text-slate-600">{f.periodo_aquisitivo_ref || '-'}</td>

                            <td className="px-4 py-3 text-slate-700">
                              <div className="flex items-center gap-1 group">
                                <span>{formatDate(f.data_inicio)}</span>
                                {f.status !== 'Gozada' && (
                                  <button
                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-[#1e3a5f]"
                                    title="Alterar data de início"
                                    onClick={() => abrirEditDataModal(f)}
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </td>

                            <td className="px-4 py-3 text-slate-700">{formatDate(f.data_retorno)}</td>

                            <td className="px-4 py-3 text-slate-700">
                              <div className="flex flex-col">
                                <span className="flex items-center gap-1">
                                  {f.dias}d
                                  {diasExtras > 0 && (
                                    <TooltipProvider delayDuration={100}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="text-red-600 font-semibold cursor-help">+{diasExtras}</span>
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-[340px] p-3 bg-slate-50 border border-slate-200 text-slate-700 shadow-lg">
                                          <p className="text-xs font-semibold text-[#1e3a5f] mb-2">Créditos extraordinários vinculados</p>
                                          <div className="space-y-1.5">
                                            {creditosDoGozo.map((credito) => (
                                              <p key={credito.id} className="text-xs text-slate-600">
                                                <span className="font-semibold text-[#1e3a5f]">+{Number(credito.quantidade_dias || 0)}d</span>
                                                {' · '}
                                                {formatarTipoCreditoExtra(credito.tipo_credito)}
                                                {credito.observacoes ? ` — ${credito.observacoes}` : ''}
                                              </p>
                                            ))}
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                </span>

                                {f.status === 'Interrompida' && interrupcaoInfo?.saldo != null && (
                                  <span className="text-xs text-orange-600 font-medium">
                                    Saldo: {interrupcaoInfo.saldo}d
                                  </span>
                                )}

                                {f.status === 'Interrompida' && interrupcaoInfo?.gozados != null && (
                                  <span className="text-xs text-slate-500">
                                    Gozados: {interrupcaoInfo.gozados}d
                                  </span>
                                )}

                                {inicioBlocked && (
                                  <span className="text-xs text-red-600 mt-1">
                                    Início bloqueado
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="px-4 py-3">
                              {f.fracionamento && (
                                <Badge className="bg-purple-100 text-purple-700 text-xs">
                                  {f.fracionamento}
                                </Badge>
                              )}
                            </td>

                            <td className="px-4 py-3">
                              <Badge
                                className={`${statusColors[f.status] || 'bg-slate-100 text-slate-700'} text-xs`}
                              >
                                {f.status}
                              </Badge>
                            </td>

                            <td className="px-3 py-3 text-center">
                              {temEventos ? (
                                <button
                                  title="Ver rastro da família"
                                  onClick={() => setFamiliaPanel({ open: true, ferias: f })}
                                  className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#1e3a5f]/8 hover:bg-[#1e3a5f]/15 text-[#1e3a5f] transition-colors"
                                >
                                  <GitBranch className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>

                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreHorizontal className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>

                                  <DropdownMenuContent align="end" className="w-56">
                                    {(f.status === 'Prevista' || f.status === 'Autorizada') && (
                                      <DropdownMenuItem
                                        disabled={inicioBlocked}
                                        title={inicioBlockedReason || ''}
                                        onClick={() => abrirRegistroLivroModal(f, 'Saída Férias')}
                                      >
                                        {inicioBlocked ? (
                                          <Lock className="w-4 h-4 mr-2 text-red-500" />
                                        ) : (
                                          <LogOut className="w-4 h-4 mr-2 text-emerald-600" />
                                        )}
                                        <span>{inicioBlocked ? 'Início bloqueado' : 'Início'}</span>
                                      </DropdownMenuItem>
                                    )}

                                    {f.status === 'Interrompida' && (
                                      <DropdownMenuItem
                                        onClick={() => abrirRegistroLivroModal(f, 'Nova Saída / Retomada')}
                                      >
                                        <RefreshCw className="w-4 h-4 mr-2 text-teal-600" />
                                        <span>Continuação</span>
                                      </DropdownMenuItem>
                                    )}

                                    {f.status === 'Em Curso' && (
                                      <>
                                        <DropdownMenuItem
                                          onClick={() => abrirRegistroLivroModal(f, 'Retorno Férias')}
                                        >
                                          <LogIn className="w-4 h-4 mr-2 text-blue-600" />
                                          <span>Término</span>
                                        </DropdownMenuItem>

                                        <DropdownMenuItem
                                          onClick={() => abrirRegistroLivroModal(f, 'Interrupção de Férias')}
                                        >
                                          <PauseCircle className="w-4 h-4 mr-2 text-orange-600" />
                                          <span>Interrupção</span>
                                        </DropdownMenuItem>
                                      </>
                                    )}

                                    {f.status !== 'Gozada' && (
                                      <>
                                        <DropdownMenuSeparator />

                                        <DropdownMenuItem
                                          onClick={() => abrirEditDataModal(f)}
                                        >
                                          <Pencil className="w-4 h-4 mr-2 text-slate-500" />
                                          <span>Alterar Data de Início</span>
                                        </DropdownMenuItem>

                                        <DropdownMenuItem
                                          onClick={() => abrirEdicaoFerias(f)}
                                        >
                                          <Pencil className="w-4 h-4 mr-2 text-slate-500" />
                                          <span>Editar Férias</span>
                                        </DropdownMenuItem>

                                        {(canAccessAction('excluir_ferias')) && (() => {
                                          const temCadeia = registrosLivro.some(
                                            (r) => r.ferias_id === f.id && TIPOS_OPERACIONAIS.includes(r.tipo_registro)
                                          );
                                          if (temCadeia) {
                                            return (
                                              <DropdownMenuItem
                                                disabled
                                                className="text-slate-400"
                                                title="Esta férias já possui atos/cadeia vinculados e não pode ser excluída de forma simples."
                                              >
                                                <Lock className="w-4 h-4 mr-2" />
                                                <span>Excluir Férias (possui cadeia)</span>
                                              </DropdownMenuItem>
                                            );
                                          }
                                          const escopo = validarEscopoMilitar(f?.militar_id);
                                          const semEscopo = !escopo.permitido;
                                          const disabled = !modoAdmin || !canAccessAction('admin_mode') || semEscopo;
                                          const title = !canAccessAction('admin_mode')
                                            ? 'Ação negada: sem permissão para usar o modo admin.'
                                            : (!modoAdmin
                                              ? 'Ative o modo admin para usar esta função.'
                                              : (semEscopo ? escopo.motivo : ''));
                                          return (
                                            <DropdownMenuItem
                                              disabled={disabled}
                                              onClick={() => !disabled && handleDelete(f)}
                                              className={!disabled ? 'text-red-600 focus:text-red-600' : 'text-slate-400'}
                                              title={title}
                                            >
                                              {modoAdmin ? (
                                                <Trash2 className="w-4 h-4 mr-2" />
                                              ) : (
                                                <Lock className="w-4 h-4 mr-2" />
                                              )}
                                              <span>{modoAdmin ? 'Excluir Férias' : 'Excluir (modo admin)'}</span>
                                            </DropdownMenuItem>
                                          );
                                        })()}
                                      </>
                                    )}

                                    {f.status === 'Gozada' && (
                                      <DropdownMenuItem disabled className="text-slate-400 text-xs italic">
                                        Férias encerrada — sem ações operacionais
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                )}
              </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={deleteBlockedDialogOpen} onOpenChange={setDeleteBlockedDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              Exclusão bloqueada pela cadeia operacional
            </DialogTitle>
            <DialogDescription>
              Estas férias possuem eventos operacionais vinculados. Para excluir com segurança,
              administre primeiro a cadeia pelo painel “Rastro da Família”.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {cadeiaBloqueandoDelete.map((evento, index) => (
              <div
                key={evento.id}
                className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-slate-50"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    #{index + 1} — {NOMES_OPERACIONAIS[evento.tipo_registro] || evento.tipo_registro}
                  </p>
                  <p className="text-xs text-slate-500">
                    Data: {formatDate(getEventDate(evento))}
                    {evento.dias ? ` — ${evento.dias} dias` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
            Abra o rastro da família e use o bloco <strong>Administração da Cadeia</strong> para:
            excluir um evento específico, excluir evento + descendentes, ou recalcular a cadeia.
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteBlockedDialogOpen(false);
                setFeriasToDelete(null);
                setCadeiaBloqueandoDelete([]);
              }}
            >
              Fechar
            </Button>

            {feriasToDelete && (
              <Button
                className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white"
                onClick={() => {
                  setDeleteBlockedDialogOpen(false);
                  setFamiliaPanel({ open: true, ferias: feriasToDelete });
                }}
              >
                Abrir Rastro da Família
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <RegistroLivroModal
        open={registroLivroModal.open}
        onClose={() =>
          setRegistroLivroModal({ open: false, ferias: null, tipo: 'Saída Férias' })
        }
        ferias={registroLivroModal.ferias}
        tipoInicial={registroLivroModal.tipo}
      />

      <Dialog
        open={editDataModal.open}
        onOpenChange={(v) => !v && setEditDataModal({ open: false, ferias: null, novaData: '' })}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#1e3a5f]">Alterar Data de Início</DialogTitle>
            <DialogDescription>
              A alteração manual respeita a cronologia da cadeia já existente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {editDataModal.ferias && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-medium text-slate-700">
                  {editDataModal.ferias.militar_posto} {editDataModal.ferias.militar_nome}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {editDataModal.ferias.dias} dias • Período {editDataModal.ferias.periodo_aquisitivo_ref || '-'}
                </p>
              </div>
            )}

            <div>
              <Input
                type="date"
                value={editDataModal.novaData}
                onChange={(e) =>
                  setEditDataModal((p) => ({ ...p, novaData: e.target.value }))
                }
                className="mt-1.5"
              />
            </div>

            {previewEditData && !editDataError && (
              <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm">
                <div className="font-medium text-cyan-800 mb-2">Prévia da atualização</div>
                <div className="grid grid-cols-3 gap-3 text-cyan-900">
                  <div>
                    <div className="text-cyan-700 text-xs">Início</div>
                    <div className="font-semibold">{formatDate(previewEditData.inicio)}</div>
                  </div>
                  <div>
                    <div className="text-cyan-700 text-xs">Fim</div>
                    <div className="font-semibold">{formatDate(previewEditData.fim)}</div>
                  </div>
                  <div>
                    <div className="text-cyan-700 text-xs">Retorno</div>
                    <div className="font-semibold">{formatDate(previewEditData.retorno)}</div>
                  </div>
                </div>
              </div>
            )}

            {editDataError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {editDataError}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setEditDataModal({ open: false, ferias: null, novaData: '' })}
              >
                Cancelar
              </Button>

              <Button
                disabled={savingEdit || !editDataModal.novaData || !!editDataError}
                onClick={handleSalvarEditData}
                className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white"
              >
                {savingEdit ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                ) : null}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir férias?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação excluirá apenas o registro de férias selecionado e liberará o período aquisitivo vinculado.
              Use esta opção somente quando não houver eventos operacionais na família.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setFeriasToDelete(null);
                setCadeiaBloqueandoDelete([]);
              }}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {familiaPanel.open && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setFamiliaPanel({ open: false, ferias: null })}
          />
          <FamiliaFeriasPanel
            ferias={familiaPanel.ferias}
            registrosLivro={registrosLivro}
            onClose={() => setFamiliaPanel({ open: false, ferias: null })}
            modoAdmin={modoAdmin}
          />
        </>
      )}
      <FeriasTagsBulkPanel
        open={feriasTagsBulkOpen}
        onClose={() => setFeriasTagsBulkOpen(false)}
        selectedFerias={selectedFerias}
        tagsStatusById={tagsStatusById}
        onConfirm={salvarTagsBulk}
        resultadoOperacao={feriasTagsBulkResultado}
      />
    </div>
  );
}