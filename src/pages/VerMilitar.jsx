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
import {
  ArrowLeft, Pencil, User, FileText,
  Phone, Heart, MapPin, GraduationCap, Calendar, Mail, CreditCard,
  Shield, Award, Send, Activity, AlertTriangle, Briefcase } from
'lucide-react';
import { format } from 'date-fns';
import TempoServico from '@/components/militar/TempoServico';
import AlertasContrato from '@/components/militar/AlertasContrato';
import SolicitarAtualizacaoModal from '@/components/militar/SolicitarAtualizacaoModal';
import PromocaoAtualModal from '@/components/antiguidade/PromocaoAtualModal';
import CarreiraAntiguidadePanel from '@/components/antiguidade/CarreiraAntiguidadePanel';
import ComportamentoTimeline from '@/components/militar/ComportamentoTimeline';
import HistoricoComportamentoChart from '@/components/militar/HistoricoComportamentoChart';
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
import { useToast } from '@/components/ui/use-toast';
import {
  formatarTipoCreditoExtra } from
'@/services/creditoExtraFeriasService';
import { getSaldoConsolidadoPeriodo, isFeriasDoPeriodo } from '@/components/ferias/periodoSaldoUtils';
import { calcularStatusPeriodoAquisitivo } from '@/components/ferias/recalcularPeriodoAquisitivo';

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

function Section({ title, icon: Icon, children }) {
  return (
    <Card className="shadow-sm">
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
  try {return format(new Date(date + 'T00:00:00'), "dd/MM/yyyy");} catch {return date;}
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
  const selectedTab = searchParams.get('tab') || 'comportamento';
  const { isAdmin, hasAccess, hasSelfAccess, canAccessAction, userEmail, isLoading: loadingUser, isAccessResolved } = useCurrentUser();
  const podeGerirImpedimentosMedalha = canAccessAction(ACOES_MEDALHAS.IMPEDIMENTOS);
  const [showSolicitacao, setShowSolicitacao] = useState(false);
  const [showPromocaoAtualModal, setShowPromocaoAtualModal] = useState(false);
  const [impedimentoForm, setImpedimentoForm] = useState({
    data_inicio: new Date().toISOString().split('T')[0],
    data_fim: '',
    motivo: '',
    observacoes: ''
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

  const { data: militarDestinoMerge } = useQuery({
    queryKey: ['militar-merge-destino', militar?.merged_into_id],
    queryFn: async () => {
      const list = await base44.entities.Militar.filter({ id: militar.merged_into_id });
      return list[0] || null;
    },
    enabled: Boolean(militar?.merged_into_id)
  });

  const canViewMilitar = militar ? hasAccess(militar) || hasSelfAccess(militar) : false;
  const comportamentoElegivel = militar ? !isOficial(militar.posto_graduacao) : false;
  const tabInicial = comportamentoElegivel ?
  selectedTab :
  selectedTab === 'comportamento' ? 'dados' : selectedTab;

  const { data: ferias = [] } = useQuery({
    queryKey: ['ver-ferias', id],
    queryFn: () => base44.entities.Ferias.filter({ militar_id: id }, '-data_inicio'),
    enabled: !!id && isAccessResolved && canViewMilitar
  });

  const { data: atestados = [] } = useQuery({
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

  const { data: armamentos = [] } = useQuery({
    queryKey: ['ver-armamentos', id],
    queryFn: () => base44.entities.Armamento.filter({ militar_id: id }),
    enabled: !!id && isAccessResolved && canViewMilitar
  });
  const { data: historicoPromocoes = [], refetch: refetchHistoricoPromocoes } = useQuery({
    queryKey: ['ver-historico-promocoes', id],
    queryFn: () => base44.entities.HistoricoPromocaoMilitar.filter({ militar_id: id }, '-data_promocao'),
    enabled: !!id && isAccessResolved && canViewMilitar
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
      console.log('[HIST] resultado query:', {
        militar_id: militarIdHistorico,
        quantidade: Array.isArray(historico) ? historico.length : 0,
        registros: historico
      });
      return historico;
    },
    enabled: !!id && isAccessResolved && canViewMilitar && comportamentoElegivel
  });

  const { data: punicoes = [] } = useQuery({
    queryKey: ['ver-punicoes-comportamento', id],
    queryFn: () => base44.entities.PunicaoDisciplinar.filter({ militar_id: id }, '-data_inicio_cumprimento'),
    enabled: !!id && isAccessResolved && canViewMilitar && comportamentoElegivel
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

  const statusColors = { 'Ativo': 'bg-emerald-100 text-emerald-700', 'Inativo': 'bg-slate-100 text-slate-700' };
  const medalhaStatusColor = { 'Indicado': 'bg-yellow-100 text-yellow-700', 'Concedido': 'bg-green-100 text-green-700', 'Negado': 'bg-red-100 text-red-700' };
  const armStatusColor = { 'Ativo': 'bg-green-100 text-green-700', 'Vendido': 'bg-blue-100 text-blue-700', 'Extraviado': 'bg-orange-100 text-orange-700', 'Furtado': 'bg-red-100 text-red-700', 'Baixado': 'bg-slate-100 text-slate-700' };

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
          <AlertasContrato militarId={id} />
          <TempoServico militar={militar} />
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
                  <Badge className={statusColors[militar.status_cadastro] || 'bg-emerald-100 text-emerald-700'}>
                    {militar.status_cadastro || 'Ativo'}
                  </Badge>
                  {militar.condicao && <Badge variant="outline" className="border-white/30 text-white">{militar.condicao}</Badge>}
                </div>
                <h2 className="text-2xl font-bold mb-1">
                  {militar.posto_graduacao && `${militar.posto_graduacao} `}
                  {militar.nome_guerra || militar.nome_completo}
                </h2>
                {militar.nome_guerra && <p className="text-white/80">{militar.nome_completo}</p>}
                <div className="flex flex-wrap gap-4 mt-3 text-sm text-white/80">
                  {(militarEnriquecido?.matricula_atual || militar.matricula) && <span>Mat. atual: {militarEnriquecido?.matricula_atual || militar.matricula}</span>}
                  {militar.quadro && <span>Quadro: {militar.quadro}</span>}
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

        {/* Tabs */}
        <Tabs defaultValue={tabInicial}>
          <TabsList className="w-full flex-wrap h-auto gap-1 mb-6">
            {comportamentoElegivel &&
            <TabsTrigger value="comportamento"><Activity className="w-4 h-4 mr-1" />Comportamento</TabsTrigger>
            }
            <TabsTrigger value="dados"><User className="w-4 h-4 mr-1" />Dados Pessoais</TabsTrigger>
            <TabsTrigger value="ferias"><Calendar className="w-4 h-4 mr-1" />Férias</TabsTrigger>
            <TabsTrigger value="atestados"><FileText className="w-4 h-4 mr-1" />Atestados</TabsTrigger>
            <TabsTrigger value="medalhas"><Award className="w-4 h-4 mr-1" />Medalhas</TabsTrigger>
            <TabsTrigger value="armamentos"><Shield className="w-4 h-4 mr-1" />Armamentos</TabsTrigger>
            <TabsTrigger value="antiguidade"><FileText className="w-4 h-4 mr-1" />Carreira e Antiguidade</TabsTrigger>
          </TabsList>

          {/* Dados Pessoais */}
          <TabsContent value="dados">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Section title="Dados Funcionais" icon={Briefcase}>
                  <div className="grid grid-cols-2 gap-x-4">
                    <InfoItem label="Nome de Guerra" value={militar.nome_guerra} />
                    <InfoItem label="Matrícula atual" value={militarEnriquecido?.matricula_atual || militar.matricula} />
                    <InfoItem label="Posto/Graduação" value={militar.posto_graduacao} />
                    <InfoItem label="Quadro" value={militar.quadro} />
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
          </TabsContent>

          {comportamentoElegivel &&
          <TabsContent value="comportamento">
              <div className="space-y-6">
                <AvisoRegistrosSistema mensagemRegistrosSistema={mensagemRegistrosSistema} />
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
            </TabsContent>
          }

          {/* Férias */}
          <TabsContent value="ferias">
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
          </TabsContent>

          {/* Atestados */}
          <TabsContent value="atestados">
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
                    {formatDate(a.data_inicio)} — {a.dias} dias — Dr(a). {a.medico || '—'}
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Medalhas */}
          <TabsContent value="medalhas">
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
                    <Badge className={medalhaStatusColor[m.status] || ''}>{m.status}</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Indicação: {formatDate(m.data_indicacao)} · Concessão: {formatDate(m.data_concessao) || '—'}
                    {m.documento_referencia && ` · ${m.documento_referencia}`}
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Armamentos */}
          <TabsContent value="armamentos">
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
                    <Badge className={armStatusColor[a.status] || ''}>{a.status}</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Série: {a.numero_serie} {a.numero_sigma ? `· SIGMA: ${a.numero_sigma}` : ''}
                    {a.data_expedicao ? ` · Expedição: ${formatDate(a.data_expedicao)}` : ''}
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="antiguidade">
            <CarreiraAntiguidadePanel
              militar={militar}
              historicoPromocoes={historicoPromocoes}
              canManage={isAdmin}
              onOpenPromocaoAtualModal={() => setShowPromocaoAtualModal(true)}
              onHistoricoChanged={async () => {
                await refetchHistoricoPromocoes();
                await queryClient.invalidateQueries({ queryKey: ['antiguidade-diagnostico'] });
              }}
            />
          </TabsContent>

        </Tabs>
      </div>

      <PromocaoAtualModal
        open={showPromocaoAtualModal}
        onOpenChange={setShowPromocaoAtualModal}
        militar={militar}
        onSaved={async () => {
          await refetchHistoricoPromocoes();
          await queryClient.invalidateQueries({ queryKey: ['antiguidade-diagnostico'] });
        }}
      />

      {showSolicitacao &&
      <SolicitarAtualizacaoModal
        militar={militar}
        onClose={() => setShowSolicitacao(false)}
        onSaved={() => setShowSolicitacao(false)} />

      }
    </div>);

}
