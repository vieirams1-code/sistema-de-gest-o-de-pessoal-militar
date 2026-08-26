import React, { useState, useEffect, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import {
  CheckCircle2,
  Edit3,
  Ban,
  Lock,
  Trash2,
  History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import ResumoCotasMensais from '@/components/ferias-portal/ResumoCotasMensais';

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

function formatarDataBR(dataStr) {
  if (!dataStr) return '-';
  const str = String(dataStr).trim();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  return str;
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

  // POPUP LATERAL (DRAWER) E DESTAQUE TEMPORÁRIO DE 2 SEGUNDOS
  const [militarModalAberto, setMilitarModalAberto] = useState(null);
  const [militarDestaqueAmareloId, setMilitarDestaqueAmareloId] = useState(null);
  const destaqueTimerRef = useRef(null);

  // Quantitativo total de efetivo para cálculo do teto de 10%
  const [totalEfetivoGeral, setTotalEfetivoGeral] = useState(0);

  // Filtros & Pesquisa
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('TODOS');
  const [filtroModalidade, setFiltroModalidade] = useState('TODOS');
  const [filtroUnidade, setFiltroUnidade] = useState('TODOS');
  const [filtroMes, setFiltroMes] = useState('TODOS');

  // Modal para Justificativa de Não Contemplado
  const [modalNaoContemplado, setModalNaoContemplado] = useState({ open: false, opcao: null, justificativa: '' });

  // Função para fechar o popup lateral e ativar o destaque amarelo de 2 segundos
  const handleFecharPopupLateral = (opIdTarget = null) => {
    const idParaDestacar = opIdTarget || militarModalAberto?.id;
    setMilitarModalAberto(null);

    if (idParaDestacar) {
      setMilitarDestaqueAmareloId(idParaDestacar);
      if (destaqueTimerRef.current) {
        clearTimeout(destaqueTimerRef.current);
      }
      destaqueTimerRef.current = setTimeout(() => {
        setMilitarDestaqueAmareloId(null);
      }, 2000);
    }
  };

  useEffect(() => {
    return () => {
      if (destaqueTimerRef.current) {
        clearTimeout(destaqueTimerRef.current);
      }
    };
  }, []);

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
        selected = listaCampanhas.find((c) => c.status === 'Aberta_Coleta' || c.status === 'Ativa') || listaCampanhas[0];
      }
      setCampanhaSelecionada(selected);

      // 2. Opções da campanha selecionada
      const listaOpcoes = res.data?.opcoes || [];
      setOpcoes(listaOpcoes);

      // 3. Carrega o quantitativo total de militares ativos para cálculo real de cotas e percentual
      try {
        const milList = await base44.entities.Militar.list();
        const ativos = (milList || []).filter(
          (m) => m.situacao !== 'Inativo' && m.status !== 'Inativo' && m.situacao !== 'Excluído' && m.situacao !== 'Falecido'
        );
        setTotalEfetivoGeral(ativos.length || milList?.length || 0);
      } catch (_milErr) {
        console.warn('Erro ao carregar efetivo total para cotas:', _milErr);
      }

      const initialMap = {};
      const initialEditing = {};

      listaOpcoes.forEach((op) => {
        const mes1 = extrairMesDeDetalhes(op.opcao_1_detalhes, '01');
        let mes2 = extrairMesDeDetalhes(op.opcao_2_detalhes, '07');
        if (mes2 === mes1) {
          mes2 = extrairMesDeDetalhes(op.opcao_3_detalhes, '08');
          if (mes2 === mes1) mes2 = mes1 === '01' ? '07' : '01';
        }
        let mes3 = extrairMesDeDetalhes(op.opcao_3_detalhes, '10');
        if (mes3 === mes1 || mes3 === mes2) {
          mes3 = ['01', '07', '10', '11', '12'].find((m) => m !== mes1 && m !== mes2) || '10';
        }

        if (op.decisao_camada_1_detalhes && op.decisao_camada_1_detalhes !== '[]') {
          try {
            const salvas = JSON.parse(op.decisao_camada_1_detalhes);
            let s1 = salvas[0]?.mes || salvas[0]?.data_inicio?.slice(5, 7) || mes1;
            let s2 = salvas[1]?.mes || salvas[1]?.data_inicio?.slice(5, 7) || mes2;
            let s3 = salvas[2]?.mes || salvas[2]?.data_inicio?.slice(5, 7) || mes3;
            if (s2 === s1) s2 = mes2 !== s1 ? mes2 : '07';
            if (s3 === s1 || s3 === s2) s3 = ['01', '07', '10', '11', '12'].find((m) => m !== s1 && m !== s2) || '10';

            initialMap[op.id] = {
              fracao1: s1,
              fracao2: s2,
              fracao3: s3,
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
          initialEditing[op.id] = selected?.status === 'Aberta_Coleta';
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
    setSelecoesMilitares((prev) => {
      const atual = { ...(prev[opId] || {}) };
      const fracaoKey = `fracao${numFracao}`;
      const mesAntigo = atual[fracaoKey];

      // Se outra fração já estava usando esse novoMes, transfere o mês anterior para evitar duplicidade
      [1, 2, 3].forEach((outroNum) => {
        if (outroNum !== numFracao) {
          const outroKey = `fracao${outroNum}`;
          if (atual[outroKey] === novoMes) {
            atual[outroKey] = mesAntigo || '01';
          }
        }
      });

      atual[fracaoKey] = novoMes;
      return {
        ...prev,
        [opId]: atual,
      };
    });
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
      if (m1 === m2) {
        setFeedback({ type: 'error', msg: 'Para férias de 2 frações, cada fração deve ser escalada em um mês diferente.' });
        alert('Atenção: A 1ª e 2ª fração não podem ser no mesmo mês. Por favor, escolha meses distintos.');
        return;
      }
      parcelas = [
        { etapa: 1, dias: 15, mes: m1, data_inicio: `${anoCampanha}-${m1}-01` },
        { etapa: 2, dias: 15, mes: m2, data_inicio: `${anoCampanha}-${m2}-01` },
      ];
    } else if (mod === '3_ETAPAS_10') {
      const m1 = selecao.fracao1 || extrairMesDeDetalhes(op.opcao_1_detalhes, '01');
      const m2 = selecao.fracao2 || extrairMesDeDetalhes(op.opcao_2_detalhes, '07');
      const m3 = selecao.fracao3 || extrairMesDeDetalhes(op.opcao_3_detalhes, '10');
      if (m1 === m2 || m1 === m3 || m2 === m3) {
        setFeedback({ type: 'error', msg: 'Para férias de 3 frações, cada fração deve ser escalada em um mês diferente.' });
        alert('Atenção: Não é permitido repetir meses entre as frações de férias. Por favor, escolha meses distintos.');
        return;
      }
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
      handleFecharPopupLateral(op.id);
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

      const opId = op.id;
      setModalNaoContemplado({ open: false, opcao: null, justificativa: '' });
      setMilitaresEmEdicao((prev) => ({ ...prev, [opId]: false }));
      setFeedback({ type: 'success', msg: `${op.militar_posto} ${op.militar_nome} registrado como NÃO CONTEMPLADO.` });
      await carregarPainel(campanhaSelecionada?.id);
      handleFecharPopupLateral(opId);
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

  const totalPendentes = opcoes.filter((o) => o.status_camada_1 === 'Pendente').length;
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
    <div className="flex flex-col min-h-screen bg-slate-100 font-sans">
      {/* HEADER PRINCIPAL IDÊNTICO AO PREVIEW TESTADO */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0 shadow-xs z-10">
        <div className="flex items-center gap-3">
          <div className="bg-green-100 text-green-700 p-2.5 rounded-xl shrink-0">
            <i className="ph ph-calendar-check text-2xl"></i>
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900">
                {campanhaSelecionada ? campanhaSelecionada.titulo : 'Gestão de Férias'}
              </h1>
              {campanhaSelecionada && (
                <span className="bg-green-100 text-green-700 text-xs px-2.5 py-0.5 rounded-full border border-green-200 uppercase font-bold tracking-wide">
                  {campanhaSelecionada.status === 'Aberta_Coleta' ? 'Coleta Aberta' : campanhaSelecionada.status}
                </span>
              )}
            </div>

            {/* SELETOR DE CAMPANHA QUANDO HOUVER MÚLTIPLAS */}
            {campanhas.length > 1 && (
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs text-slate-500 font-medium">Campanha:</span>
                <select
                  value={campanhaSelecionada?.id || ''}
                  onChange={(e) => {
                    const c = campanhas.find((item) => item.id === e.target.value);
                    if (c) handleSelecionarCampanha(c);
                  }}
                  className="text-xs bg-slate-50 border border-slate-300 rounded-md px-2 py-0.5 font-bold text-slate-800 outline-none cursor-pointer"
                >
                  {campanhas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.titulo} ({c.status})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* AÇÕES NO TOPO: ADMIN E GERAÇÃO NO SGP */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => setModoAdmin(!modoAdmin)}
            className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              modoAdmin
                ? 'bg-rose-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <i className={`ph ${modoAdmin ? 'ph-shield-warning' : 'ph-shield'} text-base`}></i>
            <span>{modoAdmin ? 'Admin ON' : 'Admin'}</span>
          </button>

          {!isCampanhaEncerradaOuDesativada && (
            <button
              type="button"
              onClick={handleGerarLoteFerias}
              disabled={actionLoading || totalSalvos === 0 || totalGeradas === totalSalvos}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-all text-white cursor-pointer ${
                totalSalvos > 0 && totalGeradas !== totalSalvos
                  ? 'bg-amber-500 hover:bg-amber-600'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              <i className="ph ph-lightning text-base"></i>
              <span>
                {totalGeradas > 0 && totalGeradas === totalSalvos
                  ? 'Férias Desta Campanha Já Geradas'
                  : `Gerar Férias no Sistema SGP (${totalSalvos})`}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* FEEDBACK ALERTS */}
      {feedback.msg && (
        <div className="px-6 pt-4">
          <div
            className={`p-3.5 rounded-xl text-xs flex items-start gap-2 animate-in fade-in ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}
          >
            <i className={`ph ${feedback.type === 'success' ? 'ph-check-circle' : 'ph-warning-circle'} text-base shrink-0 mt-0.5`}></i>
            <span>{feedback.msg}</span>
          </div>
        </div>
      )}

      {/* CORPO DO PAINEL */}
      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        {/* PAINEL SUPERIOR DE COTAS MENSAIS E TETO DE 10% */}
        {campanhaSelecionada && (
          <ResumoCotasMensais
            totalEfetivo={
              campanhaSelecionada?.total_militares_escopo ||
              campanhaSelecionada?.efetivo_total ||
              (totalEfetivoGeral > 0 ? totalEfetivoGeral : Math.max(opcoes.length, 100))
            }
            solicitacoes={opcoes}
            titulo={`Distribuição Mensal & Teto de Pagamento (10%) • ${campanhaSelecionada.titulo}`}
          />
        )}

        {/* BARRA DE FILTROS & PESQUISA */}
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          {/* TABS DE STATUS */}
          <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto">
            <button
              onClick={() => setFiltroStatus('TODOS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                filtroStatus === 'TODOS'
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos ({opcoes.length})
            </button>
            <button
              onClick={() => setFiltroStatus('PENDENTE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                filtroStatus === 'PENDENTE'
                  ? 'bg-orange-600 text-white'
                  : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
              }`}
            >
              Pendentes ({totalPendentes})
            </button>
            <button
              onClick={() => setFiltroStatus('SALVO')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                filtroStatus === 'SALVO'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              Escala Salva ({totalSalvos})
            </button>
            <button
              onClick={() => setFiltroStatus('NAO_CONTEMPLADO')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                filtroStatus === 'NAO_CONTEMPLADO'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              Não Contemplados ({totalNaoContemplados})
            </button>
            <button
              onClick={() => setFiltroStatus('GERADO')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                filtroStatus === 'GERADO'
                  ? 'bg-purple-600 text-white'
                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
              }`}
            >
              Férias Geradas ({totalGeradas})
            </button>
          </div>

          {/* BUSCA POR TEXTO */}
          <div className="relative w-full md:w-80">
            <i className="ph ph-magnifying-glass absolute left-3 top-2.5 text-slate-400 text-base"></i>
            <input
              type="text"
              placeholder="Buscar por nome, matrícula, posto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 outline-none focus:bg-white focus:border-slate-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <i className="ph ph-x text-sm"></i>
              </button>
            )}
          </div>
        </div>

        {/* TABELA DE MILITARES NO DESIGN CLEAN IDÊNTICO AO PREVIEW */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          {opcoesFiltradas.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              <i className="ph ph-users text-4xl text-slate-300 mb-2 block"></i>
              Nenhum militar encontrado para os filtros selecionados nesta campanha.
            </div>
          ) : (
            opcoesFiltradas.map((op) => {
              const modalidade = op.modalidade || '2_ETAPAS_15';
              const isNaoContemplado = op.status_camada_1 === 'Nao_Contemplado' || op.decisao_camada_1_opcao === 'NAO_CONTEMPLADO';
              const isGerado = Boolean(op.gerado_ferias_efetivas);
              const isSalvo = !isNaoContemplado && op.status_camada_1 !== 'Pendente';
              const isDestacadoAmarelo = militarDestaqueAmareloId === op.id;

              return (
                <div
                  key={op.id}
                  onClick={() => setMilitarModalAberto(op)}
                  className={`grid grid-cols-12 gap-4 p-4 items-center border-b border-slate-100 transition-all duration-700 cursor-pointer ${
                    isDestacadoAmarelo
                      ? 'bg-amber-100/90 border-amber-400 ring-2 ring-amber-300 shadow-md'
                      : 'hover:bg-blue-50/60 bg-white'
                  }`}
                >
                  <div className="col-span-12 md:col-span-5 flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-800 text-white rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                      {op.militar_posto?.slice(0, 3) || 'MIL'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 text-sm truncate">
                        {op.militar_posto} {op.militar_nome}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        Mat: {op.militar_matricula || '-'} • {op.lotacao_nome || 'Unidade'}
                      </p>
                    </div>
                  </div>

                  <div className="col-span-6 md:col-span-3">
                    <p className="text-sm font-medium text-slate-800">
                      {modalidade === '1_ETAPA_30'
                        ? 'Integral (30d)'
                        : modalidade === '3_ETAPAS_10'
                        ? '3 Frações (10+10+10d)'
                        : '2 Frações (15+15d)'}
                    </p>
                    {isSalvo && op.decisao_camada_1_meses && (
                      <span className="text-[11px] font-bold text-blue-700 block truncate">
                        {op.decisao_camada_1_meses}
                      </span>
                    )}
                  </div>

                  <div className="col-span-3 md:col-span-2 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
                        isGerado
                          ? 'bg-purple-100 text-purple-800 border-purple-200'
                          : isNaoContemplado
                          ? 'bg-rose-100 text-rose-800 border-rose-200'
                          : isSalvo
                          ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                          : 'bg-orange-100 text-orange-700 border-orange-200'
                      }`}
                    >
                      {isGerado
                        ? 'Férias Geradas'
                        : isNaoContemplado
                        ? 'Não Contemplado'
                        : isSalvo
                        ? 'Escala Salva'
                        : 'Pendente'}
                    </span>
                  </div>

                  <div className="col-span-3 md:col-span-2 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMilitarModalAberto(op);
                      }}
                      className="px-4 py-1.5 bg-green-50 text-green-700 hover:bg-green-600 hover:text-white border border-green-200 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
                    >
                      {isSalvo ? 'Ver Escala' : 'Definir Escala'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

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

        {/* POPUP LATERAL (DRAWER / SLIDE-OVER) PARA GERENCIAR AS OPÇÕES DO MILITAR */}
        {militarModalAberto && (() => {
          const op = militarModalAberto;
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

          const temMesesDuplicados = (() => {
            if (numFracoes <= 1) return false;
            const m1 = militarSelecao.fracao1;
            const m2 = militarSelecao.fracao2;
            const m3 = militarSelecao.fracao3;
            if (numFracoes === 2) return m1 === m2;
            if (numFracoes === 3) return m1 === m2 || m1 === m3 || m2 === m3;
            return false;
          })();

          return (
            <div className="fixed inset-0 z-50 overflow-hidden font-sans">
              {/* Backdrop */}
              <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs z-20 transition-opacity animate-in fade-in"
                onClick={() => handleFecharPopupLateral(op.id)}
              />

              {/* O Drawer lateral largo (750px) */}
              <div className="fixed right-0 top-0 bottom-0 w-full md:w-[750px] bg-white shadow-2xl border-l border-slate-200 z-30 flex flex-col animate-in slide-in-from-right duration-200">
                {/* Drawer Header */}
                <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-start shrink-0">
                  <div className="flex gap-4 items-start">
                    <div className="w-10 h-10 bg-slate-800 text-white rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                      {op.militar_posto?.slice(0, 3) || 'MIL'}
                    </div>
                    <div>
                      <h2 className="font-bold text-xl text-slate-900">
                        {op.militar_posto} {op.militar_nome}
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Mat: {op.militar_matricula || '-'} • Lotação: {op.lotacao_nome || 'Unidade'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleFecharPopupLateral(op.id)}
                    className="text-slate-400 hover:text-slate-700 bg-white border border-slate-200 p-2 rounded-full shadow-sm cursor-pointer transition-colors"
                  >
                    <i className="ph ph-x text-lg"></i>
                  </button>
                </div>

                {/* Drawer Body */}
                <div className="flex-1 p-6 bg-white flex flex-col gap-6 overflow-y-auto">
                  {/* Resumo Azul das Preferências */}
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                    <div>
                      <p className="text-xs font-bold text-blue-600 uppercase mb-1">Modalidade Solicitada</p>
                      <p className="text-lg font-extrabold text-blue-900">
                        {modalidade === '1_ETAPA_30'
                          ? 'Integral (30 dias)'
                          : modalidade === '3_ETAPAS_10'
                          ? '3 Frações (10 + 10 + 10 dias)'
                          : '2 Frações (15 + 15 dias)'}
                      </p>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-xs font-bold text-blue-600 uppercase mb-2">Preferências do Militar</p>
                      <div className="flex gap-2 sm:justify-end flex-wrap">
                        <span className="bg-white border border-blue-200 text-blue-800 px-2.5 py-1 rounded text-xs font-bold">
                          1º {getNomeMesPorVal(mesOpcao1)}
                        </span>
                        <span className="bg-white border border-blue-200 text-blue-800 px-2.5 py-1 rounded text-xs font-bold">
                          2º {getNomeMesPorVal(mesOpcao2)}
                        </span>
                        <span className="bg-white border border-blue-200 text-blue-800 px-2.5 py-1 rounded text-xs font-bold">
                          3º {getNomeMesPorVal(mesOpcao3)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Estado Consolidado ou Form de Frações */}
                  {isGerado ? (
                    <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 space-y-2">
                      <span className="font-extrabold text-purple-950 text-xs flex items-center">
                        <Lock className="w-4 h-4 mr-1.5 text-purple-700" />
                        Escalação Oficial Consolidada & Gerada no SGP:
                      </span>
                      <p className="text-sm font-black text-purple-900">{op.decisao_camada_1_meses}</p>
                    </div>
                  ) : isNaoContemplado && !isEditing ? (
                    <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-rose-950 text-xs flex items-center">
                          <Ban className="w-4 h-4 mr-1.5 text-rose-600" />
                          Militar Não Contemplado nesta Campanha
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setMilitaresEmEdicao((prev) => ({ ...prev, [op.id]: true }))}
                          className="border-rose-300 text-rose-900 hover:bg-rose-100 rounded-xl text-xs font-bold h-7"
                        >
                          <Edit3 className="w-3 h-3 mr-1" />
                          Alterar / Contemplar
                        </Button>
                      </div>
                      <p className="text-rose-800 text-[11px]">
                        {op.justificativa_ajuste_gestor || 'Nenhuma fração será gerada para este militar nesta campanha.'}
                      </p>
                    </div>
                  ) : isSalvo && !isEditing ? (
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-emerald-950 text-xs flex items-center">
                          <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-700" />
                          Escala Definida e Pronta:
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setMilitaresEmEdicao((prev) => ({ ...prev, [op.id]: true }))}
                          className="border-emerald-300 text-emerald-900 hover:bg-emerald-100 rounded-xl text-xs font-bold h-7"
                        >
                          <Edit3 className="w-3 h-3 mr-1" />
                          Editar Escala
                        </Button>
                      </div>
                      <p className="text-sm font-extrabold text-emerald-900">{op.decisao_camada_1_meses}</p>
                    </div>
                  ) : (
                    /* Grade de Definição de Frações */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50 p-6 rounded-xl border border-slate-200 flex-1">
                      {Array.from({ length: numFracoes }).map((_, idx) => {
                        const numFracao = idx + 1;
                        const dias = diasPorFracao[idx] || 15;
                        const mesAtual = militarSelecao[`fracao${numFracao}`] || '01';

                        return (
                          <div key={numFracao}>
                            <label className="block text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                              <span className="bg-slate-800 text-white w-6 h-6 rounded flex items-center justify-center text-xs">
                                {numFracao}
                              </span>
                              {numFracoes === 1 ? 'Período Único' : `${numFracao}ª Fração`} ({dias} dias)
                            </label>
                            <div className="bg-white rounded-lg border border-slate-300 shadow-sm p-1">
                              <select
                                value={mesAtual}
                                onChange={(e) => handleMudarMesFracao(op.id, numFracao, e.target.value)}
                                className="w-full p-2.5 text-slate-900 bg-transparent outline-none font-medium cursor-pointer text-xs"
                              >
                                {[
                                  { val: mesOpcao1, label: `${getNomeMesPorVal(mesOpcao1)} (1ª Opção)` },
                                  { val: mesOpcao2, label: `${getNomeMesPorVal(mesOpcao2)} (2ª Opção)` },
                                  { val: mesOpcao3, label: `${getNomeMesPorVal(mesOpcao3)} (3ª Opção)` },
                                ].map((opt, oIdx) => {
                                  const outroNum = Array.from({ length: numFracoes })
                                    .map((_, fIdx) => fIdx + 1)
                                    .find((outro) => outro !== numFracao && militarSelecao[`fracao${outro}`] === opt.val);

                                  return (
                                    <option key={oIdx} value={opt.val} disabled={Boolean(outroNum)}>
                                      {opt.label} {outroNum ? `(Em uso na ${outroNum}ª fração)` : ''}
                                    </option>
                                  );
                                })}
                                <option disabled>──────────</option>
                                {LISTA_MESES.map((m) => {
                                  const outroNum = Array.from({ length: numFracoes })
                                    .map((_, fIdx) => fIdx + 1)
                                    .find((outro) => outro !== numFracao && militarSelecao[`fracao${outro}`] === m.val);

                                  return (
                                    <option key={m.val} value={m.val} disabled={Boolean(outroNum)}>
                                      {m.nome} {outroNum ? `(Em uso na ${outroNum}ª fração)` : ''}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {temMesesDuplicados && (
                    <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-center gap-2">
                      <i className="ph ph-warning-circle text-red-600 text-lg shrink-0"></i>
                      <span>
                        <strong>Atenção:</strong> O mesmo mês foi selecionado para mais de uma fração. Selecione meses diferentes para cada fração.
                      </span>
                    </div>
                  )}
                </div>

                {/* Drawer Footer */}
                <div className="p-4 border-t border-slate-200 bg-white flex justify-between items-center shrink-0">
                  <button
                    type="button"
                    onClick={() => setModalNaoContemplado({ open: true, opcao: op, justificativa: '' })}
                    className="text-red-600 hover:bg-red-50 font-medium text-sm flex items-center gap-2 px-4 py-2.5 rounded-lg border border-transparent cursor-pointer transition-colors"
                  >
                    <i className="ph ph-prohibit text-lg"></i> Negar Solicitação
                  </button>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => handleFecharPopupLateral(op.id)}
                      className="px-5 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      Cancelar
                    </button>

                    {(!isSalvo || isEditing) && !isGerado && (
                      <button
                        type="button"
                        disabled={actionLoading || temMesesDuplicados}
                        onClick={() => handleSalvarEscalaMilitar(op)}
                        className={`px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 cursor-pointer shadow-sm transition-colors text-white ${
                          temMesesDuplicados
                            ? 'bg-slate-400 cursor-not-allowed'
                            : 'bg-green-600 hover:bg-green-700'
                        }`}
                      >
                        <i className="ph ph-check-circle text-lg"></i> Salvar Escala
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

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
