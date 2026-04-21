import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Medal,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Users,
} from 'lucide-react';

import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { useToast } from '@/components/ui/use-toast';
import {
  TIPOS_FIXOS_MEDALHA_TEMPO,
  apurarListaMilitaresTempoServico,
  criarIndicacaoAutomatica,
  garantirCatalogoFixoMedalhaTempo,
} from '@/services/medalhasTempoServicoService';

const situacaoBadgeConfig = {
  SEM_DIREITO: {
    label: 'Sem direito',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  ELEGIVEL: {
    label: 'Elegível',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  JA_CONTEMPLADO: {
    label: 'Já contemplado',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  IMPEDIDO: {
    label: 'Impedido',
    className: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  INCONSISTENTE: {
    label: 'Inconsistente',
    className: 'bg-rose-100 text-rose-800 border-rose-200',
  },
};

const resumoConfig = [
  { key: 'ELEGIVEL', label: 'Elegíveis', icon: ShieldCheck, color: 'text-emerald-700' },
  { key: 'JA_CONTEMPLADO', label: 'Já contemplados', icon: Medal, color: 'text-blue-700' },
  { key: 'SEM_DIREITO', label: 'Sem direito', icon: ShieldX, color: 'text-slate-700' },
  { key: 'INCONSISTENTE', label: 'Inconsistentes', icon: ShieldAlert, color: 'text-rose-700' },
  { key: 'IMPEDIDO', label: 'Impedidos', icon: Ban, color: 'text-amber-700' },
];

function formatSituacao(situacao) {
  return situacaoBadgeConfig[situacao] || situacaoBadgeConfig.SEM_DIREITO;
}

export default function ApuracaoMedalhasTempoServico() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { canAccessModule, isLoading: loadingUser, isAccessResolved } = useCurrentUser();
  const hasMedalhasAccess = canAccessModule('medalhas');

  const [search, setSearch] = useState('');
  const [situacaoFilter, setSituacaoFilter] = useState('TODOS');
  const [faixaFilter, setFaixaFilter] = useState('TODAS');
  const [unidadeFilter, setUnidadeFilter] = useState('TODAS');
  const [expandedRows, setExpandedRows] = useState({});

  useQuery({
    queryKey: ['tipos-medalha-fixos-sync-apuracao'],
    queryFn: () => garantirCatalogoFixoMedalhaTempo(base44),
    enabled: isAccessResolved && hasMedalhasAccess,
  });

  const militaresQuery = useQuery({
    queryKey: ['apuracao-medalhas-militares'],
    queryFn: () => base44.entities.Militar.list('nome_completo'),
    enabled: isAccessResolved && hasMedalhasAccess,
  });

  const medalhasQuery = useQuery({
    queryKey: ['apuracao-medalhas-registros'],
    queryFn: () => base44.entities.Medalha.list('-created_date'),
    enabled: isAccessResolved && hasMedalhasAccess,
  });

  const tiposMedalhaQuery = useQuery({
    queryKey: ['apuracao-medalhas-tipos'],
    queryFn: () => base44.entities.TipoMedalha.list('nome'),
    enabled: isAccessResolved && hasMedalhasAccess,
  });

  const impedimentosQuery = useQuery({
    queryKey: ['apuracao-medalhas-impedimentos'],
    queryFn: () => base44.entities.ImpedimentoMedalha.list('-created_date'),
    enabled: isAccessResolved && hasMedalhasAccess,
  });

  const militares = militaresQuery.data || [];
  const medalhas = medalhasQuery.data || [];
  const tiposMedalha = tiposMedalhaQuery.data || [];
  const impedimentos = impedimentosQuery.data || [];

  const indicarMutation = useMutation({
    mutationFn: async (item) => {
      const tipo = (tiposMedalha.length ? tiposMedalha : TIPOS_FIXOS_MEDALHA_TEMPO)
        .find((registro) => registro.codigo === item.medalha_devida_codigo);

      if (!tipo?.id) {
        throw new Error(`Tipo da medalha ${item.medalha_devida_codigo} não encontrado.`);
      }

      const payload = criarIndicacaoAutomatica({
        militar: item.militar,
        medalhaDevida: item.medalha_devida_codigo,
        tipoMedalha: tipo,
      });
      return base44.entities.Medalha.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apuracao-medalhas-registros'] });
      queryClient.invalidateQueries({ queryKey: ['medalhas'] });
      toast({ title: 'Indicação criada', description: 'A medalha foi indicada com status INDICADA.' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao indicar', description: error.message, variant: 'destructive' });
    },
  });

  const impedirMutation = useMutation({
    mutationFn: async ({ militarId, medalhaCodigo, motivo }) => base44.entities.ImpedimentoMedalha.create({
      militar_id: militarId,
      tipo_medalha_codigo: medalhaCodigo || '',
      ativo: true,
      data_inicio: new Date().toISOString().split('T')[0],
      motivo,
      observacoes: '',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apuracao-medalhas-impedimentos'] });
      toast({ title: 'Impedimento ativado' });
    },
  });

  const removerImpedimentoMutation = useMutation({
    mutationFn: async ({ id }) => base44.entities.ImpedimentoMedalha.update(id, {
      ativo: false,
      data_fim: new Date().toISOString().split('T')[0],
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apuracao-medalhas-impedimentos'] });
      toast({ title: 'Impedimento removido' });
    },
  });

  const apuracoes = useMemo(
    () => apurarListaMilitaresTempoServico({
      militares,
      medalhas,
      impedimentos,
      tiposMedalha: tiposMedalha.length ? tiposMedalha : TIPOS_FIXOS_MEDALHA_TEMPO,
    }),
    [militares, medalhas, tiposMedalha, impedimentos],
  );

  const totaisResumo = useMemo(() => apuracoes.reduce((acc, item) => {
    acc[item.situacao] = (acc[item.situacao] || 0) + 1;
    return acc;
  }, {}), [apuracoes]);

  const unidadesDisponiveis = useMemo(
    () => [...new Set(apuracoes.map((item) => item.militar?.lotacao || item.militar?.unidade).filter(Boolean))],
    [apuracoes],
  );

  const apuracoesFiltradas = useMemo(() => apuracoes.filter((item) => {
    const militar = item.militar || {};
    const nome = `${militar.posto_graduacao || ''} ${militar.nome_completo || ''}`.toLowerCase();
    const termo = search.toLowerCase();

    const matchSearch = !termo
      || nome.includes(termo)
      || String(militar.matricula || '').toLowerCase().includes(termo);

    const matchSituacao = situacaoFilter === 'TODOS' || item.situacao === situacaoFilter;
    const matchFaixa = faixaFilter === 'TODAS' || item.medalha_devida_codigo === faixaFilter;
    const unidade = militar.lotacao || militar.unidade;
    const matchUnidade = unidadeFilter === 'TODAS' || unidade === unidadeFilter;

    return matchSearch && matchSituacao && matchFaixa && matchUnidade;
  }), [apuracoes, faixaFilter, search, situacaoFilter, unidadeFilter]);

  const hasActiveFilters = Boolean(search.trim())
    || situacaoFilter !== 'TODOS'
    || faixaFilter !== 'TODAS'
    || unidadeFilter !== 'TODAS';

  const isLoadingData = militaresQuery.isLoading
    || medalhasQuery.isLoading
    || tiposMedalhaQuery.isLoading
    || impedimentosQuery.isLoading;

  const semElegiveis = apuracoes.length > 0 && (totaisResumo.ELEGIVEL || 0) === 0;

  const handleExpandRow = (militarId) => {
    setExpandedRows((current) => ({
      ...current,
      [militarId]: !current[militarId],
    }));
  };

  if (loadingUser || !isAccessResolved) return null;
  if (!hasMedalhasAccess) return <AccessDenied modulo="Medalhas" />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-5">
        <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('Medalhas'))}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="rounded-xl bg-slate-100 p-2 mt-0.5">
                <Medal className="w-6 h-6 text-[#1e3a5f]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-[#1e3a5f]">Apuração de Medalhas</h1>
                <p className="text-sm text-slate-600 mt-1">Apuração institucional de medalhas por tempo de serviço.</p>
              </div>
            </div>
            <Badge className="bg-slate-100 text-slate-700 border-slate-200">
              <Users className="w-3.5 h-3.5 mr-1" />
              {apuracoesFiltradas.length} na listagem
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {resumoConfig.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.key} className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-wide text-slate-500">{card.label}</p>
                  <Icon className={`w-4 h-4 ${card.color}`} />
                </div>
                <p className="text-2xl leading-tight font-semibold text-slate-800 mt-2">{totaisResumo[card.key] || 0}</p>
              </div>
            );
          })}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="relative lg:col-span-4">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                className="pl-9"
                placeholder="Buscar por nome ou matrícula"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="lg:col-span-3">
              <Select value={situacaoFilter} onValueChange={setSituacaoFilter}>
                <SelectTrigger><SelectValue placeholder="Situação" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todas situações</SelectItem>
                  <SelectItem value="ELEGIVEL">Elegíveis</SelectItem>
                  <SelectItem value="INCONSISTENTE">Inconsistentes</SelectItem>
                  <SelectItem value="IMPEDIDO">Impedidos</SelectItem>
                  <SelectItem value="JA_CONTEMPLADO">Já contemplados</SelectItem>
                  <SelectItem value="SEM_DIREITO">Sem direito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="lg:col-span-2">
              <Select value={faixaFilter} onValueChange={setFaixaFilter}>
                <SelectTrigger><SelectValue placeholder="Medalha devida" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAS">Todas faixas</SelectItem>
                  <SelectItem value="TEMPO_10">10 anos</SelectItem>
                  <SelectItem value="TEMPO_20">20 anos</SelectItem>
                  <SelectItem value="TEMPO_30">30 anos</SelectItem>
                  <SelectItem value="TEMPO_40">40 anos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="lg:col-span-3">
              <Select value={unidadeFilter} onValueChange={setUnidadeFilter}>
                <SelectTrigger><SelectValue placeholder="Unidade" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAS">Todas unidades</SelectItem>
                  {unidadesDisponiveis.map((unidade) => (
                    <SelectItem key={unidade} value={unidade}>{unidade}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3 md:p-4 shadow-sm space-y-3">
          {isLoadingData && (
            <div className="space-y-2 animate-pulse">
              <div className="h-16 bg-slate-100 rounded-lg" />
              <div className="h-16 bg-slate-100 rounded-lg" />
              <div className="h-16 bg-slate-100 rounded-lg" />
            </div>
          )}

          {!isLoadingData && apuracoesFiltradas.map((item) => {
            const situacaoInfo = formatSituacao(item.situacao);
            const militar = item.militar || {};
            const unidade = militar.lotacao || militar.unidade || 'Unidade não informada';
            const isExpanded = expandedRows[item.militar_id];
            const impedimentoAtivo = impedimentos.find((imp) => (
              imp.militar_id === item.militar_id
              && imp.ativo !== false
              && (!imp.tipo_medalha_codigo || imp.tipo_medalha_codigo === item.medalha_devida_codigo)
            ));

            return (
              <div key={item.militar_id} className="rounded-xl border border-slate-200 bg-slate-50/40">
                <div className="px-4 py-3 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <div className="md:col-span-4 min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{militar.posto_graduacao} {militar.nome_completo}</p>
                    <p className="text-xs text-slate-500">Mat: {militar.matricula || '—'}</p>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{unidade}</p>
                  </div>

                  <div className="md:col-span-3 text-sm text-slate-700 space-y-1">
                    <p><span className="text-slate-500">Tempo:</span> {item.tempo_servico_anos ?? '—'} anos</p>
                    <p><span className="text-slate-500">Maior:</span> {item.maior_medalha_recebida_codigo || '—'}</p>
                    <p><span className="text-slate-500">Devida:</span> {item.medalha_devida_codigo || '—'}</p>
                  </div>

                  <div className="md:col-span-2 flex md:justify-center">
                    <Badge className={`${situacaoInfo.className} border`}>{situacaoInfo.label}</Badge>
                  </div>

                  <div className="md:col-span-3 flex items-center justify-start md:justify-end gap-2 flex-wrap">
                    {item.situacao === 'ELEGIVEL' && (
                      <>
                        <Button
                          size="sm"
                          className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
                          disabled={indicarMutation.isPending}
                          onClick={() => indicarMutation.mutate(item)}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Indicar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={impedirMutation.isPending}
                          onClick={() => {
                            const motivo = window.prompt('Motivo do impedimento:');
                            if (!motivo) return;
                            impedirMutation.mutate({
                              militarId: item.militar_id,
                              medalhaCodigo: item.medalha_devida_codigo,
                              motivo,
                            });
                          }}
                        >
                          <Ban className="w-4 h-4 mr-1" />
                          Impedir
                        </Button>
                      </>
                    )}

                    {item.situacao === 'IMPEDIDO' && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={removerImpedimentoMutation.isPending}
                        onClick={() => {
                          if (!impedimentoAtivo) return;
                          removerImpedimentoMutation.mutate({ id: impedimentoAtivo.id });
                        }}
                      >
                        Remover impedimento
                      </Button>
                    )}

                    {item.situacao !== 'ELEGIVEL' && item.situacao !== 'IMPEDIDO' && (
                      <Button size="sm" variant="outline" disabled>
                        Indicação indisponível
                      </Button>
                    )}

                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => handleExpandRow(item.militar_id)}
                      title={isExpanded ? 'Ocultar detalhes' : 'Exibir detalhes'}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-3">
                    <div className="rounded-lg bg-white border border-slate-200 p-3 text-xs text-slate-600 grid grid-cols-1 md:grid-cols-2 gap-2">
                      <p><span className="text-slate-500">Inclusão:</span> {militar.created_date ? new Date(militar.created_date).toLocaleDateString('pt-BR') : '—'}</p>
                      <p><span className="text-slate-500">Tempo (dias):</span> {item.tempo_servico_dias ?? '—'}</p>
                      <p><span className="text-slate-500">Motivo inconsistente:</span> {item.motivo || '—'}</p>
                      <p><span className="text-slate-500">Motivo impedimento:</span> {impedimentoAtivo?.motivo || '—'}</p>
                      <p className="md:col-span-2"><span className="text-slate-500">Histórico resumido:</span> {item.maior_medalha_recebida_codigo ? `Já recebeu ${item.maior_medalha_recebida_codigo}` : 'Sem medalhas de tempo registradas'}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {!isLoadingData && apuracoesFiltradas.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
              <p className="text-slate-700 font-medium">Nenhum militar encontrado para os filtros selecionados.</p>
              <p className="text-sm text-slate-500 mt-1">
                {hasActiveFilters
                  ? 'Ajuste os filtros para ampliar os resultados da apuração.'
                  : 'Ainda não há dados suficientes para exibir a apuração.'}
              </p>
            </div>
          )}

          {!isLoadingData && apuracoesFiltradas.length > 0 && semElegiveis && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Nenhum militar está elegível para indicação no cenário atual da apuração.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
