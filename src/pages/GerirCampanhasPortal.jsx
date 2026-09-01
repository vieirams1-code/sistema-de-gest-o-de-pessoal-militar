import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
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
  FileSpreadsheet,
  X,
  Play,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
  const navigate = useNavigate();
  const [campanhas, setCampanhas] = useState([]);
  const [planosInstitucionais, setPlanosInstitucionais] = useState([]);
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

  // Modal de Criação / Edição de Campanha
  const [modalNovaCampanha, setModalNovaCampanha] = useState({
    open: false,
    isEditing: false,
    editId: null,
    tipo: 'PLANO_FERIAS',
    plano_ferias_institucional_id: '',
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

  const carregarDados = async () => {
    setLoading(true);
    setFeedback({ type: '', msg: '' });
    try {
      const [res, planosRes] = await Promise.all([
        base44.functions.invoke('portal_servicos', { acao: 'CAMPANHA_LISTAR' }),
        base44.functions.invoke('portal_servicos', { acao: 'PLANO_INSTITUCIONAL_LISTAR' }),
      ]);
      setCampanhas(res.data?.campanhas || []);
      setPlanosInstitucionais(planosRes.data?.planos || []);

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
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Falha ao carregar dados do painel.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const abrirCriacaoCampanha = (tipo) => {
    setBuscaUnidade('');
    const ano = new Date().getFullYear() + 1;
    if (tipo === 'PLANO_FERIAS') {
      setModalNovaCampanha({
        open: true,
        isEditing: false,
        editId: null,
        tipo: 'PLANO_FERIAS',
        plano_ferias_institucional_id: '',
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
      plano_ferias_institucional_id: camp.plano_ferias_institucional_id || '',
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

  const handleCriarPlanoInstitucional = async () => {
    const ano = Number(modalNovaCampanha.ano_referencia) || (new Date().getFullYear() + 1);
    const tituloSugerido = `Plano de Férias ${ano}`;
    const titulo = window.prompt('Nome do novo Plano Institucional de Férias:', tituloSugerido);
    if (!titulo?.trim()) return;

    setActionLoading(true);
    try {
      const res = await base44.functions.invoke('portal_servicos', {
        acao: 'PLANO_INSTITUCIONAL_CRIAR',
        plano_payload: {
          titulo: titulo.trim(),
          ano_referencia: ano,
          status: 'ATIVO',
        },
      });
      const novoPlano = res.data?.plano;
      const planosRes = await base44.functions.invoke('portal_servicos', { acao: 'PLANO_INSTITUCIONAL_LISTAR' });
      setPlanosInstitucionais(planosRes.data?.planos || []);
      if (novoPlano?.id) {
        setModalNovaCampanha((prev) => ({
          ...prev,
          plano_ferias_institucional_id: novoPlano.id,
        }));
      }
      setFeedback({ type: 'success', msg: `Plano Institucional "${titulo.trim()}" criado. Agora esta campanha pode ser vinculada a ele.` });
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Falha ao criar Plano Institucional de Férias.' });
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

      if (modalNovaCampanha.tipo === 'PLANO_FERIAS' && !modalNovaCampanha.plano_ferias_institucional_id) {
        alert('Selecione ou crie um Plano Institucional de Férias antes de salvar esta nova campanha. Campanhas antigas continuam compatíveis, mas novas campanhas devem ser agrupadas.');
        return;
      }

      const payload = {
        titulo: modalNovaCampanha.titulo,
        tipo: modalNovaCampanha.tipo,
        plano_ferias_institucional_id: modalNovaCampanha.tipo === 'PLANO_FERIAS'
          ? modalNovaCampanha.plano_ferias_institucional_id
          : undefined,
        status: modalNovaCampanha.status || 'Aberta_Coleta',
        ano_referencia: Number(modalNovaCampanha.ano_referencia) || undefined,
        tipo_escopo: modalNovaCampanha.tipo_escopo,
        escopo_unidades_ids: modalNovaCampanha.escopo_unidades_ids,
        escopo_unidades_nomes: nomesUnidades,
        escopo_quadros: modalNovaCampanha.escopo_quadros,
        data_inicio: modalNovaCampanha.data_inicio,
        data_fim_militar: modalNovaCampanha.data_fim_militar,
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
    if (!window.confirm(`Tem certeza que deseja excluir a campanha "${camp.titulo}"? Esta ação removerá a campanha e as respostas enviadas a ela. (Férias já geradas na escala e alterações cadastrais aprovadas na ficha dos militares NÃO serão afetadas).`)) {
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

  const handleAbrirCentralRespostas = (camp) => {
    navigate(createPageUrl('CentralRespostasCampanhas') + (camp?.id ? `?campanhaId=${camp.id}` : ''));
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
                Gestor de Campanhas do Portal
              </h1>
              <p className="text-xs text-slate-500">
                Configure planos de férias, atualizações cadastrais, devolução de documentos e formulários dinâmicos
              </p>
            </div>
          </div>

          {/* BOTÕES DE NOVA CAMPANHA & LINK DIRETO PARA CENTRAL DE RESPOSTAS */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={() => handleAbrirCentralRespostas(null)}
              className="bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-semibold shadow-xs h-9 px-3.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
              Central de Respostas & Entregas
            </Button>

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

        {/* FEEDBACK ALERTS */}
        {feedback.msg && (
          <div className={`p-3.5 rounded-xl text-xs flex items-start space-x-2 animate-in fade-in ${
            feedback.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
            <span>{feedback.msg}</span>
          </div>
        )}

        {/* LISTA DE CAMPANHAS ATIVAS & HISTÓRICO */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
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
                              className="p-1.5 text-indigo-700 hover:bg-indigo-50 rounded transition-colors font-bold"
                              title="Ver Resultados & Entregas Nominais"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => abrirEdicaoCampanha(camp)}
                              disabled={actionLoading}
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded transition-colors"
                              title="Editar Campanha"
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

        {/* MODAL DE CRIAÇÃO / EDIÇÃO DE CAMPANHA */}
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
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
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

                {modalNovaCampanha.tipo === 'PLANO_FERIAS' && (
                  <div className="p-3 bg-blue-50/70 rounded-2xl border border-blue-200 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                      <div className="flex-1 space-y-1">
                        <label className="font-bold text-slate-700 block">Plano Institucional de Férias *</label>
                        <select
                          value={modalNovaCampanha.plano_ferias_institucional_id || ''}
                          onChange={(e) => setModalNovaCampanha({ ...modalNovaCampanha, plano_ferias_institucional_id: e.target.value })}
                          className="w-full h-10 px-3 border border-blue-300 rounded-xl text-xs bg-white outline-none focus:border-[#1e3a5f] font-semibold"
                        >
                          <option value="">Selecione o plano que agrupará esta campanha...</option>
                          {planosInstitucionais
                            .filter((p) => Number(p.ano_referencia) === Number(modalNovaCampanha.ano_referencia))
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.titulo} — {p.ano_referencia} ({p.total_campanhas || 0} campanha(s))
                              </option>
                            ))}
                        </select>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCriarPlanoInstitucional}
                        disabled={actionLoading}
                        className="h-10 text-xs border-blue-300 text-blue-800 bg-white hover:bg-blue-100"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Criar novo Plano
                      </Button>
                    </div>
                    <p className="text-[11px] text-blue-800">
                      Campanhas piloto, gerais e complementares vinculadas ao mesmo plano serão consolidadas no Painel do Plano de Férias.
                    </p>
                  </div>
                )}

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

      </div>
    </div>
  );
}
