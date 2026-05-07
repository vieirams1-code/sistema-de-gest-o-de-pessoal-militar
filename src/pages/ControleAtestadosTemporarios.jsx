import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarCheck, CalendarDays, HeartPulse, RefreshCw, Search, ShieldAlert, Users } from 'lucide-react';

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

const AVISO_INSTITUCIONAL = 'Painel read-only para acompanhamento de afastamentos médicos dos militares dentro do escopo do usuário. Os alertas de 30 dias ininterruptos e 60 dias intercalados são aplicados apenas aos militares classificados como quadro temporário.';
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

const TEMPORARIO_LABELS = {
  sim: 'Sim',
  nao: 'Não',
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

function obterOpcoes(analises, seletor) {
  return [...new Set(analises.map(seletor).filter((valor) => valor && valor !== '-'))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
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
  const [statusPeriodoFiltro, setStatusPeriodoFiltro] = useState('todos');
  const [quadroFiltro, setQuadroFiltro] = useState('todos');
  const [lotacaoFiltro, setLotacaoFiltro] = useState('todos');
  const [somenteTemporarios, setSomenteTemporarios] = useState(false);
  const [somenteCriticos, setSomenteCriticos] = useState(false);

  const { data: bundle = { atestados: [], meta: {} }, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['controle-atestados-temporarios-bundle', isAdmin, modoAcesso, userEmail, effectiveUserEmail || effectiveEmail || null],
    queryFn: async () => fetchScopedAtestadosBundle(),
    enabled: isAccessResolved && hasControleAccess,
  });

  const analises = useMemo(() => montarAnalise(bundle?.atestados || []), [bundle?.atestados]);
  const quadrosDisponiveis = useMemo(() => obterOpcoes(analises, (analise) => analise.militar.quadro), [analises]);
  const lotacoesDisponiveis = useMemo(() => obterOpcoes(analises, (analise) => analise.militar.lotacao), [analises]);

  const analisesFiltradas = useMemo(() => {
    const termo = normalizarBusca(busca);
    return analises.filter((analise) => {
      const textoMilitar = normalizarBusca(`${analise.militar.nome} ${analise.militar.matricula}`);
      const matchBusca = !termo || textoMilitar.includes(termo);
      const matchStatus = statusFiltro === 'todos' || analise.statusRisco === statusFiltro;
      const matchTemporario = !somenteTemporarios || analise.temporarioClassificacao === 'sim';
      const matchCritico = !somenteCriticos || analise.statusRisco.startsWith('critico');
      const matchPeriodo = statusPeriodoFiltro === 'todos'
        || (statusPeriodoFiltro === 'vigentes' && analise.quantidadeAtestadosVigentes > 0)
        || (statusPeriodoFiltro === 'encerrados' && analise.quantidadeAtestadosVigentes === 0);
      const matchQuadro = quadroFiltro === 'todos' || analise.militar.quadro === quadroFiltro;
      const matchLotacao = lotacaoFiltro === 'todos' || analise.militar.lotacao === lotacaoFiltro;
      return matchBusca && matchStatus && matchTemporario && matchCritico && matchPeriodo && matchQuadro && matchLotacao;
    });
  }, [analises, busca, lotacaoFiltro, quadroFiltro, somenteCriticos, somenteTemporarios, statusFiltro, statusPeriodoFiltro]);

  const resumo = useMemo(() => ({
    totalMilitaresComAtestados: analises.length,
    totalAtestadosAnalisados: analises.reduce((total, analise) => total + analise.quantidadeAtestadosRecebidos, 0),
    atestadosVigentes: analises.reduce((total, analise) => total + analise.quantidadeAtestadosVigentes, 0),
    diasTotaisJanela: analises.reduce((total, analise) => total + analise.diasJanela365, 0),
    temporariosEmPrazo: analises.filter((analise) => analise.ehTemporario && analise.statusRisco !== 'normal' && analise.statusRisco !== 'nao_classificado').length,
    registrosComLacunasData: analises.reduce((total, analise) => total + analise.lacunas.length, 0),
  }), [analises]);

  if (isAccessPending) return null;
  if (!hasControleAccess) return <AccessDenied modulo="Controle de Atestados" />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-[#1e3a5f]/10 p-3 text-[#1e3a5f]">
              <HeartPulse className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[#1e3a5f]">Controle de Atestados Médicos</h1>
              <p className="text-slate-500">Painel geral de estatísticas, filtros e extratos de atestados médicos no escopo autorizado.</p>
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

        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <ResumoCard title="Total de militares com atestados" value={resumo.totalMilitaresComAtestados} icon={Users} />
          <ResumoCard title="Total de atestados analisados" value={resumo.totalAtestadosAnalisados} icon={HeartPulse} />
          <ResumoCard title="Atestados vigentes" value={resumo.atestadosVigentes} icon={CalendarCheck} />
          <ResumoCard title="Dias totais na janela" value={resumo.diasTotaisJanela} icon={CalendarDays} />
          <ResumoCard title="Temporários em atenção/alerta/crítico" value={resumo.temporariosEmPrazo} icon={ShieldAlert} tone="red" />
          <ResumoCard title="Registros com lacunas de data" value={resumo.registrosComLacunasData} icon={AlertTriangle} tone="amber" />
        </div>

        <Card className="mb-6 border-slate-200 shadow-sm">
          <CardContent className="space-y-4 p-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_220px_180px] lg:items-center">
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
              <Select value={statusPeriodoFiltro} onValueChange={setStatusPeriodoFiltro}>
                <SelectTrigger>
                  <SelectValue placeholder="Vigência" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Vigentes e encerrados</SelectItem>
                  <SelectItem value="vigentes">Somente vigentes</SelectItem>
                  <SelectItem value="encerrados">Somente encerrados</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 lg:grid-cols-[220px_220px_auto_auto] lg:items-center">
              <Select value={quadroFiltro} onValueChange={setQuadroFiltro}>
                <SelectTrigger>
                  <SelectValue placeholder="Quadro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os quadros</SelectItem>
                  {quadrosDisponiveis.map((quadro) => (
                    <SelectItem key={quadro} value={quadro}>{quadro}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={lotacaoFiltro} onValueChange={setLotacaoFiltro}>
                <SelectTrigger>
                  <SelectValue placeholder="Lotação/unidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as lotações</SelectItem>
                  {lotacoesDisponiveis.map((lotacao) => (
                    <SelectItem key={lotacao} value={lotacao}>{lotacao}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <Checkbox checked={somenteTemporarios} onCheckedChange={(checked) => setSomenteTemporarios(Boolean(checked))} />
                Somente temporários
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <Checkbox checked={somenteCriticos} onCheckedChange={(checked) => setSomenteCriticos(Boolean(checked))} />
                Somente críticos
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
                      <TableHead>Posto/graduação</TableHead>
                      <TableHead>Quadro</TableHead>
                      <TableHead>Matrícula</TableHead>
                      <TableHead>Lotação/unidade</TableHead>
                      <TableHead className="text-right">Total de atestados</TableHead>
                      <TableHead className="text-right">Maior sequência contínua</TableHead>
                      <TableHead className="text-right">Dias na janela de 365 dias</TableHead>
                      <TableHead>Temporário</TableHead>
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
                          <Badge variant="outline">{TEMPORARIO_LABELS[analise.temporarioClassificacao]}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={STATUS_CLASSES[analise.statusRisco] || STATUS_CLASSES.nao_classificado} variant="outline">
                            {analise.temporarioClassificacao === 'nao_classificado' ? 'Não classificado' : analise.ehTemporario ? STATUS_LABELS[analise.statusRisco] : 'Sem alerta específico'}
                          </Badge>
                        </TableCell>
                        <TableCell className="min-w-72 text-xs text-slate-500">
                          {analise.lacunas.length ? analise.lacunas.join(' ') : 'Sem lacunas de data identificadas.'}
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
