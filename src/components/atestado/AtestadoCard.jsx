import React, { useEffect, useState } from 'react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  FileText, 
  Clock,
  AlertCircle,
  CheckCircle,
  Shield,
  Save,
  RefreshCw,
  MessageCircle,
  Send,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import JisoHistoricoModal from './JisoHistoricoModal';
import { ATA_JISO_TARS_LABEL, ATA_JISO_TARS_PLACEHOLDER } from './ataJisoLabels';
import { sincronizarAtestadoJisoNoQuadro } from '@/components/quadro/quadroHelpers';
import {
  aplicarTemplate,
} from '@/components/utils/templateUtils.js';
import {
  calcStatusPublicacao,
  existePublicacaoAtivaParaAtestado,
  getAtestadoIdsVinculados,
  getStatusDocumentalAtaJiso,
  isPublicacaoAtestadoAtiva,
} from './atestadoPublicacaoHelpers';
import { getTemplateAtivoPorTipo } from '@/components/rp/templateValidation';
import AtestadoActionsMenu from './AtestadoActionsMenu';
import { montarLabelMilitarAtestado } from '@/services/atestadoJisoMilitarContextService';
import { atualizarEscopado, criarEscopado } from '@/services/cudEscopadoClient';
import { TEMPLATE_EDIT_MODE, TEMPLATE_SOURCE_OF_TRUTH } from '@/constants/templateGovernance';
import { buildTemplateRenderMetadata } from '@/services/templateRenderMetadata';
import { buildAtestadoTemplateVarsContrato, getTipoTemplateHomologacaoAtestado } from './atestadoTemplateVars';

const statusColors = {
  'Ativo': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Encerrado': 'bg-slate-100 text-slate-700 border-slate-200',
  'Cancelado': 'bg-red-100 text-red-700 border-red-200',
  'Prorrogado': 'bg-blue-100 text-blue-700 border-blue-200'
};

export default function AtestadoCard({ atestado, onEdit, onDelete, onView, canEdit = true, canDelete = true }) {
  // GOVERNANÇA TEMPLATE:
  // source_of_truth = render_on_submit
  // edit_mode = hibrido
  const TEMPLATE_GOVERNANCA = {
    source_of_truth: TEMPLATE_SOURCE_OF_TRUTH.RENDER_ON_SUBMIT,
    edit_mode: TEMPLATE_EDIT_MODE.HIBRIDO,
  };
  const queryClient = useQueryClient();
  const { canAccessAction, user } = useCurrentUser();
  const canViewSensitive = canAccessAction('ver_dados_sensiveis_atestado');
  const canManageJiso = canAccessAction('gerir_jiso');
  const [editingJiso, setEditingJiso] = useState(false);
  const [jisoDate, setJisoDate] = useState(atestado.data_jiso_agendada || '');
  const [jisoTime, setJisoTime] = useState(atestado.hora_jiso_agendada || '');
  const [savingJiso, setSavingJiso] = useState(false);
  const [showWhatsAppPreview, setShowWhatsAppPreview] = useState(false);
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [whatsappTemplatePreview, setWhatsappTemplatePreview] = useState(null);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [whatsappTrackingLocal, setWhatsappTrackingLocal] = useState(null);
  const [showJisoModal, setShowJisoModal] = useState(false);
  const [showHomologacaoModal, setShowHomologacaoModal] = useState(false);
  const [showAtaJisoModal, setShowAtaJisoModal] = useState(false);
  const [savingPublicacao, setSavingPublicacao] = useState(false);
  const [uploadingAtaJiso, setUploadingAtaJiso] = useState(false);
  const [arquivoAtaJisoNome, setArquivoAtaJisoNome] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setJisoDate(atestado.data_jiso_agendada || '');
    setJisoTime(atestado.hora_jiso_agendada || '');
  }, [atestado.id, atestado.data_jiso_agendada, atestado.hora_jiso_agendada]);

  // Estado do formulário de homologação
  const [homologacaoForm, setHomologacaoForm] = useState({
    data_publicacao: new Date().toISOString().split('T')[0],
    nota_para_bg: '', numero_bg: '', data_bg: '',
    texto_publicacao: ''
  });

  // Estado do formulário de Ata JISO
  const [ataJisoForm, setAtaJisoForm] = useState({
    data_publicacao: new Date().toISOString().split('T')[0],
    finalidade_jiso: 'LTS',
    secao_jiso: '', data_ata: new Date().toISOString().split('T')[0],
    nup: '', parecer_jiso: '',
    arquivo_ata_jiso: atestado.arquivo_ata_jiso || '',
    nota_para_bg: '', numero_bg: '', data_bg: '',
    texto_publicacao: ''
  });

  const formatarDataExtenso = (d) => {
    if (!d) return '';
    const dt = new Date(d + 'T00:00:00');
    return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;
  };

  const { data: templates = [] } = useQuery({
    queryKey: ['templates-texto'],
    queryFn: () => base44.entities.TemplateTexto.list(),
    staleTime: 30000,
  });
  const { data: militarAtestado = null } = useQuery({
    queryKey: ['militar-atestado-template', atestado?.militar_id],
    queryFn: async () => {
      if (!atestado?.militar_id) return null;
      const rows = await base44.entities.Militar.filter({ id: atestado.militar_id });
      return rows?.[0] || null;
    },
    enabled: !!atestado?.militar_id,
    staleTime: 30000,
  });
  const { data: medicoCadastrado = null, isLoading: isLoadingMedicoCadastrado } = useQuery({
    queryKey: ['medico-atestado-template', atestado?.medico_id],
    queryFn: async () => {
      const rows = await base44.entities.Medico.filter({ id: atestado.medico_id });
      return rows?.[0] || null;
    },
    enabled: !!atestado?.medico_id,
    staleTime: 30000,
  });

  const diasExtensoMap = { 1:'um',2:'dois',3:'três',4:'quatro',5:'cinco',6:'seis',7:'sete',8:'oito',9:'nove',10:'dez',11:'onze',12:'doze',13:'treze',14:'quatorze',15:'quinze' };
  const matriculaOperacional = montarLabelMilitarAtestado(atestado, { contexto: 'operacional' });
  const matriculaDocumental = montarLabelMilitarAtestado(atestado, { contexto: 'documental' });

  const tipoTemplateHomologacao = getTipoTemplateHomologacaoAtestado(atestado);
  const varsContratoTemplate = buildAtestadoTemplateVarsContrato({
    atestado,
    medicoCadastrado,
    militar: militarAtestado,
    matriculaDocumental,
    matriculaOperacional,
  });

  const gerarTextoHomologacao = (form) => {
    const tmpl = getTemplateAtivoPorTipo(tipoTemplateHomologacao, 'ExOfficio', templates, {
      grupamento_id: militarAtestado?.grupamento_id,
      subgrupamento_id: militarAtestado?.subgrupamento_id,
      subgrupamento_tipo: militarAtestado?.subgrupamento_tipo,
    });
    if (!tmpl?.template) return null;
    return aplicarTemplate(tmpl.template, {
      ...varsContratoTemplate,
      dias: String(atestado.dias),
      dias_extenso: String(diasExtensoMap[atestado.dias] || atestado.dias),
      tipo_afastamento: (atestado.tipo_afastamento || '').toLowerCase(),
      data_inicio: formatarDataExtenso(atestado.data_inicio),
      data_termino: formatarDataExtenso(atestado.data_termino),
    });
  };

  const gerarTextoAtaJiso = (form) => {
    const tmpl = getTemplateAtivoPorTipo('Ata JISO', 'ExOfficio', templates, {
      grupamento_id: militarAtestado?.grupamento_id,
      subgrupamento_id: militarAtestado?.subgrupamento_id,
      subgrupamento_tipo: militarAtestado?.subgrupamento_tipo,
    });
    if (!tmpl?.template) return null;
    return aplicarTemplate(tmpl.template, {
      ...varsContratoTemplate,
      secao_jiso: form.secao_jiso || '___',
      data_ata: formatarDataExtenso(form.data_ata),
      finalidade_jiso: form.finalidade_jiso || '___',
      nup: form.nup || '___',
      parecer_jiso: form.parecer_jiso || '___'
    });
  };

  const handleOpenHomologacao = () => {
    if (atestado?.medico_id && isLoadingMedicoCadastrado) {
      alert('Aguarde o carregamento dos dados do médico para gerar a homologação.');
      return;
    }
    const texto = gerarTextoHomologacao({});
    if (texto === null) {
      alert(`Template obrigatório não encontrado para '${tipoTemplateHomologacao}'. Entre em contato com o administrador.`);
      return;
    }
    setHomologacaoForm(prev => ({ ...prev, texto_publicacao: texto }));
    setShowHomologacaoModal(true);
  };

  const handleOpenAtaJiso = () => {
    if (statusDocumentalAtaJiso.bloqueiaNovaPublicacao) {
      alert('Ação bloqueada: já existe Ata JISO ativa/consolidada para este atestado.');
      return;
    }
    const texto = gerarTextoAtaJiso(ataJisoForm);
    if (texto === null) {
      alert("Template obrigatório não encontrado para 'Ata JISO'. Entre em contato com o administrador.");
      return;
    }
    setAtaJisoForm(prev => ({
      ...prev,
      arquivo_ata_jiso: prev.arquivo_ata_jiso || atestado.arquivo_ata_jiso || '',
      texto_publicacao: texto
    }));
    setArquivoAtaJisoNome('');
    setShowAtaJisoModal(true);
  };

  const handleSaveHomologacao = async () => {
    if (!canAccessAction('publicar_homologacao')) {
      alert('Ação negada: você não tem permissão para publicar homologações.');
      return;
    }
    setSavingPublicacao(true);
    const publicacoesMilitar = await base44.entities.PublicacaoExOfficio.filter({ militar_id: atestado.militar_id });
    const jaExisteHomologacao = existePublicacaoAtivaParaAtestado(
      publicacoesMilitar,
      atestado.id,
      'Homologação de Atestado'
    );

    if (jaExisteHomologacao) {
      alert('Já existe uma homologação ativa para este atestado.');
      setSavingPublicacao(false);
      return;
    }

    const status = calcStatusPublicacao({
      nota_para_bg: homologacaoForm.nota_para_bg,
      numero_bg: homologacaoForm.numero_bg,
      data_bg: homologacaoForm.data_bg,
    });
    const templatesAtualizados = await queryClient.fetchQuery({
      queryKey: ['templates-texto'],
      queryFn: () => base44.entities.TemplateTexto.list(),
    });
    const templateHomologacao = getTemplateAtivoPorTipo(tipoTemplateHomologacao, 'ExOfficio', templatesAtualizados, {
      grupamento_id: militarAtestado?.grupamento_id,
      subgrupamento_id: militarAtestado?.subgrupamento_id,
      subgrupamento_tipo: militarAtestado?.subgrupamento_tipo,
    });
    const renderMetadata = buildTemplateRenderMetadata({
      template: templateHomologacao,
      modulo: 'PublicacaoExOfficio',
      user,
      sourceOfTruth: TEMPLATE_GOVERNANCA.source_of_truth,
    });
    const payloadPublicacao = {
      tipo: 'Homologação de Atestado',
      militar_id: atestado.militar_id,
      militar_nome: atestado.militar_nome,
      militar_posto: atestado.militar_posto,
      militar_matricula: matriculaDocumental,
      data_publicacao: homologacaoForm.data_publicacao,
      atestado_homologado_id: atestado.id,
      texto_publicacao: homologacaoForm.texto_publicacao,
      nota_para_bg: homologacaoForm.nota_para_bg,
      numero_bg: homologacaoForm.numero_bg,
      data_bg: homologacaoForm.data_bg,
      status
    };
    if (renderMetadata) {
      payloadPublicacao.render_metadata = renderMetadata;
      payloadPublicacao.template_id = renderMetadata.template_id;
      payloadPublicacao.template_hash = renderMetadata.template_hash;
      payloadPublicacao.rendered_at = renderMetadata.rendered_at;
      payloadPublicacao.rendered_by = renderMetadata.rendered_by;
      payloadPublicacao.source_of_truth = renderMetadata.source_of_truth;
    }
    await criarEscopado('PublicacaoExOfficio', payloadPublicacao);
    await atualizarEscopado('Atestado', atestado.id, {
      homologado_comandante: true,
      status_jiso: 'Homologado pelo Comandante',
      status_publicacao: status
    });
    queryClient.invalidateQueries({ queryKey: ['atestados'] });
    queryClient.invalidateQueries({ queryKey: ['publicacoes-ex-officio'] });
    queryClient.invalidateQueries({ queryKey: ['publicacoes-atestado'] });
    queryClient.invalidateQueries({ queryKey: ['cards'] });
    queryClient.invalidateQueries({ queryKey: ['publicacoes-atestado'] });
    queryClient.invalidateQueries({ queryKey: ['cards'] });
    setSavingPublicacao(false);
    setShowHomologacaoModal(false);
  };

  const handleSaveAtaJiso = async () => {
    if (!canAccessAction('publicar_ata_jiso')) {
      alert('Ação negada: você não tem permissão para publicar atas JISO.');
      return;
    }
    setSavingPublicacao(true);
    const publicacoesMilitar = await base44.entities.PublicacaoExOfficio.filter({ militar_id: atestado.militar_id });
    const jaExisteAtaJiso = existePublicacaoAtivaParaAtestado(
      publicacoesMilitar,
      atestado.id,
      'Ata JISO'
    );

    if (jaExisteAtaJiso) {
      alert('Já existe uma nota/publicação ativa para esta Ata JISO.');
      setSavingPublicacao(false);
      return;
    }

    const status = calcStatusPublicacao({
      nota_para_bg: ataJisoForm.nota_para_bg,
      numero_bg: ataJisoForm.numero_bg,
      data_bg: ataJisoForm.data_bg,
    });
    const templatesAtualizados = await queryClient.fetchQuery({
      queryKey: ['templates-texto'],
      queryFn: () => base44.entities.TemplateTexto.list(),
    });
    const templateAtaJiso = getTemplateAtivoPorTipo('Ata JISO', 'ExOfficio', templatesAtualizados, {
      grupamento_id: militarAtestado?.grupamento_id,
      subgrupamento_id: militarAtestado?.subgrupamento_id,
      subgrupamento_tipo: militarAtestado?.subgrupamento_tipo,
    });
    const renderMetadata = buildTemplateRenderMetadata({
      template: templateAtaJiso,
      modulo: 'PublicacaoExOfficio',
      user,
      sourceOfTruth: TEMPLATE_GOVERNANCA.source_of_truth,
    });
    const payloadPublicacao = {
      tipo: 'Ata JISO',
      militar_id: atestado.militar_id,
      militar_nome: atestado.militar_nome,
      militar_posto: atestado.militar_posto,
      militar_matricula: matriculaDocumental,
      data_publicacao: ataJisoForm.data_publicacao,
      atestados_jiso_ids: [atestado.id],
      finalidade_jiso: ataJisoForm.finalidade_jiso,
      secao_jiso: ataJisoForm.secao_jiso,
      data_ata: ataJisoForm.data_ata,
      nup: ataJisoForm.nup,
      parecer_jiso: ataJisoForm.parecer_jiso,
      texto_publicacao: ataJisoForm.texto_publicacao,
      nota_para_bg: ataJisoForm.nota_para_bg,
      numero_bg: ataJisoForm.numero_bg,
      data_bg: ataJisoForm.data_bg,
      status
    };
    if (renderMetadata) {
      payloadPublicacao.render_metadata = renderMetadata;
      payloadPublicacao.template_id = renderMetadata.template_id;
      payloadPublicacao.template_hash = renderMetadata.template_hash;
      payloadPublicacao.rendered_at = renderMetadata.rendered_at;
      payloadPublicacao.rendered_by = renderMetadata.rendered_by;
      payloadPublicacao.source_of_truth = renderMetadata.source_of_truth;
    }
    await criarEscopado('PublicacaoExOfficio', payloadPublicacao);
    await atualizarEscopado('Atestado', atestado.id, {
      status_jiso: 'Homologado pela JISO',
      status_publicacao: status,
      arquivo_ata_jiso: ataJisoForm.arquivo_ata_jiso || ''
    });
    queryClient.invalidateQueries({ queryKey: ['atestados'] });
    queryClient.invalidateQueries({ queryKey: ['publicacoes-ex-officio'] });
    queryClient.invalidateQueries({ queryKey: ['publicacoes-atestado'] });
    queryClient.invalidateQueries({ queryKey: ['cards'] });
    setSavingPublicacao(false);
    setShowAtaJisoModal(false);
  };

  const handleAtaJisoFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAtaJiso(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setAtaJisoForm((prev) => ({ ...prev, arquivo_ata_jiso: file_url }));
      setArquivoAtaJisoNome(file.name || 'Arquivo da Ata JISO');
    } catch (error) {
      console.error('Erro ao fazer upload da Ata JISO:', error);
      alert('Não foi possível enviar o arquivo da Ata JISO.');
    } finally {
      setUploadingAtaJiso(false);
      e.target.value = '';
    }
  };

  const handleRemoveAtaJisoFile = () => {
    setAtaJisoForm((prev) => ({ ...prev, arquivo_ata_jiso: '' }));
    setArquivoAtaJisoNome('');
  };

  // Buscar publicações vinculadas a este atestado
  const { data: publicacoesVinculadas = [] } = useQuery({
    queryKey: ['publicacoes-atestado', atestado.id],
    queryFn: () => base44.entities.PublicacaoExOfficio.filter({ militar_id: atestado.militar_id }),
    select: (data) => data.filter(p =>
      p.atestado_homologado_id === atestado.id ||
      (p.atestados_jiso_ids && p.atestados_jiso_ids.includes(atestado.id))
    )
  });

  const hasHomologacaoAtiva = existePublicacaoAtivaParaAtestado(
    publicacoesVinculadas,
    atestado.id,
    'Homologação de Atestado'
  );
  const hasHomologacaoGerada = publicacoesVinculadas.some(
    (publicacao) =>
      publicacao.tipo === 'Homologação de Atestado' &&
      getAtestadoIdsVinculados(publicacao).includes(atestado.id)
  );
  const podePublicarHomologacao = atestado.fluxo_homologacao === 'comandante' && !hasHomologacaoGerada;
  const hasPublicacaoVinculada = publicacoesVinculadas.some(isPublicacaoAtestadoAtiva);
  const mensagemBloqueioPublicacao = 'Ação não permitida: este atestado possui publicação/nota vinculada.';


  const statusDocumentalAtaJiso = getStatusDocumentalAtaJiso(atestado, publicacoesVinculadas);

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return format(new Date(dateString + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR });
  };

  const getStatusInfo = () => {
    if (!atestado.data_retorno) return null;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const retorno = new Date(atestado.data_retorno + 'T00:00:00');
    if (atestado.status === 'Encerrado' || atestado.status === 'Cancelado') return null;
    const diasRestantes = differenceInDays(retorno, hoje);
    if (diasRestantes < 0) return { icon: AlertCircle, text: 'Atrasado', color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200' };
    if (diasRestantes === 0) return { icon: Clock, text: 'Retorna hoje', color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' };
    if (diasRestantes <= 3) return { icon: Clock, text: `Retorna em ${diasRestantes} ${diasRestantes === 1 ? 'dia' : 'dias'}`, color: 'text-orange-600', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' };
    return { icon: CheckCircle, text: `Retorna em ${diasRestantes} dias`, color: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' };
  };

  const persistirAgendamentoJiso = async ({ fecharEdicao = true } = {}) => {
    if (!jisoDate || !jisoTime) {
      alert('Informe a data e o horário da JISO.');
      return false;
    }
    if (savingJiso) return false;
    if (!canManageJiso) {
      alert('Ação negada: você não tem permissão para gerir o agendamento da JISO.');
      return false;
    }
    setSavingJiso(true);
    try {
      await atualizarEscopado('Atestado', atestado.id, {
        data_jiso_agendada: jisoDate,
        hora_jiso_agendada: jisoTime,
        ...((!atestado.status_jiso || atestado.status_jiso === 'Em análise') ? { status_jiso: 'Aguardando JISO' } : {})
      });
      try {
        await sincronizarAtestadoJisoNoQuadro({
          ...atestado,
          data_jiso_agendada: jisoDate,
          hora_jiso_agendada: jisoTime,
        });
      } catch (syncError) {
        if (syncError?.message?.includes('Rate limit')) {
          console.warn('Rate limit em sincronizarAtestadoJisoNoQuadro — agendamento salvo, sincronização do quadro será refeita.', syncError);
        } else {
          throw syncError;
        }
      }
      queryClient.invalidateQueries({ queryKey: ['atestados'] });
      queryClient.invalidateQueries({ queryKey: ['atestados-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      if (fecharEdicao) setEditingJiso(false);
      return true;
    } catch (error) {
      if (error?.message?.includes('Rate limit')) {
        alert('Muitas requisições em sequência. Aguarde alguns segundos e tente novamente.');
      } else {
        alert(error?.message || 'Não foi possível salvar o agendamento da JISO.');
      }
      return false;
    } finally {
      setSavingJiso(false);
    }
  };

  const handleSaveJiso = () => persistirAgendamentoJiso();

  const abrirPreviaWhatsAppJiso = async () => {
    if (!jisoDate || !jisoTime) {
      alert('Informe a data e o horário da JISO antes de preparar a notificação.');
      return;
    }

    setWhatsappMessage('');
    setWhatsappTemplatePreview(null);
    try {
      // A prévia passa a ser montada no backend a partir do TemplateTexto ativo.
      // Assim o texto exibido ao usuário e o template validado no envio têm a mesma fonte de verdade.
      const response = await base44.functions.invoke('notificarJisoWhatsAppTemplate', {
        action: 'preview',
        atestado_id: atestado.id,
        militar_id: atestado.militar_id,
        data_jiso: jisoDate,
        hora_jiso: jisoTime,
      });
      const data = response?.data || response;
      if (!data?.success) {
        throw new Error(data?.error || 'Não foi possível gerar a prévia do template da JISO.');
      }
      if (data.function_version !== 'jiso-template-v3-2026-08-29') {
        throw new Error('A função publicada de WhatsApp ainda não está na versão do template JISO. Atualize a aplicação antes de enviar.');
      }
      if (!data?.mensagem || !data?.template_id || !data?.template_hash) {
        throw new Error('A prévia retornou sem identificação válida do template ativo.');
      }

      setWhatsappTemplatePreview({
        template_id: data.template_id,
        template_nome: data.template_nome || 'Notificação de JISO WA',
        template_hash: data.template_hash,
        template_updated_date: data.template_updated_date || '',
        data_jiso_snapshot: data.data_jiso_snapshot || jisoDate,
        hora_jiso_snapshot: data.hora_jiso_snapshot || jisoTime,
      });
      setWhatsappMessage(data.mensagem);
      setShowWhatsAppPreview(true);
    } catch (error) {
      console.error('Erro ao carregar o template WhatsApp da JISO:', error);
      alert(error?.message || 'Não foi possível carregar o template atualizado da notificação JISO. Tente novamente.');
    }
  };

  const confirmarEnvioWhatsAppJiso = async () => {
    const mensagemFinal = whatsappMessage.trim();
    if (!mensagemFinal || sendingWhatsApp) return;
    if (!whatsappTemplatePreview?.template_id || !whatsappTemplatePreview?.template_hash) {
      alert('A prévia do template expirou ou não foi carregada corretamente. Feche e gere uma nova prévia antes de enviar.');
      return;
    }

    setSendingWhatsApp(true);
    try {
      const agendamentoSalvo = await persistirAgendamentoJiso({ fecharEdicao: false });
      if (!agendamentoSalvo) return;

      const response = await base44.functions.invoke('notificarJisoWhatsAppTemplate', {
        action: 'send',
        atestado_id: atestado.id,
        militar_id: atestado.militar_id,
        mensagem_final: mensagemFinal,
        template_id: whatsappTemplatePreview.template_id,
        template_hash: whatsappTemplatePreview.template_hash,
        data_jiso_snapshot: whatsappTemplatePreview.data_jiso_snapshot,
        hora_jiso_snapshot: whatsappTemplatePreview.hora_jiso_snapshot,
      });
      const data = response?.data || response;
      if (!data?.success) {
        throw new Error(data?.error || 'Falha ao enviar a notificação por WhatsApp.');
      }
      if (data.function_version !== 'jiso-template-v3-2026-08-29') {
        throw new Error('A função de WhatsApp publicada não corresponde à versão atual do template JISO.');
      }
      if (!data.enviado_em) {
        throw new Error('O provedor confirmou o envio sem retornar o horário do comprovante.');
      }

      // O card muda imediatamente para "WhatsApp enviado". A persistência no Atestado
      // continua sendo a fonte definitiva após o próximo carregamento.
      setWhatsappTrackingLocal({
        enviado_em: data.enviado_em,
        enviado_por: data.enviado_por || user?.email || '',
        mensagem: mensagemFinal,
        data_jiso_snapshot: data.data_jiso_snapshot || jisoDate,
        hora_jiso_snapshot: data.hora_jiso_snapshot || jisoTime,
      });

      queryClient.invalidateQueries({ queryKey: ['atestados'] });
      queryClient.invalidateQueries({ queryKey: ['atestados-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      setShowWhatsAppPreview(false);
      setWhatsappTemplatePreview(null);
      setEditingJiso(false);

      if (data.tracking_saved === false) {
        alert('A mensagem foi enviada pelo WhatsApp, mas o comprovante não pôde ser persistido no atestado. O card foi atualizado nesta tela para evitar reenvio acidental; não envie novamente apenas para corrigir o marcador.');
        return;
      }

      alert(`Notificação de JISO enviada pelo template "${data.template_nome || whatsappTemplatePreview.template_nome}" e registrada no atestado.`);
    } catch (error) {
      alert(error?.message || 'Não foi possível enviar a notificação por WhatsApp.');
    } finally {
      setSendingWhatsApp(false);
    }
  };

  const statusInfo = getStatusInfo();
  const isFluxoJiso = atestado.fluxo_homologacao === 'jiso' || atestado.dias > 15;
  const whatsappJisoEnviadoEm = whatsappTrackingLocal?.enviado_em || atestado.jiso_whatsapp_enviado_em;
  const whatsappJisoEnviadoPor = whatsappTrackingLocal?.enviado_por || atestado.jiso_whatsapp_enviado_por;
  const whatsappJisoDataSnapshot = whatsappTrackingLocal?.data_jiso_snapshot || atestado.jiso_whatsapp_data_agendada_snapshot;
  const whatsappJisoHoraSnapshot = whatsappTrackingLocal?.hora_jiso_snapshot || atestado.jiso_whatsapp_hora_agendada_snapshot;
  const whatsappJisoJaEnviado = !!whatsappJisoEnviadoEm;
  const whatsappJisoLegado = !whatsappJisoJaEnviado && atestado.jiso_whatsapp_status === 'legado';
  const whatsappJisoAgendamentoAlterado = whatsappJisoJaEnviado && (
    whatsappJisoDataSnapshot !== jisoDate ||
    whatsappJisoHoraSnapshot !== jisoTime
  );
  const whatsappJisoStatus = whatsappJisoLegado
    ? 'legado'
    : !whatsappJisoJaEnviado
      ? 'pendente'
      : whatsappJisoAgendamentoAlterado
        ? 'reenviar'
        : 'enviado';
  const formatarDataHoraEnvioWhatsApp = (value) => {
    if (!value) return '';
    const data = new Date(value);
    if (Number.isNaN(data.getTime())) return '';
    return format(data, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="contents"
    >
      <article className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
        <div className="px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-900 text-sm leading-tight truncate">
                    {atestado.militar_posto && `${atestado.militar_posto} `}{atestado.militar_nome}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Mat. {matriculaOperacional || '—'}
                    {atestado.tipo_afastamento ? ` · ${atestado.tipo_afastamento}` : ''}
                  </p>
                </div>
              </div>
            </div>

            <AtestadoActionsMenu
              atestado={atestado}
              handlers={{
                onView,
                onEdit,
                onDelete,
                onOpenHomologacao: handleOpenHomologacao,
                onOpenAtaJiso: handleOpenAtaJiso,
                onOpenJisoModal: () => setShowJisoModal(true),
              }}
              permissoes={{ canEdit, canDelete }}
              estados={{
                hasPublicacaoVinculada,
                mensagemBloqueioPublicacao,
                podePublicarHomologacao,
                hasHomologacaoAtiva,
                isFluxoJiso,
                statusDocumentalAtaJiso,
                bloquearEdicaoPublicacaoNoCard: true,
              }}
              publicacoesVinculadas={publicacoesVinculadas}
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
            <Badge className={`${statusColors[atestado.status] || statusColors['Ativo']} border text-[10px] px-2 py-0.5`}>
              {atestado.status || 'Ativo'}
            </Badge>
            {isFluxoJiso && (
              <Badge className={`text-[10px] px-2 py-0.5 ${atestado.status_jiso === 'Homologado pela JISO' ? 'bg-emerald-100 text-emerald-700' : 'bg-purple-100 text-purple-700'}`}>
                {atestado.status_jiso || 'JISO pendente'}
              </Badge>
            )}
            {atestado.acompanhado && (
              <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-pink-200 text-pink-700">Acompanhamento</Badge>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 mt-3 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Período</p>
              <p className="text-xs font-semibold text-slate-700 mt-0.5">{formatDate(atestado.data_inicio)}</p>
              <p className="text-[10px] text-slate-500">até {formatDate(atestado.data_termino || atestado.data_retorno)}</p>
            </div>
            <div className="border-l border-slate-200 pl-2">
              <p className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Duração</p>
              <p className="text-xs font-semibold text-slate-700 mt-0.5">{atestado.dias || 0} dias</p>
              {atestado.cid_10 && <p className="text-[10px] text-slate-500">CID {canViewSensitive ? atestado.cid_10 : 'restrito'}</p>}
            </div>
            <div className="border-l border-slate-200 pl-2">
              <p className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Retorno</p>
              <p className="text-xs font-semibold text-slate-700 mt-0.5">{formatDate(atestado.data_retorno)}</p>
              {statusInfo && <p className={`text-[10px] font-medium ${statusInfo.color}`}>{statusInfo.text}</p>}
            </div>
          </div>

          {isFluxoJiso && (
            <div className={`mt-2.5 rounded-lg border px-3 py-2.5 ${jisoDate ? 'border-purple-100 bg-purple-50/60' : 'border-amber-200 bg-amber-50'}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Shield className={`w-3.5 h-3.5 ${jisoDate ? 'text-purple-600' : 'text-amber-600'}`} />
                    <span className={`text-xs font-semibold ${jisoDate ? 'text-purple-800' : 'text-amber-800'}`}>
                      {jisoDate ? `JISO ${formatDate(jisoDate)} · ${jisoTime || 'horário pendente'}` : 'JISO ainda não agendada'}
                    </span>
                  </div>
                  {jisoDate && (
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {whatsappJisoStatus === 'enviado' && 'WhatsApp enviado'}
                      {whatsappJisoStatus === 'pendente' && 'WhatsApp pendente'}
                      {whatsappJisoStatus === 'reenviar' && 'Alteração após envio — reenviar WhatsApp'}
                      {whatsappJisoStatus === 'legado' && 'Comunicação histórica'}
                    </p>
                  )}
                </div>

                {canManageJiso && !editingJiso && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2.5 text-[11px] shrink-0 bg-white"
                    onClick={() => {
                      setJisoDate(atestado.data_jiso_agendada || '');
                      setJisoTime(atestado.hora_jiso_agendada || '');
                      setEditingJiso(true);
                    }}
                  >
                    {jisoDate ? 'Alterar' : 'Agendar'}
                  </Button>
                )}
              </div>

              {editingJiso && canManageJiso && (
                <div className="mt-2.5 pt-2.5 border-t border-purple-100 space-y-2">
                  <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-2">
                    <Input type="date" value={jisoDate} onChange={(e) => setJisoDate(e.target.value)} className="h-8 text-xs bg-white" />
                    <Input type="time" value={jisoTime} onChange={(e) => setJisoTime(e.target.value)} className="h-8 text-xs bg-white" />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button size="sm" className="h-7 px-2.5 text-[11px] bg-[#1e3a5f]" onClick={handleSaveJiso} disabled={savingJiso || !jisoDate || !jisoTime}>
                      {savingJiso ? 'Salvando...' : 'Salvar'}
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-2.5 text-[11px] bg-white text-green-700 border-green-200" onClick={abrirPreviaWhatsAppJiso} disabled={savingJiso || sendingWhatsApp || !jisoDate || !jisoTime}>
                      <MessageCircle className="w-3 h-3 mr-1" /> WhatsApp
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => { setEditingJiso(false); setJisoDate(atestado.data_jiso_agendada || ''); setJisoTime(atestado.hora_jiso_agendada || ''); }}>Cancelar</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2">
          <button type="button" onClick={() => onView(atestado)} className="text-xs font-medium text-[#1e3a5f] hover:underline">
            Ver detalhes
          </button>
          <div className="flex items-center gap-2">
            {isFluxoJiso && (
              <button type="button" onClick={() => setShowJisoModal(true)} className="text-[11px] text-slate-500 hover:text-purple-700">
                Histórico JISO
              </button>
            )}
            {jisoDate && canManageJiso && !editingJiso && (
              <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-green-700" onClick={abrirPreviaWhatsAppJiso} disabled={sendingWhatsApp}>
                <MessageCircle className="w-3 h-3 mr-1" /> WhatsApp
              </Button>
            )}
          </div>
        </div>

        {showJisoModal && (
          <JisoHistoricoModal
            atestado={atestado}
            open={showJisoModal}
            onClose={() => setShowJisoModal(false)}
          />
        )}
      </article>

      {/* Prévia da notificação JISO por WhatsApp */}
      <Dialog open={showWhatsAppPreview} onOpenChange={(open) => { if (!sendingWhatsApp) setShowWhatsAppPreview(open); }}>
        <DialogContent className="w-[96vw] max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-600" />
              Prévia da notificação JISO por WhatsApp
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              <p className="font-semibold">{atestado.militar_posto} {atestado.militar_nome}</p>
              <p className="mt-1 text-xs">
                JISO em {formatDate(jisoDate)}, às {jisoTime}. Revise o texto abaixo antes de confirmar o envio.
              </p>
              <p className="mt-1 text-[11px] text-green-700">
                Template ativo: {whatsappTemplatePreview?.template_nome || 'carregando...'}
              </p>
            </div>

            <div>
              <Label className="text-sm font-medium">Mensagem</Label>
              <Textarea
                value={whatsappMessage}
                onChange={(e) => setWhatsappMessage(e.target.value)}
                rows={14}
                className="mt-1.5 resize-y whitespace-pre-wrap"
                disabled={sendingWhatsApp}
              />
              <p className="mt-1 text-xs text-slate-500">
                Você pode editar livremente esta mensagem. Somente o texto exibido aqui será enviado.
              </p>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowWhatsAppPreview(false)}
                disabled={sendingWhatsApp}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={confirmarEnvioWhatsAppJiso}
                disabled={sendingWhatsApp || savingJiso || !whatsappMessage.trim()}
                className="bg-green-600 text-white hover:bg-green-700"
              >
                <Send className="w-4 h-4 mr-2" />
                {sendingWhatsApp ? 'Enviando...' : 'Confirmar e enviar mensagem'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Homologação pelo Comandante */}
      <Dialog open={showHomologacaoModal} onOpenChange={setShowHomologacaoModal}>
        <DialogContent className="w-[96vw] max-w-6xl max-h-[92vh] overflow-hidden p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200">
            <DialogTitle>Homologação pelo Comandante</DialogTitle>
            <p className="text-[11px] text-slate-500">
              {TEMPLATE_GOVERNANCA.source_of_truth === TEMPLATE_SOURCE_OF_TRUTH.RENDER_ON_SUBMIT
                ? 'Texto derivado do template (permite ajuste manual).'
                : 'Texto oficial persistido.'}
            </p>
          </DialogHeader>
          <div className="flex max-h-[calc(92vh-64px)] flex-col">
            <div className="overflow-y-auto px-6 pb-6">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              <strong>{atestado.militar_posto} {atestado.militar_nome}</strong> — {atestado.dias} dias — {formatarDataExtenso(atestado.data_inicio)} a {formatarDataExtenso(atestado.data_termino)}
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="space-y-4 lg:col-span-5">
                <div className="space-y-2 rounded-lg border border-slate-200 p-4">
                  <h4 className="text-xs font-semibold tracking-wide text-slate-500">DADOS DA PUBLICAÇÃO</h4>
                  <div>
                    <Label className="text-sm font-medium">Data da Publicação</Label>
                    <Input type="date" value={homologacaoForm.data_publicacao} onChange={e => setHomologacaoForm(p => ({ ...p, data_publicacao: e.target.value }))} className="mt-1.5" />
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border border-slate-200 p-4">
                  <h4 className="text-xs font-semibold tracking-wide text-slate-500">BOLETIM GERAL (BG)</h4>
                  <div>
                    <Label className="text-sm">Nota para BG</Label>
                    <Input value={homologacaoForm.nota_para_bg} onChange={e => setHomologacaoForm(p => ({ ...p, nota_para_bg: e.target.value }))} className="mt-1.5" placeholder="001/2025" />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div><Label className="text-sm">Número BG</Label><Input value={homologacaoForm.numero_bg} onChange={e => setHomologacaoForm(p => ({ ...p, numero_bg: e.target.value }))} className="mt-1.5" /></div>
                    <div><Label className="text-sm">Data BG</Label><Input type="date" value={homologacaoForm.data_bg} onChange={e => setHomologacaoForm(p => ({ ...p, data_bg: e.target.value }))} className="mt-1.5" /></div>
                  </div>
                </div>

                
              </div>
              <div className="lg:col-span-7">
                <div className="h-full rounded-lg border border-slate-200 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <Label className="text-sm font-medium">Texto para Publicação</Label>
                    <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" /> Gerado automaticamente
                    </span>
                  </div>
                  <textarea
                    value={canViewSensitive ? (homologacaoForm.texto_publicacao || '') : "Conteúdo restrito"}
                    readOnly={!canViewSensitive}
                    onChange={(e) => setHomologacaoForm(p => ({ ...p, texto_publicacao: e.target.value }))}
                    className="w-full min-h-[300px] lg:min-h-[420px] rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                    placeholder="Nenhum texto gerado."
                  />
                </div>
              </div>
            </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4">
              <Button variant="outline" onClick={() => setShowHomologacaoModal(false)}>Cancelar</Button>
              <Button onClick={handleSaveHomologacao} disabled={savingPublicacao} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
                <Save className="w-4 h-4 mr-2" />{savingPublicacao ? 'Salvando...' : 'Salvar Publicação'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Ata JISO */}
      <Dialog open={showAtaJisoModal} onOpenChange={setShowAtaJisoModal}>
        <DialogContent className="w-[96vw] max-w-6xl max-h-[92vh] overflow-y-auto px-6 pb-4">
          <DialogHeader>
            <DialogTitle>Ata JISO</DialogTitle>
            <p className="text-[11px] text-slate-500">
              {TEMPLATE_GOVERNANCA.edit_mode === TEMPLATE_EDIT_MODE.HIBRIDO
                ? 'Texto derivado do template (permite ajuste manual).'
                : 'Texto oficial persistido.'}
            </p>
          </DialogHeader>
          <div className="space-y-6">
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-800">
              <strong>{atestado.militar_posto} {atestado.militar_nome}</strong> — {atestado.dias} dias — JISO: {atestado.status_jiso || 'Aguardando'}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-5 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm">Data da Publicação</Label>
                    <Input type="date" value={ataJisoForm.data_publicacao} onChange={e => setAtaJisoForm(p => ({ ...p, data_publicacao: e.target.value }))} className="mt-1.5" />
                  </div>
                  <div>
                    <Label className="text-sm">Finalidade</Label>
                    <select value={ataJisoForm.finalidade_jiso} onChange={e => { const v = e.target.value; setAtaJisoForm(p => { const np = {...p, finalidade_jiso: v}; return {...np, texto_publicacao: gerarTextoAtaJiso(np) || np.texto_publicacao}; }); }} className="mt-1.5 w-full border rounded-md px-3 py-2 text-sm">
                      {['V.A.F','LTS','Reserva Remunerada','Atestado de Origem'].map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label className="text-sm">Seção JISO</Label>
                    <Input value={ataJisoForm.secao_jiso} onChange={e => { const v = e.target.value; setAtaJisoForm(p => { const np = {...p, secao_jiso: v}; return {...np, texto_publicacao: gerarTextoAtaJiso(np) || np.texto_publicacao}; }); }} className="mt-1.5" placeholder="62/JISO/2025" />
                  </div>
                  <div>
                    <Label className="text-sm">Data da Ata</Label>
                    <Input type="date" value={ataJisoForm.data_ata} onChange={e => { const v = e.target.value; setAtaJisoForm(p => { const np = {...p, data_ata: v}; return {...np, texto_publicacao: gerarTextoAtaJiso(np) || np.texto_publicacao}; }); }} className="mt-1.5" />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-sm">{ATA_JISO_TARS_LABEL}</Label>
                    <Input value={ataJisoForm.nup} onChange={e => { const v = e.target.value; setAtaJisoForm(p => { const np = {...p, nup: v}; return {...np, texto_publicacao: gerarTextoAtaJiso(np) || np.texto_publicacao}; }); }} className="mt-1.5" placeholder={ATA_JISO_TARS_PLACEHOLDER} />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-sm">Parecer</Label>
                    <Input
                      value={canViewSensitive ? ataJisoForm.parecer_jiso : "Dado sensível restrito"}
                      readOnly={!canViewSensitive}
                      onChange={e => { const v = e.target.value; setAtaJisoForm(p => { const np = {...p, parecer_jiso: v}; return {...np, texto_publicacao: gerarTextoAtaJiso(np) || np.texto_publicacao}; }); }}
                      className="mt-1.5"
                      placeholder="Apto"
                    />
                  </div>
                </div>

                <hr className="border-slate-200" />

                <div className="grid grid-cols-3 gap-3">
                  <div><Label className="text-sm">Nota para BG</Label><Input value={ataJisoForm.nota_para_bg} onChange={e => setAtaJisoForm(p => ({ ...p, nota_para_bg: e.target.value }))} className="mt-1.5" placeholder="001/2025" /></div>
                  <div><Label className="text-sm">Número BG</Label><Input value={ataJisoForm.numero_bg} onChange={e => setAtaJisoForm(p => ({ ...p, numero_bg: e.target.value }))} className="mt-1.5" /></div>
                  <div><Label className="text-sm">Data BG</Label><Input type="date" value={ataJisoForm.data_bg} onChange={e => setAtaJisoForm(p => ({ ...p, data_bg: e.target.value }))} className="mt-1.5" /></div>
                </div>
              </div>

              <div className="lg:col-span-7 flex flex-col space-y-5">
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-sm font-medium">Texto para Publicação</Label>
                    <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" /> Gerado automaticamente
                    </span>
                  </div>
                  <div className="w-full flex-1 min-h-[200px] border border-gray-300 rounded-md px-4 py-4 text-sm text-gray-700 bg-gray-50 outline-none">
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {canViewSensitive ? (ataJisoForm.texto_publicacao || 'Nenhum texto gerado.') : "Conteúdo restrito"}
                    </p>
                  </div>
                </div>

                <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4">
                  <Label className="text-sm">Arquivo da Ata JISO</Label>
                  <div className="mt-1.5 space-y-2">
                    {(ataJisoForm.arquivo_ata_jiso || atestado.arquivo_ata_jiso) ? (
                      <div className="p-2 border border-slate-200 rounded-md bg-slate-50 space-y-1">
                        <p className="text-xs text-slate-600">
                          <span className="font-medium">Arquivo atual:</span>{' '}
                          <span className="break-all">
                            {arquivoAtaJisoNome || decodeURIComponent((ataJisoForm.arquivo_ata_jiso || atestado.arquivo_ata_jiso).split('/').pop()?.split('?')[0] || 'Arquivo anexado')}
                          </span>
                        </p>
                        <button type="button" className="text-xs text-blue-600 hover:underline" onClick={() => window.open(ataJisoForm.arquivo_ata_jiso || atestado.arquivo_ata_jiso, '_blank')}>
                          Visualizar arquivo atual
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">Nenhum arquivo anexado.</p>
                    )}

                    <Input type="file" onChange={handleAtaJisoFileUpload} accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" disabled={uploadingAtaJiso} />
                    <p className="text-xs text-slate-500">{uploadingAtaJiso ? 'Enviando arquivo...' : 'Selecione um novo arquivo para substituir ou anexar.'}</p>
                    {(ataJisoForm.arquivo_ata_jiso || atestado.arquivo_ata_jiso) && (
                      <Button type="button" variant="outline" className="w-full" onClick={handleRemoveAtaJisoFile}>Remover arquivo da ata</Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
              <Button variant="outline" onClick={() => setShowAtaJisoModal(false)}>Cancelar</Button>
              <Button onClick={handleSaveAtaJiso} disabled={savingPublicacao} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
                <Save className="w-4 h-4 mr-2" />{savingPublicacao ? 'Salvando...' : 'Salvar Publicação'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}