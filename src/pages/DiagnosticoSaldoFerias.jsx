import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, AlertTriangle, CheckCircle2, Search, ShieldAlert } from 'lucide-react';
import { AjusteSaldoFerias, CreditoExtraFerias } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import AccessDenied from '@/components/auth/AccessDenied';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { createPageUrl } from '@/utils';
import { fetchScopedPeriodosAquisitivosBundle } from '@/services/getScopedPeriodosAquisitivosBundleClient';
import { listarDescontosFerias } from '@/services/descontoFeriasService';
import { compararSaldoPeriodo } from '@/services/diagnosticoSaldoFeriasService';

const STATUS_TODOS = 'todos';
const STATUS_COMPATIVEL = 'Compatível';
const STATUS_SHADOW = 'Shadow pendente';
const STATUS_DIVERGENTE = 'Divergente';

function normalizarTexto(value) {
  return String(value ?? '').trim();
}

function normalizarLower(value) {
  return normalizarTexto(value).toLowerCase();
}

function normalizarId(value) {
  return normalizarTexto(value);
}

function normalizarReferenciaPeriodo(periodo = {}) {
  return normalizarId(periodo?.ano_referencia || periodo?.referencia || periodo?.periodo_aquisitivo_ref);
}

function formatarDias(value) {
  const numero = Number(value);
  if (!Number.isFinite(numero)) return '—';
  return `${numero}d`;
}

function formatarDataBR(value) {
  const texto = normalizarTexto(value).slice(0, 10);
  if (!texto) return '—';
  const [ano, mes, dia] = texto.split('-');
  if (!ano || !mes || !dia) return texto;
  return `${dia}/${mes}/${ano}`;
}

function isRegistroDoPeriodo(registro = {}, periodo = {}) {
  const registroPeriodoId = normalizarId(registro?.periodo_aquisitivo_id);
  const periodoId = normalizarId(periodo?.id);

  if (registroPeriodoId) return Boolean(periodoId && registroPeriodoId === periodoId);

  const registroRef = normalizarId(registro?.periodo_aquisitivo_ref);
  const periodoRef = normalizarReferenciaPeriodo(periodo);
  return Boolean(registroRef && periodoRef && registroRef === periodoRef);
}

function isFeriasConsiderada(ferias = {}, periodo = {}) {
  const statusComImpacto = new Set(['Gozada', 'Prevista', 'Autorizada', 'Em Curso', 'Interrompida']);
  return isRegistroDoPeriodo(ferias, periodo) && statusComImpacto.has(normalizarTexto(ferias?.status));
}

function montarNomeMilitar(periodo = {}, militarById = new Map()) {
  const militar = militarById.get(periodo?.militar_id) || null;
  return normalizarTexto(
    periodo?.militar_nome
      || militar?.nome_guerra
      || militar?.nome_completo
      || militar?.nome
      || periodo?.militar_id
      || 'Militar não identificado',
  );
}

function resolverStatus(diagnostico) {
  const oficialCompativelComLegado = Number(diagnostico?.diferenca_oficial_vs_legado) === 0;
  const ajustesPuroCompativelComLegado = Number(diagnostico?.diferenca_legado_vs_ajustes_puro) === 0;

  if (oficialCompativelComLegado && ajustesPuroCompativelComLegado) return STATUS_COMPATIVEL;
  if (oficialCompativelComLegado && !ajustesPuroCompativelComLegado) return STATUS_SHADOW;
  return STATUS_DIVERGENTE;
}

function getStatusBadgeClass(status) {
  if (status === STATUS_COMPATIVEL) return 'border-emerald-200 bg-emerald-100 text-emerald-800';
  if (status === STATUS_SHADOW) return 'border-amber-200 bg-amber-100 text-amber-800';
  return 'border-red-200 bg-red-100 text-red-800';
}

function DetalheLista({ titulo, itens = [], renderItem, vazio = 'Nenhum registro ativo.' }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">{titulo}</h3>
      {itens.length === 0 ? (
        <p className="text-sm text-slate-500">{vazio}</p>
      ) : (
        <div className="space-y-2">
          {itens.map((item, index) => (
            <div key={item?.id || `${titulo}-${index}`} className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
              {renderItem(item)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DiagnosticoSaldoFerias() {
  const navigate = useNavigate();
  const { isAdmin = false, isLoading: loadingUser, isAccessResolved } = useCurrentUser();
  const [statusFilter, setStatusFilter] = useState(STATUS_TODOS);
  const [militarFilter, setMilitarFilter] = useState('');
  const [periodoFilter, setPeriodoFilter] = useState('');
  const [linhaSelecionadaId, setLinhaSelecionadaId] = useState('');

  const queryEnabled = isAccessResolved === true && !loadingUser && isAdmin;

  const { data: paBundle, isLoading: loadingBundle } = useQuery({
    queryKey: ['diagnostico-saldo-ferias-pa-bundle', isAdmin],
    queryFn: () => fetchScopedPeriodosAquisitivosBundle(),
    enabled: queryEnabled,
    staleTime: 60 * 1000,
  });

  const { data: ajustes = [], isLoading: loadingAjustes } = useQuery({
    queryKey: ['diagnostico-saldo-ferias-ajustes', isAdmin],
    queryFn: () => AjusteSaldoFerias.list('-created_date'),
    enabled: queryEnabled,
    staleTime: 60 * 1000,
  });

  const { data: creditosExtraordinarios = [], isLoading: loadingCreditos } = useQuery({
    queryKey: ['diagnostico-saldo-ferias-creditos-extra', isAdmin],
    queryFn: () => CreditoExtraFerias.list('-data_referencia'),
    enabled: queryEnabled,
    staleTime: 60 * 1000,
  });

  const { data: descontos = [], isLoading: loadingDescontos } = useQuery({
    queryKey: ['diagnostico-saldo-ferias-descontos', isAdmin],
    queryFn: listarDescontosFerias,
    enabled: queryEnabled,
    staleTime: 60 * 1000,
  });

  const periodos = paBundle?.periodosAquisitivos || [];
  const ferias = paBundle?.ferias || [];
  const militares = paBundle?.militares || [];
  const isLoading = loadingBundle || loadingAjustes || loadingCreditos || loadingDescontos;

  const militarById = useMemo(() => new Map(militares.map((militar) => [militar.id, militar])), [militares]);

  const linhas = useMemo(() => periodos.map((periodo) => {
    const diagnostico = compararSaldoPeriodo({ periodo, ajustes, ferias, creditosExtraordinarios, descontos });
    const militar = montarNomeMilitar(periodo, militarById);
    const periodoRef = diagnostico.periodo_ref || normalizarReferenciaPeriodo(periodo) || '—';
    const status = resolverStatus(diagnostico);
    return {
      id: periodo.id || `${periodo.militar_id || militar}-${periodoRef}`,
      militar,
      periodo,
      periodoRef,
      status,
      diagnostico,
      ajustesPeriodo: ajustes.filter((item) => isRegistroDoPeriodo(item, periodo)),
      feriasConsideradas: ferias.filter((item) => isFeriasConsiderada(item, periodo)),
    };
  }).sort((a, b) => a.militar.localeCompare(b.militar) || b.periodoRef.localeCompare(a.periodoRef)), [ajustes, creditosExtraordinarios, descontos, ferias, militarById, periodos]);

  const linhasFiltradas = useMemo(() => linhas.filter((linha) => {
    const militarOk = !militarFilter || normalizarLower(linha.militar).includes(normalizarLower(militarFilter));
    const periodoOk = !periodoFilter || normalizarLower(linha.periodoRef).includes(normalizarLower(periodoFilter));
    const statusOk = statusFilter === STATUS_TODOS || linha.status === statusFilter;
    return militarOk && periodoOk && statusOk;
  }), [linhas, militarFilter, periodoFilter, statusFilter]);

  const resumo = useMemo(() => linhas.reduce((acc, linha) => {
    acc.total += 1;
    if (linha.status === STATUS_COMPATIVEL) acc.compativeis += 1;
    if (linha.status === STATUS_SHADOW) acc.shadow += 1;
    if (linha.status === STATUS_DIVERGENTE) acc.divergentes += 1;
    return acc;
  }, { total: 0, compativeis: 0, shadow: 0, divergentes: 0 }), [linhas]);

  const linhaSelecionada = linhas.find((linha) => linha.id === linhaSelecionadaId) || null;

  if (!loadingUser && isAccessResolved && !isAdmin) return <AccessDenied modulo="Diagnóstico de Saldo de Férias" />;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('Ferias'))} className="mt-1 hover:bg-slate-200">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-[#1e3a5f]">Diagnóstico de Saldo de Férias</h1>
              <p className="mt-1 text-sm text-slate-600">
                Visão administrativa somente leitura para comparar saldo oficial, derivado legado e AjusteSaldoFerias.
              </p>
            </div>
          </div>
          <Badge className="w-fit border border-blue-200 bg-blue-50 px-3 py-1.5 text-blue-800">
            <ShieldAlert className="mr-1.5 h-4 w-4" /> Sem correção automática
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Total de períodos analisados</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-slate-900">{resumo.total}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Compatíveis</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-emerald-700">{resumo.compativeis}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Shadow pendente</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-amber-700">{resumo.shadow}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Divergentes</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-red-700">{resumo.divergentes}</p></CardContent></Card>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={STATUS_TODOS}>Todos os status</SelectItem>
                  <SelectItem value={STATUS_COMPATIVEL}>{STATUS_COMPATIVEL}</SelectItem>
                  <SelectItem value={STATUS_SHADOW}>{STATUS_SHADOW}</SelectItem>
                  <SelectItem value={STATUS_DIVERGENTE}>{STATUS_DIVERGENTE}</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input value={militarFilter} onChange={(event) => setMilitarFilter(event.target.value)} placeholder="Filtrar por militar" className="pl-9" />
              </div>
              <Input value={periodoFilter} onChange={(event) => setPeriodoFilter(event.target.value)} placeholder="Filtrar por período" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Militar</th><th className="px-4 py-3">Período</th><th className="px-4 py-3">Oficial</th><th className="px-4 py-3">Legado</th><th className="px-4 py-3">Ajustes</th><th className="px-4 py-3">Dif. legado</th><th className="px-4 py-3">Dif. ajustes</th><th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Carregando diagnóstico...</td></tr>
                  ) : linhasFiltradas.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Nenhum período encontrado para os filtros informados.</td></tr>
                  ) : linhasFiltradas.map((linha) => (
                    <tr key={linha.id} onClick={() => setLinhaSelecionadaId(linha.id)} className={`cursor-pointer hover:bg-blue-50 ${linhaSelecionadaId === linha.id ? 'bg-blue-50' : 'bg-white'}`}>
                      <td className="px-4 py-3 font-medium text-slate-800">{linha.militar}</td>
                      <td className="px-4 py-3 text-slate-600">{linha.periodoRef}</td>
                      <td className="px-4 py-3">{formatarDias(linha.diagnostico.modelo_oficial_atual?.saldo_atual_sistema)}</td>
                      <td className="px-4 py-3">{formatarDias(linha.diagnostico.modelo_derivado_legado?.saldo)}</td>
                      <td className="px-4 py-3">{formatarDias(linha.diagnostico.modelo_ajustes_puro?.saldo)}</td>
                      <td className="px-4 py-3">{formatarDias(linha.diagnostico.diferenca_oficial_vs_legado)}</td>
                      <td className="px-4 py-3">{formatarDias(linha.diagnostico.diferenca_oficial_vs_ajustes_puro)}</td>
                      <td className="px-4 py-3"><Badge className={`${getStatusBadgeClass(linha.status)} border`}>{linha.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {linhaSelecionada && (
          <Card className="border-blue-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl text-[#1e3a5f]">
                {linhaSelecionada.status === STATUS_COMPATIVEL ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className="h-5 w-5 text-amber-600" />}
                Detalhes — {linhaSelecionada.militar} / {linhaSelecionada.periodoRef}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <DetalheLista
                titulo="Créditos ativos"
                itens={linhaSelecionada.diagnostico.modelo_ajustes_puro?.detalhes_creditos || []}
                renderItem={(item) => <><p className="font-semibold">{formatarDias(item.dias)} — {item.motivo || item.tipo || 'Crédito'}</p><p className="text-xs text-slate-500">Origem: {item.origem || item.entidade_origem || 'AjusteSaldoFerias'}</p></>}
              />
              <DetalheLista
                titulo="Débitos ativos"
                itens={linhaSelecionada.diagnostico.modelo_ajustes_puro?.detalhes_debitos || []}
                renderItem={(item) => <><p className="font-semibold">{formatarDias(item.dias)} — {item.motivo || item.tipo || 'Débito'}</p><p className="text-xs text-slate-500">Origem: {item.origem || item.entidade_origem || 'AjusteSaldoFerias'}</p></>}
              />
              <DetalheLista
                titulo="Férias previstas/gozadas consideradas"
                itens={linhaSelecionada.feriasConsideradas}
                vazio="Nenhuma férias com impacto de saldo foi considerada."
                renderItem={(item) => <><p className="font-semibold">{formatarDias(item.dias)} — {item.status || 'Sem status'}</p><p className="text-xs text-slate-500">{formatarDataBR(item.data_inicio)} a {formatarDataBR(item.data_fim || item.data_termino)}</p></>}
              />
              <DetalheLista
                titulo="Inconsistências retornadas pelo service"
                itens={linhaSelecionada.diagnostico.inconsistencias || []}
                vazio="Nenhuma inconsistência retornada."
                renderItem={(item) => <p className="font-mono text-xs">{item}</p>}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
