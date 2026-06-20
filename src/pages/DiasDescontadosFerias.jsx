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
import { ArrowLeft, Download, CalendarMinus, Plus, RotateCcw, FileText, Save, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import MilitarSelector from '@/components/atestado/MilitarSelector';
import { cancelarOuReverterDescontoFerias, calcularDataFinalDispensa, calcularResumoDescontoPeriodo, criarDescontoFeriasAutomatico, getPeriodoRef, listarDescontosFerias, montarTextoDispensaDescontoFerias, periodoDisponivelParaDesconto, TIPO_RP_DISPENSA_DESCONTO_FERIAS } from '@/services/diasDescontadosFeriasService';

const fmt = (v) => (v ? new Date(`${v}T00:00:00`).toLocaleDateString('pt-BR') : '—');
const norm = (v) => String(v || '').toLowerCase();
const initialForm = () => ({ militar_id: '', militar_nome: '', militar_posto: '', militar_matricula: '', periodo_aquisitivo_id: '', dias_descontados: '', data_dispensa: new Date().toISOString().slice(0, 10), observacoes: '' });
const initialPublicacaoForm = () => ({ nota_para_bg: '', numero_bg: '', data_bg: '' });
function csvEscape(v) { return `"${String(v ?? '').replaceAll('"', '""')}"`; }

export default function DiasDescontadosFerias() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, canAccessModule, canAccessAction, isLoading: loadingUser, isAccessResolved } = useCurrentUser();
  const [filtros, setFiltros] = useState({ militar: '', lotacao: '', periodo: '', status: '', publicacao: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [erroCadastro, setErroCadastro] = useState('');
  const [publicacaoModalOpen, setPublicacaoModalOpen] = useState(false);
  const [textoPublicacao, setTextoPublicacao] = useState('');
  const [draftPublicacao, setDraftPublicacao] = useState(null);
  const [publicacaoForm, setPublicacaoForm] = useState(initialPublicacaoForm);

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



  const salvarPublicacaoMutation = useMutation({
    mutationFn: ({ draft, texto }) => criarDescontoFeriasAutomatico({
      militar: draft.militar,
      periodo: draft.periodo,
      dias: draft.dias,
      dataDispensa: draft.data_dispensa,
      observacoes: draft.observacoes,
      usuario: user?.email || user?.full_name || '',
      textoPublicacao: texto,
      notaParaBg: publicacaoForm.nota_para_bg,
      numeroBg: publicacaoForm.numero_bg,
      dataBg: publicacaoForm.data_bg,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dias-descontados-ferias'] });
      queryClient.invalidateQueries({ queryKey: ['dias-descontados-ferias-periodos', form.militar_id] });
      setPublicacaoModalOpen(false);
      setModalOpen(false);
      setDraftPublicacao(null);
      setTextoPublicacao('');
      setPublicacaoForm(initialPublicacaoForm());
      setForm(initialForm());
    },
    onError: (e) => setErroCadastro(e?.message || 'Falha ao salvar publicação e desconto.'),
  });

  const gerarPublicacao = () => {
    setErroCadastro('');
    if (!form.militar_id) return setErroCadastro('Selecione o militar.');
    if (!periodoSelecionado) return setErroCadastro('Selecione um período aquisitivo disponível.');
    if (Number(form.dias_descontados) <= 0) return setErroCadastro('Informe a quantidade de dias.');
    if (!form.data_dispensa) return setErroCadastro('Informe a data inicial da dispensa.');
    const resumo = calcularResumoDescontoPeriodo(periodoSelecionado, descontosMilitar);
    if (Number(form.dias_descontados) > resumo.disponivelParaDesconto) return setErroCadastro(`Quantidade maior que o disponível para desconto (${resumo.disponivelParaDesconto} dia(s)).`);
    const militar = militarById.get(String(form.militar_id)) || form;
    const militarNormalizado = { ...militar, nome_completo: form.militar_nome || militar.nome_completo || militar.nome_guerra || '', posto_graduacao: form.militar_posto || militar.posto_graduacao || militar.posto || '', matricula: form.militar_matricula || militar.matricula || '' };
    const draft = { ...form, militar: militarNormalizado, periodo: periodoSelecionado, dias: Number(form.dias_descontados), data_final_dispensa: dataFinal, periodo_aquisitivo_ref: resumo.periodo };
    setDraftPublicacao(draft);
    setTextoPublicacao(montarTextoDispensaDescontoFerias({ militar: militarNormalizado, periodoLabel: resumo.periodo, dias: Number(form.dias_descontados), dataDispensa: form.data_dispensa, dataFinalDispensa: dataFinal }));
    setPublicacaoForm(initialPublicacaoForm());
    setPublicacaoModalOpen(true);
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
    <Dialog open={modalOpen} onOpenChange={setModalOpen}><DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>Adicionar desconto</DialogTitle><DialogDescription>Preencha os dados e gere a prévia da publicação. O desconto só será efetivado ao salvar a publicação.</DialogDescription></DialogHeader><div className="grid gap-4 md:grid-cols-2"><div className="md:col-span-2"><MilitarSelector value={form.militar_id} onChange={(name, value) => setForm((p) => ({ ...p, [name]: value, periodo_aquisitivo_id: '' }))} onMilitarSelect={(data) => setForm((p) => ({ ...p, ...data, militar_id: data.id || p.militar_id, periodo_aquisitivo_id: '' }))} /></div><div className="md:col-span-2"><Label>Período aquisitivo</Label><select className="mt-1.5 w-full h-10 border rounded-md px-3" value={form.periodo_aquisitivo_id} onChange={(e) => setForm((p) => ({ ...p, periodo_aquisitivo_id: e.target.value }))}><option value="">Selecione</option>{periodosDisponiveis.map((p) => { const r = calcularResumoDescontoPeriodo(p, descontosMilitar); return <option key={p.id} value={p.id}>{r.periodo} — saldo {r.saldoAtual}; já descontados {r.diasDescontados}; pode descontar {r.disponivelParaDesconto}</option>; })}</select></div><div><Label>Quantidade de dias</Label><Input type="number" min="1" max="8" value={form.dias_descontados} onChange={(e) => setForm((p) => ({ ...p, dias_descontados: e.target.value }))} /></div><div className="grid grid-cols-2 gap-3"><div><Label>Data inicial da dispensa</Label><Input type="date" value={form.data_dispensa} onChange={(e) => setForm((p) => ({ ...p, data_dispensa: e.target.value }))} /></div><div><Label>Data final da dispensa</Label><Input value={fmt(dataFinal)} readOnly className="bg-slate-50" /></div></div><div className="md:col-span-2"><Label>Observações</Label><Textarea value={form.observacoes} onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))} /></div>{erroCadastro && <div className="md:col-span-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erroCadastro}</div>}</div><DialogFooter><Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button><Button onClick={gerarPublicacao}><FileText className="h-4 w-4 mr-2" />Gerar publicação</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={publicacaoModalOpen} onOpenChange={setPublicacaoModalOpen}><DialogContent className="w-[96vw] max-w-6xl max-h-[92vh] overflow-y-auto px-6 pb-4"><DialogHeader><DialogTitle>Publicação — {TIPO_RP_DISPENSA_DESCONTO_FERIAS}</DialogTitle><DialogDescription>Confira os dados e ajuste o texto antes de salvar. A publicação e o desconto serão criados somente ao salvar.</DialogDescription></DialogHeader><div className="space-y-6"><div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-800"><strong>{draftPublicacao?.militar?.posto_graduacao} {draftPublicacao?.militar?.nome_completo}</strong> — {draftPublicacao?.dias || 0} dia(s) — Período {draftPublicacao?.periodo_aquisitivo_ref || '—'}</div><div className="grid grid-cols-1 lg:grid-cols-12 gap-8"><div className="lg:col-span-5 space-y-5"><div className="grid grid-cols-2 gap-4"><div className="col-span-2"><Label className="text-sm">Militar</Label><Input value={`${draftPublicacao?.militar?.posto_graduacao || ''} ${draftPublicacao?.militar?.nome_completo || ''} — Mat: ${draftPublicacao?.militar?.matricula || '—'}`.trim()} readOnly className="mt-1.5 bg-slate-50" /></div><div className="col-span-2"><Label className="text-sm">Período aquisitivo</Label><Input value={draftPublicacao?.periodo_aquisitivo_ref || getPeriodoRef(draftPublicacao?.periodo || {})} readOnly className="mt-1.5 bg-slate-50" /></div><div><Label className="text-sm">Quantidade de dias</Label><Input value={draftPublicacao?.dias || ''} readOnly className="mt-1.5 bg-slate-50" /></div><div><Label className="text-sm">Data inicial</Label><Input value={fmt(draftPublicacao?.data_dispensa)} readOnly className="mt-1.5 bg-slate-50" /></div><div><Label className="text-sm">Data final</Label><Input value={fmt(draftPublicacao?.data_final_dispensa)} readOnly className="mt-1.5 bg-slate-50" /></div><div><Label className="text-sm">Status</Label><Input value="Aguardando Nota" readOnly className="mt-1.5 bg-slate-50" /></div><div className="col-span-2"><Label className="text-sm">Observações</Label><Textarea value={draftPublicacao?.observacoes || ''} readOnly className="mt-1.5 bg-slate-50" /></div></div><hr className="border-slate-200" /><div className="grid grid-cols-3 gap-3"><div><Label className="text-sm">Nota para BG</Label><Input value={publicacaoForm.nota_para_bg} onChange={(e) => setPublicacaoForm((prev) => ({ ...prev, nota_para_bg: e.target.value }))} className="mt-1.5" placeholder="001/2025" /></div><div><Label className="text-sm">Número BG</Label><Input value={publicacaoForm.numero_bg} onChange={(e) => setPublicacaoForm((prev) => ({ ...prev, numero_bg: e.target.value }))} className="mt-1.5" /></div><div><Label className="text-sm">Data BG</Label><Input type="date" value={publicacaoForm.data_bg} onChange={(e) => setPublicacaoForm((prev) => ({ ...prev, data_bg: e.target.value }))} className="mt-1.5" /></div></div></div><div className="lg:col-span-7 flex flex-col space-y-5"><div className="flex-1 flex flex-col"><div className="flex items-center justify-between mb-1.5"><Label className="text-sm font-medium">Texto da Publicação</Label><span className="text-xs text-emerald-600 font-medium flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Gerado automaticamente</span></div><Textarea value={textoPublicacao} onChange={(e) => setTextoPublicacao(e.target.value)} className="w-full min-h-[300px] lg:min-h-[420px] rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20" placeholder="Texto da publicação" /></div></div></div></div><div className="flex justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4"><Button variant="outline" onClick={() => setPublicacaoModalOpen(false)}>Cancelar</Button><Button onClick={() => salvarPublicacaoMutation.mutate({ draft: draftPublicacao, texto: textoPublicacao })} disabled={salvarPublicacaoMutation.isPending || !draftPublicacao} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"><Save className="w-4 h-4 mr-2" />{salvarPublicacaoMutation.isPending ? 'Salvando...' : 'Salvar Publicação'}</Button></div></DialogContent></Dialog>
  </div>;
}
