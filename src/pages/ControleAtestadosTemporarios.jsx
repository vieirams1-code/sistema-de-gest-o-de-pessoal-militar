import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, HeartPulse, RefreshCw } from 'lucide-react';

import AccessDenied from '@/components/auth/AccessDenied';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchScopedAtestadosBundle } from '@/services/getScopedAtestadosBundleClient';
import { fetchScopedMilitares } from '@/services/getScopedMilitaresClient';
import {
  agruparAtestadosPorMilitar,
  avaliarRiscoAtestadosMilitar,
  filtrarPorQuadroTemporario,
} from '@/services/controleAtestadosTemporariosService';

const AVISO_INSTITUCIONAL = 'Os alertas consideram os prazos de 30 dias ininterruptos e 60 dias intercalados em janela móvel de 365 dias. Este painel é preventivo e não executa providência administrativa automática.';
const CRITERIO_TEMPORARIO = 'Critério atual para temporário: quadro do militar.';

const STATUS_LABELS = {
  normal: 'Normal',
  atencao_continuo: 'Atenção contínuo',
  alerta_continuo: 'Alerta contínuo',
  critico_continuo: 'Crítico contínuo',
  atencao_intercalado: 'Atenção intercalado',
  alerta_intercalado: 'Alerta intercalado',
  critico_intercalado: 'Crítico intercalado',
  nao_classificado: 'Não classificado',
};

const STATUS_CLASSES = {
  normal: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  atencao_continuo: 'bg-amber-100 text-amber-800 border-amber-200',
  alerta_continuo: 'bg-orange-100 text-orange-800 border-orange-200',
  critico_continuo: 'bg-red-100 text-red-800 border-red-200',
  atencao_intercalado: 'bg-amber-100 text-amber-800 border-amber-200',
  alerta_intercalado: 'bg-orange-100 text-orange-800 border-orange-200',
  critico_intercalado: 'bg-red-100 text-red-800 border-red-200',
  nao_classificado: 'bg-slate-100 text-slate-700 border-slate-200',
};

function montarAnalise(atestados, militaresPorId) {
  const grupos = agruparAtestadosPorMilitar(atestados);
  const dataReferencia = new Date();

  return Object.entries(grupos)
    .map(([chave, atestadosMilitar]) => ({
      chave,
      ...avaliarRiscoAtestadosMilitar({ atestados: atestadosMilitar, dataReferencia, militaresPorId }),
    }))
    .sort((a, b) => {
      const criticoA = a.statusRisco.startsWith('critico') ? 0 : 1;
      const criticoB = b.statusRisco.startsWith('critico') ? 0 : 1;
      if (criticoA !== criticoB) return criticoA - criticoB;
      return a.militar.nome.localeCompare(b.militar.nome, 'pt-BR');
    });
}

export default function ControleAtestadosTemporarios() {
  const {
    isAdmin,
    canAccessModule,
    isLoading: loadingUser,
    isAccessResolved,
    modoAcesso,
    userEmail,
    effectiveUserEmail,
    effectiveEmail,
  } = useCurrentUser();
  const hasControleAccess = canAccessModule('controle_atestados_temporarios');
  const isAccessPending = loadingUser || !isAccessResolved;

  const [quadroFiltro, setQuadroFiltro] = useState('todos');

  const contextoEscopo = useMemo(() => ({
    isAdmin: Boolean(isAdmin),
    modoAcesso: modoAcesso || null,
    userEmail: userEmail || null,
    effectiveUserEmail: effectiveUserEmail || null,
    effectiveEmail: effectiveUserEmail || effectiveEmail || null,
  }), [effectiveEmail, effectiveUserEmail, isAdmin, modoAcesso, userEmail]);

  const {
    data: bundle = { atestados: [], meta: {} },
    isLoading: isLoadingAtestados,
    isFetching: isFetchingAtestados,
    refetch: refetchAtestados,
  } = useQuery({
    queryKey: ['controle-atestados-temporarios-bundle', contextoEscopo],
    queryFn: async () => fetchScopedAtestadosBundle(),
    enabled: isAccessResolved && hasControleAccess,
  });

  const {
    data: militaresBundle = { militares: [], meta: {} },
    isLoading: isLoadingMilitares,
    isFetching: isFetchingMilitares,
    refetch: refetchMilitares,
  } = useQuery({
    queryKey: ['controle-atestados-temporarios-militares', contextoEscopo],
    queryFn: async () => fetchScopedMilitares({
      ...contextoEscopo,
      includeFoto: false,
    }),
    enabled: isAccessResolved && hasControleAccess,
  });

  const militaresEscopados = militaresBundle?.militares || [];
  const militaresPorId = useMemo(
    () => new Map(militaresEscopados.filter((militar) => militar?.id).map((militar) => [militar.id, militar])),
    [militaresEscopados],
  );

  const isLoading = isLoadingAtestados || isLoadingMilitares;
  const isFetching = isFetchingAtestados || isFetchingMilitares;
  const refetch = () => Promise.all([refetchAtestados(), refetchMilitares()]);

  const analises = useMemo(() => montarAnalise(bundle?.atestados || [], militaresPorId), [bundle?.atestados, militaresPorId]);
  const analisesFiltradas = useMemo(() => filtrarPorQuadroTemporario(analises, quadroFiltro), [analises, quadroFiltro]);

  if (isAccessPending) return null;
  if (!hasControleAccess) return <AccessDenied modulo="Controle de Atestados dos Temporários" />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-[#1e3a5f]/10 p-3 text-[#1e3a5f]">
              <HeartPulse className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[#1e3a5f]">Controle de Atestados dos Temporários</h1>
              <p className="text-slate-500">Painel read-only para acompanhamento dos prazos de afastamento médico dos militares dos quadros temporários dentro do escopo do usuário.</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        <div className="mb-6 space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 shadow-sm">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm font-medium leading-6">{AVISO_INSTITUCIONAL}</p>
          </div>
          <p className="pl-8 text-xs font-semibold uppercase tracking-wide">{CRITERIO_TEMPORARIO}</p>
        </div>

        <Card className="mb-6 border-slate-200 shadow-sm">
          <CardContent className="space-y-3 p-4">
            <div>
              <p className="text-sm font-semibold text-slate-700">Filtros dos quadros temporários</p>
              <p className="text-xs text-slate-500">Selecione o quadro temporário que deseja acompanhar neste painel.</p>
            </div>
            <Select value={quadroFiltro} onValueChange={setQuadroFiltro}>
              <SelectTrigger className="w-full md:w-72">
                <SelectValue placeholder="Quadro temporário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os temporários</SelectItem>
                <SelectItem value="QOETBM">QOETBM</SelectItem>
                <SelectItem value="QOSTBM">QOSTBM</SelectItem>
                <SelectItem value="QPTBM">QPTBM</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1e3a5f] border-t-transparent" />
              </div>
            ) : analisesFiltradas.length === 0 ? (
              <div className="py-16 text-center text-slate-500">Nenhum militar temporário com atestado foi encontrado no escopo atual.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Militar</TableHead>
                      <TableHead>Posto/graduação</TableHead>
                      <TableHead>Quadro</TableHead>
                      <TableHead>Matrícula</TableHead>
                      <TableHead>Lotação/unidade</TableHead>
                      <TableHead className="text-right">Total de atestados</TableHead>
                      <TableHead className="text-right">Maior sequência contínua</TableHead>
                      <TableHead className="text-right">Dias na janela de 365 dias</TableHead>
                      <TableHead>Status de prazo</TableHead>
                      <TableHead>Lacunas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analisesFiltradas.map((analise) => (
                      <TableRow key={analise.chave}>
                        <TableCell className="font-medium text-slate-900">{analise.militar.nome}</TableCell>
                        <TableCell>{analise.militar.postoGraduacao}</TableCell>
                        <TableCell>{analise.militar.quadro}</TableCell>
                        <TableCell>{analise.militar.matricula}</TableCell>
                        <TableCell>{analise.militar.lotacao}</TableCell>
                        <TableCell className="text-right">{analise.quantidadeAtestadosRecebidos}</TableCell>
                        <TableCell className="text-right font-semibold">{analise.maiorSequenciaContinua}</TableCell>
                        <TableCell className="text-right font-semibold">{analise.diasJanela365}</TableCell>
                        <TableCell>
                          <Badge className={STATUS_CLASSES[analise.statusRisco] || STATUS_CLASSES.nao_classificado} variant="outline">
                            {STATUS_LABELS[analise.statusRisco] || STATUS_LABELS.nao_classificado}
                          </Badge>
                        </TableCell>
                        <TableCell className="min-w-72 text-xs text-slate-500">
                          {analise.lacunas.length ? analise.lacunas.join(' ') : 'Sem lacunas identificadas.'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
