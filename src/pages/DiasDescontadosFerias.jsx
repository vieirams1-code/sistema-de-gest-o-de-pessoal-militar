import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Download, CalendarMinus, Plus, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cancelarOuReverterDescontoFerias, criarDescontoFeriasAutomatico, listarDescontosFerias } from '@/services/diasDescontadosFeriasService';

const fmt = (v) => (v ? new Date(`${v}T00:00:00`).toLocaleDateString('pt-BR') : '—');
const norm = (v) => String(v || '').toLowerCase();

function csvEscape(v) { return `"${String(v ?? '').replaceAll('"', '""')}"`; }

export default function DiasDescontadosFerias() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, canAccessModule, canAccessAction, isLoading: loadingUser, isAccessResolved } = useCurrentUser();
  const [filtros, setFiltros] = useState({ militar: '', lotacao: '', periodo: '', status: '', publicacao: '' });
  const [form, setForm] = useState({ militar_id: '', periodo_aquisitivo_id: '', dias: '', data_dispensa: new Date().toISOString().slice(0, 10), fundamentacao: '', observacoes: '' });

  const canView = canAccessModule('ferias') && (canAccessAction('visualizar_ferias') || canAccessAction('visualizar_creditos_ferias'));
  const { data: descontos = [] } = useQuery({ queryKey: ['dias-descontados-ferias'], queryFn: () => listarDescontosFerias(), enabled: isAccessResolved && canView });
  const { data: militares = [] } = useQuery({ queryKey: ['dias-descontados-ferias-militares'], queryFn: () => base44.entities.Militar.list('nome_completo'), enabled: isAccessResolved && canView });
  const { data: periodos = [] } = useQuery({ queryKey: ['dias-descontados-ferias-periodos', form.militar_id], queryFn: () => base44.entities.PeriodoAquisitivo.filter({ militar_id: form.militar_id }), enabled: isAccessResolved && canView && Boolean(form.militar_id) });
  const militarById = useMemo(() => new Map(militares.map((m) => [String(m.id), m])), [militares]);
  const periodosDisponiveis = useMemo(() => [...periodos].sort((a, b) => String(b.inicio_aquisitivo || b.ano_referencia || '').localeCompare(String(a.inicio_aquisitivo || a.ano_referencia || ''))), [periodos]);

  const criarMutation = useMutation({
    mutationFn: async () => {
      const militar = militarById.get(String(form.militar_id));
      const periodo = periodosDisponiveis.find((p) => String(p.id) === String(form.periodo_aquisitivo_id));
      if (!militar) throw new Error('Selecione o militar.');
      if (!periodo) throw new Error('Selecione o período aquisitivo.');
      if (!form.fundamentacao.trim()) throw new Error('Informe a fundamentação.');
      return criarDescontoFeriasAutomatico({ militar, periodo, dias: form.dias, dataDispensa: form.data_dispensa, fundamentacao: form.fundamentacao, observacoes: form.observacoes, usuario: user?.email || user?.full_name || '' });
    },
    onSuccess: async () => {
      setForm({ militar_id: '', periodo_aquisitivo_id: '', dias: '', data_dispensa: new Date().toISOString().slice(0, 10), fundamentacao: '', observacoes: '' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['dias-descontados-ferias'] }),
        queryClient.invalidateQueries({ queryKey: ['dias-descontados-ferias-periodos'] }),
        queryClient.invalidateQueries({ queryKey: ['publicacoes-ex-officio'] }),
      ]);
    },
    onError: (e) => alert(e?.message || 'Falha ao cadastrar desconto.'),
  });

  const cancelarMutation = useMutation({
    mutationFn: (desconto) => cancelarOuReverterDescontoFerias({ desconto, usuario: user?.email || user?.full_name || '' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dias-descontados-ferias'] }),
    onError: (e) => alert(e?.message || 'Falha ao cancelar/reverter desconto.'),
  });

  const filtrados = useMemo(() => descontos.filter((d) => {
    const militar = militarById.get(String(d.militar_id)) || {};
    return (!filtros.militar || norm(`${d.militar_nome} ${militar.nome_completo} ${militar.nome_guerra} ${d.militar_matricula}`).includes(norm(filtros.militar)))
      && (!filtros.lotacao || norm(`${militar.lotacao} ${militar.unidade} ${militar.subunidade}`).includes(norm(filtros.lotacao)))
      && (!filtros.periodo || norm(d.periodo_aquisitivo_ref).includes(norm(filtros.periodo)))
      && (!filtros.status || norm(d.status).includes(norm(filtros.status)))
      && (!filtros.publicacao || norm(`${d.publicacao_id} ${d.publicacao_numero_bg}`).includes(norm(filtros.publicacao)));
  }), [descontos, filtros, militarById]);

  const exportarCsv = () => {
    const header = ['Militar','Lotação','Período aquisitivo','Dias descontados','Publicação gerada','Status publicação','Data','Status desconto','Usuário responsável'];
    const rows = filtrados.map((d) => {
      const militar = militarById.get(String(d.militar_id)) || {};
      return [d.militar_nome || militar.nome_completo, militar.lotacao || militar.unidade, d.periodo_aquisitivo_ref, d.dias_descontados, d.publicacao_numero_bg || d.publicacao_id, d.publicacao_status, d.data_desconto, d.status, d.usuario_criacao];
    });
    const csv = [header, ...rows].map((r) => r.map(csvEscape).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = 'dias-descontados-ferias.csv'; a.click(); URL.revokeObjectURL(url);
  };

  if (!loadingUser && isAccessResolved && !canView) return <AccessDenied modulo="Férias — Dias Descontados" />;

  return <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3"><Button variant="outline" onClick={() => navigate(createPageUrl('Ferias'))}><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button><div><h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><CalendarMinus className="h-6 w-6" />Dias Descontados</h1><p className="text-slate-500">Cadastro operacional de descontos de férias com geração automática de publicação RP.</p></div></div>
      <Button onClick={exportarCsv}><Download className="h-4 w-4 mr-2" />Exportar CSV</Button>
    </div>
    <Card>
      <CardHeader><CardTitle>Novo desconto</CardTitle></CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div><Label>Militar</Label><select className="w-full h-10 border rounded-md px-3" value={form.militar_id} onChange={(e) => setForm((p) => ({ ...p, militar_id: e.target.value, periodo_aquisitivo_id: '' }))}><option value="">Selecione</option>{militares.map((m) => <option key={m.id} value={m.id}>{m.posto_graduacao} {m.nome_completo || m.nome_guerra} — {m.matricula}</option>)}</select></div>
        <div><Label>Período aquisitivo</Label><select className="w-full h-10 border rounded-md px-3" value={form.periodo_aquisitivo_id} onChange={(e) => setForm((p) => ({ ...p, periodo_aquisitivo_id: e.target.value }))}><option value="">Selecione</option>{periodosDisponiveis.map((p) => <option key={p.id} value={p.id}>{p.periodo_aquisitivo_ref || p.ano_referencia || `${p.inicio_aquisitivo || ''} a ${p.fim_aquisitivo || ''}`} — saldo {p.saldo_disponivel ?? p.saldo_atual ?? p.saldo ?? p.dias ?? 30}</option>)}</select></div>
        <div><Label>Quantidade de dias</Label><Input type="number" min="1" max="8" value={form.dias} onChange={(e) => setForm((p) => ({ ...p, dias: e.target.value }))} /></div>
        <div><Label>Data da dispensa</Label><Input type="date" value={form.data_dispensa} onChange={(e) => setForm((p) => ({ ...p, data_dispensa: e.target.value }))} /></div>
        <div><Label>Fundamentação</Label><Textarea value={form.fundamentacao} onChange={(e) => setForm((p) => ({ ...p, fundamentacao: e.target.value }))} /></div>
        <div><Label>Observações</Label><Textarea value={form.observacoes} onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))} /></div>
        <div className="md:col-span-2"><Button disabled={criarMutation.isPending} onClick={() => criarMutation.mutate()}><Plus className="h-4 w-4 mr-2" />Salvar desconto e gerar publicação</Button></div>
      </CardContent>
    </Card>
    <Card><CardHeader><CardTitle>Filtros</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-5">{Object.keys(filtros).map((k) => <Input key={k} placeholder={k[0].toUpperCase()+k.slice(1)} value={filtros[k]} onChange={(e) => setFiltros((p) => ({ ...p, [k]: e.target.value }))} />)}</CardContent></Card>
    <Card><CardContent className="p-0 overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-100 text-slate-600"><tr>{['Militar','Período aquisitivo','Dias descontados','Publicação gerada','Status publicação','Status desconto','Data','Usuário responsável','Ações'].map(h => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr></thead><tbody>{filtrados.map((d) => <tr key={d.id} className="border-t"><td className="px-4 py-3 font-medium">{d.militar_posto} {d.militar_nome}<div className="text-xs text-slate-500">{d.militar_matricula}</div></td><td className="px-4 py-3">{d.periodo_aquisitivo_ref}</td><td className="px-4 py-3">{d.dias_descontados}</td><td className="px-4 py-3">{d.publicacao_numero_bg || d.publicacao_id || '—'}</td><td className="px-4 py-3">{d.publicacao_status || 'Aguardando Nota'}</td><td className="px-4 py-3"><Badge variant={d.status === 'ativo' ? 'default' : 'secondary'}>{d.status}</Badge></td><td className="px-4 py-3">{fmt(d.data_dispensa || d.data_desconto)}</td><td className="px-4 py-3">{d.usuario_criacao || '—'}</td><td className="px-4 py-3">{d.status === 'ativo' ? <Button size="sm" variant="outline" disabled={cancelarMutation.isPending} onClick={() => cancelarMutation.mutate(d)}><RotateCcw className="h-3 w-3 mr-1" />Cancelar/reverter</Button> : '—'}</td></tr>)}{!filtrados.length && <tr><td colSpan="9" className="px-4 py-8 text-center text-slate-500">Nenhum desconto encontrado.</td></tr>}</tbody></table></CardContent></Card>
  </div>;
}
