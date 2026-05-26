import React, { useState } from 'react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  FileText, 
  Clock,
  AlertCircle,
  CheckCircle,
  Shield,
  ShieldCheck,
  Save,
  ChevronRight,
  RefreshCw,
  Pencil
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import JisoHistoricoModal from './JisoHistoricoModal';
import { sincronizarAtestadoJisoNoQuadro } from '@/components/quadro/quadroHelpers';
import {
  aplicarTemplate,
  buildTemplateVarsContrato,
} from '@/components/utils/templateUtils';
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
  const [editingJiso, setEditingJiso] = useState(false);
  const [jisoDate, setJisoDate] = useState(atestado.data_jiso_agendada || '');
  const [savingJiso, setSavingJiso] = useState(false);
  const [showJisoModal, setShowJisoModal] = useState(false);
  const [showHomologacaoModal, setShowHomologacaoModal] = useState(false);
  const [showAtaJisoModal, setShowAtaJisoModal] = useState(false);
  const [savingPublicacao, setSavingPublicacao] = useState(false);
  const [uploadingAtaJiso, setUploadingAtaJiso] = useState(false);
  const [arquivoAtaJisoNome, setArquivoAtaJisoNome] = useState('');

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

  const diasExtensoMap = { 1:'um',2:'dois',3:'três',4:'quatro',5:'cinco',6:'seis',7:'sete',8:'oito',9:'nove',10:'dez',11:'onze',12:'doze',13:'treze',14:'quatorze',15:'quinze' };
  const matriculaOperacional = montarLabelMilitarAtestado(atestado, { contexto: 'operacional' });
  const matriculaDocumental = montarLabelMilitarAtestado(atestado, { contexto: 'documental' });

  const varsContratoTemplate = buildTemplateVarsContrato({
    ...atestado,
    militar: militarAtestado,
    matricula_documental: matriculaDocumental,
    matricula_operacional: matriculaOperacional,
  });

  const gerarTextoHomologacao = (form) => {
    const tmpl = getTemplateAtivoPorTipo('Homologação de Atestado', 'ExOfficio', templates, {
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
    const texto = gerarTextoHomologacao({});
    if (texto === null) {
      alert("Template obrigatório não encontrado para 'Homologação de Atestado'. Entre em contato com o administrador.");
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
    const templateHomologacao = getTemplateAtivoPorTipo('Homologação de Atestado', 'ExOfficio', templatesAtualizados, {
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

  const handleSaveJiso = async () => {
    if (!jisoDate) return;
    if (savingJiso) return;
    if (!canAccessAction('registrar_decisao_jiso')) {
      alert('Ação negada: você não tem permissão para agendar/registrar JISO.');
      return;
    }
    setSavingJiso(true);
    try {
      await atualizarEscopado('Atestado', atestado.id, {
        data_jiso_agendada: jisoDate,
        ...((!atestado.status_jiso || atestado.status_jiso === 'Em análise') ? { status_jiso: 'Aguardando JISO' } : {})
      });
      try {
        await sincronizarAtestadoJisoNoQuadro({
          ...atestado,
          data_jiso_agendada: jisoDate,
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
      setEditingJiso(false);
    } catch (error) {
      if (error?.message?.includes('Rate limit')) {
        alert('Muitas requisições em sequência. Aguarde alguns segundos e tente novamente.');
      } else {
        alert(error?.message || 'Não foi possível salvar o agendamento da JISO.');
      }
    } finally {
      setSavingJiso(false);
    }
  };

  const statusInfo = getStatusInfo();
  const isFluxoJiso = atestado.fluxo_homologacao === 'jiso' || atestado.dias > 15;

  const getProgressPercent = () => {
    if (!atestado.data_inicio || !atestado.data_retorno) return 0;

    const inicio = new Date(`${atestado.data_inicio}T00:00:00`);
    const retorno = new Date(`${atestado.data_retorno}T00:00:00`);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const total = Math.max(differenceInDays(retorno, inicio), 1);
    const decorrido = Math.min(Math.max(differenceInDays(hoje, inicio), 0), total);

    return Math.round((decorrido / total) * 100);
  };

  const progressPercent = getProgressPercent();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-gray-200 shadow-md hover:shadow-lg transition-all duration-200 flex flex-col h-full overflow-hidden"
    >
      <div className="p-5 pb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="bg-slate-100 p-2.5 rounded-full flex items-center justify-center h-12 w-12 text-slate-600 flex-shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-gray-900 text-[17px] leading-tight mb-0.5 truncate">
                {atestado.militar_posto && `${atestado.militar_posto} `}
                {atestado.militar_nome}
              </h3>
              {(matriculaOperacional || atestado.militar_matricula) && (
                <p className="text-gray-500 text-sm flex items-center gap-1.5">
                  {atestado.militar_posto || 'Militar'} <span className="w-1 h-1 bg-gray-300 rounded-full" /> Mat: {matriculaOperacional || '—'}
                </p>
              )}
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

        <div className="flex flex-wrap gap-1.5 mb-5">
          <Badge className={`${statusColors[atestado.status] || statusColors['Ativo']} border`}>
            {atestado.status || 'Ativo'}
          </Badge>
          {atestado.tipo_afastamento && (
            <Badge className="bg-blue-100 text-blue-700">{atestado.tipo_afastamento}</Badge>
          )}
          {isFluxoJiso && (
            <Badge className={`flex items-center gap-1 ${
              atestado.status_jiso === 'Homologado pela JISO'
                ? 'bg-green-100 text-green-700'
                : 'bg-purple-100 text-purple-700'
            }`}>
              <Shield className="w-3 h-3" />
              {atestado.status_jiso === 'Homologado pela JISO' ? 'JISO Homologado' : 'Aguardando JISO'}
            </Badge>
          )}
          {isFluxoJiso && (
            <Badge className="bg-indigo-100 text-indigo-700 truncate max-w-full" title={statusDocumentalAtaJiso.texto}>
              {statusDocumentalAtaJiso.texto}
            </Badge>
          )}
          {atestado.status_jiso === 'Homologado pelo Comandante' && (
            <Badge className="bg-blue-100 text-blue-700 flex items-center gap-1">
              <Shield className="w-3 h-3" />
              Homologado Cmt
            </Badge>
          )}
          {atestado.acompanhado && (
            <Badge variant="outline" className="border-pink-200 text-pink-700">
              Acompanhamento
            </Badge>
          )}
        </div>

        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 mb-4">
          <div className="flex flex-wrap justify-between text-xs font-medium mb-2 gap-2">
            <span className="text-slate-500">Início: {formatDate(atestado.data_inicio)}</span>
            {statusInfo && (
              <span className={`px-2 py-0.5 rounded-full flex items-center gap-1 ${statusInfo.color} ${statusInfo.bgColor}`}>
                <statusInfo.icon className="w-3 h-3" /> {statusInfo.text}
              </span>
            )}
            <span className="text-slate-700">Retorno: {formatDate(atestado.data_retorno)}</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-1.5 mb-1">
            <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{atestado.dias || 0} dias de afastamento</span>
            {atestado.cid_10 && <span>CID-10: {atestado.cid_10}</span>}
          </div>
        </div>

        {isFluxoJiso && !atestado.data_jiso_agendada && !editingJiso && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2.5 mb-4">
            <AlertCircle size={18} className="text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-amber-900 font-semibold text-sm leading-tight mb-1">JISO não agendada</p>
              <p className="text-amber-700 text-xs">É necessário definir uma data para a junta.</p>
            </div>
            <button
              onClick={() => {
                setJisoDate(atestado.data_jiso_agendada || '');
                setEditingJiso(true);
              }}
              className="text-amber-700 font-bold text-xs uppercase hover:bg-amber-100 px-2 py-1 rounded transition-colors whitespace-nowrap"
            >
              Agendar
            </button>
          </div>
        )}

        {isFluxoJiso && (editingJiso || atestado.data_jiso_agendada) && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-purple-500 flex-shrink-0" />
              <span className="text-xs font-medium text-purple-700">JISO Agendada:</span>
            </div>
            {editingJiso ? (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={jisoDate}
                  onChange={e => setJisoDate(e.target.value)}
                  className="border border-slate-300 rounded px-2 py-1 text-xs flex-1"
                />
                <Button size="sm" className="h-7 px-2 text-xs bg-[#1e3a5f] hover:bg-[#2d4a6f]" onClick={handleSaveJiso} disabled={savingJiso}>
                  {savingJiso ? '...' : 'OK'}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setEditingJiso(false); setJisoDate(atestado.data_jiso_agendada || ''); }}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-700 font-medium">{formatDate(atestado.data_jiso_agendada)}</span>
                <button onClick={() => { setJisoDate(atestado.data_jiso_agendada || ''); setEditingJiso(true); }} className="text-slate-400 hover:text-[#1e3a5f]" title="Editar data JISO">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {(atestado.medico || atestado.crm_medico || atestado.observacoes) && (
          <div className="grid grid-cols-1 gap-2 text-sm">
            {atestado.medico && (
              <p className="text-slate-700"><span className="text-slate-500">Médico:</span> {atestado.medico}</p>
            )}
            {atestado.crm_medico && (
              <p className="text-slate-700"><span className="text-slate-500">CRM:</span> {atestado.crm_medico}</p>
            )}
            {atestado.observacoes && (
              <p className="text-slate-700 whitespace-pre-wrap"><span className="text-slate-500">Observações:</span> {atestado.observacoes}</p>
            )}
          </div>
        )}

        {showJisoModal && (
          <JisoHistoricoModal
            atestado={atestado}
            open={showJisoModal}
            onClose={() => setShowJisoModal(false)}
          />
        )}
      </div>

      <div className="bg-slate-50 p-4 border-t border-slate-200 mt-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-slate-600 text-xs font-medium">
          <ShieldCheck size={16} className="text-emerald-600" />
          {atestado.status_jiso === 'Homologado pela JISO' || atestado.status_jiso === 'Homologado pelo Comandante'
            ? 'Homologado'
            : 'Em análise'}
        </div>
        {isFluxoJiso && (
          <button
            onClick={() => setShowJisoModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 shadow-sm transition-all active:scale-95 text-sm"
          >
            Registrar Decisão
            <ChevronRight size={16} />
          </button>
        )}
      </div>

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

                <div className="space-y-2 rounded-lg border border-slate-200 p-4">
                  <h4 className="text-xs font-semibold tracking-wide text-slate-500">ANEXO DA ATA JISO</h4>
                  {(ataJisoForm.arquivo_ata_jiso || atestado.arquivo_ata_jiso) ? (
                    <div className="p-2 border border-slate-200 rounded-md bg-slate-50 space-y-2">
                      <p className="text-xs text-slate-600">
                        <span className="font-medium">Arquivo atual:</span>{' '}
                        <span className="break-all">
                          {arquivoAtaJisoNome || decodeURIComponent((ataJisoForm.arquivo_ata_jiso || atestado.arquivo_ata_jiso).split('/').pop()?.split('?')[0] || 'Arquivo anexado')}
                        </span>
                      </p>
                      <button
                        type="button"
                        className="text-xs text-blue-600 hover:underline"
                        onClick={() => window.open(ataJisoForm.arquivo_ata_jiso || atestado.arquivo_ata_jiso, '_blank')}
                      >
                        Visualizar arquivo atual
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">Nenhum arquivo anexado.</p>
                  )}

                  <Input
                    type="file"
                    onChange={handleAtaJisoFileUpload}
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                    disabled={uploadingAtaJiso}
                  />
                  <div className="flex flex-wrap gap-2">
                    {(ataJisoForm.arquivo_ata_jiso || atestado.arquivo_ata_jiso) && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleRemoveAtaJisoFile}
                      >
                        Remover
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {uploadingAtaJiso ? 'Enviando arquivo...' : 'Selecione um novo arquivo para substituir ou anexar.'}
                  </p>
                </div>
              </div>
              <div className="lg:col-span-7">
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-sm font-medium">Texto para Publicação</Label>
                  <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Gerado automaticamente
                  </span>
                </div>
                <textarea
                  value={homologacaoForm.texto_publicacao || ''}
                  onChange={(e) => setHomologacaoForm(p => ({ ...p, texto_publicacao: e.target.value }))}
                  className="w-full min-h-[300px] lg:min-h-[380px] rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                  placeholder="Nenhum texto gerado."
                />
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
                    <Label className="text-sm">NUP</Label>
                    <Input value={ataJisoForm.nup} onChange={e => { const v = e.target.value; setAtaJisoForm(p => { const np = {...p, nup: v}; return {...np, texto_publicacao: gerarTextoAtaJiso(np) || np.texto_publicacao}; }); }} className="mt-1.5" placeholder="31.001.005-12" />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-sm">Parecer</Label>
                    <Input value={ataJisoForm.parecer_jiso} onChange={e => { const v = e.target.value; setAtaJisoForm(p => { const np = {...p, parecer_jiso: v}; return {...np, texto_publicacao: gerarTextoAtaJiso(np) || np.texto_publicacao}; }); }} className="mt-1.5" placeholder="Apto" />
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
                      {ataJisoForm.texto_publicacao || 'Nenhum texto gerado.'}
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
