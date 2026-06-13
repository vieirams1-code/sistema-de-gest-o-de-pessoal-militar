import React, { useState, useMemo, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { fetchScopedMedalhasBundle } from '@/services/getScopedMedalhasBundleClient';
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
import { Plus, Search, Edit, Trash2, Medal, Shield } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { format } from 'date-fns';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { ordenarMilitaresPorAntiguidadeInstitucional } from '@/utils/antiguidade/ordenacaoMilitarInstitucional';
import { useUsuarioPodeAgirSobreMilitar } from '@/hooks/useUsuarioPodeAgirSobreMilitar';
import { normalizarStatusMedalha, obterTipoMedalhaPorCodigo, resolverCodigoTipoMedalha } from '@/services/medalhasTempoServicoService';
import { ACOES_MEDALHAS } from '@/services/medalhasAcessoService';
import MedalhasTabNavigation from '@/components/medalhas/MedalhasTabNavigation';

const statusColors = {
  INDICADA: 'bg-yellow-100 text-yellow-700',
  CONCEDIDA: 'bg-green-100 text-green-700',
  CANCELADA: 'bg-red-100 text-red-700',
};

const RULER_MILESTONES = [
  { codigo: 'TEMPO_10', label: '10', metal: 'Bronze', anos: '10 anos', color: 'amber' },
  { codigo: 'TEMPO_20', label: '20', metal: 'Prata', anos: '20 anos', color: 'slate' },
  { codigo: 'TEMPO_30', label: '30', metal: 'Ouro', anos: '30 anos', color: 'yellow' },
  { codigo: 'TEMPO_40', label: '40', metal: 'Platina', anos: '40 anos', color: 'purple' },
  { codigo: 'DOM_PEDRO_II', label: <Shield className="w-4 h-4" />, metal: 'Dom Pedro II', color: 'red' },
];

const MEDALHA_PRECEDENCIA = {
  'TEMPO_10': 1,
  'TEMPO_20': 2,
  'TEMPO_30': 3,
  'TEMPO_40': 4,
  'DOM_PEDRO_II': 5,
};

const MILESTONE_COLORS = {
  amber: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', icon: 'bg-amber-500', iconText: 'text-white' },
  slate: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', icon: 'bg-slate-500', iconText: 'text-white' },
  yellow: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200', icon: 'bg-yellow-500', iconText: 'text-white' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200', icon: 'bg-purple-500', iconText: 'text-white' },
  red: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', icon: 'bg-red-500', iconText: 'text-white' },
};

function formatDate(d) {
  if (!d) return '—';
  try { return format(new Date(`${d}T00:00:00`), 'dd/MM/yyyy'); } catch { return d; }
}

export default function Medalhas() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, modoAcesso, userEmail, effectiveUserEmail, canAccessModule, canAccessAction, isLoading: loadingUser, isAccessResolved } = useCurrentUser();
  const { validar: validarEscopoMilitar } = useUsuarioPodeAgirSobreMilitar();
  const hasMedalhasAccess = canAccessModule('medalhas');
  const podeIndicar = canAccessAction(ACOES_MEDALHAS.INDICAR);
  const podeGerirDomPedro = canAccessAction(ACOES_MEDALHAS.DOM_PEDRO);

  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('regua'); // 'regua' or 'expandivel'
  const [statusFilter, setStatusFilter] = useState('all');
  const [tipoFilter, setTipoFilter] = useState('TODOS');
  const [unidadeFilter, setUnidadeFilter] = useState('TODAS');
  const [postoFilter, setPostoFilter] = useState('TODOS');
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null, militar_id: null });

  const handleEditarMedalha = (medalha) => {
    if (!podeIndicar) return;
    const escopo = validarEscopoMilitar(medalha?.militar_id);
    if (!escopo.permitido) {
      alert(escopo.motivo);
      return;
    }
    navigate(createPageUrl('CadastrarMedalha') + `?id=${medalha.id}`);
  };

  const handleAbrirExcluirMedalha = (medalha) => {
    if (!podeIndicar) return;
    const escopo = validarEscopoMilitar(medalha?.militar_id);
    if (!escopo.permitido) {
      alert(escopo.motivo);
      return;
    }
    setDeleteDialog({ open: true, id: medalha.id, militar_id: medalha.militar_id });
  };

  const handleConfirmarExcluirMedalha = () => {
    const escopo = validarEscopoMilitar(deleteDialog.militar_id);
    if (!escopo.permitido) {
      alert(escopo.motivo);
      setDeleteDialog({ open: false, id: null, militar_id: null });
      return;
    }
    deleteMutation.mutate(deleteDialog.id);
  };

  const medalhasQueryKey = ['medalhas', isAdmin, modoAcesso, userEmail, effectiveUserEmail || null, searchTerm, statusFilter, tipoFilter, unidadeFilter, postoFilter];
  const { data: medalhasBundle = { medalhas: [], tiposMedalha: [], meta: {} }, isLoading } = useQuery({
    queryKey: medalhasQueryKey,
    queryFn: () => fetchScopedMedalhasBundle(),
    enabled: isAccessResolved && hasMedalhasAccess,
  });
  const medalhasBrutas = medalhasBundle.medalhas || [];
  const tiposMedalha = medalhasBundle.tiposMedalha || [];

  // Filtra canceladas logo no início para que não apareçam em nenhum lugar da tela
  const medalhas = useMemo(() =>
    medalhasBrutas.filter(m => normalizarStatusMedalha(m.status) !== 'CANCELADA'),
    [medalhasBrutas]
  );

  const deleteMutation = useMutation({
    mutationFn: (id) => {
      if (!podeIndicar) throw new Error('Sem permissão para excluir indicação.');
      return base44.entities.Medalha.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medalhas'] });
      setDeleteDialog({ open: false, id: null });
    },
  });

  const medalhasExibicao = useMemo(() => {
    const lista = medalhas.map((medalha) => {
      const codigoNormalizado = resolverCodigoTipoMedalha(medalha);
      const tipoCatalogado = obterTipoMedalhaPorCodigo(codigoNormalizado, tiposMedalha);
      return {
        ...medalha,
        posto_graduacao: medalha.militar_posto,
        nome_completo: medalha.militar_nome,
        matricula: medalha.militar_matricula,
        tipo_medalha_codigo_normalizado: codigoNormalizado,
        tipo_medalha_exibicao: tipoCatalogado?.nome || medalha.tipo_medalha_nome,
      };
    });
    return ordenarMilitaresPorAntiguidadeInstitucional(lista);
  }, [medalhas, tiposMedalha]);

  const tiposDisponiveis = useMemo(() => {
    const defaultTipos = RULER_MILESTONES.map(m => m.metal);
    const existingTipos = [...new Set(medalhasExibicao.map((item) => item.tipo_medalha_exibicao).filter(Boolean))];
    return [...new Set([...defaultTipos, ...existingTipos])];
  }, [medalhasExibicao]);
  const unidadesDisponiveis = [...new Set(medalhasExibicao.map((item) => item.militar_unidade).filter(Boolean))];
  const postosDisponiveis = [...new Set(medalhasExibicao.map((item) => item.militar_posto).filter(Boolean))];

  const militaresAgrupados = useMemo(() => {
    // Agrupa todas as medalhas por militar primeiro para ter o contexto completo para a régua
    const allGroups = new Map();

    medalhasExibicao.forEach(m => {
      if (!allGroups.has(m.militar_id)) {
        allGroups.set(m.militar_id, {
          militar_id: m.militar_id,
          nome_completo: m.militar_nome, // normalized for sorting
          posto_graduacao: m.militar_posto, // normalized for sorting
          militar_nome: m.militar_nome,
          militar_posto: m.militar_posto,
          militar_matricula: m.militar_matricula,
          militar_unidade: m.militar_unidade,
          medalhas: []
        });
      }
      allGroups.get(m.militar_id).medalhas.push(m);
    });

    const result = [];
    allGroups.forEach(group => {
      const matchSearch =
        group.militar_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        group.militar_matricula?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        group.medalhas.some(m =>
          m.tipo_medalha_exibicao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          m.tipo_medalha_codigo_normalizado?.toLowerCase().includes(searchTerm.toLowerCase())
        );

      const matchUnidade = unidadeFilter === 'TODAS' || group.militar_unidade === unidadeFilter;
      const matchPosto = postoFilter === 'TODOS' || group.militar_posto === postoFilter;
      const matchStatus = statusFilter === 'all' || group.medalhas.some(m => normalizarStatusMedalha(m.status) === statusFilter);

      const matchTipo = tipoFilter === 'TODOS' || group.medalhas.some(m => {
        const milestone = RULER_MILESTONES.find(rm => rm.metal === tipoFilter);
        if (milestone) {
          return m.tipo_medalha_codigo_normalizado === milestone.codigo;
        }
        return m.tipo_medalha_exibicao === tipoFilter;
      });

      if (matchSearch && matchUnidade && matchPosto && matchStatus && matchTipo) {
        // Medalhas que passam pelos filtros (para exibir na tabela expandida)
        const medalhasFiltradas = group.medalhas.filter(m => {
          const mMatchStatus = statusFilter === 'all' || normalizarStatusMedalha(m.status) === statusFilter;
          const mMatchTipo = tipoFilter === 'TODOS' || (() => {
            const milestone = RULER_MILESTONES.find(rm => rm.metal === tipoFilter);
            if (milestone) {
              return m.tipo_medalha_codigo_normalizado === milestone.codigo;
            }
            return m.tipo_medalha_exibicao === tipoFilter;
          })();

          const mMatchSearch = !searchTerm ||
            group.militar_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            group.militar_matricula?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.tipo_medalha_exibicao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.tipo_medalha_codigo_normalizado?.toLowerCase().includes(searchTerm.toLowerCase());

          return mMatchStatus && mMatchTipo && mMatchSearch;
        });

        result.push({
          ...group,
          medalhasFiltradas,
          todasMedalhas: group.medalhas
        });
      }
    });

    return ordenarMilitaresPorAntiguidadeInstitucional(result);
  }, [medalhasExibicao, searchTerm, statusFilter, tipoFilter, unidadeFilter, postoFilter]);

  if (loadingUser || !isAccessResolved) return null;
  if (!hasMedalhasAccess) return <AccessDenied modulo="Medalhas" />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <MedalhasTabNavigation
          activeTab="registradas"
          canAccessAction={canAccessAction}
          actions={(
            <>
              {podeIndicar && (
                <Button
                  onClick={() => navigate(createPageUrl('CadastrarMedalha'))}
                  className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Nova Indicação
                </Button>
              )}
            </>
          )}
        />

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              label: 'Homenageados',
              subtitle: 'Militares com pelo menos uma medalha concedida.',
              value: new Set(medalhas.filter(m => normalizarStatusMedalha(m.status) === 'CONCEDIDA').map(m => m.militar_id)).size,
              color: 'text-[#1e3a5f]',
              bg: 'bg-[#1e3a5f]/10'
            },
            {
              label: 'Condecorações',
              subtitle: 'Total de medalhas efetivamente concedidas.',
              value: medalhas.filter(m => normalizarStatusMedalha(m.status) === 'CONCEDIDA').length,
              color: 'text-emerald-600',
              bg: 'bg-emerald-50'
            },
            {
              label: 'Pendências',
              subtitle: 'Indicações aguardando definição.',
              value: medalhas.filter(m => normalizarStatusMedalha(m.status) === 'INDICADA').length,
              color: 'text-amber-600',
              bg: 'bg-amber-50'
            },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex flex-col justify-center min-h-[100px]">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-lg ${s.bg} flex items-center justify-center shrink-0`}>
                  <Medal className={`w-6 h-6 ${s.color}`} />
                </div>
                <div className="min-w-0">
                  <p className={`text-2xl font-bold ${s.color} leading-none mb-1`}>{s.value}</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">{s.label}</p>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-3 border-t border-slate-50 pt-2 italic">
                {s.subtitle}
              </p>
            </div>
          ))}
        </div>

        {/* View Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Visualização:</span>
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setViewMode('regua')}
                className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
                  viewMode === 'regua'
                    ? 'bg-white text-[#1e3a5f] shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                1. Régua Visual
              </button>
              <button
                onClick={() => setViewMode('expandivel')}
                className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
                  viewMode === 'expandivel'
                    ? 'bg-white text-[#1e3a5f] shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                2. Expandível
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Buscar por militar, matrícula ou tipo de medalha..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10 border-slate-200"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 border-slate-200">
                <SelectValue placeholder="Situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="CONCEDIDA">Homenageados</SelectItem>
                <SelectItem value="INDICADA">Com pendências</SelectItem>
              </SelectContent>
            </Select>
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="h-10 border-slate-200">
                <SelectValue placeholder="Medalha/Honraria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todas as honrarias</SelectItem>
                {[
                  { metal: 'Bronze', anos: '10 anos' },
                  { metal: 'Prata', anos: '20 anos' },
                  { metal: 'Ouro', anos: '30 anos' },
                  { metal: 'Platina', anos: '40 anos' },
                  { metal: 'Dom Pedro II', anos: null }
                ].map(m => (
                  <SelectItem key={m.metal} value={m.metal}>
                    {m.metal}{m.anos ? ` (${m.anos})` : ''}
                  </SelectItem>
                ))}
                {tiposDisponiveis
                  .filter(t => !['Bronze', 'Prata', 'Ouro', 'Platina', 'Dom Pedro II'].includes(t))
                  .map((tipo) => <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>)
                }
              </SelectContent>
            </Select>
            <Select value={unidadeFilter} onValueChange={setUnidadeFilter}>
              <SelectTrigger className="h-10 border-slate-200">
                <SelectValue placeholder="Unidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAS">Todas unidades</SelectItem>
                {unidadesDisponiveis.map((unidade) => <SelectItem key={unidade} value={unidade}>{unidade}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={postoFilter} onValueChange={setPostoFilter}>
              <SelectTrigger className="h-10 border-slate-200">
                <SelectValue placeholder="Posto/Graduação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos postos</SelectItem>
                {postosDisponiveis.map((posto) => <SelectItem key={posto} value={posto}>{posto}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : militaresAgrupados.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center">
            <Medal className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">Não foram localizados militares compatíveis com os filtros selecionados.</h3>
            {(searchTerm || statusFilter !== 'all' || tipoFilter !== 'TODOS' || unidadeFilter !== 'TODAS' || postoFilter !== 'TODOS') && (
              <p className="text-slate-500">Revise os filtros aplicados e tente novamente.</p>
            )}
          </div>
        ) : viewMode === 'regua' ? (
          <div className="space-y-3">
            {militaresAgrupados.map((grupo) => (
              <div key={grupo.militar_id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-900 text-lg">
                      {grupo.militar_posto} {grupo.militar_nome}
                    </h3>
                    <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                      <span>Mat: {grupo.militar_matricula}</span>
                      {grupo.militar_unidade && (
                        <>
                          <div className="w-1 h-1 rounded-full bg-slate-300" />
                          <span>{grupo.militar_unidade}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-6 md:gap-8 lg:gap-12">
                    {/* Tempo de Serviço */}
                    <div className="flex flex-col gap-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center border-b border-slate-100 pb-1">Tempo de Serviço</span>
                      <div className="flex items-center gap-2 md:gap-3 lg:gap-4">
                        {RULER_MILESTONES.filter(m => m.codigo.startsWith('TEMPO')).map((milestone, idx, arr) => {
                          const medalha = grupo.todasMedalhas.find(m => m.tipo_medalha_codigo_normalizado === milestone.codigo);
                          const status = medalha ? normalizarStatusMedalha(medalha.status) : null;
                          const isConcedida = status === 'CONCEDIDA';
                          const isIndicada = status === 'INDICADA';
                          const colors = MILESTONE_COLORS[milestone.color];

                          return (
                            <Fragment key={milestone.codigo}>
                              <div className="flex flex-col items-center gap-2">
                                <div
                                  className={`
                                    w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all relative
                                    ${isConcedida
                                      ? `${colors.icon} border-white text-white shadow-md ring-2 ring-offset-1 ring-slate-100`
                                      : isIndicada
                                        ? `${colors.border} ${colors.text} border-dashed opacity-70 bg-white shadow-inner`
                                        : 'border-slate-100 text-slate-200 bg-slate-50/50'
                                    }
                                  `}
                                  title={`${isConcedida ? 'Concedida' : isIndicada ? 'Indicada' : 'Não possui'}: ${milestone.metal}`}
                                >
                                  {isIndicada && (
                                    <div className="absolute -top-1 -right-1 bg-amber-500 text-white text-[7px] font-black px-1 rounded-full border border-white uppercase shadow-sm">
                                      Pendente
                                    </div>
                                  )}
                                  <span className="text-sm font-bold">
                                    {milestone.label}
                                  </span>
                                </div>
                                <div className="flex flex-col items-center">
                                  <span className={`text-[9px] font-bold uppercase tracking-tight ${isConcedida ? 'text-slate-700' : isIndicada ? 'text-amber-600 italic' : 'text-slate-300'}`}>
                                    {milestone.metal}
                                  </span>
                                  <span className={`text-[8px] font-medium opacity-60 ${isConcedida ? 'text-slate-500' : isIndicada ? 'text-amber-500' : 'text-slate-300'}`}>
                                    {milestone.anos}
                                  </span>
                                </div>
                              </div>
                              {idx < arr.length - 1 && (
                                <div className="flex flex-col items-center mb-6">
                                  <div className={`w-3 md:w-4 lg:w-6 h-0.5 ${isConcedida && grupo.todasMedalhas.some(m => m.tipo_medalha_codigo_normalizado === arr[idx+1].codigo && normalizarStatusMedalha(m.status) === 'CONCEDIDA') ? colors.icon : 'bg-slate-100'}`} />
                                </div>
                              )}
                            </Fragment>
                          );
                        })}
                      </div>
                    </div>

                    <div className="hidden md:block w-px h-16 bg-slate-100 self-end mb-2" />

                    {/* Dom Pedro II */}
                    <div className="flex flex-col gap-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center border-b border-slate-100 pb-1">Honrarias Especiais</span>
                      <div className="flex items-center gap-2 md:gap-4">
                        {RULER_MILESTONES.filter(m => m.codigo === 'DOM_PEDRO_II').map((milestone) => {
                          const medalha = grupo.todasMedalhas.find(m => m.tipo_medalha_codigo_normalizado === milestone.codigo);
                          const status = medalha ? normalizarStatusMedalha(medalha.status) : null;
                          const isConcedida = status === 'CONCEDIDA';
                          const isIndicada = status === 'INDICADA';
                          const colors = MILESTONE_COLORS[milestone.color];

                          return (
                            <div key={milestone.codigo} className="flex flex-col items-center gap-2">
                              <div
                                className={`
                                  w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all relative
                                  ${isConcedida
                                    ? `${colors.icon} border-white text-white shadow-md ring-2 ring-offset-1 ring-slate-100`
                                    : isIndicada
                                      ? `${colors.border} ${colors.text} border-dashed opacity-70 bg-white shadow-inner`
                                      : 'border-slate-100 text-slate-200 bg-slate-50/50'
                                  }
                                `}
                                title={`${isConcedida ? 'Concedida' : isIndicada ? 'Indicada' : 'Não possui'}: Dom Pedro II`}
                              >
                                {isIndicada && (
                                  <div className="absolute -top-1 -right-1 bg-amber-500 text-white text-[7px] font-black px-1 rounded-full border border-white uppercase shadow-sm">
                                    Pendente
                                  </div>
                                )}
                                <span>
                                  {milestone.label}
                                </span>
                              </div>
                              <span className={`text-[9px] font-bold uppercase tracking-tight ${isConcedida ? 'text-slate-700' : isIndicada ? 'text-amber-600 italic' : 'text-slate-300'}`}>
                                Dom Pedro II
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Accordion type="multiple" className="space-y-3">
            {militaresAgrupados.map((grupo) => (
              <AccordionItem key={grupo.militar_id} value={grupo.militar_id} className="bg-white rounded-xl shadow-sm border border-slate-200 px-4 overflow-hidden border-b-0">
                <div className="flex items-center justify-between">
                  <div className="flex-1 py-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-bold text-slate-900">
                        {grupo.militar_posto} {grupo.militar_nome}
                      </h3>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 shadow-sm">
                          🏅 {grupo.todasMedalhas.filter(m => normalizarStatusMedalha(m.status) === 'CONCEDIDA').length} {grupo.todasMedalhas.filter(m => normalizarStatusMedalha(m.status) === 'CONCEDIDA').length === 1 ? 'condecoração' : 'condecorações'}
                        </Badge>
                        {grupo.todasMedalhas.some(m => normalizarStatusMedalha(m.status) === 'INDICADA') && (
                          <Badge variant="outline" className="border-amber-200 text-amber-700 bg-amber-50 shadow-sm">
                            ⚠ {grupo.todasMedalhas.filter(m => normalizarStatusMedalha(m.status) === 'INDICADA').length} {grupo.todasMedalhas.filter(m => normalizarStatusMedalha(m.status) === 'INDICADA').length === 1 ? 'indicação pendente' : 'indicações pendentes'}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      Mat: {grupo.militar_matricula}
                      {grupo.militar_unidade && <span className="mx-2 text-slate-300">|</span>}
                      {grupo.militar_unidade}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100/50">
                      {RULER_MILESTONES.map(milestone => {
                        const hasMedalha = grupo.todasMedalhas.some(m => m.tipo_medalha_codigo_normalizado === milestone.codigo && normalizarStatusMedalha(m.status) === 'CONCEDIDA');
                        if (!hasMedalha) return null;

                        const medalIcon = {
                          'TEMPO_10': '🥉',
                          'TEMPO_20': '🥈',
                          'TEMPO_30': '🥇',
                          'TEMPO_40': '💠',
                          'DOM_PEDRO_II': '🛡️'
                        }[milestone.codigo] || '🏅';

                        return (
                          <span key={milestone.codigo} className="text-base" title={milestone.metal}>
                            {medalIcon}
                          </span>
                        );
                      })}
                    </div>
                    <AccordionTrigger className="hover:no-underline py-4" />
                  </div>
                </div>

                <AccordionContent className="pb-6 pt-2 border-t border-slate-100">
                  <div className="space-y-6">
                    {/* Concedidas */}
                    {grupo.medalhasFiltradas.some(m => normalizarStatusMedalha(m.status) === 'CONCEDIDA') && (
                      <div className="mb-8">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Medalhas Concedidas</h4>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-slate-400 border-b border-slate-100">
                                <th className="pb-3 font-medium uppercase tracking-wider text-[10px]">Tipo</th>
                                <th className="pb-3 font-medium uppercase tracking-wider text-[10px]">Status</th>
                                <th className="pb-3 font-medium uppercase tracking-wider text-[10px]">Indicação</th>
                                <th className="pb-3 font-medium uppercase tracking-wider text-[10px]">Concessão</th>
                                <th className="pb-3 font-medium uppercase tracking-wider text-[10px]">DOEMS</th>
                                <th className="pb-3 font-medium uppercase tracking-wider text-[10px] text-right">Ações</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {grupo.todasMedalhas
                                .filter(m => normalizarStatusMedalha(m.status) === 'CONCEDIDA')
                                .sort((a, b) => (MEDALHA_PRECEDENCIA[a.tipo_medalha_codigo_normalizado] || 99) - (MEDALHA_PRECEDENCIA[b.tipo_medalha_codigo_normalizado] || 99))
                                .map((medalha) => (
                                  <tr key={medalha.id} className="group">
                                    <td className="py-4">
                                      <p className="font-bold text-slate-700">{medalha.tipo_medalha_exibicao}</p>
                                      {medalha.tipo_medalha_nome && medalha.tipo_medalha_nome !== medalha.tipo_medalha_exibicao && (
                                        <p className="text-[10px] text-slate-400">Legado: {medalha.tipo_medalha_nome}</p>
                                      )}
                                      {medalha.observacoes && (
                                        <p className="text-[11px] text-slate-500 mt-1 italic max-w-xs">{medalha.observacoes}</p>
                                      )}
                                    </td>
                                    <td className="py-4">
                                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none text-[10px] font-bold">
                                        CONCEDIDA
                                      </Badge>
                                    </td>
                                    <td className="py-4 text-slate-600">{formatDate(medalha.data_indicacao)}</td>
                                    <td className="py-4 text-slate-600">
                                      {medalha.documento_referencia === 'INFORMAÇÃO DP' ? (
                                        <span className="text-blue-600 font-medium text-[11px]">Informação DP</span>
                                      ) : formatDate(medalha.data_concessao)}
                                    </td>
                                    <td className="py-4 text-slate-600">
                                      {medalha.documento_referencia === 'INFORMAÇÃO DP' ? (
                                        <span className="text-slate-400 italic text-[11px]">Não localizado</span>
                                      ) : (medalha.numero_publicacao || '—')}
                                    </td>
                                    <td className="py-4 text-right">
                                      {podeIndicar && (
                                        <div className="flex justify-end gap-1">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleEditarMedalha(medalha)}
                                            className="h-8 w-8 p-0 text-slate-400 hover:text-[#1e3a5f]"
                                          >
                                            <Edit className="w-4 h-4" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleAbrirExcluirMedalha(medalha)}
                                            className="h-8 w-8 p-0 text-slate-400 hover:text-red-600"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </Button>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Indicações */}
                    {grupo.todasMedalhas.some(m => normalizarStatusMedalha(m.status) === 'INDICADA') && (
                      <div className="bg-amber-50/30 -mx-4 px-4 py-6 border-y border-amber-100/50">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Indicações Pendentes</h4>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-amber-600/60 border-b border-amber-100">
                                <th className="pb-3 font-medium uppercase tracking-wider text-[10px]">Medalha Pretendida</th>
                                <th className="pb-3 font-medium uppercase tracking-wider text-[10px]">Data da Indicação</th>
                                <th className="pb-3 font-medium uppercase tracking-wider text-[10px]">Observações</th>
                                <th className="pb-3 font-medium uppercase tracking-wider text-[10px] text-right">Ações</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-amber-50/50">
                              {grupo.todasMedalhas
                                .filter(m => normalizarStatusMedalha(m.status) === 'INDICADA')
                                .sort((a, b) => (MEDALHA_PRECEDENCIA[a.tipo_medalha_codigo_normalizado] || 99) - (MEDALHA_PRECEDENCIA[b.tipo_medalha_codigo_normalizado] || 99))
                                .map((medalha) => (
                                  <tr key={medalha.id} className="group">
                                    <td className="py-4">
                                      <p className="font-bold text-amber-900">{medalha.tipo_medalha_exibicao}</p>
                                      {medalha.tipo_medalha_nome && medalha.tipo_medalha_nome !== medalha.tipo_medalha_exibicao && (
                                        <p className="text-[10px] text-amber-600/70">Legado: {medalha.tipo_medalha_nome}</p>
                                      )}
                                    </td>
                                    <td className="py-4 text-amber-800">{formatDate(medalha.data_indicacao)}</td>
                                    <td className="py-4 text-amber-700/80 text-[11px] italic max-w-xs">
                                      {medalha.observacoes || '—'}
                                    </td>
                                    <td className="py-4 text-right">
                                      {podeIndicar && (
                                        <div className="flex justify-end gap-1">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleEditarMedalha(medalha)}
                                            className="h-8 w-8 p-0 text-amber-400 hover:text-amber-600 hover:bg-amber-100"
                                          >
                                            <Edit className="w-4 h-4" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleAbrirExcluirMedalha(medalha)}
                                            className="h-8 w-8 p-0 text-amber-400 hover:text-red-600 hover:bg-red-50"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </Button>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>

      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta medalha? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarExcluirMedalha}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}