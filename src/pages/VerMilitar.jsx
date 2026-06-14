import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  ArrowLeft, Pencil, User, FileText,
  Phone, Heart, MapPin, GraduationCap, Calendar, Mail, CreditCard,
  Shield, Award, Send, Activity, AlertTriangle, Briefcase, ClipboardList, Clock, Plus, Trash2, RotateCcw, Archive } from
'lucide-react';
import { format } from 'date-fns';
import TempoServico from '@/components/militar/TempoServico';
import AlertasContrato from '@/components/militar/AlertasContrato';
import ContratosDesignacaoSection from '@/components/militar/ContratosDesignacaoSection';
import SolicitarAtualizacaoModal from '@/components/militar/SolicitarAtualizacaoModal';
import GerarDocumentoMilitarModal from '@/components/documentosMilitares/GerarDocumentoMilitarModal';
import PromocaoAtualModal from '@/components/antiguidade/PromocaoAtualModal';
import PromocaoHistoricaModal from '@/components/antiguidade/PromocaoHistoricaModal';
import PromocaoFuturaModal from '@/components/antiguidade/PromocaoFuturaModal';
import CarreiraAntiguidadePanel from '@/components/antiguidade/CarreiraAntiguidadePanel';
import ComportamentoTimeline from '@/components/militar/ComportamentoTimeline';
import HistoricoComportamentoChart from '@/components/militar/HistoricoComportamentoChart';
import MilitarTimelineTab from '@/components/militar/MilitarTimelineTab';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { calcularComportamento, calcularProximaMelhoria } from '@/utils/calcularComportamento';
import {
  criarChavePendenciaComportamento,
  obterHistoricoComportamentoMilitar } from
'@/services/justicaDisciplinaService';
import {
  filtrarRegistrosSistema,
  getMensagemRegistrosSistemaPerfilMilitar } from
'@/config/perfilMilitarRegistrosConfig';
import { enriquecerMilitarComMatriculas, isMilitarMesclado, montarIndiceMatriculas } from '@/services/matriculaMilitarViewService';
import { apurarMedalhaTempoServicoMilitar, normalizarStatusMedalha } from '@/services/medalhasTempoServicoService';
import { ACOES_MEDALHAS, adicionarAuditoriaMedalha, validarPermissaoAcaoMedalhas } from '@/services/medalhasAcessoService';
import { conferenciaMilitarService } from '@/services/conferenciaMilitarService';
import { useToast } from '@/components/ui/use-toast';
import {
  formatarTipoCreditoExtra } from
'@/services/creditoExtraFeriasService';
import { getSaldoConsolidadoPeriodo, isFeriasDoPeriodo } from '@/components/ferias/periodoSaldoUtils';
import { calcularStatusPeriodoAquisitivo } from '@/components/ferias/recalcularPeriodoAquisitivo';
import { criarEscopado, atualizarEscopado, excluirEscopado } from '@/services/cudEscopadoClient';
import { fetchScopedContratosDesignacaoMilitar } from '@/services/getScopedContratosDesignacaoMilitarClient';
import { getEffectiveEmail } from '@/services/getScopedMilitaresClient';
import { getPostoGraduacaoMilitar, getQuadroMilitar, getPostoGraduacaoOficial } from '@/utils/militarPostoGraduacao';
import { selecionarPromocaoAtualEAnteriores } from '@/utils/antiguidade/selecionarPromocaoAtual';
import InstitucionalMilitarBadge from '@/components/militar/InstitucionalMilitarBadge';
import CoberturaHistorica from '@/components/militar/CoberturaHistorica';
import { montarDecoracoesInstitucionaisPorMilitar, getDecoracaoInstitucionalMilitar } from '@/utils/funcoesTags/decoracaoInstitucionalMilitar';
import { buildFuncoesTagsScopeKey, funcoesTagsKeys } from '@/utils/funcoesTags/queryKeys';
import { montarMilitar360Bundle } from '@/services/militar360Service';
import { canShowArmamentosTab, canShowAtestadosTab } from '@/services/militarFichaTabsVisibility';
import {
  cadastrarDocumentoHistorico,
  listarAcervoMilitar,
  excluirDocumentoHistorico,
  restaurarDocumentoHistorico,
  listarLixeiraAcervo,
  arquivarDefinitivamenteAcervo,
  listarHistoricoVersoes
} from '@/services/acervoHistoricoService';
import { AcervoHistoricoError, criarMensagemErroAcervo, getOpcoesToastErroAcervo } from '@/services/acervoHistoricoErrors';

const STATUS_COLORS = { 'Ativo': 'bg-emerald-100 text-emerald-700', 'Inativo': 'bg-slate-100 text-slate-700' };
const MEDALHA_STATUS_COLORS = { 'Indicado': 'bg-yellow-100 text-yellow-700', 'Concedido': 'bg-green-100 text-green-700', 'Negado': 'bg-red-100 text-red-700' };
const ARM_STATUS_COLORS = { 'Ativo': 'bg-green-100 text-green-700', 'Vendido': 'bg-blue-100 text-blue-700', 'Extraviado': 'bg-orange-100 text-orange-700', 'Furtado': 'bg-red-100 text-red-700', 'Baixado': 'bg-slate-100 text-slate-700' };

const POSTOS_OFICIAIS = new Set(['coronel', 'tenente coronel', 'major', 'capitao', '1 tenente', '2 tenente', 'aspirante']);
const COMPORTAMENTO_LEVEL = {
  MAU: 1,
  INSUFICIENTE: 2,
  BOM: 3,
  ÓTIMO: 4,
  OTIMO: 4,
  EXCEPCIONAL: 5
};

const normalizarPosto = (valor) => String(valor || '').
normalize('NFD').
replace(/[\u0300-\u036f]/g, '').
replace(/[º°]/g, '').
replace(/[-_]/g, ' ').
replace(/\s+/g, ' ').
trim().
toLowerCase();

const isOficial = (postoGraduacao) => POSTOS_OFICIAIS.has(normalizarPosto(postoGraduacao));

const toChartLevel = (comportamento) => {
  if (!comportamento) return 3;
  return COMPORTAMENTO_LEVEL[String(comportamento).trim().toUpperCase()] || 3;
};

function InfoItem({ label, value, icon: Icon }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2">
      {Icon && <Icon className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />}
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-medium text-slate-700">{value}</p>
      </div>
    </div>);

}

function Section({ title, icon: Icon, children, className }) {
  return (
    <Card className={`shadow-sm ${className || ''}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2 text-[#1e3a5f]">
          {Icon && <Icon className="w-5 h-5" />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>);

}

function formatDate(date) {
  if (!date) return null;
  try {
    let d;
    if (date instanceof Date) {
      d = date;
    } else if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      d = new Date(date + 'T00:00:00');
    } else {
      d = new Date(date);
    }

    if (Number.isNaN(d.getTime())) return date;
    return format(d, "dd/MM/yyyy");
  } catch {
    return date;
  }
}

function AvisoRegistrosSistema({ mensagemRegistrosSistema }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-600">{mensagemRegistrosSistema}</p>
    </div>);

}

export default function VerMilitar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');
  const registrosLivro = [];
  const selectedTab = searchParams.get('tab') || 'comportamento';
  const { isAdmin, hasAccess, hasSelfAccess, canAccessModule, canAccessAction, userEmail, modoAcesso, linkedMilitarEmail, isLoading: loadingUser, isAccessResolved } = useCurrentUser();
  const podeGerirImpedimentosMedalha = canAccessAction(ACOES_MEDALHAS.IMPEDIMENTOS);
  const podeGerirAcervo = canAccessAction('gerir_acervo_historico');
  const podeBaixarAcervo = canAccessAction('baixar_acervo_historico');

  const effectiveEmail = getEffectiveEmail();
  const funcoesTagsScopeKey = React.useMemo(() => buildFuncoesTagsScopeKey({ effectiveEmail, userEmail, modoAcesso, linkedMilitarId: linkedMilitarEmail }), [effectiveEmail, userEmail, modoAcesso, linkedMilitarEmail]);
  const podeVisualizarContratosDesignacao = isAdmin || canAccessAction('visualizar_contratos_designacao') || canAccessAction('gerir_contratos_designacao');
  const podeCriarContratoDesignacao = isAdmin || canAccessAction('criar_contrato_designacao') || canAccessAction('gerir_contratos_designacao');
  const podeEditarContratoDesignacao = isAdmin || canAccessAction('editar_contrato_designacao') || canAccessAction('gerir_contratos_designacao');
  const podeEncerrarContratoDesignacao = isAdmin || canAccessAction('encerrar_contrato_designacao') || canAccessAction('gerir_contratos_designacao');
  const podeCancelarContratoDesignacao = isAdmin || canAccessAction('cancelar_contrato_designacao') || canAccessAction('gerir_contratos_designacao');
  const podeExcluirContratoDesignacao = isAdmin || canAccessAction('excluir_contrato_designacao');
  const [showSolicitacao, setShowSolicitacao] = useState(false);
  const [showGerarDocumento, setShowGerarDocumento] = useState(false);
  const [showPromocaoAtualModal, setShowPromocaoAtualModal] = useState(false);
  const [showPromocaoHistoricaModal, setShowPromocaoHistoricaModal] = useState(false);
  const [showPromocaoFuturaModal, setShowPromocaoFuturaModal] = useState(false);
  const [promocaoFuturaEdicao, setPromocaoFuturaEdicao] = useState(null);
  const [showNovoAcervoModal, setShowNovoAcervoModal] = useState(false);
  const [acervoForm, setAcervoForm] = useState({
    tipo_documento: 'ALTERACAO',
    titulo: '',
    periodo_inicial: '',
    periodo_final: '',
    data_documento: '',
    comportamento_certificado: 'BOM',
    observacoes: '',
    substituir_existente: false,
    substitui_documento_id: '',
    confirmar_sobreposicao: false,
    confirmar_duplicidade: false
  });
  const [acervoFiles, setAcervoFiles] = useState([]);
  const [docParaVersoes, setDocParaVersoes] = useState(null);
  const [impedimentoForm, setImpedimentoForm] = useState({
    data_inicio: new Date().toISOString().split('T')[0],
    data_fim: '',
    motivo: '',
    observacoes: ''
  });

  const { data: conferenciasAtivasMilitar = [] } = useQuery({
    queryKey: ['conferencias-militar', id],
    enabled: !!id && isAccessResolved && canAccessAction('perm_visualizar_conferencias_militares'),
    queryFn: () => conferenciaMilitarService.listarConferencias({
      militarId: id,
      status: { '$in': ['pendente', 'em_andamento', 'concluida_com_pendencias'] }
    }),
  });

  const { data: militar, isLoading } = useQuery({
    queryKey: ['militar', id],
    queryFn: async () => {const list = await base44.entities.Militar.filter({ id });return list[0] || null;},
    enabled: !!id && isAccessResolved
  });
  const { data: matriculasMilitar = [] } = useQuery({
    queryKey: ['militar-matriculas', id],
    queryFn: () => base44.entities.MatriculaMilitar.filter({ militar_id: id }, '-data_inicio'),
    enabled: !!id && isAccessResolved
  });
  const militarEnriquecido = React.useMemo(() => {
    if (!militar) return null;
    const indice = montarIndiceMatriculas(matriculasMilitar);
    return enriquecerMilitarComMatriculas(militar, indice);
  }, [militar, matriculasMilitar]);
  const militarMesclado = isMilitarMesclado(militarEnriquecido || militar);

  const contratosDesignacaoQueryKey = ['ver-contratos-designacao', id, isAdmin, modoAcesso, userEmail, effectiveEmail || null];
  const { data: contratosDesignacaoData = { contratos: [], meta: {} }, isLoading: isLoadingContratosDesignacao } = useQuery({
    queryKey: contratosDesignacaoQueryKey,
    queryFn: () => fetchScopedContratosDesignacaoMilitar({ militarId: id }),
    enabled: !!id && isAccessResolved && podeVisualizarContratosDesignacao,
  });
  const contratosDesignacaoMilitar = contratosDesignacaoData.contratos || [];

  const contratoDesignacaoMutation = useMutation({
    mutationFn: ({ id: contratoId, data, operation }) => {
      if (operation === 'create') return criarEscopado('ContratoDesignacaoMilitar', data);
      if (operation === 'delete') return excluirEscopado('ContratoDesignacaoMilitar', contratoId);
      return atualizarEscopado('ContratoDesignacaoMilitar', contratoId, data);
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: contratosDesignacaoQueryKey });
      queryClient.invalidateQueries({ queryKey: ['ver-contratos-designacao', id] });
      if (variables?.operation !== 'create') {
        toast({ title: variables?.operation === 'delete' ? 'Contrato de designação excluído com sucesso.' : 'Contrato de designação atualizado com sucesso.' });
      }
    },
    onError: (error) => {
      toast({ title: 'Erro ao salvar contrato de designação', description: error?.message || 'Tente novamente.', variant: 'destructive' });
    },
  });
  const { data: militarDestinoMerge } = useQuery({
    queryKey: ['militar-merge-destino', militar?.merged_into_id],
    queryFn: async () => {
      const list = await base44.entities.Militar.filter({ id: militar.merged_into_id });
      return list[0] || null;
    },
    enabled: Boolean(militar?.merged_into_id)
  });

  const postoGraduacaoMilitar = getPostoGraduacaoOficial(militar);
  const canViewMilitar = militar ? hasAccess(militar) || hasSelfAccess(militar) : false;
  const comportamentoElegivel = militar ? !isOficial(postoGraduacaoMilitar) : false;

  const { data: ferias = [] } = useQuery({
    queryKey: ['ver-ferias', id],
    queryFn: () => base44.entities.Ferias.filter({ militar_id: id }, '-data_inicio'),
    enabled: !!id && isAccessResolved && canViewMilitar
  });

  const { data: atestados = [], isLoading: isLoadingAtestados } = useQuery({
    queryKey: ['ver-atestados', id],
    queryFn: () => base44.entities.Atestado.filter({ militar_id: id }, '-data_inicio'),
    enabled: !!id && isAccessResolved && canViewMilitar
  });

  const { data: medalhas = [] } = useQuery({
    queryKey: ['ver-medalhas', id],
    queryFn: () => base44.entities.Medalha.filter({ militar_id: id }, '-data_indicacao'),
    enabled: !!id && isAccessResolved && canViewMilitar
  });
  const { data: tiposMedalha = [] } = useQuery({
    queryKey: ['ver-tipos-medalha'],
    queryFn: () => base44.entities.TipoMedalha.list('nome'),
    enabled: !!id && isAccessResolved && canViewMilitar
  });
  const { data: impedimentosMedalha = [] } = useQuery({
    queryKey: ['ver-impedimentos-medalha', id],
    queryFn: () => base44.entities.ImpedimentoMedalha.filter({ militar_id: id }, '-created_date'),
    enabled: !!id && isAccessResolved && canViewMilitar
  });

  const { data: armamentos = [], isLoading: isLoadingArmamentos } = useQuery({
    queryKey: ['ver-armamentos', id],
    queryFn: () => base44.entities.Armamento.filter({ militar_id: id }),
    enabled: !!id && isAccessResolved && canViewMilitar
  });
  const { data: historicoPromocoes = [], refetch: refetchHistoricoPromocoes } = useQuery({
    queryKey: ['ver-historico-promocoes', id],
    queryFn: () => base44.entities.HistoricoPromocaoMilitarV2.filter({ militar_id: id }, '-data_promocao'),
    enabled: !!id && isAccessResolved && canViewMilitar
  });
  const selecaoPromocao = React.useMemo(() => selecionarPromocaoAtualEAnteriores({
    historicoPromocoes,
    militar,
  }), [historicoPromocoes, militar]);
  const postoPromocaoAtual = String(selecaoPromocao?.promocaoAtual?.posto_graduacao || '').trim();
  const existeDivergenciaPostoAtivo = Boolean(
    postoPromocaoAtual &&
    postoGraduacaoMilitar &&
    postoPromocaoAtual !== postoGraduacaoMilitar
  );


  const { data: decoracaoInstitucionalMilitar = null } = useQuery({
    queryKey: funcoesTagsKeys.militarFuncaoInstitucional(funcoesTagsScopeKey, militar?.id),
    queryFn: async () => {
      const [funcoesInstitucionais, vinculosAtivos] = await Promise.all([
        base44.entities.FuncaoMilitar.filter({ ativa: true }, 'prioridade_lista'),
        base44.entities.MilitarFuncao.filter({ militar_id: militar.id, status: 'ativa' }, '-created_date'),
      ]);
      const mapa = montarDecoracoesInstitucionaisPorMilitar({
        militares: [militar],
        funcoesInstitucionais,
        vinculosAtivos,
      });
      return getDecoracaoInstitucionalMilitar(mapa, militar.id);
    },
    enabled: Boolean(militar?.id && isAccessResolved && canViewMilitar),
  });

  const { data: periodos = [] } = useQuery({
    queryKey: ['ver-periodos', id],
    queryFn: () => base44.entities.PeriodoAquisitivo.filter({ militar_id: id }, '-inicio_aquisitivo'),
    enabled: !!id && isAccessResolved && canViewMilitar
  });
  const { data: creditosExtraFerias = [] } = useQuery({
    queryKey: ['ver-creditos-extra-ferias', id],
    queryFn: () => base44.entities.CreditoExtraFerias.filter({ militar_id: id }, '-data_referencia'),
    enabled: !!id && isAccessResolved && canViewMilitar
  });
  const { data: historicoComportamento = [] } = useQuery({
    queryKey: ['ver-historico-comportamento', id],
    queryFn: async () => {
      const militarIdHistorico = militar?.id || id;
      const historico = await obterHistoricoComportamentoMilitar(militarIdHistorico);
      return historico;
    },
    enabled: !!id && isAccessResolved && canViewMilitar && comportamentoElegivel
  });

  const { data: punicoes = [] } = useQuery({
    queryKey: ['ver-punicoes-comportamento', id],
    queryFn: () => base44.entities.PunicaoDisciplinar.filter({ militar_id: id }, '-data_inicio_cumprimento'),
    enabled: !!id && isAccessResolved && canViewMilitar && comportamentoElegivel
  });

  const { data: acervoHistorico = [] } = useQuery({
    queryKey: ['ver-acervo-historico', id],
    queryFn: () => listarAcervoMilitar(id),
    enabled: !!id && isAccessResolved && canViewMilitar
  });

  const { data: lixeiraAcervo = [] } = useQuery({
    queryKey: ['ver-lixeira-acervo', id],
    queryFn: () => listarLixeiraAcervo(id),
    enabled: !!id && isAccessResolved && canViewMilitar && podeGerirAcervo
  });

  const { data: historicoVersoes = [] } = useQuery({
    queryKey: ['ver-historico-versoes', docParaVersoes?.id],
    queryFn: () => listarHistoricoVersoes(docParaVersoes?.id),
    enabled: !!docParaVersoes?.id
  });

  const { data: pendenciasComportamento = [] } = useQuery({
    queryKey: ['ver-pendencias-comportamento', id],
    queryFn: () => base44.entities.PendenciaComportamento.filter({ militar_id: id, status_pendencia: 'Pendente' }),
    enabled: !!id && isAccessResolved && canViewMilitar && comportamentoElegivel
  });

  const pendenciasComportamentoUnicas = React.useMemo(() => {
    const unicas = [];
    const chaves = new Set();
    for (const pendencia of pendenciasComportamento) {
      const chave = criarChavePendenciaComportamento(pendencia);
      if (chaves.has(chave)) continue;
      chaves.add(chave);
      unicas.push(pendencia);
    }
    return unicas;
  }, [pendenciasComportamento]);

  const feriasSistema = React.useMemo(() => filtrarRegistrosSistema(ferias), [ferias]);
  const atestadosSistema = React.useMemo(() => filtrarRegistrosSistema(atestados), [atestados]);
  const medalhasSistema = React.useMemo(() => filtrarRegistrosSistema(medalhas), [medalhas]);
  const medalhasConcedidasSistema = React.useMemo(
    () => medalhasSistema.filter((medalha) => normalizarStatusMedalha(medalha.status) === 'CONCEDIDA'),
    [medalhasSistema]
  );
  const apuracaoTempoServico = React.useMemo(() => apurarMedalhaTempoServicoMilitar({
    militar,
    medalhas: medalhasSistema,
    tiposMedalha
  }), [medalhasSistema, militar, tiposMedalha]);
  const impedimentoAtivoGeral = React.useMemo(
    () => impedimentosMedalha.find((item) => item.ativo !== false && !item.tipo_medalha_codigo && !item.tipo_medalha_id),
    [impedimentosMedalha]
  );

  const criarImpedimentoMutation = useMutation({
    mutationFn: async () => {
      validarPermissaoAcaoMedalhas({ canAccessAction, acao: ACOES_MEDALHAS.IMPEDIMENTOS, mensagem: 'Sem permissão para gerir impedimentos de medalha.' });
      return base44.entities.ImpedimentoMedalha.create(adicionarAuditoriaMedalha({
        militar_id: id,
        ativo: true,
        data_inicio: impedimentoForm.data_inicio || new Date().toISOString().split('T')[0],
        data_fim: impedimentoForm.data_fim || '',
        motivo: impedimentoForm.motivo,
        observacoes: impedimentoForm.observacoes,
        tipo_medalha_codigo: '',
        tipo_medalha_id: ''
      }, { userEmail }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ver-impedimentos-medalha', id] });
      queryClient.invalidateQueries({ queryKey: ['apuracao-medalhas-impedimentos'] });
      toast({ title: 'Impedimento geral ativado para medalhas' });
      setImpedimentoForm((atual) => ({ ...atual, motivo: '', observacoes: '' }));
    }
  });

  const removerImpedimentoMutation = useMutation({
    mutationFn: async (impedimentoId) => {
      validarPermissaoAcaoMedalhas({ canAccessAction, acao: ACOES_MEDALHAS.IMPEDIMENTOS, mensagem: 'Sem permissão para gerir impedimentos de medalha.' });
      return base44.entities.ImpedimentoMedalha.update(impedimentoId, adicionarAuditoriaMedalha({
        ativo: false,
        data_fim: new Date().toISOString().split('T')[0]
      }, { userEmail }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ver-impedimentos-medalha', id] });
      queryClient.invalidateQueries({ queryKey: ['apuracao-medalhas-impedimentos'] });
      toast({ title: 'Impedimento removido' });
    }
  });

  const salvarAcervoMutation = useMutation({
    mutationFn: async () => {
      if (acervoFiles.length === 0) throw new Error('PDF obrigatório.');

      const results = [];
      for (const file of acervoFiles) {
        // Detecção de sobreposição de períodos para ALTERACAO
        if (acervoForm.tipo_documento === 'ALTERACAO' && !acervoForm.confirmar_sobreposicao) {
          const sobrepostos = acervoHistorico.filter(a =>
            a.tipo_documento === 'ALTERACAO' &&
            a.periodo_inicial <= acervoForm.periodo_final &&
            a.periodo_final >= acervoForm.periodo_inicial
          );
          if (sobrepostos.length > 0) {
            const titulos = sobrepostos.map(s => s.titulo).join(', ');
            if (!confirm(`Aviso de sobreposição: Este período conflita com os documentos: ${titulos}. Deseja continuar mesmo assim?`)) {
              throw new Error('Operação cancelada pelo usuário devido à sobreposição de períodos.');
            }
            setAcervoForm(prev => ({ ...prev, confirmar_sobreposicao: true }));
          }
        }

        // Converter arquivo para base64 para o backend
        const reader = new FileReader();
        const content = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        try {
          const res = await cadastrarDocumentoHistorico({
            militar_id: id,
            tipo_documento: acervoForm.tipo_documento,
            data: {
              ...acervoForm,
              titulo: acervoFiles.length > 1 ? `${acervoForm.titulo || 'Doc'} - ${file.name}` : acervoForm.titulo
            },
            file: {
              name: file.name,
              type: file.type,
              content
            }
          });
          results.push(res);
        } catch (err) {
          if (err.status === 409 && err.code === 'ARQUIVO_DUPLICADO') {
            throw new AcervoHistoricoError(criarMensagemErroAcervo(err), {
              status: err.status,
              code: err.code,
              documento_existente: err.documento_existente,
              data: err.data
            });
          }
          if (err.status === 409) {
            throw new Error(criarMensagemErroAcervo(err));
          }
          throw err;
        }
      }
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ver-acervo-historico', id] });
      toast({ title: 'Documento(s) salvo(s) com sucesso!' });
      setShowNovoAcervoModal(false);
      setAcervoFiles([]);
      setAcervoForm({
        tipo_documento: 'ALTERACAO',
        titulo: '',
        periodo_inicial: '',
        periodo_final: '',
        data_documento: '',
        comportamento_certificado: 'BOM',
        observacoes: '',
        substituir_existente: false,
        substitui_documento_id: '',
        confirmar_sobreposicao: false,
        confirmar_duplicidade: false
      });
    },
    onError: (err) => {
      const description = criarMensagemErroAcervo(err);
      toast({
        title: 'Erro ao salvar documento(s)',
        description,
        variant: 'destructive',
        ...getOpcoesToastErroAcervo(err)
      });
    }
  });

  const excluirAcervoMutation = useMutation({
    mutationFn: (docId) => excluirDocumentoHistorico(docId, userEmail),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ver-acervo-historico', id] });
      queryClient.invalidateQueries({ queryKey: ['ver-lixeira-acervo', id] });
      toast({ title: 'Documento movido para a lixeira.' });
    }
  });

  const restaurarAcervoMutation = useMutation({
    mutationFn: (docId) => restaurarDocumentoHistorico(docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ver-acervo-historico', id] });
      queryClient.invalidateQueries({ queryKey: ['ver-lixeira-acervo', id] });
      toast({ title: 'Documento restaurado.' });
    }
  });

  const arquivarAcervoMutation = useMutation({
    mutationFn: (docId) => arquivarDefinitivamenteAcervo(docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ver-lixeira-acervo', id] });
      toast({ title: 'Documento arquivado definitivamente.' });
    }
  });
  const armamentosSistema = React.useMemo(() => filtrarRegistrosSistema(armamentos), [armamentos]);
  const periodosSistema = React.useMemo(() => filtrarRegistrosSistema(periodos), [periodos]);
  const periodosFeriasResumo = React.useMemo(() => {
    return periodosSistema
      .filter((periodo) => periodo.status !== 'Inativo')
      .map((periodo) => {
        const feriasRelacionadas = feriasSistema.filter((f) =>
          isFeriasDoPeriodo(f, periodo)
        );
        const saldo = getSaldoConsolidadoPeriodo({ periodo, ferias: feriasRelacionadas });
        const statusRecalculado = calcularStatusPeriodoAquisitivo({
          periodo,
          dias_previstos: saldo.dias_previstos,
          dias_gozados: saldo.dias_gozados,
          dias_saldo: saldo.dias_saldo,
        });
        return { periodo, feriasRelacionadas, saldo, statusRecalculado };
      });
  }, [periodosSistema, feriasSistema]);
  const creditosExtraPorPeriodo = React.useMemo(() => {
    const gozoById = new Map(feriasSistema.map((item) => [item.id, item]));
    const mapa = new Map();

    creditosExtraFerias.forEach((credito) => {
      if (!credito?.gozo_ferias_id) return;
      const gozo = gozoById.get(credito.gozo_ferias_id);
      if (!gozo) return;
      const chave = gozo.periodo_aquisitivo_id || gozo.periodo_aquisitivo_ref;
      if (!chave) return;
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave).push(credito);
    });

    return mapa;
  }, [creditosExtraFerias, feriasSistema]);
  const historicoComportamentoSistema = React.useMemo(() => filtrarRegistrosSistema(historicoComportamento), [historicoComportamento]);
  const punicoesSistema = React.useMemo(() => filtrarRegistrosSistema(punicoes), [punicoes]);
  const pendenciasComportamentoSistema = React.useMemo(
    () => filtrarRegistrosSistema(pendenciasComportamentoUnicas),
    [pendenciasComportamentoUnicas]
  );
  const mensagemRegistrosSistema = React.useMemo(() => getMensagemRegistrosSistemaPerfilMilitar(), []);

  const avaliacaoComportamento = React.useMemo(() => {
    if (!militar) return null;
    return calcularComportamento(punicoesSistema, militar.posto_graduacao, new Date(), {
      dataInclusaoMilitar: militar.data_inclusao
    });
  }, [militar, punicoesSistema]);

  const proximaMelhoria = React.useMemo(() => {
    if (!militar) return null;
    return calcularProximaMelhoria(punicoesSistema, militar.posto_graduacao, new Date(), {
      dataInclusaoMilitar: militar.data_inclusao
    });
  }, [militar, punicoesSistema]);

  const conferenciaAbertaPrincipal = React.useMemo(() => {
    return conferenciasAtivasMilitar.find(c => ['em_andamento', 'pendente'].includes(c.status)) || conferenciasAtivasMilitar[0];
  }, [conferenciasAtivasMilitar]);

  const ultimaPunicaoPorMilitar = React.useMemo(() => {
    const ultima = punicoesSistema[0];
    if (!ultima) return null;
    return {
      tipo: ultima.tipo_punicao || ultima.tipo || 'Punição disciplinar',
      data: ultima.data_inicio_cumprimento || ultima.data_inicio || ultima.created_date || ''
    };
  }, [punicoesSistema]);

  const historicoChartData = React.useMemo(() => historicoComportamentoSistema.map((evento) => {
    const dataAlteracao = String(evento?.data_alteracao || '').slice(0, 10);
    const year = Number(dataAlteracao.slice(0, 4));

    return {
      year,
      level: toChartLevel(evento?.comportamento_novo),
      desc: evento?.motivo_mudanca || evento?.motivo_mudanca_resolvido || evento?.observacoes || 'Alteração de comportamento registrada.'
    };
  }).filter((item) => Number.isFinite(item.year)), [historicoComportamentoSistema]);

  const tabsConfig = React.useMemo(() => {
    if (!militar) return [];

    const certidoesHistoricas = (acervoHistorico || []).filter(a => a.tipo_documento === 'CERTIDAO_COMPORTAMENTO');

    const configs = [
      {
        key: 'comportamento',
        label: 'Comportamento',
        icon: Activity,
        visible: comportamentoElegivel,
        content: (
          <div className="space-y-6">
            <AvisoRegistrosSistema mensagemRegistrosSistema={mensagemRegistrosSistema} />

            {certidoesHistoricas.length > 0 && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                <p className="font-semibold flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Existem certidões históricas de comportamento vinculadas a este militar para validação manual.
                </p>
                <ul className="mt-2 space-y-1">
                  {certidoesHistoricas.map(cert => (
                    <li key={cert.id} className="flex items-center justify-between">
                      <span>{formatDate(cert.data_documento)} — {cert.comportamento_certificado}</span>
                      {podeBaixarAcervo && cert.arquivo_url && <Button variant="link" size="sm" onClick={() => window.open(cert.arquivo_url, '_blank')}>Abrir</Button>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Section title="Situação Atual do Comportamento" icon={Activity}>
              <div className="grid md:grid-cols-3 gap-3 text-sm">
                <div className="rounded-lg border p-3">
                  <p className="text-slate-500">Atual</p>
                  <p className="font-semibold">{militar.comportamento || '—'}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-slate-500">Calculado</p>
                  <p className="font-semibold">{avaliacaoComportamento?.comportamento || '—'}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-slate-500">Próxima melhoria</p>
                  <p className="font-semibold">
                    {avaliacaoComportamento?.inconsistente_para_calculo ?
                  'Bloqueada por inconsistência' :
                  proximaMelhoria?.data ? `${proximaMelhoria.data} (${proximaMelhoria.comportamento_futuro})` : '—'}
                  </p>
                </div>
              </div>
              {avaliacaoComportamento?.inconsistente_para_calculo &&
            <p className="mt-3 text-xs text-red-600">
                  Não foi possível calcular comportamento: {(avaliacaoComportamento?.inconsistencias || []).map((item) => item.labelCampo).join(', ')}.
                </p>
            }
              {avaliacaoComportamento?.fundamento &&
            <p className="mt-3 text-xs text-slate-600">{avaliacaoComportamento.fundamento}</p>
            }
            </Section>

            <Section title="Pendências de Comportamento" icon={AlertTriangle}>
              {pendenciasComportamentoSistema.length === 0 ?
            <p className="text-sm text-slate-500">Sem pendências de comportamento no momento.</p> :

            <div className="space-y-3">
                  {pendenciasComportamentoSistema.map((pendencia) =>
              <div key={pendencia.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-sm font-semibold text-amber-900">
                        {pendencia.comportamento_atual || militar.comportamento || '—'} → {pendencia.comportamento_sugerido || avaliacaoComportamento?.comportamento || militar.comportamento || '—'}
                      </p>
                      <p className="text-xs text-amber-800 mt-1">
                        {ultimaPunicaoPorMilitar ?
                  `Última punição: ${ultimaPunicaoPorMilitar.tipo} (${formatDate(ultimaPunicaoPorMilitar.data) || ultimaPunicaoPorMilitar.data})` :
                  'Sem punições registradas'}
                      </p>
                    </div>
              )}
                </div>
            }
            </Section>

            <Section title="Linha do Tempo do Comportamento">
              <div className="flex flex-col gap-4">
                <HistoricoComportamentoChart
                data={historicoChartData}
                title="Evolução anual do comportamento"
                height={220} />

                <ComportamentoTimeline eventos={historicoComportamentoSistema} />
              </div>
            </Section>

            <Section title="Informações Disciplinares Relacionadas" icon={Shield}>
              {punicoesSistema.length === 0 ?
            <p className="text-sm text-slate-500">Nenhuma punição disciplinar cadastrada.</p> :

            <div className="space-y-2">
                  {punicoesSistema.slice(0, 5).map((punicao) =>
              <div key={punicao.id} className="rounded-lg border border-slate-200 p-3">
                      <p className="text-sm font-medium text-slate-800">{punicao.tipo_punicao || punicao.tipo || 'Punição'}</p>
                      <p className="text-xs text-slate-500">
                        Início: {formatDate(punicao.data_inicio_cumprimento || punicao.data_inicio)} ·
                        Término: {formatDate(punicao.data_fim_cumprimento || punicao.data_termino)}
                      </p>
                    </div>
              )}
                </div>
            }
            </Section>
          </div>
        )
      },
      {
        key: 'dados',
        label: 'Dados Pessoais',
        icon: User,
        visible: true,
        content: (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Section title="Dados Funcionais" icon={Briefcase}>
                <div className="grid grid-cols-2 gap-x-4">
                  <InfoItem label="Nome de Guerra" value={militar.nome_guerra} />
                  <InfoItem label="Matrícula atual" value={militarEnriquecido?.matricula_atual || militar.matricula} />
                  <InfoItem label="Posto/Graduação" value={getPostoGraduacaoMilitar(militar)} />
                  <InfoItem label="Quadro" value={getQuadroMilitar(militar)} />
                  <InfoItem label="Situação" value={militar.situacao_militar} />
                  <InfoItem label="Condição" value={militar.condicao} />
                  <InfoItem label="Data de Inclusão" value={formatDate(militar.data_inclusao)} icon={Calendar} />
                  {militar.destino && <InfoItem label="Destino/Cedência" value={militar.destino} />}
                </div>
                {!!militarEnriquecido?.matriculas_historico?.length &&
                <div className="mt-3 space-y-2">
                    <p className="text-xs text-slate-500">Histórico de matrículas</p>
                    {militarEnriquecido.matriculas_historico.map((mat) =>
                  <div key={mat.id || `${mat.matricula}-${mat.data_inicio}`} className={`rounded-md border px-3 py-2 text-xs ${mat.is_atual ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                        <p className="font-semibold text-slate-700">{mat.matricula_formatada || mat.matricula} {mat.is_atual ? '(Atual)' : ''}</p>
                        <p className="text-slate-500">
                          Tipo: {mat.tipo_matricula || '—'} • Situação: {mat.situacao || '—'} • Início: {formatDate(mat.data_inicio) || '—'} • Fim: {formatDate(mat.data_fim) || '—'}
                        </p>
                      </div>
                  )}
                  </div>
                }
              </Section>
              <Section title="Dados Pessoais" icon={User}>
                <div className="grid grid-cols-2 gap-x-4">
                  <InfoItem label="Data de Nascimento" value={formatDate(militar.data_nascimento)} icon={Calendar} />
                  <InfoItem label="Sexo" value={militar.sexo} />
                  <InfoItem label="Estado Civil" value={militar.estado_civil} />
                  <InfoItem label="Tipo Sanguíneo" value={militar.tipo_sanguineo} />
                  <InfoItem label="Religião" value={militar.religiao} />
                  <InfoItem label="Escolaridade" value={militar.escolaridade} />
                  <InfoItem label="Naturalidade" value={militar.naturalidade} />
                  <InfoItem label="UF Naturalidade" value={militar.naturalidade_uf} />
                </div>
              </Section>
            <Section title="Filiação" icon={Heart}>
              <div className="grid grid-cols-2 gap-x-4">
                <InfoItem label="Nome do Pai" value={militar.nome_pai} />
                <InfoItem label="Nome da Mãe" value={militar.nome_mae} />
              </div>
            </Section>
            <Section title="Documentos" icon={FileText}>
              <div className="grid grid-cols-2 gap-x-4">
                <InfoItem label="CPF" value={militar.cpf} />
                <InfoItem label="RG" value={militar.rg} />
                <InfoItem label="Órgão Expedidor" value={militar.orgao_expedidor_rg} />
                <InfoItem label="UF RG" value={militar.uf_rg} />
                <InfoItem label="CNH Categoria" value={militar.cnh_categoria} />
                <InfoItem label="Validade CNH" value={formatDate(militar.cnh_validade)} icon={Calendar} />
              </div>
            </Section>
            <Section title="Contatos" icon={Phone}>
              <div className="grid grid-cols-2 gap-x-4">
                <InfoItem label="Telefone" value={militar.telefone} icon={Phone} />
                <InfoItem label="Email Particular" value={militar.email_particular} icon={Mail} />
                <InfoItem label="Email Funcional" value={militar.email_funcional} icon={Mail} />
              </div>
            </Section>
            <Section title="Dados Bancários" icon={CreditCard}>
              <div className="grid grid-cols-3 gap-x-4">
                <InfoItem label="Banco" value={militar.banco} />
                <InfoItem label="Agência" value={militar.agencia} />
                <InfoItem label="Conta" value={militar.conta} />
              </div>
            </Section>
            <Section title="Endereço" icon={MapPin}>
              <div className="grid grid-cols-2 gap-x-4">
                <InfoItem label="Endereço" value={militar.logradouro ? `${militar.logradouro}, ${militar.numero_endereco || 'S/N'}` : null} icon={MapPin} />
                <InfoItem label="Bairro" value={militar.bairro} />
                <InfoItem label="CEP" value={militar.cep} />
                <InfoItem label="Cidade/UF" value={militar.cidade ? `${militar.cidade}/${militar.uf}` : null} />
              </div>
            </Section>
            {militar.habilidades?.length > 0 &&
              <Section title="Habilidades" icon={GraduationCap}>
                <div className="flex flex-wrap gap-2">
                  {militar.habilidades.map((h, i) =>
                  <Badge key={i} className="bg-[#1e3a5f]/10 text-[#1e3a5f]">{h}</Badge>
                  )}
                </div>
              </Section>
              }
            </div>
          </div>
        )
      },
      {
        key: 'ferias',
        label: 'Férias',
        icon: Calendar,
        visible: true,
        content: (
          <div className="space-y-4">
            <AvisoRegistrosSistema mensagemRegistrosSistema={mensagemRegistrosSistema} />
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-slate-700">Períodos Aquisitivos e Férias</h3>
            </div>
            {periodosSistema.length === 0 && feriasSistema.length === 0 ?
            <div className="bg-white rounded-xl p-8 text-center border border-slate-200">
                <Calendar className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500">Nenhum registro de férias</p>
                <p className="text-xs text-slate-400 mt-2">{mensagemRegistrosSistema}</p>
              </div> :

            <>
                {periodosFeriasResumo.map(({ periodo: p, feriasRelacionadas, saldo, statusRecalculado }) =>
              <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-slate-800">{p.ano_referencia}</span>
                      <Badge className={statusRecalculado === 'Gozado' ? 'bg-green-100 text-green-700' : statusRecalculado === 'Vencido' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}>
                        {statusRecalculado}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500">
                      {formatDate(p.inicio_aquisitivo)} a {formatDate(p.fim_aquisitivo)} · Limite: {formatDate(p.data_limite_gozo)} · {saldo.dias_gozados || 0}/{p.dias_direito || 30} dias gozados
                    </p>
                    {feriasRelacionadas.map((f) =>
                <div key={f.id} className="mt-2 ml-4 p-2 bg-slate-50 rounded-lg text-xs">
                        <span className="font-medium">Fração: {f.dias} dias</span> — {formatDate(f.data_inicio)} a {formatDate(f.data_fim)}
                        {f.fracionamento && <span className="text-slate-500 ml-2">({f.fracionamento})</span>}
                        <Badge className="ml-2 text-xs" variant="outline">{f.status}</Badge>
                      </div>
                )}
                    {(creditosExtraPorPeriodo.get(p.id) || creditosExtraPorPeriodo.get(p.ano_referencia) || []).map((credito) => (
                      <div key={credito.id} className="mt-2 ml-4 p-2 bg-blue-50 rounded-lg text-xs border border-blue-100">
                        <span className="font-medium">Crédito extra: {Number(credito.quantidade_dias || 0)} dias</span>
                        <span className="text-slate-600"> — {formatarTipoCreditoExtra(credito.tipo_credito)}</span>
                      </div>
                    ))}
                  </div>
              )}
              </>
            }
          </div>
        )
      },
      {
        key: 'atestados',
        label: 'Atestados',
        icon: FileText,
        visible: canShowAtestadosTab({
          atestados: atestadosSistema,
          isLoadingAtestados,
          canAccessModule,
          canAccessAction,
        }),
        content: (
          <div className="space-y-3">
            <AvisoRegistrosSistema mensagemRegistrosSistema={mensagemRegistrosSistema} />
            {atestadosSistema.length === 0 ?
            <div className="bg-white rounded-xl p-8 text-center border border-slate-200">
                <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500">Nenhum atestado registrado</p>
                <p className="text-xs text-slate-400 mt-2">{mensagemRegistrosSistema}</p>
              </div> :
            atestadosSistema.map((a) =>
            <div key={a.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-slate-800">{a.tipo_afastamento}</span>
                    {a.cid_10 && <span className="text-xs text-slate-500 ml-2">CID: {a.cid_10}</span>}
                  </div>
                  <Badge className={a.status === 'Ativo' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}>{a.status}</Badge>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {formatDate(a.data_inicio)} — {a.dias} dias — Dr(a). {a.medico_nome_snapshot || a.medico || '—'}{(a.medico_crm_snapshot || a.crm_medico) ? ` — CRM: ${a.medico_crm_snapshot || a.crm_medico}` : ''}
                </p>
              </div>
            )}
          </div>
        )
      },
      {
        key: 'medalhas',
        label: 'Medalhas',
        icon: Award,
        visible: true,
        content: (
          <div className="space-y-3">
            <AvisoRegistrosSistema mensagemRegistrosSistema={mensagemRegistrosSistema} />
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-sm text-slate-600">
                Tempo de serviço considerado: <span className="font-semibold text-slate-800">{apuracaoTempoServico.tempo_servico_anos ?? '—'} anos</span>
              </p>
              <p className="text-sm text-slate-600">
                Medalha devida atualmente: <span className="font-semibold text-slate-800">{apuracaoTempoServico.medalha_devida_codigo || '—'}</span>
              </p>
              <p className="text-sm text-slate-600">
                Situação de apuração: <span className="font-semibold text-slate-800">{apuracaoTempoServico.situacao}</span>
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-800">Impedimento geral de medalhas</h3>
                <Badge className={impedimentoAtivoGeral ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}>
                  {impedimentoAtivoGeral ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
              {impedimentoAtivoGeral ?
              <div className="space-y-2">
                  <p className="text-xs text-slate-600">Início: {formatDate(impedimentoAtivoGeral.data_inicio) || '—'} · Fim: {formatDate(impedimentoAtivoGeral.data_fim) || '—'}</p>
                  <p className="text-xs text-slate-600">Motivo: {impedimentoAtivoGeral.motivo || '—'}</p>
                  <p className="text-xs text-slate-600">Observações: {impedimentoAtivoGeral.observacoes || '—'}</p>
                  <Button
                  size="sm"
                  variant="outline"
                  disabled={!podeGerirImpedimentosMedalha || removerImpedimentoMutation.isPending}
                  onClick={() => removerImpedimentoMutation.mutate(impedimentoAtivoGeral.id)}>

                    Remover impedimento
                  </Button>
                </div> :

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Data início</Label>
                    <Input
                    type="date"
                    value={impedimentoForm.data_inicio}
                    onChange={(event) => setImpedimentoForm((atual) => ({ ...atual, data_inicio: event.target.value }))} />

                  </div>
                  <div>
                    <Label>Data fim (opcional)</Label>
                    <Input
                    type="date"
                    value={impedimentoForm.data_fim}
                    onChange={(event) => setImpedimentoForm((atual) => ({ ...atual, data_fim: event.target.value }))} />

                  </div>
                  <div>
                    <Label>Motivo</Label>
                    <Input
                    value={impedimentoForm.motivo}
                    onChange={(event) => setImpedimentoForm((atual) => ({ ...atual, motivo: event.target.value }))} />

                  </div>
                  <div>
                    <Label>Observações</Label>
                    <Input
                    value={impedimentoForm.observacoes}
                    onChange={(event) => setImpedimentoForm((atual) => ({ ...atual, observacoes: event.target.value }))} />

                  </div>
                  <div className="md:col-span-2">
                    <Button
                    size="sm"
                    className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
                    disabled={!podeGerirImpedimentosMedalha || criarImpedimentoMutation.isPending || !impedimentoForm.motivo.trim()}
                    onClick={() => criarImpedimentoMutation.mutate()}>

                      Ativar impedimento geral
                    </Button>
                  </div>
                </div>
              }
            </div>
            {medalhasConcedidasSistema.length === 0 ?
            <div className="bg-white rounded-xl p-8 text-center border border-slate-200">
                <Award className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500">Nenhuma medalha registrada</p>
                <p className="text-xs text-slate-400 mt-2">{mensagemRegistrosSistema}</p>
              </div> :
            medalhasConcedidasSistema.map((m) =>
            <div key={m.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800">{m.tipo_medalha_nome}</span>
                  <Badge className={MEDALHA_STATUS_COLORS[m.status] || ''}>{m.status}</Badge>
                </div>
                {m.documento_referencia === 'INFORMAÇÃO DP' ? (
                  <div className="mt-1 space-y-1">
                    <p className="text-xs text-slate-500">Indicação: {formatDate(m.data_indicacao)}</p>
                    <p className="text-xs font-medium text-blue-600">Origem: Informação DP — Publicação original não localizada.</p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 mt-1">
                    Indicação: {formatDate(m.data_indicacao)} · Concessão: {formatDate(m.data_concessao) || '—'}
                    {m.documento_referencia && ` · ${m.documento_referencia}`}
                  </p>
                )}
                {m.observacoes && (
                  <p className="text-xs text-slate-400 mt-1 italic">{m.observacoes}</p>
                )}
              </div>
            )}
          </div>
        )
      },
      {
        key: 'armamentos',
        label: 'Armamentos',
        icon: Shield,
        visible: canShowArmamentosTab({
          armamentos: armamentosSistema,
          isLoadingArmamentos,
          canAccessModule,
          canAccessAction,
        }),
        content: (
          <div className="space-y-3">
            <AvisoRegistrosSistema mensagemRegistrosSistema={mensagemRegistrosSistema} />
            {armamentosSistema.length === 0 ?
            <div className="bg-white rounded-xl p-8 text-center border border-slate-200">
                <Shield className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500">Nenhum armamento registrado</p>
                <p className="text-xs text-slate-400 mt-2">{mensagemRegistrosSistema}</p>
              </div> :
            armamentosSistema.map((a) =>
            <div key={a.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800">{a.tipo} — {a.marca || ''} {a.calibre}</span>
                  <Badge className={ARM_STATUS_COLORS[a.status] || ''}>{a.status}</Badge>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Série: {a.numero_serie} {a.numero_sigma ? `· SIGMA: ${a.numero_sigma}` : ''}
                  {a.data_expedicao ? ` · Expedição: ${formatDate(a.data_expedicao)}` : ''}
                </p>
              </div>
            )}
          </div>
        )
      },
      {
        key: 'contratos-designacao',
        label: 'Contratos de Designação',
        icon: ClipboardList,
        visible: podeVisualizarContratosDesignacao,
        content: (
          <ContratosDesignacaoSection
            contratos={contratosDesignacaoMilitar}
            militares={[militarEnriquecido || militar].filter(Boolean)}
            matriculas={matriculasMilitar}
            militarId={id}
            isLoading={isLoadingContratosDesignacao}
            canCreate={podeCriarContratoDesignacao}
            canEdit={podeEditarContratoDesignacao}
            canEncerrar={podeEncerrarContratoDesignacao}
            canCancelar={podeCancelarContratoDesignacao}
            canExcluir={podeExcluirContratoDesignacao}
            isSaving={contratoDesignacaoMutation.isPending}
            onCreate={(data) => contratoDesignacaoMutation.mutateAsync({ operation: 'create', data })}
            onUpdate={(contratoId, data) => contratoDesignacaoMutation.mutateAsync({ operation: 'update', id: contratoId, data })}
            onDelete={(contratoId) => contratoDesignacaoMutation.mutateAsync({ operation: 'delete', id: contratoId })}
          />
        )
      },
      {
        key: 'antiguidade',
        label: 'Carreira e Antiguidade',
        icon: FileText,
        visible: true,
        content: (
          <CarreiraAntiguidadePanel
            militar={militar}
            historicoPromocoes={historicoPromocoes}
            canManage={isAdmin}
            onOpenPromocaoAtualModal={() => setShowPromocaoAtualModal(true)}
            onOpenPromocaoHistoricaModal={() => setShowPromocaoHistoricaModal(true)}
            onOpenPromocaoFuturaModal={(registro) => { setPromocaoFuturaEdicao(registro || null); setShowPromocaoFuturaModal(true); }}
            onHistoricoChanged={async () => {
              await refetchHistoricoPromocoes();
              await queryClient.invalidateQueries({ queryKey: ['antiguidade-diagnostico'] });
              await queryClient.invalidateQueries({ queryKey: ['militar', militar?.id] });
              await queryClient.invalidateQueries({ queryKey: ['militares-consulta-rapida-scoped'] });
            }}
          />
        )
      },
      {
        key: 'acervo-historico',
        label: `Acervo Histórico (${acervoHistorico.length})`,
        icon: FileText,
        visible: canAccessAction('visualizar_acervo_historico'),
        content: (
          <div className="space-y-6">
            <CoberturaHistorica acervo={acervoHistorico} dataInclusao={militar.data_inclusao} />

            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-slate-700">Documentos Históricos</h3>
              <div className="flex gap-2">
                {podeGerirAcervo && (
                  <Button
                    className="bg-[#1e3a5f]"
                    onClick={() => setShowNovoAcervoModal(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" /> Novo Documento
                  </Button>
                )}
              </div>
            </div>

            <Tabs defaultValue="documentos">
              <TabsList>
                <TabsTrigger value="documentos">Documentos</TabsTrigger>
                {podeGerirAcervo && <TabsTrigger value="lixeira">Lixeira ({lixeiraAcervo.length})</TabsTrigger>}
              </TabsList>

              <TabsContent value="documentos" className="space-y-6 pt-4">
                {/* Seção Alterações */}
                <Section title={`Alterações (${acervoHistorico.filter(a => a.tipo_documento === 'ALTERACAO').length})`} icon={ClipboardList}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Período</TableHead>
                        <TableHead>Título</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {acervoHistorico.filter(a => a.tipo_documento === 'ALTERACAO').length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center text-slate-500 py-4">Nenhuma alteração cadastrada.</TableCell></TableRow>
                      ) : (
                        acervoHistorico.filter(a => a.tipo_documento === 'ALTERACAO').map(a => (
                          <TableRow key={a.id}>
                            <TableCell className="text-xs">{formatDate(a.periodo_inicial)} - {formatDate(a.periodo_final)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {a.titulo}
                                {a.versao > 1 && <Badge variant="outline">v{a.versao}</Badge>}
                              </div>
                            </TableCell>
                            <TableCell>{formatDate(a.data_documento)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => setDocParaVersoes(a)}>Histórico</Button>
                                {podeBaixarAcervo && <Button variant="outline" size="sm" onClick={() => window.open(a.arquivo_url, '_blank')}>PDF</Button>}
                                {podeGerirAcervo && <Button variant="ghost" size="sm" className="text-red-600" onClick={() => excluirAcervoMutation.mutate(a.id)}><Trash2 className="w-4 h-4" /></Button>}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </Section>

                {/* Seção Certidões */}
                <Section title={`Certidões (${acervoHistorico.filter(a => a.tipo_documento === 'CERTIDAO_COMPORTAMENTO').length})`} icon={Shield}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Comportamento</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {acervoHistorico.filter(a => a.tipo_documento === 'CERTIDAO_COMPORTAMENTO').length === 0 ? (
                        <TableRow><TableCell colSpan={3} className="text-center text-slate-500 py-4">Nenhuma certidão cadastrada.</TableCell></TableRow>
                      ) : (
                        acervoHistorico.filter(a => a.tipo_documento === 'CERTIDAO_COMPORTAMENTO').map(a => (
                          <TableRow key={a.id}>
                            <TableCell>{formatDate(a.data_documento)}</TableCell>
                            <TableCell>{a.comportamento_certificado}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => setDocParaVersoes(a)}>Histórico</Button>
                                {podeBaixarAcervo && <Button variant="outline" size="sm" onClick={() => window.open(a.arquivo_url, '_blank')}>PDF</Button>}
                                {podeGerirAcervo && <Button variant="ghost" size="sm" className="text-red-600" onClick={() => excluirAcervoMutation.mutate(a.id)}><Trash2 className="w-4 h-4" /></Button>}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </Section>

                {/* Seção Diversos */}
                <Section title={`Diversos (${acervoHistorico.filter(a => a.tipo_documento === 'DIVERSOS').length})`} icon={FileText}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Título</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {acervoHistorico.filter(a => a.tipo_documento === 'DIVERSOS').length === 0 ? (
                        <TableRow><TableCell colSpan={3} className="text-center text-slate-500 py-4">Nenhum documento cadastrado.</TableCell></TableRow>
                      ) : (
                        acervoHistorico.filter(a => a.tipo_documento === 'DIVERSOS').map(a => (
                          <TableRow key={a.id}>
                            <TableCell>{formatDate(a.data_documento)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {a.titulo}
                                {a.versao > 1 && <Badge variant="outline">v{a.versao}</Badge>}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => setDocParaVersoes(a)}>Histórico</Button>
                                {podeBaixarAcervo && <Button variant="outline" size="sm" onClick={() => window.open(a.arquivo_url, '_blank')}>PDF</Button>}
                                {podeGerirAcervo && <Button variant="ghost" size="sm" className="text-red-600" onClick={() => excluirAcervoMutation.mutate(a.id)}><Trash2 className="w-4 h-4" /></Button>}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </Section>
              </TabsContent>

              {podeGerirAcervo && (
                <TabsContent value="lixeira" className="pt-4">
                  <Section title="Lixeira do Acervo" icon={Trash2}>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Documento</TableHead>
                          <TableHead>Excluído em</TableHead>
                          <TableHead>Excluído por</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lixeiraAcervo.length === 0 ? (
                          <TableRow><TableCell colSpan={4} className="text-center text-slate-500 py-4">A lixeira está vazia.</TableCell></TableRow>
                        ) : (
                          lixeiraAcervo.map(a => (
                            <TableRow key={a.id}>
                              <TableCell>
                                <p className="font-medium">{a.titulo || a.tipo_documento}</p>
                                <p className="text-[10px] text-slate-500">{formatDate(a.data_documento)}</p>
                              </TableCell>
                              <TableCell className="text-xs">{formatDate(a.deleted_at?.split('T')[0])}</TableCell>
                              <TableCell className="text-xs">{a.deleted_by}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button variant="outline" size="sm" onClick={() => restaurarAcervoMutation.mutate(a.id)}><RotateCcw className="w-4 h-4 mr-1" /> Restaurar</Button>
                                  <Button variant="outline" size="sm" className="text-red-600" onClick={() => arquivarAcervoMutation.mutate(a.id)}><Archive className="w-4 h-4 mr-1" /> Arquivar</Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </Section>
                </TabsContent>
              )}
            </Tabs>

            {/* Modal Histórico de Versões */}
            <Dialog open={!!docParaVersoes} onOpenChange={() => setDocParaVersoes(null)}>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Histórico de Versões: {docParaVersoes?.titulo}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Versão</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Incluir o documento atual se for solicitado histórico a partir dele */}
                      {[docParaVersoes, ...historicoVersoes].filter(Boolean).map((v, idx) => (
                        <TableRow key={v.id + idx}>
                          <TableCell>v{v.versao}</TableCell>
                          <TableCell>{formatDate(v.data_documento)}</TableCell>
                          <TableCell><Badge variant="outline">{v.status_documento}</Badge></TableCell>
                          <TableCell className="text-right">
                            {podeBaixarAcervo && <Button variant="outline" size="sm" onClick={() => window.open(v.arquivo_url, '_blank')}>Abrir PDF</Button>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </DialogContent>
            </Dialog>

            {/* Modal Novo Documento */}
            <Dialog open={showNovoAcervoModal} onOpenChange={setShowNovoAcervoModal}>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Novo Documento Histórico</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Tipo de Documento</Label>
                    <Select value={acervoForm.tipo_documento} onValueChange={v => setAcervoForm({...acervoForm, tipo_documento: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALTERACAO">Alteração</SelectItem>
                        <SelectItem value="CERTIDAO_COMPORTAMENTO">Certidão de Comportamento</SelectItem>
                        <SelectItem value="DIVERSOS">Diversos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2 py-2">
                    <input
                      type="checkbox"
                      id="substituir_existente"
                      checked={acervoForm.substituir_existente}
                      onChange={e => setAcervoForm({ ...acervoForm, substituir_existente: e.target.checked })}
                      className="rounded border-slate-300"
                    />
                    <Label htmlFor="substituir_existente" className="text-sm cursor-pointer">Substituir documento existente</Label>
                  </div>

                  {acervoForm.substituir_existente && (
                    <div className="space-y-2">
                      <Label>Documento a ser substituído</Label>
                      <Select value={acervoForm.substitui_documento_id} onValueChange={v => setAcervoForm({ ...acervoForm, substitui_documento_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione o documento..." /></SelectTrigger>
                        <SelectContent>
                          {acervoHistorico.filter(a => a.tipo_documento === acervoForm.tipo_documento).map(a => (
                            <SelectItem key={a.id} value={a.id}>{a.titulo || formatDate(a.data_documento)} (v{a.versao})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {(acervoForm.tipo_documento === 'ALTERACAO' || acervoForm.tipo_documento === 'DIVERSOS') && (
                    <div className="space-y-2">
                      <Label>Título</Label>
                      <Input value={acervoForm.titulo} onChange={e => setAcervoForm({...acervoForm, titulo: e.target.value})} required />
                    </div>
                  )}

                  {acervoForm.tipo_documento === 'ALTERACAO' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Período Inicial</Label>
                        <Input type="date" value={acervoForm.periodo_inicial} onChange={e => setAcervoForm({...acervoForm, periodo_inicial: e.target.value})} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Período Final</Label>
                        <Input type="date" value={acervoForm.periodo_final} onChange={e => setAcervoForm({...acervoForm, periodo_final: e.target.value})} required />
                      </div>
                    </div>
                  )}

                  {acervoForm.tipo_documento === 'CERTIDAO_COMPORTAMENTO' && (
                    <div className="space-y-2">
                      <Label>Comportamento Certificado</Label>
                      <Select value={acervoForm.comportamento_certificado} onValueChange={v => setAcervoForm({...acervoForm, comportamento_certificado: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EXCEPCIONAL">Excepcional</SelectItem>
                          <SelectItem value="OTIMO">Ótimo</SelectItem>
                          <SelectItem value="BOM">Bom</SelectItem>
                          <SelectItem value="INSUFICIENTE">Insuficiente</SelectItem>
                          <SelectItem value="MAU">Mau</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {(acervoForm.tipo_documento === 'CERTIDAO_COMPORTAMENTO' || acervoForm.tipo_documento === 'DIVERSOS') && (
                    <div className="space-y-2">
                      <Label>Data do Documento</Label>
                      <Input type="date" value={acervoForm.data_documento} onChange={e => setAcervoForm({...acervoForm, data_documento: e.target.value})} required />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Input value={acervoForm.observacoes} onChange={e => setAcervoForm({...acervoForm, observacoes: e.target.value})} />
                  </div>

                  <div className="space-y-2">
                    <Label>Upload PDF(s)</Label>
                    <Input type="file" accept="application/pdf" multiple onChange={e => setAcervoFiles(Array.from(e.target.files))} required />
                    {acervoFiles.length > 0 && <p className="text-xs text-slate-500">{acervoFiles.length} selecionado(s)</p>}
                  </div>
                </div>
                <DialogFooter>
                  <Button className="w-full bg-[#1e3a5f]" onClick={() => salvarAcervoMutation.mutate()} disabled={salvarAcervoMutation.isPending}>
                    {salvarAcervoMutation.isPending ? 'Salvando PDF...' : 'Salvar Documento'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )
      },
      {
        key: 'timeline',
        label: 'Linha do Tempo',
        icon: Clock,
        visible: true,
        content: (
          <div className="pt-4">
            <MilitarTimelineTab militarId={id} />
          </div>
        )
      }
    ];
    return configs;
  }, [
    comportamentoElegivel, militar, avaliacaoComportamento, proximaMelhoria,
    mensagemRegistrosSistema, pendenciasComportamentoSistema, ultimaPunicaoPorMilitar,
    historicoChartData, historicoComportamentoSistema, punicoesSistema,
    militarEnriquecido, postoGraduacaoMilitar, feriasSistema, periodosSistema,
    periodosFeriasResumo, creditosExtraPorPeriodo, atestadosSistema, isLoadingAtestados,
    apuracaoTempoServico, impedimentoAtivoGeral, podeGerirImpedimentosMedalha,
    removerImpedimentoMutation.isPending, impedimentoForm, criarImpedimentoMutation.isPending,
    medalhasConcedidasSistema, armamentosSistema, isLoadingArmamentos, canAccessModule, canAccessAction, podeVisualizarContratosDesignacao,
    contratosDesignacaoMilitar, matriculasMilitar, id, isLoadingContratosDesignacao,
    podeCriarContratoDesignacao, podeEditarContratoDesignacao, podeEncerrarContratoDesignacao,
    podeCancelarContratoDesignacao, podeExcluirContratoDesignacao,
    contratoDesignacaoMutation.isPending, historicoPromocoes, isAdmin, queryClient, refetchHistoricoPromocoes
  ]);

  const visibleTabs = React.useMemo(() => tabsConfig.filter(t => t.visible), [tabsConfig]);

  const tabInicial = React.useMemo(() => {
    const isTabVisible = visibleTabs.some(t => t.key === selectedTab);
    if (isTabVisible) return selectedTab;

    // Fallback: se 'comportamento' estiver selecionado mas não visível, ou qualquer outra inválida, vai para 'dados'
    return 'dados';
  }, [selectedTab, visibleTabs]);

  const handleTabChange = React.useCallback((val) => {
    const params = new URLSearchParams(searchParams);
    if (params.get('tab') === val) return;
    params.set('tab', val);
    navigate(`?${params.toString()}`, { replace: true });
  }, [searchParams, navigate]);

  React.useEffect(() => {
    if (selectedTab !== tabInicial) {
      handleTabChange(tabInicial);
    }
  }, [selectedTab, tabInicial, handleTabChange]);

  const bundle360 = React.useMemo(() => {
    if (!militar) return null;
    return montarMilitar360Bundle({
      militar,
      ferias,
      atestados,
      registrosLivro,
      publicacoes: [], // Removido fetch global novo conforme requisito 7
      medalhas,
      pendencias: pendenciasComportamento,
      historicoPromocoes,
      periodosAquisitivos: periodos
    });
  }, [militar, ferias, atestados, registrosLivro, medalhas, pendenciasComportamento, historicoPromocoes, periodos]);

  if (loadingUser || isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
      </div>);

  }

  if (!militar) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 mb-4">Militar não encontrado</p>
          <Button onClick={() => navigate(createPageUrl('Militares'))} className="bg-primary text-primary-foreground px-4 py-2 text-sm font-medium text-left rounded-lg inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow hover:bg-primary/90 h-9">Voltar</Button>
        </div>
      </div>);

  }

  if (!canViewMilitar) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 mb-4">Acesso negado para este militar.</p>
          <Button onClick={() => navigate(createPageUrl('Home'))}>Ir para Home</Button>
        </div>
      </div>);

  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('Militares'))} className="hover:bg-slate-200">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-[#1e3a5f]">Perfil do Militar</h1>
              <p className="text-slate-500 text-sm">Comportamento e dados completos do militar</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowGerarDocumento(true)}>
              <FileText className="w-4 h-4 mr-2" />Gerar Documento
            </Button>
            <Button variant="outline" onClick={() => setShowSolicitacao(true)}>
              <Send className="w-4 h-4 mr-2" />Solicitar Correção
            </Button>
            {isAdmin &&
            <>
                <Button onClick={() => navigate(createPageUrl('CadastrarMilitar') + `?id=${militar.id}`)} className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white">
                  <Pencil className="w-4 h-4 mr-2" />Editar
                </Button>
              </>
            }
          </div>
        </div>

        {/* Alertas e tempo de serviço */}
        <div className="space-y-2 mb-4">
          {conferenciaAbertaPrincipal && (
            <Card className="border-blue-200 bg-blue-50/50 shadow-sm overflow-hidden">
              <div className="flex flex-col sm:flex-row items-center gap-4 p-4">
                <div className="p-3 bg-blue-100 rounded-xl text-blue-600">
                  <ClipboardCheck className="w-6 h-6" />
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                    <h3 className="font-bold text-blue-900">Conferência Cadastral Ativa</h3>
                    <Badge variant="outline" className={`
                      ${conferenciaAbertaPrincipal.status === 'pendente' ? 'bg-slate-100 text-slate-700' :
                        conferenciaAbertaPrincipal.status === 'em_andamento' ? 'bg-blue-100 text-blue-700' :
                        'bg-amber-100 text-amber-700'}
                      border-none font-semibold text-[10px] uppercase
                    `}>
                      {conferenciaAbertaPrincipal.status === 'pendente' ? 'Pendente' :
                       conferenciaAbertaPrincipal.status === 'em_andamento' ? 'Em Andamento' :
                       'Com Pendências'}
                    </Badge>
                  </div>
                  <p className="text-sm text-blue-800/80">
                    Tipo: <span className="font-medium text-blue-900">{
                      conferenciaAbertaPrincipal.tipo_conferencia === 'ingresso' ? 'Ingresso' :
                      conferenciaAbertaPrincipal.tipo_conferencia === 'reativacao' ? 'Reativação' :
                      conferenciaAbertaPrincipal.tipo_conferencia === 'retorno_transferencia' ? 'Retorno de Transferência' :
                      'Saneamento Manual'
                    }</span> • Aberta em {formatDate(conferenciaAbertaPrincipal.data_abertura?.split('T')[0])}
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex-1 max-w-[200px] h-1.5 bg-blue-200 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600" style={{ width: `${conferenciaAbertaPrincipal.progresso_percentual}%` }} />
                    </div>
                    <span className="text-[10px] font-bold text-blue-700">{conferenciaAbertaPrincipal.progresso_percentual}%</span>
                  </div>
                </div>
                <Button
                  onClick={() => navigate(createPageUrl('ConferenciasMilitares'))}
                  className="bg-blue-600 hover:bg-blue-700 text-white shadow-none h-9 px-4"
                >
                  Abrir conferência
                </Button>
              </div>
            </Card>
          )}
          <AlertasContrato militarId={id} />
          <TempoServico militar={{ ...militar, posto_graduacao: postoGraduacaoMilitar }} />
          {militarMesclado &&
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Cadastro mesclado</p>
              <p>
                Este militar foi mesclado e deve ser usado apenas para consulta histórica.
                {militarDestinoMerge?.id ? ` Registro destino: ${militarDestinoMerge.nome_completo || militarDestinoMerge.nome_guerra} (${militarDestinoMerge.matricula || 'sem matrícula'}).` : ''}
              </p>
            </div>
          }
        </div>

        {/* Ficha 360º — Visão Geral */}
        {bundle360 && (
          <Section title="Ficha 360º — Visão Geral" icon={Activity} className="mb-6 border-l-4 border-l-[#1e3a5f]">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 py-2">
              {/* Situação Operacional */}
              <Card className="bg-slate-50/50 border-none shadow-none">
                <CardHeader className="p-3 pb-0">
                  <CardTitle className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-2">
                    <Activity className="w-3 h-3" /> Situação
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="space-y-2">
                    <Badge style={{ backgroundColor: bundle360.statusOperacional?.cor || '#64748b', color: 'white' }} className="w-full justify-center">
                      {bundle360.statusOperacional?.status || 'Não informado'}
                    </Badge>
                    <div className="space-y-1">
                      <p className="text-xs text-slate-600 font-medium truncate" title={bundle360.statusOperacional?.motivo}>
                        {bundle360.statusOperacional?.motivo || 'Sem registros'}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate" title={bundle360.resumoExecutivo?.lotacao}>
                        {bundle360.resumoExecutivo?.lotacao || 'Sem lotação'}
                      </p>
                      <Badge variant="outline" className="text-[9px] h-3.5 px-1 font-normal opacity-70">
                        CAD: {bundle360.auditoria?.statusCadastro || '---'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Carreira */}
              <Card className="bg-slate-50/50 border-none shadow-none">
                <CardHeader className="p-3 pb-0">
                  <CardTitle className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-2">
                    <Briefcase className="w-3 h-3" /> Carreira
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-700 leading-tight">{bundle360.carreira?.postoAtual || 'Não informado'}</p>
                    <p className="text-[10px] text-slate-500">Prom: {formatDate(bundle360.carreira?.resumoCarreira?.dataUltimaPromocao) || '---'}</p>
                    <p className="text-xs text-slate-600 font-medium">{bundle360.carreira?.tempoServico?.anos_completos ?? '0'} anos de serviço</p>
                    <p className="text-xs text-slate-600 truncate" title={bundle360.resumoExecutivo?.funcao}>
                      {bundle360.resumoExecutivo?.funcao || 'Sem função'}
                    </p>
                    <p className="text-xs text-slate-600">Comp: {bundle360.carreira?.comportamentoAtual?.comportamento || 'Não informado'}</p>
                    {bundle360.carreira?.proximaMedalha?.codigo && (
                      <p className="text-[10px] text-emerald-600 font-medium uppercase">Próxima: {bundle360.carreira.proximaMedalha.codigo}</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Saúde */}
              <Card className="bg-slate-50/50 border-none shadow-none">
                <CardHeader className="p-3 pb-0">
                  <CardTitle className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-2">
                    <Heart className="w-3 h-3" /> Saúde
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-700">{bundle360.saude?.statusSaude || 'Sem registros'}</p>
                    <p className="text-xs text-slate-600">
                      Último: {formatDate(bundle360.saude?.ultimoAtestado?.data_inicio) || 'Não informado'}
                    </p>
                    <p className="text-xs text-slate-600">{bundle360.saude?.diasAfastados12Meses || 0} dias (12m)</p>
                    {bundle360.saude?.possuiJiso && (
                      <Badge variant="outline" className="text-[10px] h-4 mt-1 border-purple-200 text-purple-700">JISO ATIVA</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Férias */}
              <Card className="bg-slate-50/50 border-none shadow-none">
                <CardHeader className="p-3 pb-0">
                  <CardTitle className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-2">
                    <Calendar className="w-3 h-3" /> Férias
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-slate-700">{bundle360.ferias?.saldoAtual || 0} dias</p>
                      <Badge variant="outline" className="text-[10px] h-4">
                        {bundle360.ferias?.periodos?.length || 0} per.
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-600">{bundle360.ferias?.situacaoAtual?.emGozo ? 'Em gozo' : 'Disponível'}</p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Vencto: {formatDate(bundle360.ferias?.proximoVencimento) || 'Não informado'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Auditoria */}
              <Card className="bg-slate-50/50 border-none shadow-none">
                <CardHeader className="p-3 pb-0">
                  <CardTitle className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-2">
                    <Shield className="w-3 h-3" /> Auditoria
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-slate-700">{bundle360.auditoria?.score ?? '---'}%</p>
                      <span className="text-[10px] text-slate-400">Completude</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <Badge variant={bundle360.auditoria?.resumo?.totalCriticos > 0 ? "destructive" : "outline"} className="text-[10px] h-4 px-1">
                        {bundle360.auditoria?.resumo?.totalCriticos || 0} C
                      </Badge>
                      <Badge className={`text-[10px] h-4 px-1 ${bundle360.auditoria?.resumo?.totalAtencao > 0 ? "bg-amber-100 text-amber-700 hover:bg-amber-100" : "bg-slate-100 text-slate-500 hover:bg-slate-100"}`} variant="secondary">
                        {bundle360.auditoria?.resumo?.totalAtencao || 0} A
                      </Badge>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-1 leading-tight">
                      Atu: {formatDate(bundle360.auditoria?.ultimaAtualizacao) || '---'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </Section>
        )}

        {/* Profile Header */}
        <Card className="shadow-sm mb-6 overflow-hidden">
          <div className="bg-gradient-to-r from-[#1e3a5f] to-[#2d4a6f] p-6 text-white">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div className="w-28 h-36 rounded-lg bg-white/10 overflow-hidden flex-shrink-0">
                {militar.foto ?
                <img src={militar.foto} alt={militar.nome_completo} className="w-full h-full object-cover" /> :

                <div className="w-full h-full flex items-center justify-center">
                    <User className="w-12 h-12 text-white/50" />
                  </div>
                }
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Badge className={STATUS_COLORS[militar.status_cadastro] || 'bg-emerald-100 text-emerald-700'}>
                    {militar.status_cadastro || 'Ativo'}
                  </Badge>
                  {militar.condicao && <Badge variant="outline" className="border-white/30 text-white">{militar.condicao}</Badge>}
                </div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h2 className="text-2xl font-bold">
                    {postoGraduacaoMilitar && `${postoGraduacaoMilitar} `}
                    {militar.nome_guerra || militar.nome_completo}
                  </h2>
                  <InstitucionalMilitarBadge decoracao={decoracaoInstitucionalMilitar} className="bg-white/15 text-white border-white/30" />
                </div>
                {existeDivergenciaPostoAtivo &&
                <div className="mt-2">
                    <Badge className="bg-amber-200 text-amber-900 border border-amber-500">
                      Cadastro divergente do histórico ativo mais recente.
                    </Badge>
                  </div>
                }
                {militar.nome_guerra && <p className="text-white/80">{militar.nome_completo}</p>}
                <div className="flex flex-wrap gap-4 mt-3 text-sm text-white/80">
                  {(militarEnriquecido?.matricula_atual || militar.matricula) && <span>Mat. atual: {militarEnriquecido?.matricula_atual || militar.matricula}</span>}
                  <span>Quadro: {getQuadroMilitar(militar)}</span>
                  {militar.lotacao && <span>Lotação: {militar.lotacao}</span>}
                  {militar.funcao && <span>Função: {militar.funcao}</span>}
                </div>
                {militar.comportamento && comportamentoElegivel &&
                <div className="mt-2">
                    <Badge className="bg-white/20 text-white border border-white/30">Comportamento: {militar.comportamento}</Badge>
                  </div>
                }
              </div>
            </div>
          </div>
        </Card>

        <Tabs value={tabInicial} onValueChange={handleTabChange}>
          <TabsList className="w-full flex-wrap h-auto gap-1 mb-6">
            {visibleTabs.map((t) => (
              <TabsTrigger key={t.key} value={t.key}>
                {t.icon && <t.icon className="w-4 h-4 mr-1" />}
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {visibleTabs.map((t) => (
            <TabsContent key={t.key} value={t.key}>
              {t.content}
            </TabsContent>
          ))}
        </Tabs>
      </div>



      <PromocaoHistoricaModal
        open={showPromocaoHistoricaModal}
        onOpenChange={setShowPromocaoHistoricaModal}
        militar={militar}
        onSaved={async () => {
          await refetchHistoricoPromocoes();
          await queryClient.invalidateQueries({ queryKey: ['antiguidade-diagnostico'] });
          await queryClient.invalidateQueries({ queryKey: ['militar', militar?.id] });
          await queryClient.invalidateQueries({ queryKey: ['militares-consulta-rapida-scoped'] });
        }}
      />


      <PromocaoFuturaModal
        open={showPromocaoFuturaModal}
        onOpenChange={(open) => {
          setShowPromocaoFuturaModal(open);
          if (!open) setPromocaoFuturaEdicao(null);
        }}
        militar={militar}
        registroEdicao={promocaoFuturaEdicao}
        onSaved={async () => {
          await refetchHistoricoPromocoes();
          await queryClient.invalidateQueries({ queryKey: ['militar', militar?.id] });
          await queryClient.invalidateQueries({ queryKey: ['antiguidade-diagnostico'] });
          await queryClient.invalidateQueries({ queryKey: ['militares-consulta-rapida-scoped'] });
        }}
      />

      <PromocaoAtualModal
        open={showPromocaoAtualModal}
        onOpenChange={setShowPromocaoAtualModal}
        militar={militar}
        onSaved={async () => {
          await refetchHistoricoPromocoes();
          await queryClient.invalidateQueries({ queryKey: ['antiguidade-diagnostico'] });
          await queryClient.invalidateQueries({ queryKey: ['militar', militar?.id] });
          await queryClient.invalidateQueries({ queryKey: ['militares-consulta-rapida-scoped'] });
        }}
      />

      {showGerarDocumento &&
      <GerarDocumentoMilitarModal
        militar={militarEnriquecido || militar}
        onClose={() => setShowGerarDocumento(false)} />

      }

      {showSolicitacao &&
      <SolicitarAtualizacaoModal
        militar={militar}
        onClose={() => setShowSolicitacao(false)}
        onSaved={() => setShowSolicitacao(false)} />

      }
    </div>);

}