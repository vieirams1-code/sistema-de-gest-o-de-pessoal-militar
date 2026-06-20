import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ArrowLeft, Download, CalendarMinus, Plus, RotateCcw, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import MilitarSelector from '@/components/atestado/MilitarSelector';
import { cancelarOuReverterDescontoFerias, calcularDataFinalDispensa, calcularResumoDescontoPeriodo, listarDescontosFerias, periodoDisponivelParaDesconto, TIPO_RP_DISPENSA_DESCONTO_FERIAS } from '@/services/diasDescontadosFeriasService';

const fmt = (v) => (v ? new Date(`${v}T00:00:00`).toLocaleDateString('pt-BR') : '—');
const norm = (v) => String(v || '').toLowerCase();
const initialForm = () => ({ militar_id: '', militar_nome: '', militar_posto: '', militar_matricula: '', periodo_aquisitivo_id: '', dias_descontados: '', data_dispensa: new Date().toISOString().slice(0, 10), fundamentacao: '', observacoes: '' });
function csvEscape(v) { return `"${String(v ?? '').replaceAll('"', '""')}"`; }

export default function DiasDescontadosFerias() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, canAccessModule, canAccessAction, isLoading: loadingUser, isAccessResolved } = useCurrentUser();
  const [filtros, setFiltros] = useState({ militar: '', lotacao: '', periodo: '', status: '', publicacao: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [erroCadastro, setErroCadastro] = useState('');

  const canView = canAccessModule('ferias') && (canAccessAction('visualizar_ferias') || canAccessAction('visualizar_creditos_ferias'));
  const { data: descontos = [], error: erroDescontos } = useQuery({ queryKey: ['dias-descontados-ferias'], queryFn: () => listarDescontosFerias(), enabled: isAccessResolved && canView && Boolean(base44?.entities?.DiasDescontadosFerias), retry: 1 });
  const { data: militares = [] } = useQuery({ queryKey: ['dias-descontados-ferias-militares'], queryFn: () => base44.entities.Militar.list('nome_completo'), enabled: isAccessResolved && canView });
  const { data: periodos = [] } = useQuery({ queryKey: ['dias-descontados-ferias-periodos', form.militar_id], queryFn: () => base44.entities.PeriodoAquisitivo.filter({ militar_id: form.militar_id }), enabled: isAccessResolved && canView && Boolean(form.militar_id) });
  const militarById = useMemo(() => new Map(militares.map((m) => [String(m.id), m])), [militares]);
  const descontosMilitar = useMemo(() => descontos.filter((d) => String(d.militar_id) === String(form.militar_id)), [descontos, form.militar_id]);
  const periodosDisponiveis = useMemo(() => periodos.filter((p) => periodoDisponivelParaDesconto(p, descontosMilitar)).sort((a, b) => String(b.inicio_aquisitivo || b.ano_referencia || '').localeCompare(String(a.inicio_aquisitivo || a.ano_referencia || ''))), [periodos, descontosMilitar]);
  const periodoSelecionado = useMemo(() => periodosDisponiveis.find((p) => String(p.id) === String(form.periodo_aquisitivo_id)), [periodosDisponiveis, form.periodo_aquisitivo_id]);
  const dataFinal = useMemo(() => calcularDataFinalDispensa(form.data_dispensa, form.dias_descontados), [form.data_dispensa, form.dias_descontados]);

  const cancelarMutation = useMutation({
    mutationFn: (desconto) => cancelarOuReverterDescontoFerias({ desconto, usuario: user?.email || user?.full_name || '' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dias-descontados-ferias'] }),
    onError: (e) => alert(e?.message || 'Falha ao cancelar/reverter desconto.'),
  });

  const gerarPublicacao = () => {
    setErroCadastro('');
    if (!form.militar_id) return setErroCadastro('Selecione o militar.');
    if (!periodoSelecionado) return setErroCadastro('Selecione um período aquisitivo disponível.');
    if (Number(form.dias_descontados) <= 0) return setErroCadastro('Informe a quantidade de dias.');
    if (!form.data_dispensa) return setErroCadastro('Informe a data inicial da dispensa.');
    if (!form.fundamentacao.trim()) return setErroCadastro('Informe a fundamentação.');
    const resumo = calcularResumoDescontoPeriodo(periodoSelecionado, descontosMilitar);
    if (Number(form.dias_descontados) > resumo.disponivelParaDesconto) return setErroCadastro(`Quantidade maior que o disponível para desconto (${resumo.disponivelParaDesconto} dia(s)).`);
    const militar = militarById.get(String(form.militar_id)) || form;
    const draft = { ...form, dias: Number(form.dias_descontados), data_final_dispensa: dataFinal, periodo_aquisitivo_ref: resumo.periodo, fluxo_guiado_dias_descontados: true, usuario_origem: user?.email || '', militar_nome: form.militar_nome || militar.nome_completo || militar.nome_guerra || '', militar_posto: form.militar_posto || militar.posto_graduacao || militar.posto || '', militar_matricula: form.militar_matricula || militar.matricula || '' };
    sessionStorage.setItem('sgp:dias-descontados:draft', JSON.stringify(draft));
    navigate(`${createPageUrl('CadastrarRegistroRP')}?tipo=${encodeURIComponent(TIPO_RP_DISPENSA_DESCONTO_FERIAS)}&fluxo=dias_descontados&militar_id=${encodeURIComponent(form.militar_id)}`);
  };

  const filtrados = useMemo(() => descontos.filter((d) => {
    const militar = militarById.get(String(d.militar_id)) || {};
    return (!filtros.militar || norm(`${d.militar_nome} ${militar.nome_completo} ${militar.nome_guerra} ${d.militar_matricula}`).includes(norm(filtros.militar)))
      && (!filtros.lotacao || norm(`${militar.lotacao} ${militar.unidade} ${militar.subunidade}`).includes(norm(filtros.lotacao)))
      && (!filtros.periodo || norm(d.periodo_aquisitivo_ref).includes(norm(filtros.periodo)))
      && (!filtros.status || norm(d.status).includes(norm(filtros.status)))
      && (!filtros.publicacao || norm(`${d.publicacao_id} ${d.publicacao_numero_bg}`).includes(norm(filtros.publicacao)));
  }), [descontos, filtros, militarById]);

  const exportarCsv = () => { const header = ['Militar','Lotação','Período aquisitivo','Dias descontados','Publicação gerada','Status publicação','Data','Status desconto','Usuário responsável']; const rows = filtrados.map((d) => { const militar = militarById.get(String(d.militar_id)) || {}; return [d.militar_nome || militar.nome_completo, militar.lotacao || militar.unidade, d.periodo_aquisitivo_ref, d.dias_descontados, d.publicacao_numero_bg || d.publicacao_id, d.publicacao_status, d.data_desconto, d.status, d.usuario_criacao]; }); const csv = [header, ...rows].map((r) => r.map(csvEscape).join(';')).join('\n'); const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })); const a = document.createElement('a'); a.href = url; a.download = 'dias-descontados-ferias.csv'; a.click(); URL.revokeObjectURL(url); };

  if (!loadingUser && isAccessResolved && !canView) return <AccessDenied modulo="Férias — Dias Descontados" />;
  return <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
    <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><Button variant="outline" onClick={() => navigate(createPageUrl('Ferias'))}><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button><div><h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><CalendarMinus className="h-6 w-6" />Dias Descontados</h1><p className="text-slate-500">Descontos de férias são efetivados somente após finalizar/publicar a publicação RP guiada.</p></div></div><div className="flex gap-2"><Button variant="outline" onClick={exportarCsv}><Download className="h-4 w-4 mr-2" />Exportar CSV</Button><Button onClick={() => { setForm(initialForm()); setModalOpen(true); }}><Plus className="h-4 w-4 mr-2" />Adicionar desconto</Button></div></div>
    {(!base44?.entities?.DiasDescontadosFerias || erroDescontos) && <Card className="border-amber-200 bg-amber-50"><CardContent className="p-4 text-sm text-amber-900">A entidade DiasDescontadosFerias precisa estar sincronizada/publicada no Base44 para listar e efetivar descontos. A tela evita consultar a entidade inexistente e mantém disponível apenas a preparação da publicação.</CardContent></Card>}
    <Card><CardHeader><CardTitle>Filtros</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-5">{Object.keys(filtros).map((k) => <Input key={k} placeholder={k[0].toUpperCase()+k.slice(1)} value={filtros[k]} onChange={(e) => setFiltros((p) => ({ ...p, [k]: e.target.value }))} />)}</CardContent></Card>
    <Card><CardContent className="p-0 overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-100 text-slate-600"><tr>{['Militar','Período aquisitivo','Dias descontados','Publicação gerada','Status publicação','Status desconto','Data','Usuário responsável','Ações'].map(h => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr></thead><tbody>{filtrados.map((d) => <tr key={d.id} className="border-t"><td className="px-4 py-3 font-medium">{d.militar_posto} {d.militar_nome}<div className="text-xs text-slate-500">{d.militar_matricula}</div></td><td className="px-4 py-3">{d.periodo_aquisitivo_ref}</td><td className="px-4 py-3">{d.dias_descontados}</td><td className="px-4 py-3">{d.publicacao_numero_bg || d.publicacao_id || '—'}</td><td className="px-4 py-3">{d.publicacao_status || 'Aguardando Nota'}</td><td className="px-4 py-3"><Badge variant={d.status === 'ativo' ? 'default' : 'secondary'}>{d.status}</Badge></td><td className="px-4 py-3">{fmt(d.data_dispensa || d.data_desconto)}</td><td className="px-4 py-3">{d.usuario_criacao || '—'}</td><td className="px-4 py-3">{d.status === 'ativo' ? <Button size="sm" variant="outline" disabled={cancelarMutation.isPending} onClick={() => cancelarMutation.mutate(d)}><RotateCcw className="h-3 w-3 mr-1" />Cancelar/reverter</Button> : '—'}</td></tr>)}{!filtrados.length && <tr><td colSpan="9" className="px-4 py-8 text-center text-slate-500">Nenhum desconto encontrado.</td></tr>}</tbody></table></CardContent></Card>
    <Dialog open={modalOpen} onOpenChange={setModalOpen}><DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>Adicionar desconto</DialogTitle><DialogDescription>Preencha os dados e gere a publicação. O desconto só será abatido quando a publicação for finalizada/publicada.</DialogDescription></DialogHeader><div className="grid gap-4 md:grid-cols-2"><div className="md:col-span-2"><MilitarSelector value={form.militar_id} onChange={(name, value) => setForm((p) => ({ ...p, [name]: value, periodo_aquisitivo_id: '' }))} onMilitarSelect={(data) => setForm((p) => ({ ...p, ...data, militar_id: data.id || p.militar_id, periodo_aquisitivo_id: '' }))} /></div><div className="md:col-span-2"><Label>Período aquisitivo</Label><select className="mt-1.5 w-full h-10 border rounded-md px-3" value={form.periodo_aquisitivo_id} onChange={(e) => setForm((p) => ({ ...p, periodo_aquisitivo_id: e.target.value }))}><option value="">Selecione</option>{periodosDisponiveis.map((p) => { const r = calcularResumoDescontoPeriodo(p, descontosMilitar); return <option key={p.id} value={p.id}>{r.periodo} — saldo {r.saldoAtual}; já descontados {r.diasDescontados}; pode descontar {r.disponivelParaDesconto}</option>; })}</select></div><div><Label>Quantidade de dias</Label><Input type="number" min="1" max="8" value={form.dias_descontados} onChange={(e) => setForm((p) => ({ ...p, dias_descontados: e.target.value }))} /></div><div><Label>Data inicial da dispensa</Label><Input type="date" value={form.data_dispensa} onChange={(e) => setForm((p) => ({ ...p, data_dispensa: e.target.value }))} /></div><div><Label>Data final calculada</Label><Input value={fmt(dataFinal)} readOnly className="bg-slate-50" /></div><div><Label>Fundamentação</Label><Textarea value={form.fundamentacao} onChange={(e) => setForm((p) => ({ ...p, fundamentacao: e.target.value }))} /></div><div className="md:col-span-2"><Label>Observações</Label><Textarea value={form.observacoes} onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))} /></div>{erroCadastro && <div className="md:col-span-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erroCadastro}</div>}</div><DialogFooter><Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button><Button onClick={gerarPublicacao}><FileText className="h-4 w-4 mr-2" />Gerar publicação</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
