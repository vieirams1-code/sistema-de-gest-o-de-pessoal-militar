import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Calendar,
  Users,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Zap,
  Sliders,
  Check,
  Edit3,
  Star,
  Layers,
  ChevronRight,
  Medal,
  Award,
  Sparkles,
  Info,
  CalendarDays,
  Clock,
  Search,
  X,
  Filter,
  Ban,
  Lock,
  RotateCcw,
  CheckCircle,
  ShieldAlert,
  Shield,
  Trash2,
  Archive,
  PowerOff,
  History,
  FolderArchive,
  Megaphone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const LISTA_MESES = [
  { val: '01', nome: 'Janeiro' },
  { val: '02', nome: 'Fevereiro' },
  { val: '03', nome: 'Março' },
  { val: '04', nome: 'Abril' },
  { val: '05', nome: 'Maio' },
  { val: '06', nome: 'Junho' },
  { val: '07', nome: 'Julho' },
  { val: '08', nome: 'Agosto' },
  { val: '09', nome: 'Setembro' },
  { val: '10', nome: 'Outubro' },
  { val: '11', nome: 'Novembro' },
  { val: '12', nome: 'Dezembro' },
];

function getNomeMesPorVal(val) {
  const m = LISTA_MESES.find((item) => item.val === val);
  return m ? m.nome : val;
}

function extrairMesDeDetalhes(detalhesStr, fallbackVal = '01') {
  if (!detalhesStr) return fallbackVal;
  try {
    const arr = JSON.parse(detalhesStr);
    if (Array.isArray(arr) && arr.length > 0 && arr[0].mes) {
      return arr[0].mes;
    }
    if (Array.isArray(arr) && arr.length > 0 && arr[0].data_inicio?.length >= 7) {
      return arr[0].data_inicio.slice(5, 7);
    }
  } catch (_e) {}
  return fallbackVal;
}

export default function PainelPlanoFerias() {
  // Lista de Campanhas e Campanha Selecionada
  const [campanhas, setCampanhas] = useState([]);
  const [campanhaSelecionada, setCampanhaSelecionada] = useState(null);
  const [opcoes, setOpcoes] = useState([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', msg: '' });

  // Modo Admin para proteção de campanhas
  const [modoAdmin, setModoAdmin] = useState(false);

  // Estados de Edição e Seleção por Militar
  const [selecoesMilitares, setSelecoesMilitares] = useState({});
  const [militaresEmEdicao, setMilitaresEmEdicao] = useState({});

  // Filtros & Pesquisa
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('TODOS');
  const [filtroModalidade, setFiltroModalidade] = useState('TODOS');
  const [filtroUnidade, setFiltroUnidade] = useState('TODOS');
  const [filtroMes, setFiltroMes] = useState('TODOS');

  // Modal para Justificativa de Não Contemplado
  const [modalNaoContemplado, setModalNaoContemplado] = useState({ open: false, opcao: null, justificativa: '' });

  // Carrega lista de campanhas e opções da campanha selecionada
  const carregarPainel = async (campanhaAlvoId = null) => {
    setLoading(true);
    setFeedback({ type: '', msg: '' });
    try {
      // 1. Carrega todas as campanhas de férias
      const res = await base44.functions.invoke('portal_servicos', {
        acao: 'PLANO_ESCALA_LISTAR',
        campanha_id: campanhaAlvoId || undefined,
      });

      const listaCampanhas = res.data?.campanhas || [];
      setCampanhas(listaCampanhas);

      // Define campanha ativa/selecionada
      let selected = null;
      if (campanhaAlvoId) {
        selected = listaCampanhas.find((c) => c.id === campanhaAlvoId) || null;
      }
      if (!selected && listaCampanhas.length > 0) {
        // Prioriza a primeira campanha ativa/aberta; se não houver, pega a primeira
        selected = listaCampanhas.find((c) => c.status === 'Aberta_Coleta' || c.status === 'Ativa') || listaCampanhas[0];
      }
      setCampanhaSelecionada(selected);

      // 2. Opções da campanha selecionada
      const listaOpcoes = res.data?.opcoes || [];
      setOpcoes(listaOpcoes);

      const initialMap = {};
      const initialEditing = {};

      listaOpcoes.forEach((op) => {
        const mes1 = extrairMesDeDetalhes(op.opcao_1_detalhes, '01');
        const mes2 = extrairMesDeDetalhes(op.opcao_2_detalhes, '07');
        const mes3 = extrairMesDeDetalhes(op.opcao_3_detalhes, '10');

        if (op.decisao_camada_1_detalhes && op.decisao_camada_1_detalhes !== '[]') {
          try {
            const salvas = JSON.parse(op.decisao_camada_1_detalhes);
            initialMap[op.id] = {
              fracao1: salvas[0]?.mes || salvas[0]?.data_inicio?.slice(5, 7) || mes1,
              fracao2: salvas[1]?.mes || salvas[1]?.data_inicio?.slice(5, 7) || mes2,
              fracao3: salvas[2]?.mes || salvas[2]?.data_inicio?.slice(5, 7) || mes3,
              justificativa: op.justificativa_ajuste_gestor || '',
            };
          } catch (_e) {
            initialMap[op.id] = { fracao1: mes1, fracao2: mes2, fracao3: mes3, justificativa: '' };
          }
          initialEditing[op.id] = false;
        } else if (op.status_camada_1 === 'Nao_Contemplado' || op.decisao_camada_1_opcao === 'NAO_CONTEMPLADO') {
          initialMap[op.id] = { fracao1: mes1, fracao2: mes2, fracao3: mes3, justificativa: op.justificativa_ajuste_gestor || '' };
          initialEditing[op.id] = false;
        } else {
          initialMap[op.id] = { fracao1: mes1, fracao2: mes2, fracao3: mes3, justificativa: '' };
          initialEditing[op.id] = selected?.status === 'Aberta_Coleta'; // Se campanha estiver ativa, começa editável
        }
      });

      setSelecoesMilitares(initialMap);
      setMilitaresEmEdicao(initialEditing);
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Falha ao carregar dados do painel de férias.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarPainel();
  }, []);

  const handleSelecionarCampanha = (camp) => {
    setCampanhaSelecionada(camp);
    carregarPainel(camp.id);
  };

  const handleMudarMesFracao = (opId, numFracao, novoMes) => {
    setSelecoesMilitares((prev) => ({
      ...prev,
      [opId]: {
        ...(prev[opId] || {}),
        [`fracao${numFracao}`]: novoMes,
      },
    }));
  };

  // Salvar Escala Definitiva do Militar
  const handleSalvarEscalaMilitar = async (op) => {
    const selecao = selecoesMilitares[op.id] || {};
    const mod = op.modalidade || '2_ETAPAS_15';
    const anoCampanha = campanhaSelecionada?.ano_referencia || (new Date().getFullYear() + 1);

    let parcelas = [];
    if (mod === '1_ETAPA_30') {
      const m1 = selecao.fracao1 || extrairMesDeDetalhes(op.opcao_1_detalhes, '01');
      parcelas = [{ etapa: 1, dias: 30, mes: m1, data_inicio: `${anoCampanha}-${m1}-01` }];
    } else if (mod === '2_ETAPAS_15') {
      const m1 = selecao.fracao1 || extrairMesDeDetalhes(op.opcao_1_detalhes, '01');
      const m2 = selecao.fracao2 || extrairMesDeDetalhes(op.opcao_2_detalhes, '07');
      parcelas = [
        { etapa: 1, dias: 15, mes: m1, data_inicio: `${anoCampanha}-${m1}-01` },
        { etapa: 2, dias: 15, mes: m2, data_inicio: `${anoCampanha}-${m2}-01` },
      ];
    } else if (mod === '3_ETAPAS_10') {
      const m1 = selecao.fracao1 || extrairMesDeDetalhes(op.opcao_1_detalhes, '01');
      const m2 = selecao.fracao2 || extrairMesDeDetalhes(op.opcao_2_detalhes, '07');
      const m3 = selecao.fracao3 || extrairMesDeDetalhes(op.opcao_3_detalhes, '10');
      parcelas = [
        { etapa: 1, dias: 10, mes: m1, data_inicio: `${anoCampanha}-${m1}-01` },
        { etapa: 2, dias: 10, mes: m2, data_inicio: `${anoCampanha}-${m2}-01` },
        { etapa: 3, dias: 10, mes: m3, data_inicio: `${anoCampanha}-${m3}-01` },
      ];
    }

    const mesesResumoFormatado = parcelas.map((p) => `${getNomeMesPorVal(p.mes)} (${p.dias}d)`).join(' + ');

    setActionLoading(true);
    try {
      await base44.functions.invoke('portal_servicos', {
        acao: 'PLANO_DECISAO_CAMADA_1',
        opcao_id: op.id,
        decisao_camada_1: {
          opcao_escolhida: 'ESCALA_VALIDADA',
          parcelas: parcelas,
          resumo_meses: mesesResumoFormatado,
          justificativa: selecao.justificativa || '',
          gestor_nome: 'Gestor da Unidade',
        },
      });

      setMilitaresEmEdicao((prev) => ({ ...prev, [op.id]: false }));
      setFeedback({ type: 'success', msg: `Escala salva para ${op.militar_posto} ${op.militar_nome}: ${mesesResumoFormatado}` });
      await carregarPainel(campanhaSelecionada?.id);
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Falha ao salvar escala.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Marcar como Não Contemplado
  const handleConfirmarNaoContemplado = async () => {
    if (!modalNaoContemplado.opcao) return;
    const op = modalNaoContemplado.opcao;

    setActionLoading(true);
    try {
      await base44.functions.invoke('portal_servicos', {
        acao: 'PLANO_DECISAO_CAMADA_1',
        opcao_id: op.id,
        decisao_camada_1: {
          opcao_escolhida: 'NAO_CONTEMPLADO',
          parcelas: [],
          justificativa: modalNaoContemplado.justificativa || 'Militar não contemplado neste plano de férias.',
          gestor_nome: 'Gestor da Unidade',
        },
      });

      setModalNaoContemplado({ open: false, opcao: null, justificativa: '' });
      setMilitaresEmEdicao((prev) => ({ ...prev, [op.id]: false }));
      setFeedback({ type: 'success', msg: `${op.militar_posto} ${op.militar_nome} registrado como NÃO CONTEMPLADO.` });
      await carregarPainel(campanhaSelecionada?.id);
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Falha ao registrar não contemplado.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Geração de Férias Específica desta Campanha
  const handleGerarLoteFerias = async () => {
    if (!campanhaSelecionada) return;

    const totalContemplados = opcoes.filter(
      (o) => o.status_camada_1 !== 'Pendente' && o.status_camada_1 !== 'Nao_Contemplado' && o.decisao_camada_1_opcao !== 'NAO_CONTEMPLADO' && !o.gerado_ferias_efetivas
    ).length;

    if (totalContemplados === 0) {
      alert('Não há militares com escala salva prontos para geração de férias nesta campanha.');
      return;
    }

    if (!window.confirm(`Confirma a geração de férias para os ${totalContemplados} militares contemplados da campanha "${campanhaSelecionada.titulo}"? A campanha será encerrada e as férias cadastradas no SGP.`)) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await base44.functions.invoke('portal_servicos', {
        acao: 'PLANO_GERAR_LOTE_FERIAS',
        campanha_id: campanhaSelecionada.id,
        ano_referencia: Number(campanhaSelecionada.ano_referencia),
      });

      setFeedback({ type: 'success', msg: res.data?.message || 'Férias geradas no SGP e campanha encerrada com sucesso!' });
      await carregarPainel(campanhaSelecionada.id);
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Falha na geração em lote.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Ações Administrativas de Campanha (Protegidas pelo Modo Admin)
  const handleDesativarCampanhaAdmin = async (camp) => {
    if (!window.confirm(`Modo Admin: Deseja desativar a campanha "${camp.titulo}"? Ela deixará de receber respostas e passará para o histórico de consulta.`)) return;
    setActionLoading(true);
    try {
      await base44.functions.invoke('portal_servicos', {
        acao: 'CAMPANHA_DESATIVAR',
        campanha_id: camp.id,
      });
      setFeedback({ type: 'success', msg: `Campanha "${camp.titulo}" desativada.` });
      await carregarPainel();
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Falha ao desativar campanha.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleArquivarCampanhaAdmin = async (camp) => {
    if (!window.confirm(`Modo Admin: Deseja arquivar a campanha "${camp.titulo}"?`)) return;
    setActionLoading(true);
    try {
      await base44.functions.invoke('portal_servicos', {
        acao: 'CAMPANHA_ARQUIVAR',
        campanha_id: camp.id,
      });
      setFeedback({ type: 'success', msg: `Campanha "${camp.titulo}" arquivada.` });
      await carregarPainel();
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Falha ao arquivar campanha.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleExcluirCampanhaAdmin = async (camp) => {
    if (!window.confirm(`ALERTA MODO ADMIN: Tem certeza que deseja EXCLUIR a campanha "${camp.titulo}"? Todas as opções já registradas pelos militares permanecem protegidas no sistema.`)) return;
    setActionLoading(true);
    try {
      await base44.functions.invoke('portal_servicos', {
        acao: 'CAMPANHA_EXCLUIR',
        campanha_id: camp.id,
      });
      setFeedback({ type: 'success', msg: `Campanha "${camp.titulo}" excluída com sucesso.` });
      await carregarPainel();
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Falha ao excluir campanha.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Separação de Campanhas Ativas vs Histórico (Desativadas/Encerradas/Arquivadas)
  const campanhasAtivas = useMemo(() => {
    return campanhas.filter((c) => c.status === 'Aberta_Coleta' || c.status === 'Ativa');
  }, [campanhas]);

  const campanhasHistorico = useMemo(() => {
    return campanhas.filter((c) => c.status !== 'Aberta_Coleta' && c.status !== 'Ativa');
  }, [campanhas]);

  // Unidades únicas
  const unidadesDisponiveis = useMemo(() => {
    const setU = new Set();
    opcoes.forEach((o) => {
      if (o.lotacao_nome) setU.add(o.lotacao_nome);
    });
    return Array.from(setU).sort();
  }, [opcoes]);

  // Contagem de efetivo por mês
  const contagemPorMes = Array(12).fill(0);
  opcoes.forEach((op) => {
    if (op.status_camada_1 === 'Nao_Contemplado' || op.decisao_camada_1_opcao === 'NAO_CONTEMPLADO') return;
    const detalhes = op.decisao_camada_1_detalhes || op.opcao_1_detalhes;
    if (detalhes && detalhes !== '[]') {
      try {
        const pList = JSON.parse(detalhes);
        pList.forEach((p) => {
          const mNum = parseInt(p.mes || p.data_inicio?.slice(5, 7), 10);
          if (mNum >= 1 && mNum <= 12) contagemPorMes[mNum - 1]++;
        });
      } catch (_err) {}
    }
  });

  const totalSalvos = opcoes.filter((o) => o.status_camada_1 !== 'Pendente' && o.status_camada_1 !== 'Nao_Contemplado' && o.decisao_camada_1_opcao !== 'NAO_CONTEMPLADO').length;
  const totalNaoContemplados = opcoes.filter((o) => o.status_camada_1 === 'Nao_Contemplado' || o.decisao_camada_1_opcao === 'NAO_CONTEMPLADO').length;
  const totalGeradas = opcoes.filter((o) => o.gerado_ferias_efetivas).length;

  const isCampanhaEncerradaOuDesativada = campanhaSelecionada && (campanhaSelecionada.status === 'Encerrada' || campanhaSelecionada.status === 'Desativada' || campanhaSelecionada.status === 'Arquivada');

  // Filtragem dos Militares
  const opcoesFiltradas = useMemo(() => {
    return opcoes.filter((op) => {
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const nome = (op.militar_nome || '').toLowerCase();
        const posto = (op.militar_posto || '').toLowerCase();
        const mat = (op.militar_matricula || '').toLowerCase();
        const lotacao = (op.lotacao_nome || '').toLowerCase();
        if (!nome.includes(term) && !posto.includes(term) && !mat.includes(term) && !lotacao.includes(term)) {
          return false;
        }
      }

      const isNaoContemplado = op.status_camada_1 === 'Nao_Contemplado' || op.decisao_camada_1_opcao === 'NAO_CONTEMPLADO';
      const isGerado = Boolean(op.gerado_ferias_efetivas);
      const isSalvo = !isNaoContemplado && op.status_camada_1 !== 'Pendente';
      const isPendente = op.status_camada_1 === 'Pendente';

      if (filtroStatus === 'PENDENTE' && !isPendente) return false;
      if (filtroStatus === 'SALVO' && !isSalvo) return false;
      if (filtroStatus === 'NAO_CONTEMPLADO' && !isNaoContemplado) return false;
      if (filtroStatus === 'GERADO' && !isGerado) return false;

      if (filtroModalidade !== 'TODOS' && op.modalidade !== filtroModalidade) return false;
      if (filtroUnidade !== 'TODOS' && op.lotacao_nome !== filtroUnidade) return false;

      if (filtroMes !== 'TODOS') {
        const detalhes = op.decisao_camada_1_detalhes || op.opcao_1_detalhes;
        if (!detalhes || detalhes === '[]') return false;
        try {
          const pList = JSON.parse(detalhes);
          const temMes = pList.some((p) => (p.mes || p.data_inicio?.slice(5, 7)) === filtroMes);
          if (!temMes) return false;
        } catch (_e) {
          return false;
        }
      }

      return true;
    });
  }, [opcoes, searchTerm, filtroStatus, filtroModalidade, filtroUnidade, filtroMes]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-[#1e3a5f] rounded-full animate-spin"></div>
        <p className="text-sm text-slate-500 font-medium">Carregando plano anual de férias...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* CABEÇALHO SUPERIOR E TOGGLE DE MODO ADMIN */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shadow-inner">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-[#1e3a5f] tracking-tight flex items-center">
                Painel do Plano de Férias
              </h1>
              <p className="text-xs text-slate-500">
                Selecione uma campanha de férias para gerenciar suas opções e gerar os lançamentos no SGP
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setModoAdmin(!modoAdmin)}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-1.5 transition-all shadow-xs ${
                modoAdmin
                  ? 'bg-rose-700 text-white ring-2 ring-rose-300'
                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {modoAdmin ? <ShieldAlert className="w-4 h-4" /> : <Shield className="w-4 h-4 text-slate-500" />}
              <span>{modoAdmin ? 'Modo Admin: ATIVO' : 'Modo Admin'}</span>
            </button>
          </div>
        </div>

        {/* FEEDBACK ALERTS */}
        {feedback.msg && (
          <div className={`p-3.5 rounded-xl text-xs flex items-start space-x-2 animate-in fade-in ${
            feedback.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
            <span>{feedback.msg}</span>
          </div>
        )}

        {/* SEÇÃO 1: CAMPANHAS DE FÉRIAS ATIVAS NO SISTEMA */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center">
              <Megaphone className="w-4 h-4 mr-2 text-emerald-600" />
              Campanhas de Férias Ativas
            </h2>
            <span className="text-xs text-slate-500">
              Clique em uma campanha para gerenciar exclusivamente suas opções
            </span>
          </div>

          {campanhasAtivas.length === 0 ? (
            <Card className="border-slate-200 bg-white">
              <CardContent className="p-6 text-center text-xs text-slate-500">
                Nenhuma campanha de férias ativa no momento. Você pode consultar as campanhas no Histórico abaixo ou iniciar uma nova no Gestor de Campanhas.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {campanhasAtivas.map((camp) => {
                const isSelected = campanhaSelecionada?.id === camp.id;
                return (
                  <div
                    key={camp.id}
                    onClick={() => handleSelecionarCampanha(camp)}
                    className={`p-4 rounded-2xl border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-blue-50/80 border-[#1e3a5f] shadow-md ring-2 ring-[#1e3a5f]/20'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                        {camp.ano_referencia ? `Ano ${camp.ano_referencia}` : 'Ativa'}
                      </span>
                      {isSelected && (
                        <span className="flex items-center text-[10px] font-bold text-[#1e3a5f] bg-white px-2 py-0.5 rounded-full border border-blue-200">
                          <Check className="w-3 h-3 mr-1 text-emerald-600" /> Selecionada
                        </span>
                      )}
                    </div>

                    <strong className="text-sm font-extrabold text-slate-900 block truncate">
                      {camp.titulo}
                    </strong>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      Público: {camp.escopo_unidades_nomes || 'Geral'}
                    </p>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                      <span>Prazo: {camp.data_fim_militar || '-'}</span>
                      {modoAdmin && (
                        <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            title="Desativar Campanha (Admin)"
                            onClick={() => handleDesativarCampanhaAdmin(camp)}
                            className="p-1 rounded hover:bg-slate-200 text-slate-700"
                          >
                            <PowerOff className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Arquivar Campanha (Admin)"
                            onClick={() => handleArquivarCampanhaAdmin(camp)}
                            className="p-1 rounded hover:bg-slate-200 text-slate-700"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* DETALHES E GESTÃO DA CAMPANHA SELECIONADA */}
        {campanhaSelecionada && (
          <div className="space-y-6 pt-2">
            {/* BANNER DA CAMPANHA SELECIONADA */}
            <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm ${
              isCampanhaEncerradaOuDesativada
                ? 'bg-slate-100 border-slate-300 text-slate-700'
                : 'bg-white border-blue-200 text-slate-800'
            }`}>
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <h2 className="text-lg font-black text-slate-900">
                    {campanhaSelecionada.titulo}
                  </h2>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    campanhaSelecionada.status === 'Aberta_Coleta'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-200 text-slate-700'
                  }`}>
                    {campanhaSelecionada.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Ano {campanhaSelecionada.ano_referencia} • Escopo: <strong>{campanhaSelecionada.escopo_unidades_nomes || 'Toda a Corporação'}</strong> • Prazo Limite: {campanhaSelecionada.data_fim_militar || 'Não definido'}
                </p>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                {!isCampanhaEncerradaOuDesativada && (
                  <Button
                    type="button"
                    onClick={handleGerarLoteFerias}
                    disabled={actionLoading || totalSalvos === 0 || totalGeradas === totalSalvos}
                    className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-extrabold h-10 px-5 shadow-sm"
                  >
                    <Zap className="w-4 h-4 mr-1.5" />
                    {totalGeradas > 0 && totalGeradas === totalSalvos
                      ? 'Férias Desta Campanha Já Geradas'
                      : 'Gerar Férias no Sistema SGP'}
                  </Button>
                )}
              </div>
            </div>

            {/* CARDS DE STATS DA CAMPANHA SELECIONADA */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <Card className="border-slate-200 bg-white">
                <CardContent className="p-4 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-500 block">Opções Desta Campanha</span>
                    <strong className="text-xl text-[#1e3a5f] font-extrabold">{opcoes.length}</strong>
                  </div>
                  <Users className="w-8 h-8 text-blue-500 opacity-30" />
                </CardContent>
              </Card>

              <Card className="border-slate-200 bg-white">
                <CardContent className="p-4 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-500 block">Escalas Salvas / Prontas</span>
                    <strong className="text-xl text-emerald-700 font-extrabold">{totalSalvos}</strong>
                  </div>
                  <CheckCircle className="w-8 h-8 text-emerald-500 opacity-30" />
                </CardContent>
              </Card>

              <Card className="border-slate-200 bg-white">
                <CardContent className="p-4 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-500 block">Não Contemplados</span>
                    <strong className="text-xl text-rose-700 font-extrabold">{totalNaoContemplados}</strong>
                  </div>
                  <Ban className="w-8 h-8 text-rose-500 opacity-30" />
                </CardContent>
              </Card>

              <Card className="border-slate-200 bg-white">
                <CardContent className="p-4 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-500 block">Férias Geradas no SGP</span>
                    <strong className="text-xl text-purple-700 font-extrabold">{totalGeradas}</strong>
                  </div>
                  <Zap className="w-8 h-8 text-purple-500 opacity-30" />
                </CardContent>
              </Card>
            </div>

            {/* DISTRIBUIÇÃO DE EFETIVO POR MÊS */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="p-4 pb-2 border-b border-slate-100">
                <CardTitle className="text-xs sm:text-sm font-bold text-slate-800 flex items-center">
                  <CalendarDays className="w-4 h-4 mr-2 text-[#1e3a5f]" />
                  Distribuição de Efetivo Escalado nesta Campanha ({campanhaSelecionada.ano_referencia})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 text-xs">
                <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5 text-center">
                  {LISTA_MESES.map((m, idx) => {
                    const count = contagemPorMes[idx];
                    return (
                      <div
                        key={m.val}
                        className={`p-2 rounded-xl border ${
                          count > 0 ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <span className="text-[10px] text-slate-500 block truncate">{m.nome.slice(0, 3)}</span>
                        <strong className={`text-sm ${count > 0 ? 'text-[#1e3a5f]' : 'text-slate-400'}`}>
                          {count}
                        </strong>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* BARRA DE PESQUISA E FILTROS */}
            <Card className="border-slate-200 shadow-sm bg-white">
              <CardContent className="p-4 space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Pesquisar por nome do militar, nome de guerra, posto/graduação, matrícula ou lotação..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-8 h-10 text-xs rounded-xl bg-slate-50 border-slate-200 focus:bg-white"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block uppercase">Status da Escala</label>
                    <select
                      value={filtroStatus}
                      onChange={(e) => setFiltroStatus(e.target.value)}
                      className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none"
                    >
                      <option value="TODOS">Todos os Status ({opcoes.length})</option>
                      <option value="PENDENTE">Pendentes de Definição</option>
                      <option value="SALVO">Escalas Salvas / Prontas ({totalSalvos})</option>
                      <option value="NAO_CONTEMPLADO">Não Contemplados ({totalNaoContemplados})</option>
                      <option value="GERADO">Férias Geradas no SGP ({totalGeradas})</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block uppercase">Modalidade</label>
                    <select
                      value={filtroModalidade}
                      onChange={(e) => setFiltroModalidade(e.target.value)}
                      className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none"
                    >
                      <option value="TODOS">Todas as Modalidades</option>
                      <option value="1_ETAPA_30">Integral (30 dias)</option>
                      <option value="2_ETAPAS_15">2 Frações (15 + 15 dias)</option>
                      <option value="3_ETAPAS_10">3 Frações (10 + 10 + 10 dias)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block uppercase">Unidade / Lotação</label>
                    <select
                      value={filtroUnidade}
                      onChange={(e) => setFiltroUnidade(e.target.value)}
                      className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none"
                    >
                      <option value="TODOS">Todas as Unidades</option>
                      {unidadesDisponiveis.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block uppercase">Mês Escalado</label>
                    <select
                      value={filtroMes}
                      onChange={(e) => setFiltroMes(e.target.value)}
                      className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none"
                    >
                      <option value="TODOS">Qualquer Mês</option>
                      {LISTA_MESES.map((m) => (
                        <option key={m.val} value={m.val}>
                          {m.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px] text-slate-500">
                  <span>
                    Exibindo <strong>{opcoesFiltradas.length}</strong> de <strong>{opcoes.length}</strong> militares
                  </span>
                  {(searchTerm || filtroStatus !== 'TODOS' || filtroModalidade !== 'TODOS' || filtroUnidade !== 'TODOS' || filtroMes !== 'TODOS') && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm('');
                        setFiltroStatus('TODOS');
                        setFiltroModalidade('TODOS');
                        setFiltroUnidade('TODOS');
                        setFiltroMes('TODOS');
                      }}
                      className="text-blue-600 hover:text-blue-800 font-bold"
                    >
                      Limpar filtros
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* LISTAGEM DE MILITARES */}
            <div className="space-y-4">
              {opcoesFiltradas.length === 0 ? (
                <Card className="border-slate-200 shadow-sm bg-white">
                  <CardContent className="p-8 text-center text-slate-500 text-xs">
                    Nenhuma opção de militar encontrada para os filtros selecionados nesta campanha.
                  </CardContent>
                </Card>
              ) : (
                opcoesFiltradas.map((op) => {
                  const modalidade = op.modalidade || '2_ETAPAS_15';
                  const numFracoes = modalidade === '1_ETAPA_30' ? 1 : modalidade === '3_ETAPAS_10' ? 3 : 2;
                  const diasPorFracao = modalidade === '1_ETAPA_30' ? [30] : modalidade === '3_ETAPAS_10' ? [10, 10, 10] : [15, 15];

                  const mesOpcao1 = extrairMesDeDetalhes(op.opcao_1_detalhes, '01');
                  const mesOpcao2 = extrairMesDeDetalhes(op.opcao_2_detalhes, '07');
                  const mesOpcao3 = extrairMesDeDetalhes(op.opcao_3_detalhes, '10');

                  const militarSelecao = selecoesMilitares[op.id] || {
                    fracao1: mesOpcao1,
                    fracao2: mesOpcao2,
                    fracao3: mesOpcao3,
                  };

                  const isNaoContemplado = op.status_camada_1 === 'Nao_Contemplado' || op.decisao_camada_1_opcao === 'NAO_CONTEMPLADO';
                  const isGerado = Boolean(op.gerado_ferias_efetivas);
                  const isSalvo = !isNaoContemplado && op.status_camada_1 !== 'Pendente';
                  const isEditing = militaresEmEdicao[op.id] === true;

                  return (
                    <Card key={op.id} className="border-slate-200 bg-white shadow-xs rounded-2xl overflow-hidden">
                      <CardHeader className="p-4 bg-slate-50/70 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-2xl bg-[#1e3a5f] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs">
                            {op.militar_posto?.slice(0, 3) || 'MIL'}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-extrabold text-slate-900 text-sm">
                                {op.militar_posto} {op.militar_nome}
                              </span>
                              <span className="text-xs text-slate-400 font-mono">
                                Mat: {op.militar_matricula || '-'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500">
                              Lotação: <strong className="text-slate-700">{op.lotacao_nome || 'Unidade'}</strong> • Período Aquisitivo: <strong>{op.periodo_inicio} a {op.periodo_fim}</strong>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <span className="px-2.5 py-1 rounded-xl bg-slate-200 text-slate-800 text-[11px] font-bold">
                            {modalidade === '1_ETAPA_30' ? 'Integral (30d)' : modalidade === '3_ETAPAS_10' ? '3 Frações (10+10+10d)' : '2 Frações (15+15d)'}
                          </span>

                          <span className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center shadow-2xs ${
                            isGerado
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : isNaoContemplado
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : isSalvo
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}>
                            {isGerado ? (
                              <>
                                <Lock className="w-3 h-3 mr-1" />
                                Férias Geradas no SGP
                              </>
                            ) : isNaoContemplado ? (
                              <>
                                <Ban className="w-3 h-3 mr-1" />
                                Não Contemplado
                              </>
                            ) : isSalvo ? (
                              <>
                                <Check className="w-3 h-3 mr-1" />
                                Escala Salva / Pronta
                              </>
                            ) : (
                              <>
                                <Clock className="w-3 h-3 mr-1" />
                                Pendente de Definição
                              </>
                            )}
                          </span>
                        </div>
                      </CardHeader>

                      <CardContent className="p-4 sm:p-5 space-y-4 text-xs">
                        {/* HISTÓRICO PERMANENTE DAS OPÇÕES */}
                        <div className="p-3 bg-slate-100/60 rounded-2xl border border-slate-200 space-y-1.5">
                          <span className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wide flex items-center">
                            <Star className="w-3 h-3 mr-1 text-amber-500 fill-amber-500" />
                            Histórico de Preferências Registradas pelo Militar no Portal:
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                            <div className="px-2.5 py-1.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                              <span className="text-slate-500 text-[11px]">1ª Opção:</span>
                              <strong className="text-slate-900 font-bold">{getNomeMesPorVal(mesOpcao1)}</strong>
                            </div>
                            <div className="px-2.5 py-1.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                              <span className="text-slate-500 text-[11px]">2ª Opção:</span>
                              <strong className="text-slate-900 font-bold">{getNomeMesPorVal(mesOpcao2)}</strong>
                            </div>
                            <div className="px-2.5 py-1.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                              <span className="text-slate-500 text-[11px]">3ª Opção:</span>
                              <strong className="text-slate-900 font-bold">{getNomeMesPorVal(mesOpcao3)}</strong>
                            </div>
                          </div>
                        </div>

                        {/* ESTADO DE EXIBIÇÃO / EDIÇÃO */}
                        {isGerado ? (
                          <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-200 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-purple-950 text-xs flex items-center">
                                <Lock className="w-3.5 h-3.5 mr-1 text-purple-700" />
                                Escalação Oficial Consolidada & Gerada:
                              </span>
                              <span className="text-[11px] text-purple-800 font-semibold">
                                Férias registradas no módulo SGP
                              </span>
                            </div>
                            <p className="text-sm font-black text-purple-900">
                              {op.decisao_camada_1_meses}
                            </p>
                          </div>
                        ) : isNaoContemplado && !isEditing ? (
                          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="space-y-1">
                              <span className="font-extrabold text-rose-950 text-xs flex items-center">
                                <Ban className="w-4 h-4 mr-1.5 text-rose-600" />
                                Militar Não Contemplado nesta Campanha
                              </span>
                              <p className="text-rose-800 text-[11px]">
                                {op.justificativa_ajuste_gestor || 'Nenhuma fração será gerada para este militar nesta campanha.'}
                              </p>
                            </div>

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setMilitaresEmEdicao((prev) => ({ ...prev, [op.id]: true }))}
                              className="border-rose-300 text-rose-900 hover:bg-rose-100 rounded-xl text-xs font-bold h-8 shrink-0"
                            >
                              <Edit3 className="w-3.5 h-3.5 mr-1" />
                              Alterar / Contemplar
                            </Button>
                          </div>
                        ) : isSalvo && !isEditing ? (
                          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="space-y-1">
                              <span className="font-extrabold text-emerald-950 text-xs flex items-center">
                                <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-700" />
                                Escala Definida e Pronta para Geração:
                              </span>
                              <p className="text-sm font-extrabold text-emerald-900">
                                {op.decisao_camada_1_meses}
                              </p>
                            </div>

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setMilitaresEmEdicao((prev) => ({ ...prev, [op.id]: true }))}
                              className="border-emerald-300 text-emerald-900 hover:bg-emerald-100 rounded-xl text-xs font-bold h-8 shrink-0"
                            >
                              <Edit3 className="w-3.5 h-3.5 mr-1" />
                              Editar Escala
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {Array.from({ length: numFracoes }).map((_, idx) => {
                              const numFracao = idx + 1;
                              const dias = diasPorFracao[idx] || 15;
                              const mesAtualFracao = militarSelecao[`fracao${numFracao}`] || '01';

                              const isOpcao1 = mesAtualFracao === mesOpcao1;
                              const isOpcao2 = mesAtualFracao === mesOpcao2;
                              const isOpcao3 = mesAtualFracao === mesOpcao3;
                              const isOutroMes = !isOpcao1 && !isOpcao2 && !isOpcao3;

                              return (
                                <div
                                  key={numFracao}
                                  className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-extrabold text-slate-800 text-xs flex items-center">
                                      <Layers className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                                      {numFracoes === 1 ? 'Período Único' : `${numFracao}ª Fração`} ({dias} dias):
                                    </span>
                                    <span className="text-[11px] font-bold text-slate-600">
                                      Mês Selecionado: <strong className="text-blue-900 bg-white px-2 py-0.5 rounded-md border border-blue-200">{getNomeMesPorVal(mesAtualFracao)}</strong>
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleMudarMesFracao(op.id, numFracao, mesOpcao1)}
                                      className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                                        isOpcao1
                                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm ring-2 ring-emerald-200'
                                          : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/30'
                                      }`}
                                    >
                                      <div>
                                        <span className={`text-[10px] block font-bold uppercase tracking-wider ${isOpcao1 ? 'text-emerald-100' : 'text-emerald-700'}`}>
                                          ⭐ 1ª Opção
                                        </span>
                                        <strong className="text-xs block">{getNomeMesPorVal(mesOpcao1)}</strong>
                                      </div>
                                      {isOpcao1 && <Check className="w-4 h-4 text-white shrink-0 ml-1" />}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleMudarMesFracao(op.id, numFracao, mesOpcao2)}
                                      className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                                        isOpcao2
                                          ? 'bg-blue-700 border-blue-700 text-white shadow-sm ring-2 ring-blue-200'
                                          : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50/30'
                                      }`}
                                    >
                                      <div>
                                        <span className={`text-[10px] block font-bold uppercase tracking-wider ${isOpcao2 ? 'text-blue-100' : 'text-slate-500'}`}>
                                          2ª Opção
                                        </span>
                                        <strong className="text-xs block">{getNomeMesPorVal(mesOpcao2)}</strong>
                                      </div>
                                      {isOpcao2 && <Check className="w-4 h-4 text-white shrink-0 ml-1" />}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleMudarMesFracao(op.id, numFracao, mesOpcao3)}
                                      className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                                        isOpcao3
                                          ? 'bg-blue-700 border-blue-700 text-white shadow-sm ring-2 ring-blue-200'
                                          : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50/30'
                                      }`}
                                    >
                                      <div>
                                        <span className={`text-[10px] block font-bold uppercase tracking-wider ${isOpcao3 ? 'text-blue-100' : 'text-slate-500'}`}>
                                          3ª Opção
                                        </span>
                                        <strong className="text-xs block">{getNomeMesPorVal(mesOpcao3)}</strong>
                                      </div>
                                      {isOpcao3 && <Check className="w-4 h-4 text-white shrink-0 ml-1" />}
                                    </button>

                                    <div className={`p-2 rounded-xl border flex flex-col justify-center transition-all ${
                                      isOutroMes
                                        ? 'bg-purple-50 border-purple-400 ring-2 ring-purple-200'
                                        : 'bg-white border-slate-200'
                                    }`}>
                                      <span className="text-[10px] font-bold text-slate-600 block uppercase tracking-wider">
                                        ✏️ Outro Mês
                                      </span>
                                      <select
                                        value={isOutroMes ? mesAtualFracao : ''}
                                        onChange={(e) => {
                                          if (e.target.value) {
                                            handleMudarMesFracao(op.id, numFracao, e.target.value);
                                          }
                                        }}
                                        className="w-full h-7 px-1.5 bg-transparent border-0 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                                      >
                                        <option value="">Selecionar...</option>
                                        {LISTA_MESES.map((m) => (
                                          <option key={m.val} value={m.val}>
                                            {m.nome}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}

                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setModalNaoContemplado({ open: true, opcao: op, justificativa: '' })}
                                className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 text-xs font-bold rounded-xl h-9"
                              >
                                <Ban className="w-3.5 h-3.5 mr-1" />
                                🚫 Marcar como Não Contemplado
                              </Button>

                              <div className="flex items-center space-x-2">
                                {isSalvo && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setMilitaresEmEdicao((prev) => ({ ...prev, [op.id]: false }))}
                                    className="text-slate-500 hover:text-slate-800 text-xs rounded-xl h-9"
                                  >
                                    Cancelar
                                  </Button>
                                )}

                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={actionLoading}
                                  onClick={() => handleSalvarEscalaMilitar(op)}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold h-9 px-5 shadow-sm"
                                >
                                  <Check className="w-3.5 h-3.5 mr-1.5" />
                                  Salvar Escala Definitiva
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* SEÇÃO 2: HISTÓRICO DE CAMPANHAS DE FÉRIAS (DESATIVADAS / ENCERRADAS / ARQUIVADAS) */}
        {campanhasHistorico.length > 0 && (
          <div className="space-y-3 pt-6 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-slate-500 flex items-center">
                <History className="w-4 h-4 mr-2" />
                Histórico de Campanhas de Férias (Encerradas / Desativadas / Arquivadas)
              </h2>
              <span className="text-[11px] text-slate-400">
                Disponíveis para consulta e auditoria de opções e férias geradas
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {campanhasHistorico.map((camp) => {
                const isSelected = campanhaSelecionada?.id === camp.id;
                return (
                  <div
                    key={camp.id}
                    onClick={() => handleSelecionarCampanha(camp)}
                    className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-slate-200/90 border-slate-400 shadow-sm ring-2 ring-slate-400'
                        : 'bg-slate-100/70 border-slate-200 hover:bg-slate-100 opacity-75'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-600 text-[10px] font-bold">
                        {camp.status} • Ano {camp.ano_referencia || '-'}
                      </span>
                      {isSelected && (
                        <span className="text-[10px] font-bold text-slate-700 bg-white px-2 py-0.5 rounded-md">
                          Em Consulta
                        </span>
                      )}
                    </div>

                    <strong className="text-xs font-bold text-slate-700 block truncate">
                      {camp.titulo}
                    </strong>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">
                      Público: {camp.escopo_unidades_nomes || 'Geral'}
                    </p>

                    {modoAdmin && (
                      <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-end space-x-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          title="Excluir Definitivamente (Admin)"
                          onClick={() => handleExcluirCampanhaAdmin(camp)}
                          className="p-1 rounded text-rose-600 hover:bg-rose-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* MODAL PARA JUSTIFICATIVA DE NÃO CONTEMPLADO */}
        {modalNaoContemplado.open && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 text-xs animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-slate-900 text-sm flex items-center text-rose-700">
                  <Ban className="w-4 h-4 mr-2" />
                  Marcar como Não Contemplado
                </h3>
                <button
                  type="button"
                  onClick={() => setModalNaoContemplado({ open: false, opcao: null, justificativa: '' })}
                  className="text-slate-400 hover:text-slate-600 font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-slate-700">
                  Militar: <strong>{modalNaoContemplado.opcao?.militar_posto} {modalNaoContemplado.opcao?.militar_nome}</strong>
                </p>
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                  O militar não terá frações de férias geradas nesta campanha. Você poderá alterar essa decisão a qualquer momento antes da geração final.
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Justificativa / Observação (Opcional):
                  </label>
                  <textarea
                    rows={3}
                    value={modalNaoContemplado.justificativa}
                    onChange={(e) => setModalNaoContemplado({ ...modalNaoContemplado, justificativa: e.target.value })}
                    placeholder="Ex: Excedente de efetivo no período / adiamento solicitado."
                    className="w-full p-3 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModalNaoContemplado({ open: false, opcao: null, justificativa: '' })}
                  className="text-xs h-9 rounded-xl"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleConfirmarNaoContemplado}
                  disabled={actionLoading}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold h-9 px-4 rounded-xl shadow-xs"
                >
                  Confirmar Não Contemplado
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
