import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Medal, Search, ArrowLeft, Ban, CheckCircle2 } from 'lucide-react';

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

const situacaoColor = {
  SEM_DIREITO: 'bg-slate-100 text-slate-700',
  ELEGIVEL: 'bg-yellow-100 text-yellow-800',
  JA_CONTEMPLADO: 'bg-green-100 text-green-800',
  IMPEDIDO: 'bg-orange-100 text-orange-800',
  INCONSISTENTE: 'bg-red-100 text-red-800',
};

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

  useQuery({
    queryKey: ['tipos-medalha-fixos-sync-apuracao'],
    queryFn: () => garantirCatalogoFixoMedalhaTempo(base44),
    enabled: isAccessResolved && hasMedalhasAccess,
  });

  const { data: militares = [] } = useQuery({
    queryKey: ['apuracao-medalhas-militares'],
    queryFn: () => base44.entities.Militar.list('nome_completo'),
    enabled: isAccessResolved && hasMedalhasAccess,
  });

  const { data: medalhas = [] } = useQuery({
    queryKey: ['apuracao-medalhas-registros'],
    queryFn: () => base44.entities.Medalha.list('-created_date'),
    enabled: isAccessResolved && hasMedalhasAccess,
  });

  const { data: tiposMedalha = [] } = useQuery({
    queryKey: ['apuracao-medalhas-tipos'],
    queryFn: () => base44.entities.TipoMedalha.list('nome'),
    enabled: isAccessResolved && hasMedalhasAccess,
  });

  const { data: impedimentos = [] } = useQuery({
    queryKey: ['apuracao-medalhas-impedimentos'],
    queryFn: () => base44.entities.ImpedimentoMedalha.list('-created_date'),
    enabled: isAccessResolved && hasMedalhasAccess,
  });

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

  if (loadingUser || !isAccessResolved) return null;
  if (!hasMedalhasAccess) return <AccessDenied modulo="Medalhas" />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('Medalhas'))}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Medal className="w-7 h-7 text-[#1e3a5f]" />
            <div>
              <h1 className="text-2xl font-bold text-[#1e3a5f]">Apuração de Medalhas</h1>
              <p className="text-sm text-slate-500">Medalhas de tempo de serviço (não cumulativa)</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input className="pl-9" placeholder="Buscar militar/matrícula" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
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
          <Select value={faixaFilter} onValueChange={setFaixaFilter}>
            <SelectTrigger><SelectValue placeholder="Faixa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TODAS">Todas faixas</SelectItem>
              <SelectItem value="TEMPO_10">10 anos</SelectItem>
              <SelectItem value="TEMPO_20">20 anos</SelectItem>
              <SelectItem value="TEMPO_30">30 anos</SelectItem>
              <SelectItem value="TEMPO_40">40 anos</SelectItem>
            </SelectContent>
          </Select>
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

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left p-3">Militar</th>
                <th className="text-left p-3">Unidade</th>
                <th className="text-left p-3">Tempo</th>
                <th className="text-left p-3">Maior recebida</th>
                <th className="text-left p-3">Medalha devida</th>
                <th className="text-left p-3">Situação</th>
                <th className="text-left p-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {apuracoesFiltradas.map((item) => (
                <tr key={item.militar_id} className="border-b border-slate-100">
                  <td className="p-3">
                    <p className="font-medium text-slate-800">{item.militar?.posto_graduacao} {item.militar?.nome_completo}</p>
                    <p className="text-xs text-slate-500">Mat: {item.militar?.matricula || '—'}</p>
                  </td>
                  <td className="p-3">{item.militar?.lotacao || item.militar?.unidade || '—'}</td>
                  <td className="p-3">{item.tempo_servico_anos ?? '—'} anos</td>
                  <td className="p-3">{item.maior_medalha_recebida_codigo || '—'}</td>
                  <td className="p-3">{item.medalha_devida_codigo || '—'}</td>
                  <td className="p-3">
                    <Badge className={situacaoColor[item.situacao] || situacaoColor.SEM_DIREITO}>{item.situacao}</Badge>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
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
                            const impedimentoAtivo = impedimentos.find((imp) => (
                              imp.militar_id === item.militar_id
                              && imp.ativo !== false
                              && (!imp.tipo_medalha_codigo || imp.tipo_medalha_codigo === item.medalha_devida_codigo)
                            ));
                            if (!impedimentoAtivo) return;
                            removerImpedimentoMutation.mutate({ id: impedimentoAtivo.id });
                          }}
                        >
                          Remover impedimento
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {apuracoesFiltradas.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">Nenhum militar encontrado para os filtros selecionados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
