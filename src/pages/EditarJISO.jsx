import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, CheckCircle2, FileText, Link2, MessageCircle, Plus, Save, Trash2, Upload } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { fetchScopedAtestadosBundle } from '@/services/getScopedAtestadosBundleClient';
import { jisoService } from '@/services/jisoService';
import { aplicarTemplate, buildTemplateVarsContrato } from '@/components/utils/templateUtils.js';
import { getTemplateAtivoPorTipo } from '@/components/rp/templateValidation';
import { buildTemplateRenderMetadata } from '@/services/templateRenderMetadata';
import { TEMPLATE_SOURCE_OF_TRUTH } from '@/constants/templateGovernance';
import { createPageUrl } from '@/utils';

const EMPTY_FORM = {
  data_jiso: '',
  hora_jiso: '',
  local_jiso: '',
  secao_jiso: '',
  finalidade_jiso: 'LTS',
  nup: '',
  numero_ata: '',
  resultado_jiso: '',
  dias_jiso: '',
  data_inicio_efeito: '',
  data_termino_efeito: '',
  data_retorno_efeito: '',
  parecer_jiso: '',
  observacoes: '',
  arquivo_ata_jiso: '',
  status: 'Aguardando Agendamento',
};

const STATUS_CLASS = {
  Rascunho: 'bg-slate-100 text-slate-700',
  'Aguardando Agendamento': 'bg-amber-100 text-amber-800',
  Agendada: 'bg-blue-100 text-blue-800',
  Realizada: 'bg-violet-100 text-violet-800',
  'Resultado Registrado': 'bg-indigo-100 text-indigo-800',
  'Concluída': 'bg-emerald-100 text-emerald-800',
  Cancelada: 'bg-red-100 text-red-800',
};

const formatDate = (value) => {
  if (!value) return '—';
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
};

const calcPublicationStatus = ({ nota_para_bg, numero_bg, data_bg }) => {
  if (numero_bg || data_bg) return 'Publicado';
  if (nota_para_bg) return 'Aguardando Publicação';
  return 'Aguardando Nota';
};

export default function EditarJISO() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const jisoId = params.get('jiso_id');
  const { canAccessModule, canAccessAction, isLoading, isAccessResolved, user } = useCurrentUser();
  const canView = canAccessAction('gerir_jiso') || canAccessAction('registrar_decisao_jiso');
  const canManage = canAccessAction('gerir_jiso');
  const canDecide = canAccessAction('registrar_decisao_jiso');
  const canPublish = canAccessAction('publicar_ata_jiso');
  const [form, setForm] = useState(EMPTY_FORM);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedAddIds, setSelectedAddIds] = useState([]);
  const [showWhatsapp, setShowWhatsapp] = useState(false);
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [whatsappPreview, setWhatsappPreview] = useState(null);
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [publication, setPublication] = useState({
    data_publicacao: new Date().toISOString().slice(0, 10),
    nota_para_bg: '',
    numero_bg: '',
    data_bg: '',
  });

  const detailQuery = useQuery({
    queryKey: ['jiso-detalhe', jisoId],
    queryFn: async () => (await jisoService.detalhar(jisoId)).jiso,
    enabled: Boolean(jisoId && isAccessResolved && canView),
  });
  const jiso = detailQuery.data;

  useEffect(() => {
    if (!jiso) return;
    setForm({
      ...EMPTY_FORM,
      ...jiso,
      dias_jiso: jiso.dias_jiso ?? '',
    });
  }, [jiso]);

  const { data: atestadosEscopo = [] } = useQuery({
    queryKey: ['atestados-adicionar-jiso', jiso?.militar_id],
    queryFn: async () => {
      const bundle = await fetchScopedAtestadosBundle({ functionName: 'getScopedAtestadosBundleV2', dtoVersion: 'operacional-v2' });
      return bundle?.atestados || [];
    },
    enabled: Boolean(showAdd && jiso?.militar_id),
  });

  const candidatos = useMemo(() => {
    const linked = new Set((jiso?.atestados || []).map((item) => item.id));
    return atestadosEscopo.filter((item) => item.militar_id === jiso?.militar_id && !linked.has(item.id));
  }, [atestadosEscopo, jiso]);

  const { data: templates = [] } = useQuery({
    queryKey: ['templates-texto-jiso-independente'],
    queryFn: () => base44.entities.TemplateTexto.list(),
    enabled: Boolean(jiso && canPublish),
  });

  const { data: militar = null } = useQuery({
    queryKey: ['militar-jiso-independente', jiso?.militar_id],
    queryFn: async () => {
      const rows = await base44.entities.Militar.filter({ id: jiso.militar_id });
      return rows?.[0] || null;
    },
    enabled: Boolean(jiso?.militar_id),
  });

  const templateAta = useMemo(() => getTemplateAtivoPorTipo('Ata JISO', 'ExOfficio', templates, {
    grupamento_id: militar?.grupamento_id,
    subgrupamento_id: militar?.subgrupamento_id,
    subgrupamento_tipo: militar?.subgrupamento_tipo,
  }), [templates, militar]);

  const textoPublicacao = useMemo(() => {
    if (!templateAta?.template || !jiso) return '';
    const principal = jiso.atestados?.[0] || {};
    const varsContrato = buildTemplateVarsContrato({
      ...principal,
      militar,
      militar_nome: jiso.militar_nome,
      militar_posto: jiso.militar_posto,
      militar_matricula: jiso.militar_matricula_atual || jiso.militar_matricula,
    });
    return aplicarTemplate(templateAta.template, {
      ...varsContrato,
      finalidade_jiso: form.finalidade_jiso || '',
      secao_jiso: form.secao_jiso || '',
      data_ata: formatDate(form.data_jiso),
      nup: form.nup || '',
      parecer_jiso: form.parecer_jiso || '',
      numero_ata: form.numero_ata || '',
      total_atestados: String(jiso.atestados?.length || 0),
    });
  }, [templateAta, jiso, militar, form.finalidade_jiso, form.secao_jiso, form.data_jiso, form.nup, form.parecer_jiso, form.numero_ata]);

  const updateMutation = useMutation({
    mutationFn: (patch) => jisoService.atualizar(jisoId, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jiso-detalhe', jisoId] });
      queryClient.invalidateQueries({ queryKey: ['jisos-independentes'] });
    },
    onError: (err) => alert(err?.message || 'Não foi possível atualizar a JISO.'),
  });

  const saveAll = async () => {
    const status = form.status === 'Aguardando Agendamento' && form.data_jiso && form.hora_jiso ? 'Agendada' : form.status;
    await updateMutation.mutateAsync({
      ...form,
      status,
      dias_jiso: form.dias_jiso === '' ? null : Number(form.dias_jiso),
      texto_publicacao: textoPublicacao || form.texto_publicacao || '',
    });
  };

  const addMutation = useMutation({
    mutationFn: () => jisoService.vincularAtestados(jisoId, selectedAddIds),
    onSuccess: () => {
      setShowAdd(false);
      setSelectedAddIds([]);
      queryClient.invalidateQueries({ queryKey: ['jiso-detalhe', jisoId] });
      queryClient.invalidateQueries({ queryKey: ['jisos-independentes'] });
    },
    onError: (err) => alert(err?.message || 'Não foi possível vincular os atestados.'),
  });

  const removeAtestado = async (atestadoId) => {
    const motivo = window.prompt('Informe o motivo da retirada deste atestado da JISO:');
    if (!motivo) return;
    try {
      await jisoService.removerVinculo(jisoId, atestadoId, motivo);
      queryClient.invalidateQueries({ queryKey: ['jiso-detalhe', jisoId] });
    } catch (err) {
      alert(err?.message || 'Não foi possível remover o vínculo.');
    }
  };

  const uploadAta = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const response = await base44.integrations.Core.UploadFile({ file });
      const fileUrl = response?.file_url || response?.url;
      setForm((current) => ({ ...current, arquivo_ata_jiso: fileUrl || '' }));
      await updateMutation.mutateAsync({ arquivo_ata_jiso: fileUrl || '' });
    } catch (err) {
      alert(err?.message || 'Não foi possível enviar a ata.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const prepareWhatsapp = async () => {
    if (!form.data_jiso || !form.hora_jiso) {
      alert('Defina a data e o horário antes de preparar a notificação.');
      return;
    }
    try {
      await updateMutation.mutateAsync({
        data_jiso: form.data_jiso,
        hora_jiso: form.hora_jiso,
        local_jiso: form.local_jiso,
        status: 'Agendada',
      });
      const response = await base44.functions.invoke('notificarJisoWhatsAppTemplate', {
        action: 'preview',
        jiso_id: jisoId,
        data_jiso: form.data_jiso,
        hora_jiso: form.hora_jiso,
      });
      const data = response?.data || response;
      if (!data?.success) throw new Error(data?.error || 'Falha ao preparar a mensagem.');
      setWhatsappMessage(data.mensagem || '');
      setWhatsappPreview(data);
      setShowWhatsapp(true);
    } catch (err) {
      alert(err?.message || 'Não foi possível preparar a notificação.');
    }
  };

  const sendWhatsapp = async () => {
    if (!whatsappPreview || !whatsappMessage.trim()) return;
    setSendingWhatsapp(true);
    try {
      const response = await base44.functions.invoke('notificarJisoWhatsAppTemplate', {
        action: 'send',
        jiso_id: jisoId,
        mensagem_final: whatsappMessage.trim(),
        template_id: whatsappPreview.template_id,
        template_hash: whatsappPreview.template_hash,
        data_jiso_snapshot: whatsappPreview.data_jiso_snapshot,
        hora_jiso_snapshot: whatsappPreview.hora_jiso_snapshot,
      });
      const data = response?.data || response;
      if (!data?.success) throw new Error(data?.error || 'Falha ao enviar a notificação.');
      setShowWhatsapp(false);
      setWhatsappPreview(null);
      queryClient.invalidateQueries({ queryKey: ['jiso-detalhe', jisoId] });
      queryClient.invalidateQueries({ queryKey: ['jisos-independentes'] });
      alert('Notificação enviada e registrada no histórico da JISO.');
    } catch (err) {
      alert(err?.message || 'Não foi possível enviar a notificação.');
    } finally {
      setSendingWhatsapp(false);
    }
  };

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!textoPublicacao) throw new Error('O template ativo de Ata JISO não foi encontrado ou não gerou texto.');
      await updateMutation.mutateAsync({
        ...form,
        status: 'Resultado Registrado',
        texto_publicacao: textoPublicacao,
        dias_jiso: form.dias_jiso === '' ? null : Number(form.dias_jiso),
      });
      const renderMetadata = buildTemplateRenderMetadata({
        template: templateAta,
        modulo: 'PublicacaoExOfficio',
        user,
        sourceOfTruth: TEMPLATE_SOURCE_OF_TRUTH.RENDER_ON_SUBMIT,
      });
      return jisoService.publicarAta(jisoId, {
        ...publication,
        texto_publicacao: textoPublicacao,
        status: calcPublicationStatus(publication),
        render_metadata: renderMetadata,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jiso-detalhe', jisoId] });
      queryClient.invalidateQueries({ queryKey: ['jisos-independentes'] });
      alert('Ata JISO encaminhada para o fluxo de publicações.');
    },
    onError: (err) => alert(err?.message || 'Não foi possível publicar a Ata JISO.'),
  });

  const cancelJiso = async () => {
    const motivo = window.prompt('Informe o motivo do cancelamento da JISO:');
    if (!motivo) return;
    try {
      await jisoService.cancelar(jisoId, motivo);
      queryClient.invalidateQueries({ queryKey: ['jiso-detalhe', jisoId] });
      queryClient.invalidateQueries({ queryKey: ['jisos-independentes'] });
    } catch (err) {
      alert(err?.message || 'Não foi possível cancelar a JISO.');
    }
  };

  if (isLoading || !isAccessResolved) return null;
  if (!canAccessModule('atestados') || !canView) return <AccessDenied modulo="JISO / Atestados" />;
  if (!jisoId) return <div className="p-8 text-center text-slate-500">JISO não informada.</div>;
  if (detailQuery.isLoading) return <div className="p-16 text-center text-slate-500">Carregando JISO...</div>;
  if (detailQuery.error || !jiso) return <div className="p-8 text-center text-red-600">{detailQuery.error?.message || 'JISO não encontrada.'}</div>;

  const isClosed = ['Concluída', 'Cancelada'].includes(jiso.status);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-7 space-y-5">
        <div className="rounded-2xl bg-gradient-to-r from-[#1e3a5f] to-[#0f233a] p-6 text-white shadow-lg">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => navigate(createPageUrl('AgendarJISO'))}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-blue-200">{jiso.codigo || 'JISO'}</span>
                  <Badge className={STATUS_CLASS[jiso.status] || STATUS_CLASS.Rascunho}>{jiso.status}</Badge>
                </div>
                <h1 className="text-2xl font-black">{jiso.militar_posto} {jiso.militar_nome}</h1>
                <p className="text-sm text-slate-300">Matrícula {jiso.militar_matricula_atual || jiso.militar_matricula || '—'} · {jiso.atestados?.length || 0} atestado(s)</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {canManage && !isClosed && <Button variant="outline" onClick={cancelJiso} className="border-white/30 bg-white/10 text-white hover:bg-white/20">Cancelar JISO</Button>}
              {(canManage || canDecide) && !isClosed && (
                <Button onClick={saveAll} disabled={updateMutation.isPending} className="bg-white text-[#1e3a5f] hover:bg-slate-100">
                  <Save className="mr-2 h-4 w-4" /> Salvar
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-12">
          <div className="space-y-5 xl:col-span-7">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-[#1e3a5f]"><CalendarDays className="h-5 w-5" /> Agendamento e identificação</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div><Label>Data da JISO</Label><Input type="date" value={form.data_jiso} onChange={(e) => setForm((p) => ({ ...p, data_jiso: e.target.value }))} disabled={isClosed} className="mt-1.5" /></div>
                <div><Label>Horário</Label><Input type="time" value={form.hora_jiso} onChange={(e) => setForm((p) => ({ ...p, hora_jiso: e.target.value }))} disabled={isClosed} className="mt-1.5" /></div>
                <div><Label>Local</Label><Input value={form.local_jiso} onChange={(e) => setForm((p) => ({ ...p, local_jiso: e.target.value }))} disabled={isClosed} className="mt-1.5" /></div>
                <div><Label>Seção JISO</Label><Input value={form.secao_jiso} onChange={(e) => setForm((p) => ({ ...p, secao_jiso: e.target.value }))} disabled={isClosed} className="mt-1.5" /></div>
                <div>
                  <Label>Finalidade</Label>
                  <Select value={form.finalidade_jiso || 'LTS'} onValueChange={(value) => setForm((p) => ({ ...p, finalidade_jiso: value }))} disabled={isClosed}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>{['LTS', 'V.A.F', 'Reserva Remunerada', 'Atestado de Origem'].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>TARS/NUP</Label><Input value={form.nup} onChange={(e) => setForm((p) => ({ ...p, nup: e.target.value }))} disabled={isClosed} className="mt-1.5" /></div>
              </div>
              {canManage && !isClosed && (
                <div className="mt-4 flex justify-end">
                  <Button variant="outline" onClick={prepareWhatsapp}><MessageCircle className="mr-2 h-4 w-4" /> Preparar WhatsApp</Button>
                </div>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-lg font-bold text-[#1e3a5f]"><Link2 className="h-5 w-5" /> Atestados vinculados</h2>
                {canManage && !isClosed && <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}><Plus className="mr-1.5 h-4 w-4" /> Adicionar</Button>}
              </div>
              <div className="space-y-2">
                {(jiso.atestados || []).map((atestado, index) => (
                  <div key={atestado.id} className="flex flex-col gap-3 rounded-lg border border-slate-200 p-3 md:flex-row md:items-center md:justify-between">
                    <button type="button" onClick={() => navigate(createPageUrl('VerAtestado') + `?id=${atestado.id}`)} className="min-w-0 text-left">
                      <div className="flex items-center gap-2"><Badge variant="outline">{index === 0 ? 'Principal' : 'Complementar'}</Badge><span className="text-sm font-semibold">{atestado.tipo_afastamento || 'Atestado médico'}</span></div>
                      <p className="mt-1 text-xs text-slate-500">{formatDate(atestado.data_inicio)} a {formatDate(atestado.data_termino)} · {atestado.dias || 0} dia(s)</p>
                    </button>
                    {canManage && !isClosed && (jiso.atestados?.length || 0) > 1 && (
                      <Button size="sm" variant="ghost" onClick={() => removeAtestado(atestado.id)} className="text-red-600 hover:bg-red-50 hover:text-red-700"><Trash2 className="mr-1.5 h-4 w-4" /> Retirar</Button>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-[#1e3a5f]"><CheckCircle2 className="h-5 w-5" /> Resultado da Junta</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div><Label>Número da Ata</Label><Input value={form.numero_ata} onChange={(e) => setForm((p) => ({ ...p, numero_ata: e.target.value }))} disabled={!canDecide || isClosed} className="mt-1.5" /></div>
                <div>
                  <Label>Resultado</Label>
                  <Select value={form.resultado_jiso || ''} onValueChange={(value) => setForm((p) => ({ ...p, resultado_jiso: value }))} disabled={!canDecide || isClosed}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{['Homologado', 'Diminuído', 'Prorrogado', 'Não homologado', 'Apto', 'Inapto'].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Dias reconhecidos</Label><Input type="number" min="0" value={form.dias_jiso} onChange={(e) => setForm((p) => ({ ...p, dias_jiso: e.target.value }))} disabled={!canDecide || isClosed} className="mt-1.5" /></div>
                <div><Label>Data de início do efeito</Label><Input type="date" value={form.data_inicio_efeito} onChange={(e) => setForm((p) => ({ ...p, data_inicio_efeito: e.target.value }))} disabled={!canDecide || isClosed} className="mt-1.5" /></div>
                <div><Label>Data de término efetiva</Label><Input type="date" value={form.data_termino_efeito} onChange={(e) => setForm((p) => ({ ...p, data_termino_efeito: e.target.value }))} disabled={!canDecide || isClosed} className="mt-1.5" /></div>
                <div><Label>Data de retorno efetiva</Label><Input type="date" value={form.data_retorno_efeito} onChange={(e) => setForm((p) => ({ ...p, data_retorno_efeito: e.target.value }))} disabled={!canDecide || isClosed} className="mt-1.5" /></div>
              </div>
              <div className="mt-4"><Label>Parecer da JISO</Label><Textarea value={form.parecer_jiso} onChange={(e) => setForm((p) => ({ ...p, parecer_jiso: e.target.value }))} disabled={!canDecide || isClosed} className="mt-1.5 min-h-28" /></div>
              <div className="mt-4"><Label>Observações administrativas</Label><Textarea value={form.observacoes} onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))} disabled={isClosed} className="mt-1.5" /></div>
              {canDecide && !isClosed && (
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => updateMutation.mutate({ status: 'Realizada', realizada_em: new Date().toISOString() })}>Marcar como realizada</Button>
                  <Button onClick={() => updateMutation.mutate({ ...form, status: 'Resultado Registrado', dias_jiso: form.dias_jiso === '' ? null : Number(form.dias_jiso), texto_publicacao: textoPublicacao })} className="bg-indigo-700 hover:bg-indigo-800">Registrar resultado</Button>
                </div>
              )}
            </section>
          </div>

          <div className="space-y-5 xl:col-span-5">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-[#1e3a5f]"><MessageCircle className="h-5 w-5" /> Comunicação</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Status</span><span className="font-semibold">{jiso.whatsapp_status || 'pendente'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Último envio</span><span className="font-semibold">{jiso.whatsapp_enviado_em ? new Date(jiso.whatsapp_enviado_em).toLocaleString('pt-BR') : '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Enviado por</span><span className="max-w-[220px] truncate font-semibold">{jiso.whatsapp_enviado_por || '—'}</span></div>
              </div>
              {jiso.notificacoes?.length > 0 && (
                <div className="mt-4 border-t border-slate-200 pt-3">
                  <p className="mb-2 text-xs font-bold uppercase text-slate-500">Histórico</p>
                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    {jiso.notificacoes.map((item) => (
                      <div key={item.id} className="rounded-lg bg-slate-50 p-2 text-xs">
                        <div className="flex justify-between gap-2"><span className="font-semibold">{item.tipo} · {item.status}</span><span className="text-slate-500">{item.enviado_em ? new Date(item.enviado_em).toLocaleString('pt-BR') : ''}</span></div>
                        <p className="mt-1 line-clamp-2 text-slate-600">{item.mensagem || item.erro || 'Registro legado'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-[#1e3a5f]"><Upload className="h-5 w-5" /> Arquivo da Ata</h2>
              {form.arquivo_ata_jiso ? (
                <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
                  <a href={form.arquivo_ata_jiso} target="_blank" rel="noreferrer" className="font-semibold text-emerald-800 underline">Visualizar arquivo atual</a>
                </div>
              ) : <p className="mb-3 text-sm text-slate-500">Nenhum arquivo anexado.</p>}
              {canDecide && !isClosed && <Input type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={uploadAta} disabled={uploading} />}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-[#1e3a5f]"><FileText className="h-5 w-5" /> Publicação da Ata JISO</h2>
              <div className="space-y-3">
                <div><Label>Data da publicação</Label><Input type="date" value={publication.data_publicacao} onChange={(e) => setPublication((p) => ({ ...p, data_publicacao: e.target.value }))} disabled={isClosed} className="mt-1.5" /></div>
                <div><Label>Nota para BG</Label><Input value={publication.nota_para_bg} onChange={(e) => setPublication((p) => ({ ...p, nota_para_bg: e.target.value }))} disabled={isClosed} className="mt-1.5" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Número BG</Label><Input value={publication.numero_bg} onChange={(e) => setPublication((p) => ({ ...p, numero_bg: e.target.value }))} disabled={isClosed} className="mt-1.5" /></div>
                  <div><Label>Data BG</Label><Input type="date" value={publication.data_bg} onChange={(e) => setPublication((p) => ({ ...p, data_bg: e.target.value }))} disabled={isClosed} className="mt-1.5" /></div>
                </div>
                <div>
                  <Label>Texto gerado</Label>
                  <div className="mt-1.5 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
                    {textoPublicacao || 'Cadastre o resultado e verifique se existe um template ativo de Ata JISO.'}
                  </div>
                </div>
                {jiso.publicacao_id ? (
                  <Badge className="bg-emerald-100 text-emerald-800">Publicação vinculada · {jiso.status_publicacao}</Badge>
                ) : canPublish && !isClosed && (
                  <Button className="w-full bg-[#1e3a5f] hover:bg-[#2d4a6f]" disabled={!form.resultado_jiso || publishMutation.isPending} onClick={() => publishMutation.mutate()}>
                    <FileText className="mr-2 h-4 w-4" /> {publishMutation.isPending ? 'Publicando...' : 'Gerar publicação da JISO'}
                  </Button>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Adicionar atestados à JISO</DialogTitle></DialogHeader>
          <div className="max-h-[55vh] space-y-2 overflow-y-auto">
            {candidatos.map((item) => (
              <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
                <Checkbox checked={selectedAddIds.includes(item.id)} onCheckedChange={() => setSelectedAddIds((ids) => ids.includes(item.id) ? ids.filter((id) => id !== item.id) : [...ids, item.id])} />
                <span><span className="block text-sm font-semibold">{item.tipo_afastamento || 'Atestado médico'} · {item.dias || 0} dia(s)</span><span className="text-xs text-slate-500">{formatDate(item.data_inicio)} a {formatDate(item.data_termino)}</span></span>
              </label>
            ))}
            {!candidatos.length && <p className="p-8 text-center text-sm text-slate-500">Não há outros atestados disponíveis deste militar.</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancelar</Button>
            <Button disabled={!selectedAddIds.length || addMutation.isPending} onClick={() => addMutation.mutate()} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">Adicionar selecionados</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showWhatsapp} onOpenChange={setShowWhatsapp}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Prévia da notificação por WhatsApp</DialogTitle></DialogHeader>
          <Textarea value={whatsappMessage} onChange={(e) => setWhatsappMessage(e.target.value)} className="min-h-56" />
          <p className="text-xs text-slate-500">A mensagem pode ser ajustada antes do envio. O texto final será preservado no histórico da JISO.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowWhatsapp(false)}>Cancelar</Button>
            <Button disabled={!whatsappMessage.trim() || sendingWhatsapp} onClick={sendWhatsapp} className="bg-emerald-700 hover:bg-emerald-800">
              <MessageCircle className="mr-2 h-4 w-4" /> {sendingWhatsapp ? 'Enviando...' : 'Enviar WhatsApp'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
