import React, { useState } from 'react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  FileText, 
  MoreVertical, 
  Pencil, 
  Trash2, 
  Eye,
  Clock,
  AlertCircle,
  CheckCircle,
  Shield,
  ShieldCheck,
  History,
  BookOpen,
  Save,
  ChevronRight,
  Download
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import JisoHistoricoModal from './JisoHistoricoModal';
import { createPageUrl } from '@/utils';
import { sincronizarAtestadoJisoNoQuadro } from '@/components/quadro/quadroHelpers';
import {
  calcStatusPublicacao,
  existePublicacaoAtivaParaAtestado,
  getStatusDocumentalAtaJiso,
  isPublicacaoAtestadoAtiva,
} from './atestadoPublicacaoHelpers';

const statusColors = {
  'Ativo': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Encerrado': 'bg-slate-100 text-slate-700 border-slate-200',
  'Cancelado': 'bg-red-100 text-red-700 border-red-200',
  'Prorrogado': 'bg-blue-100 text-blue-700 border-blue-200'
};

export default function AtestadoCard({ atestado, onEdit, onDelete, onView }) {
  const queryClient = useQueryClient();
  const [editingJiso, setEditingJiso] = useState(false);
  const [jisoDate, setJisoDate] = useState(atestado.data_jiso_agendada || '');
  const [savingJiso, setSavingJiso] = useState(false);
  const [showJisoModal, setShowJisoModal] = useState(false);
  const [showHomologacaoModal, setShowHomologacaoModal] = useState(false);
  const [showAtaJisoModal, setShowAtaJisoModal] = useState(false);
  const [savingPublicacao, setSavingPublicacao] = useState(false);

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
    nota_para_bg: '', numero_bg: '', data_bg: '',
    texto_publicacao: ''
  });

  const formatarDataExtenso = (d) => {
    if (!d) return '';
    const dt = new Date(d + 'T00:00:00');
    return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;
  };

  const diasExtensoMap = { 1:'um',2:'dois',3:'três',4:'quatro',5:'cinco',6:'seis',7:'sete',8:'oito',9:'nove',10:'dez',11:'onze',12:'doze',13:'treze',14:'quatorze',15:'quinze' };

  const gerarTextoHomologacao = (form) => {
    const posto = `${atestado.militar_posto || ''} QOBM`;
    return `O(A) Comandante do 1° Grupamento de Bombeiros Militar, no uso das atribuições que lhe confere o art. 49, II, do Decreto nº 5.698, de 21 de novembro de 1990, homologa o afastamento médico do ${posto} ${atestado.militar_nome}, matrícula ${atestado.militar_matricula}, pelo período de ${atestado.dias} (${diasExtensoMap[atestado.dias] || atestado.dias}) dias, ${(atestado.tipo_afastamento || '').toLowerCase()}, a contar de ${formatarDataExtenso(atestado.data_inicio)}, com término em ${formatarDataExtenso(atestado.data_termino)}. Em consequência: (1) Ao Chefe da B-1: proceder nos assentamentos do militar; (2) publique-se.`;
  };

  const gerarTextoAtaJiso = (form) => {
    const posto = `${atestado.militar_posto || ''} QOBM`;
    return `O(A) Comandante do 1° Grupamento de Bombeiros Militar, no uso das atribuições que lhe confere o art. 49, II, do Decreto nº 5.698, de 21 de novembro de 1990, resolve: tornar público que recebeu a Ata de Inspeção de Saúde Sessão Nº ${form.secao_jiso || '___'}, de ${formatarDataExtenso(form.data_ata)}, pertencente ao: ${posto} ${atestado.militar_nome}, matrícula ${atestado.militar_matricula}, inspecionado para fins de ${form.finalidade_jiso}, conf. NUP Nº ${form.nup || '___'}, com o parecer: ${form.parecer_jiso || '___'}.`;
  };

  const handleOpenHomologacao = () => {
    const texto = gerarTextoHomologacao({});
    setHomologacaoForm(prev => ({ ...prev, texto_publicacao: texto }));
    setShowHomologacaoModal(true);
  };

  const handleOpenAtaJiso = () => {
    const texto = gerarTextoAtaJiso(ataJisoForm);
    setAtaJisoForm(prev => ({ ...prev, texto_publicacao: texto }));
    setShowAtaJisoModal(true);
  };

  const handleSaveHomologacao = async () => {
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
    await base44.entities.PublicacaoExOfficio.create({
      tipo: 'Homologação de Atestado',
      militar_id: atestado.militar_id,
      militar_nome: atestado.militar_nome,
      militar_posto: atestado.militar_posto,
      militar_matricula: atestado.militar_matricula,
      data_publicacao: homologacaoForm.data_publicacao,
      atestado_homologado_id: atestado.id,
      texto_publicacao: homologacaoForm.texto_publicacao,
      nota_para_bg: homologacaoForm.nota_para_bg,
      numero_bg: homologacaoForm.numero_bg,
      data_bg: homologacaoForm.data_bg,
      status
    });
    await base44.entities.Atestado.update(atestado.id, {
      homologado_comandante: true,
      status_jiso: 'Homologado pelo Comandante',
      status_publicacao: status
    });
    queryClient.invalidateQueries({ queryKey: ['atestados'] });
    queryClient.invalidateQueries({ queryKey: ['publicacoes-ex-officio'] });
    setSavingPublicacao(false);
    setShowHomologacaoModal(false);
  };

  const handleSaveAtaJiso = async () => {
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
    await base44.entities.PublicacaoExOfficio.create({
      tipo: 'Ata JISO',
      militar_id: atestado.militar_id,
      militar_nome: atestado.militar_nome,
      militar_posto: atestado.militar_posto,
      militar_matricula: atestado.militar_matricula,
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
    });
    await base44.entities.Atestado.update(atestado.id, {
      status_jiso: 'Homologado pela JISO',
      status_publicacao: status
    });
    queryClient.invalidateQueries({ queryKey: ['atestados'] });
    queryClient.invalidateQueries({ queryKey: ['publicacoes-ex-officio'] });
    setSavingPublicacao(false);
    setShowAtaJisoModal(false);
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
    setSavingJiso(true);
    await base44.entities.Atestado.update(atestado.id, {
      data_jiso_agendada: jisoDate,
      status_jiso: 'Aguardando JISO'
    });
    await sincronizarAtestadoJisoNoQuadro({
      ...atestado,
      data_jiso_agendada: jisoDate,
    });
    queryClient.invalidateQueries({ queryKey: ['atestados'] });
    queryClient.invalidateQueries({ queryKey: ['atestados-dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['cards'] });
    setSavingJiso(false);
    setEditingJiso(false);
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
              {atestado.militar_matricula && (
                <p className="text-gray-500 text-sm flex items-center gap-1.5">
                  {atestado.militar_posto || 'Militar'} <span className="w-1 h-1 bg-gray-300 rounded-full" /> Mat: {atestado.militar_matricula}
                </p>
              )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 text-gray-400 hover:text-gray-600 -mr-2">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => onView(atestado)}>
                <Eye className="w-4 h-4 mr-2" />
                Visualizar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(atestado)}>
                <Pencil className="w-4 h-4 mr-2" />
                Editar
              </DropdownMenuItem>
              {atestado.arquivo_atestado && (
                <DropdownMenuItem onClick={() => window.open(atestado.arquivo_atestado, '_blank')}>
                  <Download className="w-4 h-4 mr-2 text-slate-600" />
                  Baixar atestado anexado
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {/* Fluxo exclusivo: mostrar apenas o botão do fluxo definido */}
              {/* dias <= 15 e fluxo = comandante (ou não definido e dias <= 15): mostrar homologação */}
              {atestado.fluxo_homologacao === 'comandante' && (
                <DropdownMenuItem onClick={handleOpenHomologacao} disabled={hasHomologacaoAtiva}>
                  <CheckCircle className="w-4 h-4 mr-2 text-emerald-600" />
                  {hasHomologacaoAtiva ? 'Homologação já gerada' : 'Publicar Homologação'}
                </DropdownMenuItem>
              )}
              {/* fluxo = jiso OU dias > 15: mostrar Ata JISO */}
              {(atestado.fluxo_homologacao === 'jiso' || (atestado.dias > 15)) && (
                <DropdownMenuItem
                  onClick={handleOpenAtaJiso}
                  disabled={statusDocumentalAtaJiso.bloqueiaNovaPublicacao}
                  title={statusDocumentalAtaJiso.bloqueiaNovaPublicacao ? 'Já existe uma nota/publicação ativa para esta Ata JISO.' : ''}
                >
                  <BookOpen className="w-4 h-4 mr-2 text-purple-600" />
                  {statusDocumentalAtaJiso.bloqueiaNovaPublicacao
                    ? 'Já existe uma nota/publicação ativa para esta Ata JISO.'
                    : 'Publicar ata JISO'}
                </DropdownMenuItem>
              )}
              {publicacoesVinculadas.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  {publicacoesVinculadas.filter(isPublicacaoAtestadoAtiva).map(p => (
                    <DropdownMenuItem key={p.id} onClick={() => window.open(createPageUrl('CadastrarPublicacao') + `?id=${p.id}`, '_blank')}>
                      <FileText className="w-4 h-4 mr-2 text-blue-500" />
                      <span className="truncate">{p.tipo} — {p.status}</span>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
              {(atestado.fluxo_homologacao === 'jiso' || atestado.dias > 15) && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowJisoModal(true)}>
                    <History className="w-4 h-4 mr-2" />
                    Registrar decisão JISO
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem onClick={() => onDelete(atestado)} className="text-red-600 focus:text-red-600">
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
            <Badge className="bg-indigo-100 text-indigo-700">
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

        {(atestado.medico || atestado.observacoes) && (
          <div className="grid grid-cols-1 gap-2 text-sm">
            {atestado.medico && (
              <p className="text-slate-700"><span className="text-slate-500">Médico:</span> {atestado.medico}</p>
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
        <button
          onClick={() => setShowJisoModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 shadow-sm transition-all active:scale-95 text-sm"
        >
          Registrar Decisão
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Modal Homologação pelo Comandante */}
      <Dialog open={showHomologacaoModal} onOpenChange={setShowHomologacaoModal}>
        <DialogContent className="max-w-2xl max-h-screen overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Homologação pelo Comandante</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              <strong>{atestado.militar_posto} {atestado.militar_nome}</strong> — {atestado.dias} dias — {formatarDataExtenso(atestado.data_inicio)} a {formatarDataExtenso(atestado.data_termino)}
            </div>
            <div>
              <Label className="text-sm font-medium">Data da Publicação</Label>
              <Input type="date" value={homologacaoForm.data_publicacao} onChange={e => setHomologacaoForm(p => ({ ...p, data_publicacao: e.target.value }))} className="mt-1.5" />
            </div>
            <div>
              <Label className="text-sm font-medium">Texto para Publicação</Label>
              <Textarea value={homologacaoForm.texto_publicacao} onChange={e => setHomologacaoForm(p => ({ ...p, texto_publicacao: e.target.value }))} className="mt-1.5" rows={5} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-sm">Nota para BG</Label><Input value={homologacaoForm.nota_para_bg} onChange={e => setHomologacaoForm(p => ({ ...p, nota_para_bg: e.target.value }))} className="mt-1.5" placeholder="001/2025" /></div>
              <div><Label className="text-sm">Número BG</Label><Input value={homologacaoForm.numero_bg} onChange={e => setHomologacaoForm(p => ({ ...p, numero_bg: e.target.value }))} className="mt-1.5" /></div>
              <div><Label className="text-sm">Data BG</Label><Input type="date" value={homologacaoForm.data_bg} onChange={e => setHomologacaoForm(p => ({ ...p, data_bg: e.target.value }))} className="mt-1.5" /></div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
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
        <DialogContent className="max-w-2xl max-h-screen overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ata JISO</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-800">
              <strong>{atestado.militar_posto} {atestado.militar_nome}</strong> — {atestado.dias} dias — JISO: {atestado.status_jiso || 'Aguardando'}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Data da Publicação</Label>
                <Input type="date" value={ataJisoForm.data_publicacao} onChange={e => setAtaJisoForm(p => ({ ...p, data_publicacao: e.target.value }))} className="mt-1.5" />
              </div>
              <div>
                <Label className="text-sm">Finalidade</Label>
                <select value={ataJisoForm.finalidade_jiso} onChange={e => { const v = e.target.value; setAtaJisoForm(p => { const np = {...p, finalidade_jiso: v}; return {...np, texto_publicacao: gerarTextoAtaJiso(np)}; }); }} className="mt-1.5 w-full border rounded-md px-3 py-2 text-sm">
                  {['V.A.F','LTS','Reserva Remunerada','Atestado de Origem'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Seção JISO</Label>
                <Input value={ataJisoForm.secao_jiso} onChange={e => { const v = e.target.value; setAtaJisoForm(p => { const np = {...p, secao_jiso: v}; return {...np, texto_publicacao: gerarTextoAtaJiso(np)}; }); }} className="mt-1.5" placeholder="62/JISO/2025" />
              </div>
              <div>
                <Label className="text-sm">Data da Ata</Label>
                <Input type="date" value={ataJisoForm.data_ata} onChange={e => { const v = e.target.value; setAtaJisoForm(p => { const np = {...p, data_ata: v}; return {...np, texto_publicacao: gerarTextoAtaJiso(np)}; }); }} className="mt-1.5" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">NUP</Label>
                <Input value={ataJisoForm.nup} onChange={e => { const v = e.target.value; setAtaJisoForm(p => { const np = {...p, nup: v}; return {...np, texto_publicacao: gerarTextoAtaJiso(np)}; }); }} className="mt-1.5" placeholder="31.001.005-12" />
              </div>
              <div>
                <Label className="text-sm">Parecer</Label>
                <Input value={ataJisoForm.parecer_jiso} onChange={e => { const v = e.target.value; setAtaJisoForm(p => { const np = {...p, parecer_jiso: v}; return {...np, texto_publicacao: gerarTextoAtaJiso(np)}; }); }} className="mt-1.5" placeholder="Apto" />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">Texto para Publicação</Label>
              <Textarea value={ataJisoForm.texto_publicacao} onChange={e => setAtaJisoForm(p => ({ ...p, texto_publicacao: e.target.value }))} className="mt-1.5" rows={5} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-sm">Nota para BG</Label><Input value={ataJisoForm.nota_para_bg} onChange={e => setAtaJisoForm(p => ({ ...p, nota_para_bg: e.target.value }))} className="mt-1.5" placeholder="001/2025" /></div>
              <div><Label className="text-sm">Número BG</Label><Input value={ataJisoForm.numero_bg} onChange={e => setAtaJisoForm(p => ({ ...p, numero_bg: e.target.value }))} className="mt-1.5" /></div>
              <div><Label className="text-sm">Data BG</Label><Input type="date" value={ataJisoForm.data_bg} onChange={e => setAtaJisoForm(p => ({ ...p, data_bg: e.target.value }))} className="mt-1.5" /></div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
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
