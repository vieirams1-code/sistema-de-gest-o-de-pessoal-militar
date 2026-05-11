import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardList, Eye, FileText, Search, ShieldCheck, UserRound, XCircle } from 'lucide-react';

import AccessDenied from '@/components/auth/AccessDenied';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { createPageUrl } from '@/utils';
import { fetchScopedPainelContratosDesignacao } from '@/services/getScopedPainelContratosDesignacaoClient';
import {
  aplicarFiltrosPainelContratos,
  calcularDiasParaVencimento,
  calcularSituacaoDerivadaContrato,
  classificarVencimentoContrato,
  FILTRO_LEGADO,
  FILTRO_SITUACAO,
  FILTRO_VENCIMENTO,
  SITUACAO_CONTRATO_DESIGNACAO,
} from '@/services/painelContratosDesignacaoService';

const EMPTY_COUNTERS = {
  ativos: 0,
  vencendo30: 0,
  vencendo60: 0,
  vencendo90: 0,
  vencidos: 0,
  semDataFim: 0,
  legadoAtivaAplicada: 0,
  legadoAtivaPendente: 0,
  encerrados: 0,
  cancelados: 0,
};

const SITUACAO_UI = {
  [SITUACAO_CONTRATO_DESIGNACAO.ATIVO]: { label: 'Ativo', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  [SITUACAO_CONTRATO_DESIGNACAO.ATIVO_VENCENDO]: { label: 'Ativo vencendo', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  [SITUACAO_CONTRATO_DESIGNACAO.ATIVO_VENCIDO]: { label: 'Ativo vencido', className: 'bg-red-50 text-red-700 border-red-200' },
  [SITUACAO_CONTRATO_DESIGNACAO.ENCERRADO]: { label: 'Encerrado', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  [SITUACAO_CONTRATO_DESIGNACAO.CANCELADO]: { label: 'Cancelado', className: 'bg-rose-50 text-rose-700 border-rose-200' },
  [SITUACAO_CONTRATO_DESIGNACAO.SEM_DATA_FIM]: { label: 'Sem data fim', className: 'bg-blue-50 text-blue-700 border-blue-200' },
};

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR');
}

function CounterCard({ title, value, icon: Icon, color = 'slate' }) {
  const colors = {
    slate: 'bg-slate-50 text-slate-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    blue: 'bg-blue-50 text-blue-700',
    rose: 'bg-rose-50 text-rose-700',
  };
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2.5 rounded-xl ${colors[color] || colors.slate}`}><Icon size={20} /></div>
        <div>
          <p className="text-xs font-medium text-slate-500">{title}</p>
          <p className="text-2xl font-bold text-slate-900">{value || 0}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DetailItem({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-900 break-words">{value || '—'}</p>
    </div>
  );
}

export default function ContratosDesignacao() {
  const { isAdmin, canAccessAction, canAccessAll, permissions, userEmail, isLoading: loadingUser, isAccessResolved } = useCurrentUser();
  const hasAbsoluteAccess = canAccessAll || permissions === 'ALL';
  const canView = hasAbsoluteAccess || isAdmin || canAccessAction('visualizar_contratos_designacao') || canAccessAction('gerir_contratos_designacao');
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState(FILTRO_SITUACAO.TODOS);
  const [vencimento, setVencimento] = useState(FILTRO_VENCIMENTO.TODOS);
  const [legado, setLegado] = useState(FILTRO_LEGADO.TODOS);
  const [contratoDetalhe, setContratoDetalhe] = useState(null);

  const query = useQuery({
    queryKey: ['painel-contratos-designacao', Boolean(isAdmin || hasAbsoluteAccess), null, userEmail || null, null],
    queryFn: () => fetchScopedPainelContratosDesignacao(),
    enabled: Boolean(isAccessResolved && canView),
  });

  const bundle = query.data || {};
  const counters = { ...EMPTY_COUNTERS, ...(bundle.counters || {}) };
  const contratos = bundle.contratos || [];
  const militares = bundle.militares || [];
  const matriculasMilitar = bundle.matriculasMilitar || [];
  const legadoAtivaPorContrato = bundle.legadoAtivaPorContrato || {};

  const militaresPorId = useMemo(() => Object.fromEntries(militares.map((m) => [String(m.id), m])), [militares]);
  const contratosFiltrados = useMemo(() => aplicarFiltrosPainelContratos(contratos, {
    militaresPorId,
    matriculasMilitar,
    legadoAtivaPorContrato,
    busca,
    situacao,
    vencimento,
    legado,
  }), [busca, contratos, legado, legadoAtivaPorContrato, matriculasMilitar, militaresPorId, situacao, vencimento]);

  if (loadingUser || !isAccessResolved) return null;
  if (!canView) return <AccessDenied modulo="Contratos de Designação" />;

  const getMilitar = (contrato) => militaresPorId[String(contrato?.militar_id || '')] || {};
  const getMatriculaAtual = (contrato) => {
    const militar = getMilitar(contrato);
    const atual = matriculasMilitar.find((m) => String(m.militar_id) === String(contrato?.militar_id) && m.is_atual);
    return atual?.matricula || militar.matricula || '—';
  };
  const renderDias = (contrato) => {
    const dias = calcularDiasParaVencimento(contrato);
    if (dias === null) return '—';
    if (dias < 0) return `${Math.abs(dias)} dia(s) vencido`;
    if (dias === 0) return 'Vence hoje';
    return `${dias} dia(s)`;
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-sm"><ClipboardList size={26} /></div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Contratos de Designação</h1>
              <p className="text-slate-500">Controle centralizado de contratos ativos, vencidos, encerrados e cancelados. Nenhuma alteração automática é realizada nesta tela.</p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          <CounterCard title="Ativos" value={counters.ativos} icon={CheckCircle2} color="emerald" />
          <CounterCard title="Vencendo em 30 dias" value={counters.vencendo30} icon={CalendarClock} color="amber" />
          <CounterCard title="Vencendo em 60 dias" value={counters.vencendo60} icon={CalendarClock} color="amber" />
          <CounterCard title="Vencendo em 90 dias" value={counters.vencendo90} icon={CalendarClock} color="amber" />
          <CounterCard title="Vencidos" value={counters.vencidos} icon={AlertTriangle} color="red" />
          <CounterCard title="Sem data fim" value={counters.semDataFim} icon={FileText} color="blue" />
          <CounterCard title="Legado da Ativa aplicado" value={counters.legadoAtivaAplicada} icon={ShieldCheck} color="emerald" />
          <CounterCard title="Legado da Ativa pendente" value={counters.legadoAtivaPendente} icon={AlertTriangle} color="amber" />
          <CounterCard title="Encerrados" value={counters.encerrados} icon={XCircle} color="slate" />
          <CounterCard title="Cancelados" value={counters.cancelados} icon={XCircle} color="rose" />
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4 grid grid-cols-1 lg:grid-cols-4 gap-3">
            <div className="relative lg:col-span-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-slate-200" placeholder="Buscar por militar, matrícula, contrato ou boletim..." value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <select className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm" value={situacao} onChange={(e) => setSituacao(e.target.value)}>
              <option value={FILTRO_SITUACAO.TODOS}>Situação: Todos</option>
              <option value={FILTRO_SITUACAO.ATIVOS}>Ativos</option>
              <option value={FILTRO_SITUACAO.ATIVOS_VENCENDO}>Ativos vencendo</option>
              <option value={FILTRO_SITUACAO.ATIVOS_VENCIDOS}>Ativos vencidos</option>
              <option value={FILTRO_SITUACAO.ENCERRADOS}>Encerrados</option>
              <option value={FILTRO_SITUACAO.CANCELADOS}>Cancelados</option>
              <option value={FILTRO_SITUACAO.SEM_DATA_FIM}>Sem data fim</option>
            </select>
            <select className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm" value={vencimento} onChange={(e) => setVencimento(e.target.value)}>
              <option value={FILTRO_VENCIMENTO.TODOS}>Vencimento: Todos</option>
              <option value={FILTRO_VENCIMENTO.VENCIDOS}>Vencidos</option>
              <option value={FILTRO_VENCIMENTO.ATE_30}>Até 30 dias</option>
              <option value={FILTRO_VENCIMENTO.DE_31_A_60}>31–60 dias</option>
              <option value={FILTRO_VENCIMENTO.DE_61_A_90}>61–90 dias</option>
              <option value={FILTRO_VENCIMENTO.ACIMA_90}>Acima de 90 dias</option>
              <option value={FILTRO_VENCIMENTO.SEM_DATA_FIM}>Sem data fim</option>
            </select>
            <select className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm" value={legado} onChange={(e) => setLegado(e.target.value)}>
              <option value={FILTRO_LEGADO.TODOS}>Legado da Ativa: Todos</option>
              <option value={FILTRO_LEGADO.APLICADO}>Com transição aplicada</option>
              <option value={FILTRO_LEGADO.PENDENTE}>Sem transição aplicada</option>
            </select>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  {['Situação', 'Militar', 'Matrícula atual', 'Matrícula de designação', 'Início', 'Fim previsto/operacional', 'Dias para vencimento', 'Nº contrato', 'Boletim/publicação', 'Fonte legal/tipo', 'Legado da Ativa', 'Ações'].map((col) => <th key={col} className="px-4 py-3 text-left font-semibold whitespace-nowrap">{col}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {query.isLoading ? (
                  <tr><td colSpan="12" className="px-4 py-12 text-center text-slate-500">Carregando contratos...</td></tr>
                ) : contratosFiltrados.length === 0 ? (
                  <tr><td colSpan="12" className="px-4 py-12 text-center text-slate-500">Nenhum contrato encontrado para os filtros informados.</td></tr>
                ) : contratosFiltrados.map((contrato) => {
                  const militar = getMilitar(contrato);
                  const situacaoDerivada = calcularSituacaoDerivadaContrato(contrato);
                  const ui = SITUACAO_UI[situacaoDerivada] || SITUACAO_UI.ativo;
                  const legadoInfo = legadoAtivaPorContrato[String(contrato.id)] || { aplicado: false };
                  return (
                    <tr key={contrato.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3"><Badge variant="outline" className={ui.className}>{ui.label}</Badge></td>
                      <td className="px-4 py-3 min-w-56"><div className="font-semibold text-slate-900">{militar.nome_guerra || militar.nome_completo || 'Militar não localizado'}</div><div className="text-xs text-slate-500">{militar.posto_graduacao || militar.quadro || '—'}</div></td>
                      <td className="px-4 py-3 whitespace-nowrap">{getMatriculaAtual(contrato)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{contrato.matricula_designacao || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(contrato.data_inicio_contrato)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(contrato.data_fim_contrato || contrato.data_encerramento_operacional)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{renderDias(contrato)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{contrato.numero_contrato || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{contrato.boletim_publicacao || '—'}</td>
                      <td className="px-4 py-3 min-w-48">{[contrato.fonte_legal, contrato.tipo_designacao].filter(Boolean).join(' / ') || '—'}</td>
                      <td className="px-4 py-3"><Badge variant="outline" className={legadoInfo.aplicado ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}>{legadoInfo.aplicado ? 'Aplicada' : 'Pendente'}</Badge></td>
                      <td className="px-4 py-3"><div className="flex items-center gap-2"><Button asChild variant="outline" size="sm"><Link to={`${createPageUrl('VerMilitar')}?id=${contrato.militar_id}`}><UserRound size={14} className="mr-1" />Ficha</Link></Button><Button type="button" variant="outline" size="sm" onClick={() => setContratoDetalhe(contrato)}><Eye size={14} className="mr-1" />Detalhes</Button></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {query.error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{query.error.message || 'Erro ao carregar painel.'}</div>}
      </div>

      {contratoDetalhe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-4xl rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-5 flex items-center justify-between">
              <div><h2 className="text-xl font-bold text-slate-900">Detalhes do contrato</h2><p className="text-sm text-slate-500">Visualização read-only — não há alteração de dados nesta tela.</p></div>
              <Button variant="outline" onClick={() => setContratoDetalhe(null)}>Fechar</Button>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
              {(() => {
                const militar = getMilitar(contratoDetalhe);
                const legadoInfo = legadoAtivaPorContrato[String(contratoDetalhe.id)] || { aplicado: false, totalPeriodos: 0, ultimaAplicacaoEm: null };
                return (<>
                  <DetailItem label="Militar" value={militar.nome_completo || militar.nome_guerra} />
                  <DetailItem label="Matrícula atual" value={getMatriculaAtual(contratoDetalhe)} />
                  <DetailItem label="Matrícula de designação" value={contratoDetalhe.matricula_designacao} />
                  <DetailItem label="Status persistido" value={contratoDetalhe.status_contrato} />
                  <DetailItem label="Situação visual derivada" value={SITUACAO_UI[calcularSituacaoDerivadaContrato(contratoDetalhe)]?.label} />
                  <DetailItem label="Classificação vencimento" value={classificarVencimentoContrato(contratoDetalhe)} />
                  <DetailItem label="Início" value={formatDate(contratoDetalhe.data_inicio_contrato)} />
                  <DetailItem label="Fim previsto/operacional" value={formatDate(contratoDetalhe.data_fim_contrato || contratoDetalhe.data_encerramento_operacional)} />
                  <DetailItem label="Data de inclusão para férias" value={formatDate(contratoDetalhe.data_inclusao_para_ferias)} />
                  <DetailItem label="Nº contrato" value={contratoDetalhe.numero_contrato} />
                  <DetailItem label="Boletim/publicação" value={contratoDetalhe.boletim_publicacao} />
                  <DetailItem label="Data publicação" value={formatDate(contratoDetalhe.data_publicacao)} />
                  <DetailItem label="Fonte legal" value={contratoDetalhe.fonte_legal} />
                  <DetailItem label="Tipo de designação" value={contratoDetalhe.tipo_designacao} />
                  <DetailItem label="Legado da Ativa" value={legadoInfo.aplicado ? `Aplicada (${legadoInfo.totalPeriodos} período(s))` : 'Pendente'} />
                  <DetailItem label="Última aplicação legado" value={legadoInfo.ultimaAplicacaoEm ? formatDate(legadoInfo.ultimaAplicacaoEm) : '—'} />
                  <div className="md:col-span-2"><DetailItem label="Observações" value={contratoDetalhe.observacoes} /></div>
                </>);
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
