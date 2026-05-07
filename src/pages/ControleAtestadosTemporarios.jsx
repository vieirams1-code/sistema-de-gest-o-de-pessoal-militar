import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, HeartPulse, RefreshCw, Search, ShieldAlert, Users } from 'lucide-react';

import AccessDenied from '@/components/auth/AccessDenied';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchScopedAtestadosBundle } from '@/services/getScopedAtestadosBundleClient';
import {
  agruparAtestadosPorMilitar,
  avaliarRiscoAtestadosMilitar,
} from '@/services/controleAtestadosTemporariosService';

const AVISO_INSTITUCIONAL = 'Este painel é um controle preventivo. Enquanto não houver campo estruturado para vínculo temporário e relação com o serviço, os resultados são indicativos e dependem de conferência administrativa.';

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

function normalizarBusca(valor) {
  return String(valor || '').trim().toLowerCase();
}

function montarAnalise(atestados) {
  const grupos = agruparAtestadosPorMilitar(atestados);
  const dataReferencia = new Date();

  return Object.entries(grupos)
    .map(([chave, atestadosMilitar]) => ({
      chave,
      ...avaliarRiscoAtestadosMilitar({ atestados: atestadosMilitar, dataReferencia }),
    }))
    .sort((a, b) => {
      const criticoA = a.statusRisco.startsWith('critico') ? 0 : 1;
      const criticoB = b.statusRisco.startsWith('critico') ? 0 : 1;
      if (criticoA !== criticoB) return criticoA - criticoB;
      return a.militar.nome.localeCompare(b.militar.nome, 'pt-BR');
    });
}

function ResumoCard({ title, value, icon: Icon, tone = 'slate' }) {
  const toneClass = tone === 'red' ? 'text-red-700 bg-red-50' : tone === 'amber' ? 'text-amber-700 bg-amber-50' : 'text-[#1e3a5f] bg-blue-50';

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">{title}</CardTitle>
        <div className={`rounded-full p-2 ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-slate-900">{value}</div>
      </CardContent>
    </Card>
  );
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

  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('todos');
  const [somenteVinculoNaoClassificado, setSomenteVinculoNaoClassificado] = useState(false);
  const [somenteRelacaoNaoClassificada, setSomenteRelacaoNaoClassificada] = useState(false);

  const { data: bundle = { atestados: [], meta: {} }, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['controle-atestados-temporarios-bundle', isAdmin, modoAcesso, userEmail, effectiveUserEmail || effectiveEmail || null],
    queryFn: async () => fetchScopedAtestadosBundle(),
    enabled: isAccessResolved && hasControleAccess,
  });

  const analises = useMemo(() => montarAnalise(bundle?.atestados || []), [bundle?.atestados]);

  const analisesFiltradas = useMemo(() => {
    const termo = normalizarBusca(busca);
    return analises.filter((analise) => {
      const textoMilitar = normalizarBusca(`${analise.militar.nome} ${analise.militar.matricula}`);
      const matchBusca = !termo || textoMilitar.includes(termo);
      const matchStatus = statusFiltro === 'todos' || analise.statusRisco === statusFiltro;
      const matchVinculo = !somenteVinculoNaoClassificado || analise.vinculo === 'não classificado';
      const matchRelacao = !somenteRelacaoNaoClassificada || analise.relacaoServico === 'não classificada';
      return matchBusca && matchStatus && matchVinculo && matchRelacao;
    });
  }, [analises, busca, statusFiltro, somenteRelacaoNaoClassificada, somenteVinculoNaoClassificado]);

  const resumo = useMemo(() => ({
    totalMilitares: analises.length,
    criticosContinuos: analises.filter((analise) => analise.statusRisco === 'critico_continuo').length,
    criticosIntercalados: analises.filter((analise) => analise.statusRisco === 'critico_intercalado').length,
    naoClassificados: analises.filter((analise) => analise.vinculo === 'não classificado' || analise.relacaoServico === 'não classificada').length,
  }), [analises]);

  if (isAccessPending) return null;
  if (!hasControleAccess) return <AccessDenied modulo="Controle de Atestados Temporários" />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-[#1e3a5f]/10 p-3 text-[#1e3a5f]">
              <HeartPulse className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[#1e3a5f]">Controle de Atestados Médicos Temporários</h1>
              <p className="text-slate-500">Painel preventivo somente-leitura baseado no escopo de atestados já autorizado.</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 shadow-sm">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm font-medium leading-6">{AVISO_INSTITUCIONAL}</p>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ResumoCard title="Militares analisados" value={resumo.totalMilitares} icon={Users} />
          <ResumoCard title="Críticos por 30 dias contínuos" value={resumo.criticosContinuos} icon={ShieldAlert} tone="red" />
          <ResumoCard title="Críticos por 60 dias intercalados" value={resumo.criticosIntercalados} icon={ShieldAlert} tone="red" />
          <ResumoCard title="Vínculo/relação não classificados" value={resumo.naoClassificados} icon={AlertTriangle} tone="amber" />
        </div>

        <Card className="mb-6 border-slate-200 shadow-sm">
          <CardContent className="p-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_240px_auto_auto] lg:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Buscar por nome ou matrícula..."
                  value={busca}
                  onChange={(event) => setBusca(event.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFiltro} onValueChange={setStatusFiltro}>
                <SelectTrigger>
                  <SelectValue placeholder="Status de risco" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([status, label]) => (
                    <SelectItem key={status} value={status}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <Checkbox checked={somenteVinculoNaoClassificado} onCheckedChange={(checked) => setSomenteVinculoNaoClassificado(Boolean(checked))} />
                Vínculo não classificado
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <Checkbox checked={somenteRelacaoNaoClassificada} onCheckedChange={(checked) => setSomenteRelacaoNaoClassificada(Boolean(checked))} />
                Relação não classificada
              </label>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1e3a5f] border-t-transparent" />
              </div>
            ) : analisesFiltradas.length === 0 ? (
              <div className="py-16 text-center text-slate-500">Nenhum militar encontrado para os filtros selecionados.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Militar</TableHead>
                      <TableHead>Posto/Graduação</TableHead>
                      <TableHead>Matrícula</TableHead>
                      <TableHead>Lotação/Unidade</TableHead>
                      <TableHead className="text-right">Maior sequência</TableHead>
                      <TableHead className="text-right">365 dias</TableHead>
                      <TableHead className="text-right">Atestados</TableHead>
                      <TableHead>Vínculo</TableHead>
                      <TableHead>Relação com serviço</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Observações/Lacunas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analisesFiltradas.map((analise) => (
                      <TableRow key={analise.chave}>
                        <TableCell className="font-medium text-slate-900">{analise.militar.nome}</TableCell>
                        <TableCell>{analise.militar.postoGraduacao}</TableCell>
                        <TableCell>{analise.militar.matricula}</TableCell>
                        <TableCell>{analise.militar.lotacao}</TableCell>
                        <TableCell className="text-right font-semibold">{analise.maiorSequenciaContinua}</TableCell>
                        <TableCell className="text-right font-semibold">{analise.diasJanela365}</TableCell>
                        <TableCell className="text-right">{analise.quantidadeAtestadosConsiderados}</TableCell>
                        <TableCell><Badge variant="outline">Vínculo: {analise.vinculo}</Badge></TableCell>
                        <TableCell><Badge variant="outline">Relação: {analise.relacaoServico}</Badge></TableCell>
                        <TableCell>
                          <Badge className={STATUS_CLASSES[analise.statusRisco] || STATUS_CLASSES.nao_classificado} variant="outline">
                            {STATUS_LABELS[analise.statusRisco] || analise.statusRisco}
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
