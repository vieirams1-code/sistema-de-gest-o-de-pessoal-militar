import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { fetchScopedLotacoes } from '@/services/getScopedLotacoesClient';
import {
  Megaphone,
  Plus,
  Calendar,
  UserCheck,
  Users,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Bell,
  Eye,
  Search,
  Edit,
  Trash2,
  Archive,
  Link2,
  FileSignature,
  Layers,
  Download,
  ArrowUp,
  ArrowDown,
  FileSpreadsheet,
  Check,
  X,
  Play,
  FolderDown,
  Paperclip,
  Clock,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  baixarAnexosCampanhaZip,
  exportarPlanilhaCampanhaExcel,
  exportarPlanilhaCampanhaCsv,
} from '@/utils/portalCampanhasExport';

const TIPOS_CAMPOS_FORMULARIO = [
  { tipo: 'texto_curto', label: 'Texto Curto', icone: '📝', desc: 'Para nomes, termos ou respostas pontuais' },
  { tipo: 'texto_longo', label: 'Texto Longo / Parágrafo', icone: '📄', desc: 'Para justificativas ou relatos' },
  { tipo: 'multipla_escolha', label: 'Múltipla Escolha (1 opção)', icone: '🔘', desc: 'Seleção única entre várias opções' },
  { tipo: 'checkbox', label: 'Caixas de Seleção (Múltiplas)', icone: '☑️', desc: 'Permite marcar mais de uma opção' },
  { tipo: 'select', label: 'Lista Suspensa (Dropdown)', icone: '🔽', desc: 'Menu suspenso com opções' },
  { tipo: 'data', label: 'Data', icone: '📅', desc: 'Seletor de data' },
  { tipo: 'numero', label: 'Número', icone: '🔢', desc: 'Entrada numérica' },
  { tipo: 'upload_arquivo', label: 'Upload de Arquivo', icone: '📎', desc: 'Envio de documento/comprovante pelo militar' },
  { tipo: 'termo_aceite', label: 'Termo de Aceite / Ciência', icone: '📜', desc: 'Checkbox de declaração/ciência formal' },
];

export default function GerirCampanhasPortal() {
  const [activeTab, setActiveTab] = useState('campanhas'); // 'campanhas' | 'respostas'
  const [campanhas, setCampanhas] = useState([]);
  const [unidadesList, setUnidadesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', msg: '' });

  // Filtros e Paginação (Tabela de Campanhas)
  const [searchTerm, setSearchTerm] = useState('');
  const [mostrarArquivadas, setMostrarArquivadas] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [buscaUnidade, setBuscaUnidade] = useState('');

  // Estado da Central de Respostas & Entregas
  const [campanhaSelecionadaRespostas, setCampanhaSelecionadaRespostas] = useState(null);
  const [respostasData, setRespostasData] = useState(null);
  const [loadingRespostas, setLoadingRespostas] = useState(false);
  const [buscaRespostas, setBuscaRespostas] = useState('');
  const [filtroStatusRespostas, setFiltroStatusRespostas] = useState('TODOS'); // 'TODOS' | 'Respondido' | 'Pendente'
  const [filtroLotacaoRespostas, setFiltroLotacaoRespostas] = useState('');
  const [paginaRespostas, setPaginaRespostas] = useState(1);
  const respostasPorPagina = 15;

  // Estado do Modal de Progresso do ZIP
  const [zipProgress, setZipProgress] = useState(null); // { open, atual, total, texto, loading }

  // Modal de Criação / Edição de Campanha
  const [modalNovaCampanha, setModalNovaCampanha] = useState({
    open: false,
    isEditing: false,
    editId: null,
    tipo: 'PLANO_FERIAS',
    status: 'Aberta_Coleta',
    titulo: 'Plano Anual de Férias 2027',
    ano_referencia: new Date().getFullYear() + 1,
    tipo_escopo: 'TODOS',
    escopo_unidades_ids: [],
    escopo_quadros: [],
    data_inicio: new Date().toISOString().split('T')[0],
    data_fim_militar: `${new Date().getFullYear()}-10-31`,
    data_fim_unidade: `${new Date().getFullYear()}-11-30`,
    instrucoes: 'Prezados militares, registrem suas 3 opções de meses para o plano de férias.',
    config_regras: {},
    arquivo_modelo_url: '',
    arquivo_modelo_nome: '',
    exigir_devolucao_arquivo: true,
    texto_termo_aceite: '',
    campos_formulario: [],
    previewMode: false,
  });

  // Modal de Visualização da Resposta Completa de um Militar
  const [modalRespostaMilitar, setModalRespostaMilitar] = useState({
    open: false,
    militar: null,
    resposta: null,
    observacaoRH: '',
  });

  const carregarDados = async () => {
    setLoading(true);
    setFeedback({ type: '', msg: '' });
    try {
      const res = await base44.functions.invoke('portal_servicos', { acao: 'CAMPANHA_LISTAR' });
      const lista = res.data?.campanhas || [];
      setCampanhas(lista);

      let unidades = [];
      try {
        const lotRes = await fetchScopedLotacoes({});
        if (Array.isArray(lotRes?.lotacoes) && lotRes.lotacoes.length > 0) {
          unidades = lotRes.lotacoes.map((l) => ({
            id: String(l.id || l.nome || '').trim(),
            nome: l.nome || l.sigla || l.label || l.id,
          }));
        }
      } catch (lotErr) {
        console.warn('Falha no fetchScopedLotacoes, tentando entidades:', lotErr);
      }

      if (unidades.length === 0) {
        try {
          const milList = await base44.entities.Militar.list();
          const distinct = new Set();
          (milList || []).forEach((m) => {
            const loc = (m.lotacao || m.estrutura_nome || '').trim();
            if (loc) distinct.add(loc);
          });
          unidades = Array.from(distinct)
            .sort()
            .map((nome) => ({
              id: nome,
              nome: nome,
            }));
        } catch (_err) {}
      }

      setUnidadesList(unidades || []);

      // Se houver campanha selecionada para respostas, atualiza os dados dela
      if (campanhaSelecionadaRespostas) {
        const atualizada = lista.find((c) => c.id === campanhaSelecionadaRespostas.id);
        if (atualizada) {
          setCampanhaSelecionadaRespostas(atualizada);
          await carregarRespostasCampanha(atualizada);
        }
      } else if (lista.length > 0) {
        // Pré-seleciona a primeira campanha ativa
        const primeiraAtiva = lista.find((c) => c.status === 'Aberta_Coleta') || lista[0];
        setCampanhaSelecionadaRespostas(primeiraAtiva);
      }
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Falha ao carregar dados do painel.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  // Carrega respostas nominais de uma campanha para a aba Central de Respostas
  const carregarRespostasCampanha = async (camp) => {
    if (!camp?.id) return;
    setLoadingRespostas(true);
    try {
      const res = await base44.functions.invoke('portal_servicos', {
        acao: 'CAMPANHA_DETALHES_RETORNO',
        campanha_id: camp.id,
      });
      setRespostasData(res.data);
      setPaginaRespostas(1);
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Falha ao carregar respostas da campanha.' });
    } finally {
      setLoadingRespostas(false);
    }
  };

  const handleSelecionarCampanhaRespostas = async (campId) => {
    const camp = campanhas.find((c) => c.id === campId);
    if (!camp) return;
    setCampanhaSelecionadaRespostas(camp);
    await carregarRespostasCampanha(camp);
  };

  const abrirCriacaoCampanha = (tipo) => {
    setBuscaUnidade('');
    const ano = new Date().getFullYear() + 1;
    if (tipo === 'PLANO_FERIAS') {
      setModalNovaCampanha({
        open: true,
        isEditing: false,
        editId: null,
        tipo: 'PLANO_FERIAS',
        status: 'Aberta_Coleta',
        titulo: `Plano Anual de Férias ${ano}`,
        ano_referencia: ano,
        tipo_escopo: 'TODOS',
        escopo_unidades_ids: [],
        escopo_quadros: [],
        data_inicio: new Date().toISOString().split('T')[0],
        data_fim_militar: `${new Date().getFullYear()}-10-31`,
        data_fim_unidade: `${new Date().getFullYear()}-11-30`,
        instrucoes: `Prezados militares, registrem suas 3 opções de preferências de meses para o Plano de Férias de ${ano}.`,
        config_regras: {
          permitir_1_etapa_30d: true,
          permitir_2_etapas_15d: true,
          permitir_3_etapas_10d: true,
          modo_selecao_periodo: 'mais_antigo',
          exigir_atualizacao_cadastral: true,
        },
        arquivo_modelo_url: '',
        arquivo_modelo_nome: '',
        exigir_devolucao_arquivo: false,
        texto_termo_aceite: '',
        campos_formulario: [],
        previewMode: false,
      });
    } else if (tipo === 'ATUALIZACAO_CADASTRAL') {
      setModalNovaCampanha({
        open: true,
        isEditing: false,
        editId: null,
        tipo: 'ATUALIZACAO_CADASTRAL',
        status: 'Aberta_Coleta',
        titulo: `Recadastramento & Conferência Anual Obrigatória ${new Date().getFullYear()}`,
        ano_referencia: new Date().getFullYear(),
        tipo_escopo: 'TODOS',
        escopo_unidades_ids: [],
        escopo_quadros: [],
        data_inicio: new Date().toISOString().split('T')[0],
        data_fim_militar: `${new Date().getFullYear()}-12-15`,
        data_fim_unidade: `${new Date().getFullYear()}-12-20`,
        instrucoes: 'Prezados militares, revisem atentamente seus dados cadastrais no portal para assegurar a conformidade funcional.',
        config_regras: {},
        arquivo_modelo_url: '',
        arquivo_modelo_nome: '',
        exigir_devolucao_arquivo: false,
        texto_termo_aceite: '',
        campos_formulario: [],
        previewMode: false,
      });
    } else if (tipo === 'ASSINATURA_DOCUMENTO') {
      setModalNovaCampanha({
        open: true,
        isEditing: false,
        editId: null,
        tipo: 'ASSINATURA_DOCUMENTO',
        status: 'Aberta_Coleta',
        titulo: 'Declaração e Termo de Ciência Funcional',
        ano_referencia: new Date().getFullYear(),
        tipo_escopo: 'TODOS',
        escopo_unidades_ids: [],
        escopo_quadros: [],
        data_inicio: new Date().toISOString().split('T')[0],
        data_fim_militar: '',
        data_fim_unidade: '',
        instrucoes: 'Baixe o documento modelo anexo, preencha, assine digitalmente ou fisicamente e reenvie pelo Portal.',
        config_regras: {},
        arquivo_modelo_url: '',
        arquivo_modelo_nome: '',
        exigir_devolucao_arquivo: true,
        texto_termo_aceite: 'Declaro para os devidos fins que as informações prestadas são verdadeiras.',
        campos_formulario: [],
        previewMode: false,
      });
    } else {
      // FORMULARIO_DINAMICO
      setModalNovaCampanha({
        open: true,
        isEditing: false,
        editId: null,
        tipo: 'FORMULARIO_DINAMICO',
        status: 'Aberta_Coleta',
        titulo: 'Pesquisa / Formulário de Levantamento',
        ano_referencia: new Date().getFullYear(),
        tipo_escopo: 'TODOS',
        escopo_unidades_ids: [],
        escopo_quadros: [],
        data_inicio: new Date().toISOString().split('T')[0],
        data_fim_militar: '',
        data_fim_unidade: '',
        instrucoes: 'Por favor, responda às perguntas abaixo conforme as orientações.',
        config_regras: {},
        arquivo_modelo_url: '',
        arquivo_modelo_nome: '',
        exigir_devolucao_arquivo: false,
        texto_termo_aceite: '',
        campos_formulario: [
          {
            id: 'campo_' + Date.now(),
            tipo: 'texto_curto',
            pergunta: 'Qual o seu curso de especialização prioritário?',
            descricao_ajuda: '',
            obrigatorio: true,
            opcoes: [],
            arquivo_modelo_url: '',
            arquivo_modelo_nome: '',
          },
        ],
        previewMode: false,
      });
    }
  };

  const abrirEdicaoCampanha = (camp) => {
    setBuscaUnidade('');
    let regras = {
      permitir_1_etapa_30d: true,
      permitir_2_etapas_15d: true,
      permitir_3_etapas_10d: true,
      modo_selecao_periodo: 'mais_antigo',
      exigir_atualizacao_cadastral: false,
    };
    if (camp.config_regras) {
      try {
        regras = typeof camp.config_regras === 'string' ? JSON.parse(camp.config_regras) : camp.config_regras;
      } catch (_e) {}
    }

    let campos = [];
    if (camp.config_formulario) {
      try {
        const parsed = typeof camp.config_formulario === 'string' ? JSON.parse(camp.config_formulario) : camp.config_formulario;
        campos = parsed?.campos || [];
      } catch (_e) {}
    }

    setModalNovaCampanha({
      open: true,
      isEditing: true,
      editId: camp.id,
      tipo: camp.tipo || 'PLANO_FERIAS',
      status: camp.status || 'Aberta_Coleta',
      titulo: camp.titulo || '',
      ano_referencia: camp.ano_referencia || (new Date().getFullYear() + 1),
      tipo_escopo: camp.tipo_escopo || 'TODOS',
      escopo_unidades_ids: camp.escopo_unidades_ids || [],
      escopo_quadros: camp.escopo_quadros || [],
      data_inicio: camp.data_inicio || new Date().toISOString().split('T')[0],
      data_fim_militar: camp.data_fim_militar || '',
      data_fim_unidade: camp.data_fim_unidade || '',
      instrucoes: camp.instrucoes || '',
      config_regras: regras,
      arquivo_modelo_url: camp.arquivo_modelo_url || '',
      arquivo_modelo_nome: camp.arquivo_modelo_nome || '',
      exigir_devolucao_arquivo: Boolean(camp.exigir_devolucao_arquivo),
      texto_termo_aceite: camp.texto_termo_aceite || '',
      campos_formulario: campos,
      previewMode: false,
    });
  };

  const handleAdicionarPergunta = (tipo = 'texto_curto') => {
    const novoId = 'campo_' + Date.now();
    const novoCampo = {
      id: novoId,
      tipo,
      pergunta: '',
      descricao_ajuda: '',
      obrigatorio: true,
      opcoes: tipo === 'multipla_escolha' || tipo === 'checkbox' || tipo === 'select' ? ['Opção 1', 'Opção 2'] : [],
      arquivo_modelo_url: '',
      arquivo_modelo_nome: '',
    };
    setModalNovaCampanha((prev) => ({
      ...prev,
      campos_formulario: [...prev.campos_formulario, novoCampo],
    }));
  };

  const handleEditarPergunta = (index, chave, valor) => {
    setModalNovaCampanha((prev) => {
      const novos = [...prev.campos_formulario];
      novos[index] = { ...novos[index], [chave]: valor };
      return { ...prev, campos_formulario: novos };
    });
  };

  const handleRemoverPergunta = (index) => {
    setModalNovaCampanha((prev) => ({
      ...prev,
      campos_formulario: prev.campos_formulario.filter((_, i) => i !== index),
    }));
  };

  const handleAdicionarOpcao = (perguntaIndex) => {
    setModalNovaCampanha((prev) => {
      const novos = [...prev.campos_formulario];
      const opcoesAtuais = novos[perguntaIndex].opcoes || [];
      novos[perguntaIndex] = {
        ...novos[perguntaIndex],
        opcoes: [...opcoesAtuais, `Opção ${opcoesAtuais.length + 1}`],
      };
      return { ...prev, campos_formulario: novos };
    });
  };

  const handleEditarOpcao = (perguntaIndex, opcaoIndex, valor) => {
    setModalNovaCampanha((prev) => {
      const novos = [...prev.campos_formulario];
      const opcoesAtuais = [...(novos[perguntaIndex].opcoes || [])];
      opcoesAtuais[opcaoIndex] = valor;
      novos[perguntaIndex] = { ...novos[perguntaIndex], opcoes: opcoesAtuais };
      return { ...prev, campos_formulario: novos };
    });
  };

  const handleRemoverOpcao = (perguntaIndex, opcaoIndex) => {
    setModalNovaCampanha((prev) => {
      const novos = [...prev.campos_formulario];
      const opcoesAtuais = (novos[perguntaIndex].opcoes || []).filter((_, i) => i !== opcaoIndex);
      novos[perguntaIndex] = { ...novos[perguntaIndex], opcoes: opcoesAtuais };
      return { ...prev, campos_formulario: novos };
    });
  };

  const handleUploadModeloGestor = async (file, perguntaIndex = null) => {
    if (!file) return;
    setActionLoading(true);
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      if (res?.file_url) {
        if (perguntaIndex !== null) {
          handleEditarPergunta(perguntaIndex, 'arquivo_modelo_url', res.file_url);
          handleEditarPergunta(perguntaIndex, 'arquivo_modelo_nome', file.name);
        } else {
          setModalNovaCampanha((prev) => ({
            ...prev,
            arquivo_modelo_url: res.file_url,
            arquivo_modelo_nome: file.name,
          }));
        }
        setFeedback({ type: 'success', msg: `Arquivo modelo "${file.name}" anexado com sucesso!` });
      }
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Falha ao enviar arquivo modelo.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSalvarCampanha = async (e) => {
    e.preventDefault();
    if (!modalNovaCampanha.titulo.trim()) {
      alert('Por favor, informe o título da campanha.');
      return;
    }

    if (modalNovaCampanha.tipo_escopo === 'UNIDADES' && modalNovaCampanha.escopo_unidades_ids.length === 0) {
      alert('Selecione ao menos uma unidade para o escopo.');
      return;
    }

    setActionLoading(true);
    setFeedback({ type: '', msg: '' });

    try {
      const nomesUnidades = modalNovaCampanha.escopo_unidades_ids
        .map((id) => unidadesList.find((u) => u.id === id)?.nome || id)
        .join(', ');

      const payload = {
        titulo: modalNovaCampanha.titulo,
        tipo: modalNovaCampanha.tipo,
        status: modalNovaCampanha.status || 'Aberta_Coleta',
        ano_referencia: Number(modalNovaCampanha.ano_referencia) || undefined,
        tipo_escopo: modalNovaCampanha.tipo_escopo,
        escopo_unidades_ids: modalNovaCampanha.escopo_unidades_ids,
        escopo_unidades_nomes: nomesUnidades,
        escopo_quadros: modalNovaCampanha.escopo_quadros,
        data_inicio: modalNovaCampanha.data_inicio,
        data_fim_militar: modalNovaCampitar || modalNovaCampanha.data_fim_militar,
        data_fim_unidade: modalNovaCampanha.data_fim_unidade,
        instrucoes: modalNovaCampanha.instrucoes,
        config_regras: modalNovaCampanha.config_regras,
        arquivo_modelo_url: modalNovaCampanha.arquivo_modelo_url,
        arquivo_modelo_nome: modalNovaCampanha.arquivo_modelo_nome,
        exigir_devolucao_arquivo: modalNovaCampanha.exigir_devolucao_arquivo,
        texto_termo_aceite: modalNovaCampanha.texto_termo_aceite,
        config_formulario: {
          campos: modalNovaCampanha.campos_formulario,
        },
      };

      if (modalNovaCampanha.isEditing) {
        await base44.functions.invoke('portal_servicos', {
          acao: 'CAMPANHA_EDITAR',
          campanha_id: modalNovaCampanha.editId,
          campanha_payload: payload,
        });
        setFeedback({ type: 'success', msg: 'Campanha atualizada com sucesso!' });
      } else {
        await base44.functions.invoke('portal_servicos', {
          acao: 'CAMPANHA_CRIAR',
          campanha_payload: payload,
        });
        setFeedback({ type: 'success', msg: 'Campanha criada e aberta aos militares com sucesso!' });
      }

      setModalNovaCampanha((prev) => ({ ...prev, open: false }));
      await carregarDados();
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Falha ao salvar campanha.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleExcluirCampanha = async (camp) => {
    if (!window.confirm(`Tem certeza que deseja excluir a campanha "${camp.titulo}"? Esta ação removerá a campanha do portal.`)) {
      return;
    }
    setActionLoading(true);
    try {
      await base44.functions.invoke('portal_servicos', {
        acao: 'CAMPANHA_EXCLUIR',
        campanha_id: camp.id,
      });
      setFeedback({ type: 'success', msg: `Campanha "${camp.titulo}" excluída com sucesso.` });
      await carregarDados();
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Falha ao excluir campanha.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleArquivarCampanha = async (camp) => {
    setActionLoading(true);
    try {
      await base44.functions.invoke('portal_servicos', {
        acao: 'CAMPANHA_ARQUIVAR',
        campanha_id: camp.id,
      });
      setFeedback({ type: 'success', msg: `Campanha "${camp.titulo}" arquivada com sucesso.` });
      await carregarDados();
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Falha ao arquivar campanha.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReabrirCampanha = async (camp) => {
    if (!window.confirm(`Deseja reabrir a coleta da campanha "${camp.titulo}" para os militares no Portal?`)) return;
    setActionLoading(true);
    try {
      await base44.functions.invoke('portal_servicos', {
        acao: 'CAMPANHA_REABRIR',
        campanha_id: camp.id,
      });
      setFeedback({ type: 'success', msg: `Campanha "${camp.titulo}" reaberta com sucesso!` });
      await carregarDados();
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Falha ao reabrir campanha.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAbrirCentralRespostas = async (camp) => {
    setCampanhaSelecionadaRespostas(camp);
    setActiveTab('respostas');
    await carregarRespostasCampanha(camp);
  };

  const handleDispararLembretes = async (campId) => {
    if (!window.confirm('Deseja enviar lembretes aos militares que ainda não responderam a esta campanha?')) return;
    setActionLoading(true);
    try {
      const res = await base44.functions.invoke('portal_servicos', {
        acao: 'CAMPANHA_DISPARAR_LEMBRETES',
        campanha_id: campId,
      });
      setFeedback({ type: 'success', msg: res.data?.message || 'Lembretes enviados com sucesso!' });
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Falha ao disparar lembretes.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Funções de Exportação Avançada da Central de Respostas
  const handleBaixarZipLote = async () => {
    if (!campanhaSelecionadaRespostas || !respostasData?.militares) {
      alert('Não há dados carregados para download de anexos.');
      return;
    }
    setZipProgress({ open: true, atual: 0, total: 0, texto: 'Iniciando preparação do pacote...', loading: true });
    try {
      const res = await baixarAnexosCampanhaZip(
        campanhaSelecionadaRespostas,
        respostasData.militares,
        (atual, total, texto) => {
          setZipProgress({ open: true, atual, total, texto, loading: true });
        }
      );
      setZipProgress({
        open: true,
        atual: res.totalBaixados,
        total: res.totalEsperados,
        texto: `Sucesso! ${res.totalBaixados} arquivo(s) compactado(s) e renomeados no padrão militar.`,
        loading: false,
      });
      setTimeout(() => {
        setZipProgress(null);
      }, 4000);
    } catch (err) {
      setZipProgress(null);
      alert(err.message || 'Erro ao gerar pacote ZIP de anexos.');
    }
  };

  const handleExportarExcel = () => {
    if (!campanhaSelecionadaRespostas || !respostasData?.militares) {
      alert('Não há dados para exportação.');
      return;
    }
    try {
      exportarPlanilhaCampanhaExcel(campanhaSelecionadaRespostas, respostasData.militares);
      setFeedback({ type: 'success', msg: 'Planilha Excel gerada e baixada com sucesso!' });
    } catch (err) {
      alert(err.message || 'Falha ao exportar planilha Excel.');
    }
  };

  const handleExportarCsv = () => {
    if (!campanhaSelecionadaRespostas || !respostasData?.militares) {
      alert('Não há dados para exportação.');
      return;
    }
    try {
      exportarPlanilhaCampanhaCsv(campanhaSelecionadaRespostas, respostasData.militares);
      setFeedback({ type: 'success', msg: 'Arquivo CSV (UTF-8) gerado com sucesso!' });
    } catch (err) {
      alert(err.message || 'Falha ao exportar CSV.');
    }
  };

  // Filtros de Campanhas
  const campanhasFiltradas = useMemo(() => {
    return campanhas.filter((camp) => {
      if (!mostrarArquivadas && camp.status === 'Arquivada') return false;
      if (searchTerm) {
        const termo = searchTerm.toLowerCase();
        return (
          (camp.titulo || '').toLowerCase().includes(termo) ||
          (camp.instrucoes || '').toLowerCase().includes(termo) ||
          (camp.escopo_unidades_nomes || '').toLowerCase().includes(termo)
        );
      }
      return true;
    });
  }, [campanhas, mostrarArquivadas, searchTerm]);

  // Paginação de Campanhas
  const totalPages = Math.ceil(campanhasFiltradas.length / itemsPerPage) || 1;
  const currentItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return campanhasFiltradas.slice(start, start + itemsPerPage);
  }, [campanhasFiltradas, currentPage]);

  // Filtro de Respostas Nominais na Central de Respostas
  const militaresRespostasFiltrados = useMemo(() => {
    const lista = respostasData?.militares || [];
    const termo = (buscaRespostas || '').toLowerCase();

    return lista.filter((m) => {
      if (filtroStatusRespostas !== 'TODOS' && m.status_resposta !== filtroStatusRespostas) return false;
      if (filtroLotacaoRespostas && m.militar_lotacao !== filtroLotacaoRespostas) return false;
      if (termo) {
        const matchNome = (m.militar_nome || '').toLowerCase().includes(termo);
        const matchMat = (m.militar_matricula || '').toLowerCase().includes(termo);
        const matchPosto = (m.militar_posto || '').toLowerCase().includes(termo);
        const matchLot = (m.militar_lotacao || '').toLowerCase().includes(termo);
        if (!matchNome && !matchMat && !matchPosto && !matchLot) return false;
      }
      return true;
    });
  }, [respostasData, buscaRespostas, filtroStatusRespostas, filtroLotacaoRespostas]);

  // Paginação de Respostas Nominais
  const totalPaginasRespostas = Math.ceil(militaresRespostasFiltrados.length / respostasPorPagina) || 1;
  const currentRespostasItems = useMemo(() => {
    const start = (paginaRespostas - 1) * respostasPorPagina;
    return militaresRespostasFiltrados.slice(start, start + respostasPorPagina);
  }, [militaresRespostasFiltrados, paginaRespostas]);

  // Perguntas dinâmicas da campanha selecionada
  const perguntasCampanhaSelecionada = useMemo(() => {
    if (!campanhaSelecionadaRespostas?.config_formulario) return [];
    try {
      const p = typeof campanhaSelecionadaRespostas.config_formulario === 'string'
        ? JSON.parse(campanhaSelecionadaRespostas.config_formulario)
        : campanhaSelecionadaRespostas.config_formulario;
      return p?.campos || [];
    } catch (_e) {
      return [];
    }
  }, [campanhaSelecionadaRespostas]);

  // Contagem de anexos na campanha atual
  const contagemAnexosCampanha = useMemo(() => {
    if (!respostasData?.militares) return 0;
    let count = 0;
    respostasData.militares.forEach((m) => {
      if (m.status_resposta !== 'Respondido' || !m.resposta_completa) return;
      const resp = m.resposta_completa;
      if (resp.arquivo_devolucao_url) count++;
      if (resp.arquivos_anexados_json) {
        try {
          const arqObj = typeof resp.arquivos_anexados_json === 'string'
            ? JSON.parse(resp.arquivos_anexados_json)
            : resp.arquivos_anexados_json;
          Object.values(arqObj || {}).forEach((item) => {
            if (item && (typeof item === 'string' || item.url)) count++;
          });
        } catch (_e) {}
      }
    });
    return count;
  }, [respostasData]);

  // Lista de lotações únicas para o filtro da Central de Respostas
  const lotacoesDisponiveisRespostas = useMemo(() => {
    const distinct = new Set();
    (respostasData?.militares || []).forEach((m) => {
      if (m.militar_lotacao) distinct.add(m.militar_lotacao);
    });
    return Array.from(distinct).sort();
  }, [respostasData]);

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:p-8 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER PRINCIPAL */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-[#1e3a5f] text-white flex items-center justify-center shadow-md">
              <Megaphone className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Gestor de Campanhas & Portal do Militar
              </h1>
              <p className="text-xs text-slate-500">
                Gerencie planos de férias, conferências cadastrais, formulários com anexo e auditoria nominal
              </p>
            </div>
          </div>

          {/* BOTÕES DE NOVA CAMPANHA */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={() => abrirCriacaoCampanha('PLANO_FERIAS')}
              className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-xs h-9 px-3"
            >
              <Calendar className="w-3.5 h-3.5 mr-1" />
              Novo Plano de Férias
            </Button>

            <Button
              type="button"
              onClick={() => abrirCriacaoCampanha('ATUALIZACAO_CADASTRAL')}
              className="bg-[#1e3a5f] hover:bg-[#2a4d7d] text-white rounded-xl text-xs font-semibold shadow-xs h-9 px-3"
            >
              <UserCheck className="w-3.5 h-3.5 mr-1" />
              Nova Atualização Cadastral
            </Button>

            <Button
              type="button"
              onClick={() => abrirCriacaoCampanha('ASSINATURA_DOCUMENTO')}
              className="bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-semibold shadow-xs h-9 px-3"
            >
              <FileSignature className="w-3.5 h-3.5 mr-1" />
              Nova Assinatura Doc
            </Button>

            <Button
              type="button"
              onClick={() => abrirCriacaoCampanha('FORMULARIO_DINAMICO')}
              className="bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-semibold shadow-xs h-9 px-3"
            >
              <Layers className="w-3.5 h-3.5 mr-1" />
              Novo Formulário
            </Button>
          </div>
        </div>

        {/* NAVEGAÇÃO ENTRE ABAS */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('campanhas')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'campanhas'
                ? 'bg-[#1e3a5f] text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Megaphone className="w-4 h-4" />
            Campanhas & Configuração ({campanhas.length})
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('respostas');
              if (!campanhaSelecionadaRespostas && campanhas.length > 0) {
                handleSelecionarCampanhaRespostas(campanhas[0].id);
              }
            }}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'respostas'
                ? 'bg-[#1e3a5f] text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Central de Respostas & Entregas
            {campanhaSelecionadaRespostas && (
              <span className="px-2 py-0.5 rounded-md bg-blue-100 text-[#1e3a5f] text-[10px] font-extrabold max-w-[180px] truncate">
                {campanhaSelecionadaRespostas.titulo}
              </span>
            )}
          </button>
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

        {/* ========================================================================= */}
        {/* ABA 1: LISTA DE CAMPANHAS & CONFIGURAÇÕES */}
        {/* ========================================================================= */}
        {activeTab === 'campanhas' && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden space-y-0">
            {/* TOOLBAR DA TABELA */}
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center text-sm gap-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filtrar campanhas..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-9 pr-4 py-1.5 border border-slate-300 rounded-lg text-xs w-64 focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs font-semibold text-slate-600">
                <button
                  type="button"
                  onClick={carregarDados}
                  disabled={loading}
                  className="flex items-center gap-1 hover:text-slate-900 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  Atualizar
                </button>

                <label className="flex items-center gap-2 cursor-pointer hover:text-slate-900">
                  <input
                    type="checkbox"
                    checked={mostrarArquivadas}
                    onChange={(e) => {
                      setMostrarArquivadas(e.target.checked);
                      setCurrentPage(1);
                    }}
                    className="rounded text-[#1e3a5f] focus:ring-[#1e3a5f] border-slate-300"
                  />
                  Mostrar arquivadas
                </label>
              </div>
            </div>

            {/* CORPO DA TABELA DE CAMPANHAS */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 uppercase text-xs tracking-wider border-b border-slate-200">
                    <th className="p-4 font-semibold min-w-[220px]">Nome da Campanha</th>
                    <th className="p-4 font-semibold">Tipo</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold">Público Alvo</th>
                    <th className="p-4 font-semibold min-w-[120px]">Período</th>
                    <th className="p-4 font-semibold w-48">Adesão</th>
                    <th className="p-4 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {currentItems.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-slate-500">
                        Nenhuma campanha encontrada com os filtros atuais.
                      </td>
                    </tr>
                  ) : (
                    currentItems.map((camp) => {
                      const totalAlvo = camp.total_publico_alvo || 0;
                      const respondidos = camp.total_respondidos || 0;
                      const percentual = totalAlvo > 0 ? Math.round((respondidos / totalAlvo) * 100) : 0;
                      const isFerias = camp.tipo === 'PLANO_FERIAS';
                      const isCadastro = camp.tipo === 'ATUALIZACAO_CADASTRAL' || camp.tipo === 'CONFERENCIA_GERAL';
                      const isAssinatura = camp.tipo === 'ASSINATURA_DOCUMENTO';
                      const isEncerrada = camp.status === 'Encerrada';
                      const isArquivada = camp.status === 'Arquivada';

                      let statusStyles = { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500 animate-pulse', label: 'Ativa' };
                      if (isArquivada) statusStyles = { bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-300', label: 'Arquivada' };
                      else if (isEncerrada) statusStyles = { bg: 'bg-slate-100', text: 'text-slate-800', dot: 'bg-slate-500', label: 'Encerrada' };
                      else if (camp.status === 'Aberta_Coleta') statusStyles = { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500 animate-pulse', label: 'Aberta' };

                      return (
                        <tr key={camp.id} className="hover:bg-blue-50/50 transition-colors bg-white">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                                isFerias ? 'bg-emerald-50 text-emerald-700' :
                                isCadastro ? 'bg-blue-50 text-blue-700' :
                                isAssinatura ? 'bg-amber-50 text-amber-700' :
                                'bg-purple-50 text-purple-700'
                              }`}>
                                {isFerias ? <Calendar className="w-4 h-4" /> :
                                 isCadastro ? <UserCheck className="w-4 h-4" /> :
                                 isAssinatura ? <FileSignature className="w-4 h-4" /> :
                                 <Layers className="w-4 h-4" />}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="font-bold text-slate-800">{camp.titulo}</p>
                                  {(() => {
                                    let cr = {};
                                    try {
                                      cr = typeof camp.config_regras === 'string' ? JSON.parse(camp.config_regras) : (camp.config_regras || {});
                                    } catch (_e) {}
                                    return cr?.exigir_atualizacao_cadastral ? (
                                      <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold inline-flex items-center gap-0.5" title="Exige Atualização Cadastral prévia">
                                        <Link2 className="w-2.5 h-2.5" />
                                        Cascata
                                      </span>
                                    ) : null;
                                  })()}
                                </div>
                                <p className="text-xs text-slate-500 truncate max-w-[200px]" title={camp.instrucoes}>{camp.instrucoes}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              isFerias ? 'bg-emerald-100 text-emerald-800' :
                              isCadastro ? 'bg-blue-100 text-blue-800' :
                              isAssinatura ? 'bg-amber-100 text-amber-900' :
                              'bg-purple-100 text-purple-900'
                            }`}>
                              {isFerias ? 'Férias' :
                               isCadastro ? 'Cadastro' :
                               isAssinatura ? 'Assinatura Doc' :
                               'Formulário'}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles.bg} ${statusStyles.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${statusStyles.dot}`}></span>
                              {statusStyles.label}
                            </span>
                          </td>
                          <td className="p-4 text-slate-600">
                            <div className="line-clamp-2 max-w-[200px]" title={camp.escopo_unidades_nomes || 'Toda a Corporação'}>
                              {camp.escopo_unidades_nomes || 'Toda a Corporação'}
                            </div>
                            <span className="text-xs font-medium text-slate-400">({totalAlvo})</span>
                          </td>
                          <td className="p-4 text-slate-600">
                            <div className="flex flex-col">
                              <span className="text-xs">Início: {camp.data_inicio || '-'}</span>
                              <span className={`font-medium text-xs mt-0.5 ${isArquivada ? 'text-slate-500' : 'text-[#1e3a5f]'}`}>
                                Prazo: {camp.data_fim_militar || 'Não definido'}
                              </span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-between mb-1 text-xs">
                              <span className="font-medium text-slate-700">{respondidos}/{totalAlvo}</span>
                              <span className={`font-bold ${isArquivada ? 'text-slate-500' : 'text-[#1e3a5f]'}`}>
                                {percentual}%
                              </span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-1.5">
                              <div
                                className={`${isArquivada ? 'bg-slate-400' : percentual >= 80 ? 'bg-emerald-500' : percentual >= 40 ? 'bg-blue-500' : 'bg-amber-500'} h-1.5 rounded-full transition-all duration-500`}
                                style={{ width: `${percentual}%` }}
                              ></div>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-end gap-1">
                              {camp.status !== 'Aberta_Coleta' && (
                                <button
                                  onClick={() => handleReabrirCampanha(camp)}
                                  disabled={actionLoading}
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                  title="Reabrir Coleta no Portal"
                                >
                                  <Play className="w-4 h-4" />
                                </button>
                              )}
                              {camp.status === 'Aberta_Coleta' && (
                                <button
                                  onClick={() => handleDispararLembretes(camp.id)}
                                  disabled={actionLoading}
                                  className="p-1.5 text-amber-600 hover:bg-amber-50 rounded transition-colors"
                                  title="Disparar Lembretes"
                                >
                                  <Bell className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleAbrirCentralRespostas(camp)}
                                disabled={actionLoading}
                                className="p-1.5 text-[#1e3a5f] hover:bg-blue-50 rounded transition-colors"
                                title="Abrir Central de Respostas & Entregas"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => abrirEdicaoCampanha(camp)}
                                disabled={actionLoading}
                                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded transition-colors"
                                title="Editar"
                              >
                                <Edit className="w-4 h-4" />
                              </button>

                              {!isArquivada && <div className="w-px h-4 bg-slate-300 mx-1"></div>}

                              {!isArquivada && (
                                <button
                                  onClick={() => handleArquivarCampanha(camp)}
                                  disabled={actionLoading}
                                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded transition-colors"
                                  title="Arquivar"
                                >
                                  <Archive className="w-4 h-4" />
                                </button>
                              )}

                              {!isArquivada && (
                                <button
                                  onClick={() => handleExcluirCampanha(camp)}
                                  disabled={actionLoading}
                                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
                                  title="Excluir"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* PAGINAÇÃO DE CAMPANHAS */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
                <div>
                  Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, campanhasFiltradas.length)} de {campanhasFiltradas.length} campanhas
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    className="h-8 px-2"
                  >
                    Anterior
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <Button
                      key={p}
                      type="button"
                      variant={currentPage === p ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(p)}
                      className={`h-8 w-8 p-0 ${currentPage === p ? 'bg-[#1e3a5f] text-white' : ''}`}
                    >
                      {p}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="h-8 px-2"
                  >
                    Próximo
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA 2: CENTRAL DE RESPOSTAS & ENTREGAS (RESULTADOS NOMINAIS & EXPORTAÇÃO) */}
        {/* ========================================================================= */}
        {activeTab === 'respostas' && (
          <div className="space-y-5">
            
            {/* SELETOR DE CAMPANHA & AÇÕES DE EXPORTAÇÃO */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto flex-1">
                <span className="text-xs font-bold text-slate-500 uppercase shrink-0 flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-[#1e3a5f]" />
                  Campanha:
                </span>
                <select
                  value={campanhaSelecionadaRespostas?.id || ''}
                  onChange={(e) => handleSelecionarCampanhaRespostas(e.target.value)}
                  className="w-full md:max-w-md h-10 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-[#1e3a5f] outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                >
                  {campanhas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.tipo === 'PLANO_FERIAS' ? '🏖️ ' : c.tipo === 'ASSINATURA_DOCUMENTO' ? '📁 ' : c.tipo === 'ATUALIZACAO_CADASTRAL' ? '🪪 ' : '📋 '}
                      {c.titulo} ({c.status || 'Aberta'})
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-2 mt-1 sm:mt-0">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    {campanhaSelecionadaRespostas?.tipo === 'PLANO_FERIAS' ? 'Plano de Férias' :
                     campanhaSelecionadaRespostas?.tipo === 'ASSINATURA_DOCUMENTO' ? 'Assinatura Documento' :
                     campanhaSelecionadaRespostas?.tipo === 'ATUALIZACAO_CADASTRAL' ? 'Atualização Cadastral' : 'Formulário Dinâmico'}
                  </span>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1.5 ${
                    campanhaSelecionadaRespostas?.status === 'Aberta_Coleta' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${campanhaSelecionadaRespostas?.status === 'Aberta_Coleta' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                    {campanhaSelecionadaRespostas?.status === 'Aberta_Coleta' ? 'Aberta' : (campanhaSelecionadaRespostas?.status || 'Ativa')}
                  </span>
                </div>
              </div>

              {/* BOTÕES DE EXPORTAÇÃO */}
              <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
                <Button
                  type="button"
                  onClick={() => carregarRespostasCampanha(campanhaSelecionadaRespostas)}
                  disabled={loadingRespostas}
                  variant="outline"
                  className="h-10 text-xs font-semibold rounded-xl"
                  title="Recarregar Respostas"
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loadingRespostas ? 'animate-spin' : ''}`} />
                  Recarregar
                </Button>

                <Button
                  type="button"
                  onClick={handleExportarExcel}
                  disabled={loadingRespostas || !respostasData?.militares?.length}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white h-10 text-xs font-bold rounded-xl shadow-xs px-3.5"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-1.5" />
                  Excel (.xlsx)
                </Button>

                <Button
                  type="button"
                  onClick={handleExportarCsv}
                  disabled={loadingRespostas || !respostasData?.militares?.length}
                  variant="outline"
                  className="h-10 text-xs font-semibold rounded-xl"
                >
                  CSV
                </Button>

                <Button
                  type="button"
                  onClick={handleBaixarZipLote}
                  disabled={loadingRespostas || contagemAnexosCampanha === 0}
                  className="bg-blue-700 hover:bg-blue-800 text-white h-10 text-xs font-bold rounded-xl shadow-xs px-3.5 disabled:opacity-40"
                  title={contagemAnexosCampanha === 0 ? 'Esta campanha não possui uploads de arquivos' : 'Baixar todos os anexos renomeados'}
                >
                  <FolderDown className="w-4 h-4 mr-1.5" />
                  Baixar Todos Anexos (ZIP)
                </Button>
              </div>
            </div>

            {/* KPI CARDS RESUMO */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase">Público Alvo</p>
                  <h3 className="text-2xl font-black text-slate-900 mt-0.5">
                    {loadingRespostas ? '...' : respostasData?.total_alvo || 0}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {campanhaSelecionadaRespostas?.escopo_unidades_nomes || 'Toda a Corporação'}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1e3a5f] flex items-center justify-center font-bold">
                  <Users className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase">Respondidos</p>
                  <h3 className="text-2xl font-black text-emerald-600 mt-0.5">
                    {loadingRespostas ? '...' : respostasData?.total_respondidos || 0}
                  </h3>
                  <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                    {loadingRespostas ? '' : `${respostasData?.percentual || 0}% de adesão`}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase">Pendentes</p>
                  <h3 className="text-2xl font-black text-amber-600 mt-0.5">
                    {loadingRespostas ? '...' : respostasData?.total_pendentes || 0}
                  </h3>
                  <p className="text-[11px] text-amber-600 font-semibold mt-0.5">
                    Aguardando submissão
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                  <Clock className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase">Arquivos Anexados</p>
                  <h3 className="text-2xl font-black text-purple-700 mt-0.5">
                    {loadingRespostas ? '...' : contagemAnexosCampanha}
                  </h3>
                  <p className="text-[11px] text-purple-700 font-semibold mt-0.5">
                    {contagemAnexosCampanha > 0 ? 'Prontos para ZIP renomeado' : 'Sem uploads'}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                  <Paperclip className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* PAINEL DE CONTROLE DE FILTROS & BUSCA */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por Nome, Matrícula, Posto ou Lotação..."
                  value={buscaRespostas}
                  onChange={(e) => {
                    setBuscaRespostas(e.target.value);
                    setPaginaRespostas(1);
                  }}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none focus:ring-1 focus:ring-[#1e3a5f] focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => {
                    setFiltroStatusRespostas('TODOS');
                    setPaginaRespostas(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    filtroStatusRespostas === 'TODOS' ? 'bg-[#1e3a5f] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Todos ({respostasData?.total_alvo || 0})
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFiltroStatusRespostas('Respondido');
                    setPaginaRespostas(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    filtroStatusRespostas === 'Respondido' ? 'bg-[#1e3a5f] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Respondidos ({respostasData?.total_respondidos || 0})
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFiltroStatusRespostas('Pendente');
                    setPaginaRespostas(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    filtroStatusRespostas === 'Pendente' ? 'bg-[#1e3a5f] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Pendentes ({respostasData?.total_pendentes || 0})
                </button>

                {lotacoesDisponiveisRespostas.length > 0 && (
                  <select
                    value={filtroLotacaoRespostas}
                    onChange={(e) => {
                      setFiltroLotacaoRespostas(e.target.value);
                      setPaginaRespostas(1);
                    }}
                    className="h-8 px-2.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none"
                  >
                    <option value="">Todas as Lotações</option>
                    {lotacoesDisponiveisRespostas.map((lot) => (
                      <option key={lot} value={lot}>{lot}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* TABELA DINÂMICA DE RESPOSTAS NOMINAIS */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700 uppercase">Relação Nominal de Militares</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                    {militaresRespostasFiltrados.length} registros
                  </span>
                </div>
                <div className="text-xs text-slate-500 hidden sm:block">
                  💡 Clique na linha ou no ícone de visualização para auditar a submissão completa
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 text-slate-600 uppercase font-bold tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="p-3 pl-4 min-w-[200px]">Militar</th>
                      <th className="p-3 min-w-[140px]">Lotação</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 min-w-[110px]">Data Envio</th>

                      {/* Colunas Específicas conforme o tipo da Campanha */}
                      {campanhaSelecionadaRespostas?.tipo === 'PLANO_FERIAS' && (
                        <>
                          <th className="p-3">1ª Opção</th>
                          <th className="p-3">2ª Opção</th>
                          <th className="p-3">3ª Opção</th>
                          <th className="p-3">Parcelamento</th>
                        </>
                      )}

                      {campanhaSelecionadaRespostas?.tipo === 'ASSINATURA_DOCUMENTO' && (
                        <>
                          <th className="p-3">Documento Assinado</th>
                          <th className="p-3">Termo Ciência</th>
                        </>
                      )}

                      {campanhaSelecionadaRespostas?.tipo === 'FORMULARIO_DINAMICO' && (
                        perguntasCampanhaSelecionada.map((p) => (
                          <th key={p.id} className="p-3 min-w-[160px] max-w-[240px]">
                            {p.pergunta}
                          </th>
                        ))
                      )}

                      {campanhaSelecionadaRespostas?.tipo === 'ATUALIZACAO_CADASTRAL' && (
                        <th className="p-3">Detalhes / Alterações</th>
                      )}

                      <th className="p-3 pr-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {loadingRespostas ? (
                      <tr>
                        <td colSpan="10" className="p-8 text-center text-slate-500">
                          <RefreshCw className="w-5 h-5 animate-spin inline mr-2 text-[#1e3a5f]" />
                          Carregando respostas da campanha...
                        </td>
                      </tr>
                    ) : currentRespostasItems.length === 0 ? (
                      <tr>
                        <td colSpan="10" className="p-8 text-center text-slate-400">
                          Nenhum militar encontrado com os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      currentRespostasItems.map((m) => {
                        const isResp = m.status_resposta === 'Respondido';
                        const resp = m.resposta_completa || {};

                        let respostasObj = {};
                        let arquivosObj = {};
                        if (resp.respostas_json) {
                          try {
                            respostasObj = typeof resp.respostas_json === 'string' ? JSON.parse(resp.respostas_json) : resp.respostas_json;
                          } catch (_e) {}
                        }
                        if (resp.arquivos_anexados_json) {
                          try {
                            arquivosObj = typeof resp.arquivos_anexados_json === 'string' ? JSON.parse(resp.arquivos_anexados_json) : resp.arquivos_anexados_json;
                          } catch (_e) {}
                        }

                        return (
                          <tr
                            key={m.militar_id}
                            onClick={() => {
                              if (isResp) {
                                setModalRespostaMilitar({
                                  open: true,
                                  militar: m,
                                  resposta: resp,
                                  observacaoRH: resp.observacao_gestor || '',
                                });
                              }
                            }}
                            className={`hover:bg-blue-50/50 transition-colors bg-white ${isResp ? 'cursor-pointer' : ''}`}
                          >
                            <td className="p-3 pl-4">
                              <span className="font-bold text-slate-900 block">{m.militar_posto} {m.militar_nome}</span>
                              <span className="text-[10px] text-slate-400 font-mono">Mat: {m.militar_matricula}</span>
                            </td>
                            <td className="p-3 text-slate-600 font-semibold">{m.militar_lotacao}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isResp ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {isResp ? 'Respondido' : 'Pendente'}
                              </span>
                            </td>
                            <td className="p-3 text-slate-500 font-mono text-[11px]">
                              {m.data_resposta ? m.data_resposta.replace('T', ' ').slice(0, 16) : '-'}
                            </td>

                            {/* Células Plano de Férias */}
                            {campanhaSelecionadaRespostas?.tipo === 'PLANO_FERIAS' && (
                              <>
                                <td className="p-3">
                                  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-bold text-[11px]">
                                    {resp.opcao_1_meses || m.detalhes_resposta || '-'}
                                  </span>
                                </td>
                                <td className="p-3 text-slate-700">{resp.opcao_2_meses || '-'}</td>
                                <td className="p-3 text-slate-700">{resp.opcao_3_meses || '-'}</td>
                                <td className="p-3 text-slate-600">{resp.modo_parcelamento || '-'}</td>
                              </>
                            )}

                            {/* Células Assinatura de Documento */}
                            {campanhaSelecionadaRespostas?.tipo === 'ASSINATURA_DOCUMENTO' && (
                              <>
                                <td className="p-3">
                                  {resp.arquivo_devolucao_url ? (
                                    <div className="flex items-center gap-1.5 text-purple-900 font-bold bg-purple-50 px-2 py-1 rounded-lg border border-purple-200 max-w-[200px]">
                                      <Paperclip className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                      <span className="truncate text-[11px]" title={resp.arquivo_devolucao_nome || 'Arquivo Assinado'}>
                                        {resp.arquivo_devolucao_nome || 'Arquivo Assinado'}
                                      </span>
                                      <a
                                        href={resp.arquivo_devolucao_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-purple-700 hover:text-purple-900 ml-auto"
                                        title="Baixar Anexo"
                                      >
                                        <Download className="w-3.5 h-3.5" />
                                      </a>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 italic">Sem anexo</span>
                                  )}
                                </td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${resp.termo_aceite ? 'bg-emerald-100 text-emerald-800' : 'text-slate-400'}`}>
                                    {resp.termo_aceite ? 'Confirmado' : '-'}
                                  </span>
                                </td>
                              </>
                            )}

                            {/* Células Formulário Dinâmico */}
                            {campanhaSelecionadaRespostas?.tipo === 'FORMULARIO_DINAMICO' && (
                              perguntasCampanhaSelecionada.map((p) => {
                                if (p.tipo === 'upload_arquivo') {
                                  const item = arquivosObj[p.id];
                                  const url = typeof item === 'object' ? item?.url : item;
                                  const nome = typeof item === 'object' ? item?.nome || item?.nome_original : 'Arquivo Anexo';

                                  return (
                                    <td key={p.id} className="p-3">
                                      {url ? (
                                        <div className="flex items-center gap-1.5 text-purple-900 font-bold bg-purple-50 px-2 py-1 rounded-lg border border-purple-200 max-w-[200px]">
                                          <Paperclip className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                          <span className="truncate text-[11px]" title={nome}>{nome}</span>
                                          <a
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="text-purple-700 hover:text-purple-900 ml-auto"
                                            title="Baixar Anexo"
                                          >
                                            <Download className="w-3.5 h-3.5" />
                                          </a>
                                        </div>
                                      ) : (
                                        <span className="text-slate-400">-</span>
                                      )}
                                    </td>
                                  );
                                }

                                const val = respostasObj[p.id];
                                const strVal = Array.isArray(val) ? val.join(', ') : (val !== undefined && val !== null ? String(val) : '-');
                                return (
                                  <td key={p.id} className="p-3 text-slate-700 max-w-xs truncate" title={strVal}>
                                    {strVal}
                                  </td>
                                );
                              })
                            )}

                            {/* Células Atualização Cadastral */}
                            {campanhaSelecionadaRespostas?.tipo === 'ATUALIZACAO_CADASTRAL' && (
                              <td className="p-3 text-slate-700 max-w-xs truncate">
                                {m.detalhes_resposta || (isResp ? 'Dados conferidos sem alteração' : 'Pendente')}
                              </td>
                            )}

                            <td className="p-3 pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                              {isResp ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setModalRespostaMilitar({
                                    open: true,
                                    militar: m,
                                    resposta: resp,
                                    observacaoRH: resp.observacao_gestor || '',
                                  })}
                                  className="text-[11px] h-7 px-2.5 rounded-lg border-blue-200 text-blue-700 hover:bg-blue-50 font-bold"
                                >
                                  <Eye className="w-3 h-3 mr-1" />
                                  Auditar
                                </Button>
                              ) : (
                                <span className="text-slate-400 text-[11px] italic">Pendente</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* PAGINAÇÃO DE RESPOSTAS NOMINAIS */}
              {totalPaginasRespostas > 1 && (
                <div className="p-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
                  <div>
                    Mostrando {((paginaRespostas - 1) * respostasPorPagina) + 1} a {Math.min(paginaRespostas * respostasPorPagina, militaresRespostasFiltrados.length)} de {militaresRespostasFiltrados.length} registros
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPaginaRespostas((p) => Math.max(p - 1, 1))}
                      disabled={paginaRespostas === 1}
                      className="h-8 px-2"
                    >
                      Anterior
                    </Button>
                    {Array.from({ length: totalPaginasRespostas }, (_, i) => i + 1).slice(0, 7).map((p) => (
                      <Button
                        key={p}
                        type="button"
                        variant={paginaRespostas === p ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPaginaRespostas(p)}
                        className={`h-8 w-8 p-0 ${paginaRespostas === p ? 'bg-[#1e3a5f] text-white' : ''}`}
                      >
                        {p}
                      </Button>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPaginaRespostas((p) => Math.min(p + 1, totalPaginasRespostas))}
                      disabled={paginaRespostas === totalPaginasRespostas}
                      className="h-8 px-2"
                    >
                      Próximo
                    </Button>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL DE CRIAÇÃO / EDIÇÃO DE CAMPANHA */}
        {/* ========================================================================= */}
        {modalNovaCampanha.open && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full p-5 sm:p-7 space-y-5 text-xs animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-slate-800 text-base flex items-center">
                  {modalNovaCampanha.isEditing
                    ? `Editar Campanha: ${modalNovaCampanha.titulo}`
                    : modalNovaCampanha.tipo === 'PLANO_FERIAS'
                    ? 'Novo Plano Anual de Férias'
                    : modalNovaCampanha.tipo === 'ATUALIZACAO_CADASTRAL'
                    ? 'Nova Campanha de Atualização Cadastral'
                    : modalNovaCampanha.tipo === 'ASSINATURA_DOCUMENTO'
                    ? 'Nova Campanha de Assinatura de Documento'
                    : 'Novo Formulário Dinâmico (Construtor)'}
                </h3>
                <button
                  type="button"
                  onClick={() => setModalNovaCampanha({ ...modalNovaCampanha, open: false })}
                  className="text-slate-400 hover:text-slate-600 font-bold text-base"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSalvarCampanha} className="space-y-4">
                {/* TIPO DE CAMPANHA, ANO, STATUS & TÍTULO */}
                <div className={`grid grid-cols-1 ${modalNovaCampanha.isEditing ? 'sm:grid-cols-4' : 'sm:grid-cols-4'} gap-3`}>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Tipo de Campanha *</label>
                    <select
                      value={modalNovaCampanha.tipo}
                      onChange={(e) => abrirCriacaoCampanha(e.target.value)}
                      disabled={modalNovaCampanha.isEditing}
                      className="w-full h-10 px-3 border border-slate-300 rounded-xl text-xs bg-white outline-none focus:border-[#1e3a5f] font-semibold"
                    >
                      <option value="PLANO_FERIAS">🏖️ Plano de Férias (Fixo)</option>
                      <option value="ATUALIZACAO_CADASTRAL">🪪 Atualização Cadastral (Fixo)</option>
                      <option value="ASSINATURA_DOCUMENTO">✍️ Assinatura de Documentos (Fixo)</option>
                      <option value="FORMULARIO_DINAMICO">📋 Formulário Dinâmico (Google Forms)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Ano Exercício *</label>
                    <Input
                      type="number"
                      min={2020}
                      max={2050}
                      value={modalNovaCampanha.ano_referencia || ''}
                      onChange={(e) => setModalNovaCampanha({ ...modalNovaCampanha, ano_referencia: Number(e.target.value) })}
                      required
                      placeholder="Ex: 2027"
                      className="h-10 text-xs rounded-xl font-bold"
                    />
                  </div>

                  {modalNovaCampanha.isEditing && (
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 block">Status *</label>
                      <select
                        value={modalNovaCampanha.status || 'Aberta_Coleta'}
                        onChange={(e) => setModalNovaCampanha({ ...modalNovaCampanha, status: e.target.value })}
                        className="w-full h-10 px-3 border border-slate-300 rounded-xl text-xs bg-white outline-none focus:border-[#1e3a5f] font-semibold"
                      >
                        <option value="Aberta_Coleta">🟢 Aberta / Ativa</option>
                        <option value="Encerrada">⚪ Encerrada</option>
                        <option value="Arquivada">📁 Arquivada</option>
                      </select>
                    </div>
                  )}

                  <div className={`${modalNovaCampanha.isEditing ? 'sm:col-span-1' : 'sm:col-span-2'} space-y-1`}>
                    <label className="font-bold text-slate-700 block">Título da Campanha *</label>
                    <Input
                      type="text"
                      value={modalNovaCampanha.titulo}
                      onChange={(e) => setModalNovaCampanha({ ...modalNovaCampanha, titulo: e.target.value })}
                      required
                      placeholder="Ex: Plano Anual de Férias 2027"
                      className="h-10 text-xs rounded-xl"
                    />
                  </div>
                </div>

                {/* ESCOPO */}
                <div className="space-y-2 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <label className="font-bold text-slate-700 block flex items-center">
                    <Users className="w-4 h-4 mr-1.5 text-[#1e3a5f]" />
                    Público Alvo / Escopo de Aplicação *
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer text-xs ${
                      modalNovaCampanha.tipo_escopo === 'TODOS' ? 'bg-white border-[#1e3a5f] font-bold text-[#1e3a5f] ring-1 ring-[#1e3a5f]' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}>
                      <input
                        type="radio"
                        name="tipo_escopo"
                        value="TODOS"
                        checked={modalNovaCampanha.tipo_escopo === 'TODOS'}
                        onChange={() => setModalNovaCampanha({ ...modalNovaCampanha, tipo_escopo: 'TODOS' })}
                        className="accent-[#1e3a5f]"
                      />
                      <span>Toda a Corporação (Geral)</span>
                    </label>

                    <label className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer text-xs ${
                      modalNovaCampanha.tipo_escopo === 'UNIDADES' ? 'bg-white border-[#1e3a5f] font-bold text-[#1e3a5f] ring-1 ring-[#1e3a5f]' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}>
                      <input
                        type="radio"
                        name="tipo_escopo"
                        value="UNIDADES"
                        checked={modalNovaCampanha.tipo_escopo === 'UNIDADES'}
                        onChange={() => setModalNovaCampanha({ ...modalNovaCampanha, tipo_escopo: 'UNIDADES' })}
                        className="accent-[#1e3a5f]"
                      />
                      <span>Selecionar Unidades / Lotações</span>
                    </label>
                  </div>

                  {modalNovaCampanha.tipo_escopo === 'UNIDADES' && (
                    <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2 mt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-700">Selecione as Unidades Participantes:</span>
                        <div className="space-x-2">
                          <button
                            type="button"
                            onClick={() => setModalNovaCampanha({ ...modalNovaCampanha, escopo_unidades_ids: unidadesList.map((u) => u.id) })}
                            className="text-[11px] text-[#1e3a5f] font-bold hover:underline"
                          >
                            Marcar Todas
                          </button>
                          <button
                            type="button"
                            onClick={() => setModalNovaCampanha({ ...modalNovaCampanha, escopo_unidades_ids: [] })}
                            className="text-[11px] text-slate-500 font-bold hover:underline"
                          >
                            Desmarcar
                          </button>
                        </div>
                      </div>

                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 transform -translate-y-1/2 text-slate-400" />
                        <Input
                          type="text"
                          placeholder="Buscar unidade..."
                          value={buscaUnidade}
                          onChange={(e) => setBuscaUnidade(e.target.value)}
                          className="h-8 text-xs pl-8 rounded-lg"
                        />
                      </div>

                      <div className="max-h-36 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
                        {unidadesList
                          .filter((u) => u.nome.toLowerCase().includes(buscaUnidade.toLowerCase()))
                          .map((unidade) => {
                            const selected = modalNovaCampanha.escopo_unidades_ids.includes(unidade.id);
                            return (
                              <label
                                key={unidade.id}
                                className={`p-1.5 rounded-lg border text-[11px] flex items-center gap-1.5 cursor-pointer truncate ${
                                  selected ? 'bg-blue-50 border-[#1e3a5f] font-bold text-[#1e3a5f]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => {
                                    const novos = selected
                                      ? modalNovaCampanha.escopo_unidades_ids.filter((id) => id !== unidade.id)
                                      : [...modalNovaCampanha.escopo_unidades_ids, unidade.id];
                                    setModalNovaCampanha({ ...modalNovaCampanha, escopo_unidades_ids: novos });
                                  }}
                                  className="accent-[#1e3a5f]"
                                />
                                <span className="truncate" title={unidade.nome}>{unidade.nome}</span>
                              </label>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>

                {/* PRAZOS */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Data de Abertura / Início *</label>
                    <Input
                      type="date"
                      value={modalNovaCampanha.data_inicio}
                      onChange={(e) => setModalNovaCampanha({ ...modalNovaCampanha, data_inicio: e.target.value })}
                      required
                      className="h-10 text-xs rounded-xl"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Prazo Militar (Portal) *</label>
                    <Input
                      type="date"
                      value={modalNovaCampanha.data_fim_militar}
                      onChange={(e) => setModalNovaCampanha({ ...modalNovaCampanha, data_fim_militar: e.target.value })}
                      required
                      className="h-10 text-xs rounded-xl"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Prazo Unidade / Homologação</label>
                    <Input
                      type="date"
                      value={modalNovaCampanha.data_fim_unidade}
                      onChange={(e) => setModalNovaCampanha({ ...modalNovaCampanha, data_fim_unidade: e.target.value })}
                      className="h-10 text-xs rounded-xl"
                    />
                  </div>
                </div>

                {/* INSTRUÇÕES */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Instruções / Orientação aos Militares</label>
                  <textarea
                    rows={3}
                    value={modalNovaCampanha.instrucoes}
                    onChange={(e) => setModalNovaCampanha({ ...modalNovaCampanha, instrucoes: e.target.value })}
                    placeholder="Orientações que serão exibidas em destaque para o militar na tela inicial do portal..."
                    className="w-full p-3 border border-slate-300 rounded-xl text-xs outline-none focus:border-[#1e3a5f]"
                  />
                </div>

                {/* REGRAS ESPECÍFICAS DE FÉRIAS (CASCATA) */}
                {modalNovaCampanha.tipo === 'PLANO_FERIAS' && (
                  <div className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-200 space-y-2">
                    <strong className="block text-emerald-950 font-bold flex items-center">
                      <Link2 className="w-4 h-4 mr-1 text-emerald-700" />
                      Regras de Negócio e Cascata do Plano de Férias
                    </strong>
                    <label className="flex items-center space-x-2 text-xs text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={modalNovaCampanha.config_regras?.exigir_atualizacao_cadastral}
                        onChange={(e) => setModalNovaCampanha({
                          ...modalNovaCampanha,
                          config_regras: { ...modalNovaCampanha.config_regras, exigir_atualizacao_cadastral: e.target.checked },
                        })}
                        className="w-4 h-4 accent-emerald-600 rounded"
                      />
                      <span><strong>Exigir Atualização Cadastral Prévia:</strong> O militar só consegue submeter opções de férias após validar seus dados no portal.</span>
                    </label>
                  </div>
                )}

                {/* CONFIGURAÇÃO DE MODELO PARA ASSINATURA DE DOCUMENTO */}
                {modalNovaCampanha.tipo === 'ASSINATURA_DOCUMENTO' && (
                  <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200 space-y-3">
                    <strong className="block text-amber-950 font-bold flex items-center">
                      <FileSignature className="w-4 h-4 mr-1 text-amber-700" />
                      Arquivo Modelo e Termo de Ciência
                    </strong>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 block text-xs">Arquivo Modelo para Download pelo Militar (Opcional):</label>
                      {modalNovaCampanha.arquivo_modelo_url ? (
                        <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-amber-200">
                          <span className="font-bold text-amber-950 truncate max-w-sm">{modalNovaCampanha.arquivo_modelo_nome || 'Arquivo Modelo Anexado'}</span>
                          <button
                            type="button"
                            onClick={() => setModalNovaCampanha({ ...modalNovaCampanha, arquivo_modelo_url: '', arquivo_modelo_nome: '' })}
                            className="text-red-500 hover:text-red-700 text-xs font-bold"
                          >
                            Remover
                          </button>
                        </div>
                      ) : (
                        <input
                          type="file"
                          onChange={(e) => handleUploadModeloGestor(e.target.files?.[0])}
                          className="text-xs"
                        />
                      )}
                    </div>

                    <label className="flex items-center space-x-2 text-xs text-slate-800 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={modalNovaCampanha.exigir_devolucao_arquivo}
                        onChange={(e) => setModalNovaCampanha({ ...modalNovaCampanha, exigir_devolucao_arquivo: e.target.checked })}
                        className="w-4 h-4 accent-amber-600 rounded"
                      />
                      <span><strong>Exigir Upload do Documento Assinado:</strong> O militar deve reenviar o PDF assinado pelo portal.</span>
                    </label>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 block text-xs">Texto do Termo de Ciência / Declaração:</label>
                      <Input
                        type="text"
                        value={modalNovaCampanha.texto_termo_aceite}
                        onChange={(e) => setModalNovaCampanha({ ...modalNovaCampanha, texto_termo_aceite: e.target.value })}
                        placeholder="Ex: Declaro estar ciente das obrigações funcionais aqui descritas."
                        className="h-9 text-xs rounded-xl"
                      />
                    </div>
                  </div>
                )}

                {/* CONSTRUTOR DE FORMULÁRIO DINÂMICO */}
                {modalNovaCampanha.tipo === 'FORMULARIO_DINAMICO' && (
                  <div className="p-4 bg-purple-50/50 rounded-2xl border border-purple-200 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <strong className="block text-purple-950 font-bold text-sm flex items-center">
                          <Layers className="w-4 h-4 mr-1 text-purple-700" />
                          Construtor de Perguntas do Formulário
                        </strong>
                        <p className="text-[11px] text-purple-700">Adicione perguntas personalizadas de texto, múltipla escolha, upload ou ciência.</p>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Button
                          type="button"
                          onClick={() => handleAdicionarPergunta('texto_curto')}
                          className="h-8 text-[11px] bg-purple-700 hover:bg-purple-800 text-white rounded-lg font-bold"
                        >
                          <Plus className="w-3 h-3 mr-1" /> Texto
                        </Button>
                        <Button
                          type="button"
                          onClick={() => handleAdicionarPergunta('multipla_escolha')}
                          variant="outline"
                          className="h-8 text-[11px] rounded-lg font-bold border-purple-200 text-purple-900"
                        >
                          <Plus className="w-3 h-3 mr-1" /> Opções
                        </Button>
                        <Button
                          type="button"
                          onClick={() => handleAdicionarPergunta('upload_arquivo')}
                          variant="outline"
                          className="h-8 text-[11px] rounded-lg font-bold border-purple-200 text-purple-900"
                        >
                          <Plus className="w-3 h-3 mr-1" /> Upload Anexo
                        </Button>
                      </div>
                    </div>

                    {modalNovaCampanha.campos_formulario.length === 0 ? (
                      <div className="p-6 text-center border-2 border-dashed border-purple-200 rounded-2xl text-purple-600 bg-white/50 font-medium">
                        Nenhuma pergunta adicionada ainda. Clique nos botões acima para adicionar campos.
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                        {modalNovaCampanha.campos_formulario.map((campo, cIdx) => (
                          <div key={campo.id || cIdx} className="p-3.5 bg-white rounded-2xl border border-purple-100 shadow-xs space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                              <div className="flex items-center space-x-2">
                                <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-800 font-bold text-[10px] flex items-center justify-center">
                                  {cIdx + 1}
                                </span>
                                <span className="font-bold text-slate-800 text-xs">
                                  {TIPOS_CAMPOS_FORMULARIO.find((t) => t.tipo === campo.tipo)?.icone}{' '}
                                  {TIPOS_CAMPOS_FORMULARIO.find((t) => t.tipo === campo.tipo)?.label}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleRemoverPergunta(cIdx)}
                                className="text-red-500 hover:text-red-700 p-1 text-xs font-bold"
                                title="Remover Pergunta"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                              <div className="sm:col-span-3 space-y-1">
                                <label className="text-[11px] font-bold text-slate-700 block">Enunciado da Pergunta *</label>
                                <Input
                                  type="text"
                                  value={campo.pergunta}
                                  onChange={(e) => handleEditarPergunta(cIdx, 'pergunta', e.target.value)}
                                  placeholder="Digite a pergunta que o militar verá..."
                                  required
                                  className="h-8 text-xs"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-700 block">Obrigatoriedade</label>
                                <label className="flex items-center space-x-2 h-8 px-2 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={campo.obrigatorio}
                                    onChange={(e) => handleEditarPergunta(cIdx, 'obrigatorio', e.target.checked)}
                                    className="w-4 h-4 accent-purple-600 rounded"
                                  />
                                  <span className="text-xs font-semibold text-slate-800">Obrigatório</span>
                                </label>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-slate-500 block">Texto de Ajuda / Orientação (Opcional)</label>
                              <Input
                                type="text"
                                value={campo.descricao_ajuda || ''}
                                onChange={(e) => handleEditarPergunta(cIdx, 'descricao_ajuda', e.target.value)}
                                placeholder="Instrução adicional sobre como responder..."
                                className="h-8 text-xs"
                              />
                            </div>

                            {/* OPÇÕES PARA ESCOLHAS */}
                            {(campo.tipo === 'multipla_escolha' || campo.tipo === 'checkbox' || campo.tipo === 'select') && (
                              <div className="p-3 bg-purple-50/40 rounded-xl border border-purple-100 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-purple-950">Opções de Resposta:</span>
                                  <button
                                    type="button"
                                    onClick={() => handleAdicionarOpcao(cIdx)}
                                    className="text-[11px] font-bold text-purple-700 hover:underline flex items-center"
                                  >
                                    <Plus className="w-3 h-3 mr-0.5" /> Adicionar Opção
                                  </button>
                                </div>

                                <div className="space-y-1.5">
                                  {(campo.opcoes || []).map((op, opIdx) => (
                                    <div key={opIdx} className="flex items-center space-x-1.5">
                                      <span className="text-slate-400 font-mono text-xs w-4">{opIdx + 1}.</span>
                                      <Input
                                        type="text"
                                        value={op}
                                        onChange={(e) => handleEditarOpcao(cIdx, opIdx, e.target.value)}
                                        className="h-7 text-xs flex-1 bg-white"
                                        placeholder={`Opção ${opIdx + 1}`}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleRemoverOpcao(cIdx, opIdx)}
                                        disabled={(campo.opcoes || []).length <= 1}
                                        className="text-red-400 hover:text-red-600 p-1 disabled:opacity-20"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* ANEXO DE MODELO ESPECÍFICO DESTA PERGUNTA */}
                            {campo.tipo === 'upload_arquivo' && (
                              <div className="p-2.5 bg-blue-50/50 rounded-xl border border-blue-200 text-[11px] space-y-1.5">
                                <span className="font-bold text-blue-950 block">Arquivo Modelo Específico desta Pergunta (Opcional):</span>
                                {campo.arquivo_modelo_url ? (
                                  <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-blue-200">
                                    <span className="font-bold text-blue-900 truncate max-w-xs">{campo.arquivo_modelo_nome || 'Arquivo Modelo Anexado'}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleEditarPergunta(cIdx, 'arquivo_modelo_url', '');
                                        handleEditarPergunta(cIdx, 'arquivo_modelo_nome', '');
                                      }}
                                      className="text-red-500 hover:text-red-700 text-xs font-bold"
                                    >
                                      Remover
                                    </button>
                                  </div>
                                ) : (
                                  <input
                                    type="file"
                                    onChange={(e) => handleUploadModeloGestor(e.target.files?.[0], cIdx)}
                                    className="text-xs"
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* BOTÕES DE SALVAMENTO */}
                <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setModalNovaCampanha({ ...modalNovaCampanha, open: false })}
                    className="text-xs h-10 rounded-xl px-4"
                  >
                    Cancelar
                  </Button>

                  <Button
                    type="submit"
                    disabled={actionLoading}
                    className="bg-[#1e3a5f] hover:bg-[#2a4d7d] text-white text-xs font-semibold h-10 rounded-xl px-5 shadow-sm"
                  >
                    {actionLoading ? 'Salvando...' : modalNovaCampanha.isEditing ? 'Atualizar Campanha' : 'Iniciar Campanha'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL DE RESPOSTA INDIVIDUAL DO MILITAR */}
        {/* ========================================================================= */}
        {modalRespostaMilitar.open && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-5 sm:p-7 space-y-4 text-xs animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">
                    Respostas do Militar: {modalRespostaMilitar.militar?.militar_posto} {modalRespostaMilitar.militar?.militar_nome}
                  </h3>
                  <span className="text-slate-500 text-[11px]">
                    Matrícula: {modalRespostaMilitar.militar?.militar_matricula} • Lotação: {modalRespostaMilitar.militar?.militar_lotacao}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setModalRespostaMilitar({ open: false, militar: null, resposta: null, observacaoRH: '' })}
                  className="text-slate-400 hover:text-slate-600 font-bold text-base"
                >
                  ✕
                </button>
              </div>

              {/* CONTEÚDO DAS RESPOSTAS */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {/* Se for Assinatura de Documento */}
                {modalRespostaMilitar.resposta?.arquivo_devolucao_url && (
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-2">
                    <strong className="block text-amber-950 font-bold text-sm flex items-center">
                      <FileSignature className="w-4 h-4 mr-1.5 text-amber-700" />
                      Documento Assinado Enviado pelo Militar
                    </strong>
                    <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-amber-200">
                      <span className="font-bold text-slate-800 truncate max-w-sm">
                        {modalRespostaMilitar.resposta.arquivo_devolucao_nome || 'documento_assinado.pdf'}
                      </span>
                      <a
                        href={modalRespostaMilitar.resposta.arquivo_devolucao_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-3 py-1.5 font-bold text-xs flex items-center shadow-xs"
                      >
                        <Download className="w-3.5 h-3.5 mr-1" />
                        Baixar Documento
                      </a>
                    </div>
                  </div>
                )}

                {/* Perguntas e Respostas do Formulário Dinâmico */}
                {(() => {
                  let formCampos = [];
                  if (campanhaSelecionadaRespostas?.config_formulario) {
                    try {
                      const p = typeof campanhaSelecionadaRespostas.config_formulario === 'string'
                        ? JSON.parse(campanhaSelecionadaRespostas.config_formulario)
                        : campanhaSelecionadaRespostas.config_formulario;
                      formCampos = p?.campos || [];
                    } catch (_e) {}
                  }

                  let respostasObj = {};
                  let arquivosObj = {};
                  if (modalRespostaMilitar.resposta?.respostas_json) {
                    try {
                      respostasObj = typeof modalRespostaMilitar.resposta.respostas_json === 'string'
                        ? JSON.parse(modalRespostaMilitar.resposta.respostas_json)
                        : modalRespostaMilitar.resposta.respostas_json;
                    } catch (_e) {}
                  }
                  if (modalRespostaMilitar.resposta?.arquivos_anexados_json) {
                    try {
                      arquivosObj = typeof modalRespostaMilitar.resposta.arquivos_anexados_json === 'string'
                        ? JSON.parse(modalRespostaMilitar.resposta.arquivos_anexados_json)
                        : modalRespostaMilitar.resposta.arquivos_anexados_json;
                    } catch (_e) {}
                  }

                  if (formCampos.length === 0) return null;

                  return (
                    <div className="space-y-3">
                      <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Perguntas Respondidas:</h4>
                      {formCampos.map((c, i) => {
                        const val = respostasObj[c.id];
                        const anexo = arquivosObj[c.id];
                        const anexoUrl = typeof anexo === 'object' ? anexo?.url : anexo;
                        const anexoNome = typeof anexo === 'object' ? anexo?.nome || anexo?.nome_original : 'Arquivo Anexo';

                        return (
                          <div key={c.id || i} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                            <span className="font-bold text-slate-700 block">
                              {i + 1}. {c.pergunta}
                            </span>
                            {c.tipo === 'upload_arquivo' ? (
                              anexoUrl ? (
                                <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200 mt-1">
                                  <span className="font-semibold text-slate-800 truncate">{anexoNome}</span>
                                  <a
                                    href={anexoUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-700 font-bold hover:underline flex items-center"
                                  >
                                    <Download className="w-3.5 h-3.5 mr-1" /> Baixar
                                  </a>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">Nenhum arquivo enviado</span>
                              )
                            ) : (
                              <p className="text-slate-900 bg-white p-2 rounded-lg border border-slate-200 font-medium">
                                {Array.isArray(val) ? val.join(', ') : (val !== undefined && val !== null && String(val).trim() !== '' ? String(val) : '—')}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Termo de Ciência */}
                {modalRespostaMilitar.resposta?.termo_aceite && (
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>O militar confirmou o termo de ciência e veracidade na submissão.</span>
                  </div>
                )}
              </div>

              {/* AÇÕES DE HOMOLOGAÇÃO PELO GESTOR */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalRespostaMilitar({ open: false, militar: null, resposta: null, observacaoRH: '' })}
                  className="text-xs h-9 rounded-xl"
                >
                  Fechar
                </Button>

                <div className="flex items-center space-x-2">
                  <Button
                    type="button"
                    onClick={async () => {
                      if (!modalRespostaMilitar.resposta?.id) return;
                      setActionLoading(true);
                      try {
                        await base44.functions.invoke('portal_servicos', {
                          acao: 'CAMPANHA_HOMOLOGAR_RESPOSTA',
                          resposta_id: modalRespostaMilitar.resposta.id,
                          status: 'Homologado',
                          observacao_gestor: 'Aprovado pelo RH',
                        });
                        setFeedback({ type: 'success', msg: 'Resposta homologada com sucesso!' });
                        setModalRespostaMilitar({ open: false, militar: null, resposta: null, observacaoRH: '' });
                        if (campanhaSelecionadaRespostas) {
                          await carregarRespostasCampanha(campanhaSelecionadaRespostas);
                        }
                      } catch (err) {
                        setFeedback({ type: 'error', msg: err.message || 'Falha ao homologar.' });
                      } finally {
                        setActionLoading(false);
                      }
                    }}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold h-9 px-4 shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5 mr-1" />
                    Dar Visto / Homologar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL DE PROGRESSO DO DOWNLOAD DE ANEXOS (ZIP) */}
        {/* ========================================================================= */}
        {zipProgress?.open && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 text-xs animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 text-[#1e3a5f] flex items-center justify-center font-bold">
                  <FolderDown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Download em Lote de Anexos</h3>
                  <p className="text-[11px] text-slate-500">Compactação e renomeação institucional</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="text-slate-700">{zipProgress.texto}</span>
                  {zipProgress.total > 0 && (
                    <span className="text-[#1e3a5f] font-mono">
                      {zipProgress.atual}/{zipProgress.total}
                    </span>
                  )}
                </div>

                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                  <div
                    className="bg-[#1e3a5f] h-full transition-all duration-300 rounded-full"
                    style={{
                      width: zipProgress.total > 0 ? `${Math.round((zipProgress.atual / zipProgress.total) * 100)}%` : '100%',
                    }}
                  ></div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                {!zipProgress.loading && (
                  <Button
                    type="button"
                    onClick={() => setZipProgress(null)}
                    className="bg-[#1e3a5f] text-white text-xs h-8 rounded-lg font-bold"
                  >
                    Fechar
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
