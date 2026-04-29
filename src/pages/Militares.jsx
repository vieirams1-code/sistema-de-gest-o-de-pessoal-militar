import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
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
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Eye, Pencil, Trash2, Users } from 'lucide-react';
import {
  carregarMilitaresComMatriculas,
  filtrarMilitaresOperacionais,
  getLotacaoAtualMilitar,
  militarCorrespondeBusca,
} from '@/services/matriculaMilitarViewService';
import { excluirMilitarComDependencias } from '@/services/militarExclusaoService';
import DataDebugPanel from '@/components/debug/DataDebugPanel';

const TODAS_LOTACOES_VALUE = '__todas_lotacoes__';
const statusBadgeClass = { Ativo: 'bg-emerald-100 text-emerald-700 border-emerald-200', Inativo: 'bg-slate-100 text-slate-700 border-slate-200', Reserva: 'bg-amber-100 text-amber-700 border-amber-200', Reforma: 'bg-blue-100 text-blue-700 border-blue-200', Falecido: 'bg-red-100 text-red-700 border-red-200' };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const loadSubgrupamentosWithRetry = async ({ maxRetries = 2, baseDelayMs = 500 } = {}) => {
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await base44.entities.Subgrupamento.list('nome', 200);
    } catch (error) {
      lastError = error;
      if (attempt >= maxRetries) break;
      await sleep(baseDelayMs * (2 ** attempt));
    }
  }

  throw lastError || new Error('Falha ao carregar lotações.');
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
  const { isAdmin, userEmail, linkedMilitarEmail, canAccessModule, canAccessAction, getMilitarScopeFilters, isLoading: loadingUser, isAccessResolved } = useCurrentUser();

  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('q') || '');
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [debouncedGroups, setDebouncedGroups] = useState([]);
  const [lotacaoFilter, setLotacaoFilter] = useState(TODAS_LOTACOES_VALUE);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [militarToDelete, setMilitarToDelete] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedGroups(selectedGroups), 300);
    return () => clearTimeout(t);
  }, [selectedGroups]);

  const selectedPostos = useMemo(() => {
    const postos = GRADUACAO_GROUPS.filter((g) => debouncedGroups.includes(g.key)).flatMap((g) => g.postos);
    return [...new Set(postos)];
  }, [debouncedGroups]);

  const shouldQuery = isAccessResolved && selectedPostos.length > 0;

  const lotacoesAdminQueryKey = ['militares-lotacoes-admin'];
  const {
    data: lotacoesAdminData = [],
    isLoading: isLoadingLotacoesAdmin,
    isError: isErrorLotacoesAdmin,
    error: lotacoesAdminError,
    refetch: refetchLotacoesAdmin,
  } = useQuery({
    queryKey: lotacoesAdminQueryKey,
    enabled: isAdmin,
    queryFn: async () => {
      const lotacoes = await loadSubgrupamentosWithRetry({ maxRetries: 2, baseDelayMs: 400 });
      return (lotacoes || [])
        .filter((item) => {
          const status = String(item?.status || '').trim().toLowerCase();
          if (item?.deleted === true) return false;
          if (item?.is_deleted === true) return false;
          if (item?.excluido === true) return false;
          if (item?.ativo === false) return false;
          if (item?.archived === true) return false;
          if (item?.arquivado === true) return false;
          if (status === 'excluído' || status === 'excluido' || status === 'inativo') return false;
          return true;
        })
        .map((item) => String(item?.nome || '').trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    },
  });

  const { data: militaresData, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['militares-consulta-rapida', isAdmin, lotacaoFilter, selectedPostos.join('|')],
    enabled: shouldQuery,
    queryFn: async () => {
      const filters = isAdmin ? [{ posto_graduacao: { in: selectedPostos } }] : getMilitarScopeFilters();
      if (!filters.length) return { militares: [], partialFailures: 0, totalCarregadoAntesFiltroLocal: 0, totalDepoisFiltroLocal: 0, lotacoesEncontradasNosResultados: [] };

      const runAdminFilter = async () => {
        const diagnostico = { filtro: filters[0], quantidade: 0, fallbackIndividual: false, erro: null };
        try {
          const data = await base44.entities.Militar.filter(filters[0], '-created_date');
          const lista = data || [];
          diagnostico.quantidade = lista.length;

          if (lista.length > 0) return { data: lista, diagnostico };

          const results = await Promise.allSettled(
            selectedPostos.map((posto) => base44.entities.Militar.filter({ posto_graduacao: posto }, '-created_date'))
          );
          const fulfilled = results
            .filter((result) => result.status === 'fulfilled')
            .flatMap((result) => result.value || []);
          diagnostico.fallbackIndividual = true;
          diagnostico.quantidade = fulfilled.length;
          return { data: fulfilled, diagnostico };
        } catch (erroInOperator) {
          const results = await Promise.allSettled(
            selectedPostos.map((posto) => base44.entities.Militar.filter({ posto_graduacao: posto }, '-created_date'))
          );
          const fulfilled = results
            .filter((result) => result.status === 'fulfilled')
            .flatMap((result) => result.value || []);
          diagnostico.erro = erroInOperator;
          diagnostico.fallbackIndividual = true;
          diagnostico.quantidade = fulfilled.length;
          return { data: fulfilled, diagnostico };
        }
      };

      const diagnostico = [];
      const settled = await Promise.allSettled(
        isAdmin
          ? [runAdminFilter().then((result) => { diagnostico.push(result.diagnostico); return result.data; })]
          : filters.map((filtro) => {
            const diag = { filtro, quantidade: 0 };
            diagnostico.push(diag);
            return base44.entities.Militar.filter(filtro, '-created_date').then((data) => {
              const lista = data || [];
              diag.quantidade = lista.length;
              return lista;
            });
          })
      );
      const fulfilled = settled.filter((s) => s.status === 'fulfilled').map((s) => s.value || []);
      const partialFailures = settled.length - fulfilled.length;
      if (!fulfilled.length && settled.length) throw new Error('Falha ao carregar militares por escopo.');

      const unique = new Map();
      fulfilled.flat().forEach((m) => { if (!unique.has(m.id)) unique.set(m.id, m); });
      const militaresEnriquecidos = await carregarMilitaresComMatriculas(Array.from(unique.values()));
      const militaresComLotacaoAtual = militaresEnriquecidos.map((m) => ({ ...m, lotacao_atual: getLotacaoAtualMilitar(m) }));
      const totalCarregadoAntesFiltroLocal = militaresComLotacaoAtual.length;
      const lotacaoNormalizada = String(lotacaoFilter || '').trim().toLowerCase();
      const militares = lotacaoFilter !== TODAS_LOTACOES_VALUE
        ? militaresComLotacaoAtual.filter((m) => {
          const lotacaoAtual = String(m.lotacao_atual || '').trim().toLowerCase();
          return lotacaoAtual.includes(lotacaoNormalizada) || lotacaoNormalizada.includes(lotacaoAtual);
        })
        : militaresComLotacaoAtual;
      const totalDepoisFiltroLocal = militares.length;
      const lotacoesEncontradasNosResultados = [...new Set(militaresComLotacaoAtual.map((m) => m.lotacao_atual).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

      if (import.meta.env.DEV) {
        console.warn('[Militares] Diagnóstico consulta rápida', {
          lotacaoFilter,
          selectedPostos,
          filtrosTentados: diagnostico.map((item) => ({
            filtro: item.filtro,
            fallbackIndividual: Boolean(item.fallbackIndividual),
            quantidade: item.quantidade,
            erro: item.erro ? String(item.erro?.message || item.erro) : null,
          })),
          totalUnico: unique.size,
          totalCarregadoAntesFiltroLocal,
          totalDepoisFiltroLocal,
          lotacoesEncontradasNosResultados,
        });
      }

      return { militares, partialFailures, totalCarregadoAntesFiltroLocal, totalDepoisFiltroLocal, lotacoesEncontradasNosResultados };
    },
  });

  const militares = useMemo(() => militaresData?.militares || [], [militaresData]);
  const operacionais = filtrarMilitaresOperacionais(militares, { incluirInativos: true });
  const filteredMilitares = operacionais.filter((m) => militarCorrespondeBusca(m, searchTerm));

  const lotacoesDisponiveis = useMemo(() => (isAdmin ? lotacoesAdminData : []), [isAdmin, lotacoesAdminData]);
  const isLotacoesAdminRateLimit = String(lotacoesAdminError?.message || '').includes('Rate limit exceeded');
  const lotacoesAdminEmptyForAdmin = isAdmin && !isLoadingLotacoesAdmin && !isErrorLotacoesAdmin && lotacoesDisponiveis.length === 0;
  const shouldShowLotacoesDebugPanel = isAdmin && (isErrorLotacoesAdmin || lotacoesAdminEmptyForAdmin);

  const deleteMutation = useMutation({
    mutationFn: (id) => excluirMilitarComDependencias(id, { executadoPor: userEmail || '' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['militares-consulta-rapida'] });
      setDeleteDialogOpen(false);
      setMilitarToDelete(null);
    }
  });

  if (!loadingUser && isAccessResolved && !canAccessModule('militares')) return <AccessDenied modulo="Efetivo" />;

  const emptyInstruction = 'Selecione uma ou mais graduações para carregar o efetivo.';

  const isRateLimitError = String(error?.message || '').toLowerCase().includes('rate limit');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-[#1e3a5f]">Efetivo</h1>
            <p className="text-slate-500">Consulta rápida por lotação e graduação</p>
            <p className="text-xs text-slate-500 mt-1">Escopo atual: {isAdmin ? 'Administrador' : (linkedMilitarEmail || userEmail || 'Usuário')}</p>
          </div>
          {canAccessAction('adicionar_militares') && <Button onClick={() => navigate(createPageUrl('CadastrarMilitar'))} className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white"><Plus className="w-5 h-5 mr-2" />Novo Militar</Button>}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {GRADUACAO_GROUPS.map((group) => (
              <Button key={group.key} size="sm" variant={selectedGroups.includes(group.key) ? 'default' : 'outline'} onClick={() => setSelectedGroups((prev) => prev.includes(group.key) ? prev.filter((k) => k !== group.key) : [...prev, group.key])} className={selectedGroups.includes(group.key) ? 'bg-[#1e3a5f]' : ''}>{group.label}</Button>
            ))}
          </div>
          <div className="flex flex-col md:flex-row gap-3">
            {isAdmin && <Select value={lotacaoFilter} onValueChange={setLotacaoFilter}><SelectTrigger className="md:w-72"><SelectValue placeholder="Selecione uma lotação" /></SelectTrigger><SelectContent><SelectItem value={TODAS_LOTACOES_VALUE}>Todas as lotações</SelectItem>{lotacoesDisponiveis.map((lotacao) => <SelectItem key={lotacao} value={lotacao}>{lotacao}</SelectItem>)}</SelectContent></Select>}
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input className="pl-9" placeholder="Buscar nome ou matrícula..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
          </div>
        </div>

        {isAdmin && isErrorLotacoesAdmin && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 mb-4">
            <p className="text-sm font-medium">{isLotacoesAdminRateLimit ? 'Rate limit excedido ao carregar lotações. Você ainda pode consultar por graduação.' : 'Não foi possível carregar lotações. Você ainda pode consultar por graduação.'}</p>
            <Button onClick={() => refetchLotacoesAdmin()} variant="outline" size="sm" className="mt-2">Tentar carregar lotações</Button>
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
            <p className="text-sm text-slate-600 mb-4">{isRateLimitError ? 'Muitas requisições em pouco tempo. Aguarde alguns segundos e tente novamente.' : 'Não foi possível carregar os dados da consulta.'}</p>
            <Button onClick={() => refetch()} className="bg-[#1e3a5f] text-white">Tentar novamente</Button>
            <DataDebugPanel debugData={{ pagina: 'Militares', erroPrincipal: error ? { message: error.message } : null, estagioProvavel: 'Militar.filter escopo' }} className="text-left" />
          </div>
        ) : filteredMilitares.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center">
            <h3 className="text-lg font-semibold text-slate-700">Nenhum militar encontrado para os filtros selecionados.</h3>
            <DataDebugPanel
              debugData={{
                pagina: 'Militares',
                lotacaoFilter,
                selectedPostos,
                totalCarregadoAntesFiltroLocal: militaresData?.totalCarregadoAntesFiltroLocal || 0,
                totalDepoisFiltroLocal: militaresData?.totalDepoisFiltroLocal || 0,
                lotacoesEncontradasNosResultados: militaresData?.lotacoesEncontradasNosResultados || [],
              }}
              className="text-left mt-4"
            />
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-semibold text-slate-500 border-b bg-slate-50">
              <div className="col-span-2">Graduação</div><div className="col-span-3">Nome/Nome de guerra</div><div className="col-span-2">Matrícula</div><div className="col-span-1">Quadro</div><div className="col-span-2">Lotação</div><div className="col-span-1">Status</div><div className="col-span-1 text-right">Ações</div>
            </div>
            {filteredMilitares.map((militar) => (
              <div key={militar.id} className="grid grid-cols-12 gap-2 px-3 py-2 border-b text-sm items-center">
                <div className="col-span-2 font-semibold text-[#1e3a5f]">{militar.posto_graduacao || 'Sem posto'}</div>
                <div className="col-span-3"><div className="font-medium truncate">{militar.nome_guerra || militar.nome_completo}</div><div className="text-xs text-slate-500 truncate">{militar.nome_completo}</div></div>
                <div className="col-span-2 truncate">{militar.matricula || '—'}</div><div className="col-span-1 truncate">{militar.quadro || '—'}</div><div className="col-span-2 truncate">{militar.lotacao_atual || 'Sem lotação'}</div>
                <div className="col-span-1"><Badge className={`${statusBadgeClass[militar.status_cadastro] || statusBadgeClass.Ativo} border`}>{militar.status_cadastro || 'Ativo'}</Badge></div>
                <div className="col-span-1 flex justify-end gap-1"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(createPageUrl('VerMilitar') + `?id=${militar.id}`)}><Eye className="w-4 h-4" /></Button>{canAccessAction('editar_militares') && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(createPageUrl('CadastrarMilitar') + `?id=${militar.id}`)}><Pencil className="w-4 h-4" /></Button>}{canAccessAction('excluir_militares') && <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => { setMilitarToDelete(militar); setDeleteDialogOpen(true); }}><Trash2 className="w-4 h-4" /></Button>}</div>
              </div>
            ))}
          </div>
        )}

        {shouldShowLotacoesDebugPanel && (
          <DataDebugPanel
            debugData={{
              pagina: 'Militares',
              estagioProvavel: 'Subgrupamento.list',
              lotacoesAdminData: {
                isLoading: isLoadingLotacoesAdmin,
                isError: isErrorLotacoesAdmin,
                erro: lotacoesAdminError ? { message: lotacoesAdminError.message } : null,
                quantidadeRetornada: lotacoesDisponiveis.length,
                queryKey: lotacoesAdminQueryKey,
              },
            }}
            className="text-left mt-4"
          />
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirmar exclusão</AlertDialogTitle><AlertDialogDescription>Tem certeza que deseja excluir o militar {militarToDelete?.nome_completo}?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => militarToDelete && deleteMutation.mutate(militarToDelete.id)} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
