import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronDown, ChevronRight, Copy, ExternalLink, Pencil, Search, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { createPageUrl } from '@/utils';
import { listarFamiliasInconsistentes } from '@/services/familiasFeriasInconsistentesService';

const STATUS_TODOS = 'todos';
const STATUS_OPCOES = ['Prevista', 'Autorizada', 'Em Curso', 'Interrompida', 'Gozada'];

function normalizarLower(value) {
  return String(value ?? '').trim().toLowerCase();
}

function formatarDataBR(value) {
  const texto = String(value ?? '').slice(0, 10);
  if (!texto) return '—';
  const [ano, mes, dia] = texto.split('-');
  if (!ano || !mes || !dia) return texto;
  return `${dia}/${mes}/${ano}`;
}

function formatarDataHora(value) {
  const texto = String(value ?? '');
  if (!texto) return '—';
  const data = new Date(texto);
  if (Number.isNaN(data.getTime())) return texto;
  return data.toLocaleString('pt-BR');
}

function nomeMilitar(periodo = {}, militarById = new Map()) {
  const militar = militarById.get(periodo?.militar_id) || null;
  return String(
    periodo?.militar_nome || militar?.nome_guerra || militar?.nome_completo || periodo?.militar_id || 'Militar não identificado',
  ).trim();
}

function matriculaMilitar(periodo = {}, militarById = new Map()) {
  const militar = militarById.get(periodo?.militar_id) || null;
  return String(periodo?.militar_matricula || militar?.matricula || '—').trim() || '—';
}

export default function FamiliasInconsistentesSection({ periodos = [], ajustes = [], ferias = [], militares = [], isLoading = false }) {
  const navigate = useNavigate();
  const [militarFilter, setMilitarFilter] = useState('');
  const [matriculaFilter, setMatriculaFilter] = useState('');
  const [periodoFilter, setPeriodoFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState(STATUS_TODOS);
  const [expandido, setExpandido] = useState('');
  const [copiadoId, setCopiadoId] = useState('');

  const militarById = useMemo(() => new Map(militares.map((m) => [m.id, m])), [militares]);
  const periodoById = useMemo(() => new Map(periodos.map((p) => [p.id, p])), [periodos]);

  const familias = useMemo(() => {
    const inconsistentes = listarFamiliasInconsistentes({ periodos, ajustes, ferias });
    return inconsistentes
      .map((familia) => {
        const periodo = periodoById.get(familia.periodo_id) || { id: familia.periodo_id, militar_id: familia.militar_id };
        return {
          ...familia,
          periodo,
          militar: nomeMilitar(periodo, militarById),
          matricula: matriculaMilitar(periodo, militarById),
        };
      })
      .sort((a, b) => a.militar.localeCompare(b.militar) || String(b.periodo_ref).localeCompare(String(a.periodo_ref)));
  }, [periodos, ajustes, ferias, periodoById, militarById]);

  const familiasFiltradas = useMemo(() => familias.filter((familia) => {
    const militarOk = !militarFilter || normalizarLower(familia.militar).includes(normalizarLower(militarFilter));
    const matriculaOk = !matriculaFilter || normalizarLower(familia.matricula).includes(normalizarLower(matriculaFilter));
    const periodoOk = !periodoFilter || normalizarLower(familia.periodo_ref).includes(normalizarLower(periodoFilter));
    const statusOk = statusFilter === STATUS_TODOS
      || (familia.feriasValidas || []).some((item) => item.status === statusFilter);
    return militarOk && matriculaOk && periodoOk && statusOk;
  }), [familias, militarFilter, matriculaFilter, periodoFilter, statusFilter]);

  const copiarIds = async (familia) => {
    const idsFerias = (familia.feriasValidas || []).map((f) => f.id).join(', ');
    const texto = [
      `Militar: ${familia.militar} (${familia.matricula})`,
      `periodo_aquisitivo_id: ${familia.periodo_id}`,
      `Período: ${familia.periodo_ref || '—'}`,
      `Direito operacional: ${familia.direito_operacional}d | Soma válida: ${familia.soma_valida}d | Excesso: ${familia.excesso}d`,
      `Férias (ids): ${idsFerias}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(texto);
      setCopiadoId(familia.periodo_id);
      setTimeout(() => setCopiadoId(''), 1500);
    } catch {
      /* clipboard indisponível — silencioso */
    }
  };

  return (
    <Card className="border-amber-100">
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <CardTitle className="flex items-center gap-2 text-xl text-[#1e3a5f]">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          Famílias de férias inconsistentes
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge className="border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-800">
            {isLoading ? 'Analisando…' : `${familias.length} famílias encontradas`}
          </Badge>
          <Badge className="border border-blue-200 bg-blue-50 px-3 py-1.5 text-blue-800">
            <ShieldAlert className="mr-1.5 h-4 w-4" /> Sem correção automática
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600">
          Períodos em que a <strong>soma das férias válidas</strong> ultrapassa o <strong>direito líquido operacional</strong>.
          Corrija pelo fluxo normal (editar dias/fracionamento, ou cancelar/excluir o registro duplicado). A lista atualiza
          sozinha após a correção.
        </p>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={militarFilter} onChange={(e) => setMilitarFilter(e.target.value)} placeholder="Militar" className="pl-9" />
          </div>
          <Input value={matriculaFilter} onChange={(e) => setMatriculaFilter(e.target.value)} placeholder="Matrícula" />
          <Input value={periodoFilter} onChange={(e) => setPeriodoFilter(e.target.value)} placeholder="Período" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Status das férias" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={STATUS_TODOS}>Todos os status</SelectItem>
              {STATUS_OPCOES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3 w-8" />
                <th className="px-4 py-3">Militar</th>
                <th className="px-4 py-3">Matrícula</th>
                <th className="px-4 py-3">Período</th>
                <th className="px-4 py-3">Direito op.</th>
                <th className="px-4 py-3">Soma válida</th>
                <th className="px-4 py-3">Excesso</th>
                <th className="px-4 py-3">Registros</th>
                <th className="px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">Analisando famílias…</td></tr>
              ) : familiasFiltradas.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">Nenhuma família inconsistente para os filtros informados.</td></tr>
              ) : familiasFiltradas.map((familia) => {
                const aberto = expandido === familia.periodo_id;
                return (
                  <React.Fragment key={familia.periodo_id || `${familia.militar_id}-${familia.periodo_ref}`}>
                    <tr className="bg-white hover:bg-amber-50/40">
                      <td className="px-3 py-3">
                        <button type="button" onClick={() => setExpandido(aberto ? '' : familia.periodo_id)} className="text-slate-500 hover:text-slate-800">
                          {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">{familia.militar}</td>
                      <td className="px-4 py-3 text-slate-600">{familia.matricula}</td>
                      <td className="px-4 py-3 text-slate-600">{familia.periodo_ref || '—'}</td>
                      <td className="px-4 py-3 text-slate-700">{familia.direito_operacional}d</td>
                      <td className="px-4 py-3 font-semibold text-red-700">{familia.soma_valida}d</td>
                      <td className="px-4 py-3"><Badge className="border border-red-200 bg-red-100 text-red-800">+{familia.excesso}d</Badge></td>
                      <td className="px-4 py-3 text-slate-600">{familia.quantidade_registros}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => navigate(`${createPageUrl('VerMilitar')}?id=${familia.militar_id}`)}>
                            <ExternalLink className="mr-1 h-3 w-3" /> Militar
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => copiarIds(familia)}>
                            <Copy className="mr-1 h-3 w-3" /> {copiadoId === familia.periodo_id ? 'Copiado!' : 'Copiar IDs'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {aberto && (
                      <tr className="bg-slate-50">
                        <td colSpan={9} className="px-4 py-3">
                          <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
                            <table className="w-full min-w-[820px] text-xs">
                              <thead className="bg-slate-100 text-left uppercase tracking-wide text-slate-500">
                                <tr>
                                  <th className="px-3 py-2">ID</th>
                                  <th className="px-3 py-2">Fração</th>
                                  <th className="px-3 py-2">Dias</th>
                                  <th className="px-3 py-2">Início</th>
                                  <th className="px-3 py-2">Fim</th>
                                  <th className="px-3 py-2">Retorno</th>
                                  <th className="px-3 py-2">Status</th>
                                  <th className="px-3 py-2">Criado</th>
                                  <th className="px-3 py-2">Atualizado</th>
                                  <th className="px-3 py-2">Ação</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {(familia.feriasValidas || []).map((item) => (
                                  <tr key={item.id}>
                                    <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{item.id}</td>
                                    <td className="px-3 py-2">{item.fracionamento || '—'}</td>
                                    <td className="px-3 py-2 font-semibold">{item.dias}d</td>
                                    <td className="px-3 py-2">{formatarDataBR(item.data_inicio)}</td>
                                    <td className="px-3 py-2">{formatarDataBR(item.data_fim)}</td>
                                    <td className="px-3 py-2">{formatarDataBR(item.data_retorno)}</td>
                                    <td className="px-3 py-2">{item.status}</td>
                                    <td className="px-3 py-2 text-slate-500">{formatarDataHora(item.created_date)}</td>
                                    <td className="px-3 py-2 text-slate-500">{formatarDataHora(item.updated_date)}</td>
                                    <td className="px-3 py-2">
                                      <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => navigate(`${createPageUrl('CadastrarFerias')}?id=${item.id}`)}>
                                        <Pencil className="mr-1 h-3 w-3" /> Editar
                                      </Button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {(familia.bg_publicacao || (familia.feriasValidas || []).some((f) => f.bg_publicacao)) && (
                            <p className="mt-2 text-xs text-slate-500">
                              Verifique a publicação/ato vinculada antes de corrigir. Ex.: BG {(familia.feriasValidas || []).map((f) => f.bg_publicacao).filter(Boolean).join(', ')}.
                            </p>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}