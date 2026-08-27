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
  const [campanhas, setCampanhas] = useState([]);
  const [unidadesList, setUnidadesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', msg: '' });

  // Filtros e Paginação (Tabela)
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
    tipo: 'PLANO_FERIAS', // 'PLANO_FERIAS' | 'ATUALIZACAO_CADASTRAL' | 'ASSINATURA_DOCUMENTO' | 'FORMULARIO_DINAMICO'
    titulo: 'Plano Anual de Férias 2027',
    ano_referencia: new Date().getFullYear() + 1,
    tipo_escopo: 'TODOS', // 'TODOS' | 'UNIDADES' | 'QUADROS'
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
    campos_formulario: [], // Perguntas do formulário dinâmico
    previewMode: false,
  });

  // Modal / Drawer de Retorno e Acompanhamento Nominal
  const [detalhesRetorno, setDetalhesRetorno] = useState({
    open: false,
    campanha: null,
    dados: null,
    filtro: 'TODOS', // 'TODOS' | 'Pendente' | 'Respondido'
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
      setCampanhas(res.data?.campanhas || []);

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
        titulo: `Recadastramento & Conferência Anual Obrigatória ${new Date().getFullYear()}`,
        ano_referencia: new Date().getFullYear(),
        tipo_escopo: 'TODOS',
        escopo_unidades_ids: [],
        escopo_quadros: [],
        data_inicio: new Date().toISOString().split('T')[0],
        data_fim_militar: `${new Date().getFullYear()}-11-15`,
        data_fim_unidade: `${new Date().getFullYear()}-11-30`,
        instrucoes: 'Conferência cadastral obrigatória de dados pessoais, contatos, endereço, CNH e dependentes.',
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
        titulo: `Entrega de Declaração de Bens e Renda ${new Date().getFullYear()}`,
        ano_referencia: new Date().getFullYear(),
        tipo_escopo: 'TODOS',
        escopo_unidades_ids: [],
        escopo_quadros: [],
        data_inicio: new Date().toISOString().split('T')[0],
        data_fim_militar: `${new Date().getFullYear()}-11-30`,
        data_fim_unidade: `${new Date().getFullYear()}-12-15`,
        instrucoes: 'Baixe o modelo oficial disponibilizado abaixo, preencha, assine e anexe de volta em formato PDF para conferência do RH.',
        config_regras: {},
        arquivo_modelo_url: '',
        arquivo_modelo_nome: '',
        exigir_devolucao_arquivo: true,
        texto_termo_aceite: 'Declaro sob as penas da lei a exatidão e autenticidade dos dados e documentos apresentados.',
        campos_formulario: [],
        previewMode: false,
      });
    } else {
      // FORMULARIO_DINAMICO (Google Forms)
      setModalNovaCampanha({
        open: true,
        isEditing: false,
        editId: null,
        tipo: 'FORMULARIO_DINAMICO',
        titulo: `Formulário de Levantamento de Informações ${new Date().getFullYear()}`,
        ano_referencia: new Date().getFullYear(),
        tipo_escopo: 'TODOS',
        escopo_unidades_ids: [],
        escopo_quadros: [],
        data_inicio: new Date().toISOString().split('T')[0],
        data_fim_militar: `${new Date().getFullYear()}-11-30`,
        data_fim_unidade: `${new Date().getFullYear()}-12-15`,
        instrucoes: 'Prezados militares, solicitamos o preenchimento das perguntas abaixo para atualização de cadastro e levantamento institucional.',
        config_regras: {},
        arquivo_modelo_url: '',
        arquivo_modelo_nome: '',
        exigir_devolucao_arquivo: false,
        texto_termo_aceite: '',
        campos_formulario: [
          {
            id: 'campo_1',
            tipo: 'texto_curto',
            pergunta: 'Qual sua principal área de atuação ou especialidade?',
            descricao_ajuda: 'Ex: Resgate, Salvamento em Altura, Combate a Incêndio, Vistoria Técnica',
            obrigatorio: true,
            opcoes: [],
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

  // Funções do Construtor de Perguntas do Formulário Dinâmico
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

  const handleEditarPergunta = (idx, chave, valor) => {
    setModalNovaCampanha((prev) => {
      const novos = [...prev.campos_formulario];
      novos[idx] = { ...novos[idx], [chave]: valor };
      return { ...prev, campos_formulario: novos };
    });
  };

  const handleRemoverPergunta = (idx) => {
    setModalNovaCampanha((prev) => {
      const novos = [...prev.campos_formulario];
      novos.splice(idx, 1);
      return { ...prev, campos_formulario: novos };
    });
  };

  const handleMoverPergunta = (idx, direcao) => {
    setModalNovaCampanha((prev) => {
      const novos = [...prev.campos_formulario];
      const targetIdx = idx + direcao;
      if (targetIdx < 0 || targetIdx >= novos.length) return prev;
      const temp = novos[idx];
      novos[idx] = novos[targetIdx];
      novos[targetIdx] = temp;
      return { ...prev, campos_formulario: novos };
    });
  };

  const handleAdicionarOpcao = (campoIdx) => {
    setModalNovaCampanha((prev) => {
      const novos = [...prev.campos_formulario];
      const c = novos[campoIdx];
      const count = (c.opcoes || []).length + 1;
      novos[campoIdx] = { ...c, opcoes: [...(c.opcoes || []), `Opção ${count}`] };
      return { ...prev, campos_formulario: novos };
    });
  };

  const handleEditarOpcao = (campoIdx, opIdx, novoValor) => {
    setModalNovaCampanha((prev) => {
      const novos = [...prev.campos_formulario];
      const c = novos[campoIdx];
      const novasOpcoes = [...(c.opcoes || [])];
      novasOpcoes[opIdx] = novoValor;
      novos[campoIdx] = { ...c, opcoes: novasOpcoes };
      return { ...prev, campos_formulario: novos };
    });
  };

  const handleRemoverOpcao = (campoIdx, opIdx) => {
    setModalNovaCampanha((prev) => {
      const novos = [...prev.campos_formulario];
      const c = novos[campoIdx];
      const novasOpcoes = (c.opcoes || []).filter((_, i) => i !== opIdx);
      novos[campoIdx] = { ...c, opcoes: novasOpcoes };
      return { ...prev, campos_formulario: novos };
    });
  };

  // Upload de arquivo modelo da campanha pelo Gestor
  const handleUploadModeloGestor = async (file, campoIdx = null) => {
    if (!file) return;
    setActionLoading(true);
    try {
      const uploadRes = await base44.integrations.Core.UploadFile({ file });
      const fileUrl = uploadRes?.file_url || uploadRes?.url;
      if (!fileUrl) throw new Error('Não foi possível obter URL do arquivo.');

      if (campoIdx !== null) {
        handleEditarPergunta(campoIdx, 'arquivo_modelo_url', fileUrl);
        handleEditarPergunta(campoIdx, 'arquivo_modelo_nome', file.name);
      } else {
        setModalNovaCampanha((prev) => ({
          ...prev,
          arquivo_modelo_url: fileUrl,
          arquivo_modelo_nome: file.name,
        }));
      }
      setFeedback({ type: 'success', msg: `Arquivo modelo "${file.name}" anexado com sucesso!` });
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Falha ao anexar arquivo modelo.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleUnidadeEscopo = (uId) => {
    const ids = [...modalNovaCampanha.escopo_unidades_ids];
    if (ids.includes(uId)) {
      setModalNovaCampanha({ ...modalNovaCampanha, escopo_unidades_ids: ids.filter((id) => id !== uId) });
    } else {
      setModalNovaCampanha({ ...modalNovaCampanha, escopo_unidades_ids: [...ids, uId] });
    }
  };

  const handleSelecionarTodasUnidades = () => {
    const allIds = unidadesList.map((u) => u.id);
    setModalNovaCampanha({ ...modalNovaCampanha, escopo_unidades_ids: allIds });
  };

  const handleLimparSelecaoUnidades = () => {
    setModalNovaCampanha({ ...modalNovaCampanha, escopo_unidades_ids: [] });
  };

  const handleSalvarCampanha = async (e) => {
    e.preventDefault();
    if (modalNovaCampanha.tipo_escopo === 'UNIDADES' && modalNovaCampanha.escopo_unidades_ids.length === 0) {
      setFeedback({ type: 'error', msg: 'Por favor, selecione ao menos uma unidade para o escopo.' });
      return;
    }

    if (modalNovaCampanha.tipo === 'FORMULARIO_DINAMICO' && modalNovaCampanha.campos_formulario.length === 0) {
      setFeedback({ type: 'error', msg: 'Adicione ao menos uma pergunta no formulário dinâmico antes de salvar.' });
      return;
    }

    setActionLoading(true);
    setFeedback({ type: '', msg: '' });

    let unidadesNomes = 'Toda a Corporação';
    if (modalNovaCampanha.tipo_escopo === 'UNIDADES' && modalNovaCampanha.escopo_unidades_ids.length > 0) {
      const nomes = unidadesList
        .filter((u) => modalNovaCampanha.escopo_unidades_ids.includes(u.id))
        .map((u) => u.nome || u.sigla || u.id);
      unidadesNomes = nomes.slice(0, 3).join(', ') + (nomes.length > 3 ? ` (+${nomes.length - 3} unidades)` : '');
    }

    const payloadCampanha = {
      ...modalNovaCampanha,
      escopo_unidades_nomes: unidadesNomes,
      config_formulario: JSON.stringify({ campos: modalNovaCampanha.campos_formulario || [] }),
    };

    try {
      if (modalNovaCampanha.isEditing) {
        await base44.functions.invoke('portal_servicos', {
          acao: 'CAMPANHA_EDITAR',
          campanha_id: modalNovaCampanha.editId,
          campanha_payload: payloadCampanha,
        });
        setFeedback({ type: 'success', msg: `Campanha "${modalNovaCampanha.titulo}" atualizada com sucesso!` });
      } else {
        const res = await base44.functions.invoke('portal_servicos', {
          acao: 'CAMPANHA_CRIAR',
          campanha_payload: payloadCampanha,
        });
        setFeedback({ type: 'success', msg: `Campanha "${res.data?.campanha?.titulo}" lançada com sucesso no Portal!` });
      }

      setModalNovaCampanha({ ...modalNovaCampanha, open: false });
      await carregarDados();
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Falha ao salvar campanha.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleExcluirCampanha = async (camp) => {
    if (!window.confirm(`Tem certeza que deseja EXCLUIR permanentemente a campanha "${camp.titulo}"?`)) return;
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
    if (!window.confirm(`Deseja arquivar a campanha "${camp.titulo}"?`)) return;
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

  const handleAbrirRetorno = async (camp) => {
    setActionLoading(true);
    try {
      const res = await base44.functions.invoke('portal_servicos', {
        acao: 'CAMPANHA_DETALHES_RETORNO',
        campanha_id: camp.id,
      });

      setDetalhesRetorno({
        open: true,
        campanha: camp,
        dados: res.data,
        filtro: 'TODOS',
      });
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Falha ao buscar retorno da campanha.' });
    } finally {
      setActionLoading(false);
    }
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

  // Exportação de Dados para CSV com suporte UTF-8 BOM
  const handleExportarPlanilha = () => {
    const campanha = detalhesRetorno.campanha;
    const militares = detalhesRetorno.dados?.militares || [];
    if (!campanha || militares.length === 0) {
      alert('Não há dados disponíveis para exportação.');
      return;
    }

    let formCampos = [];
    if (campanha.config_formulario) {
      try {
        const parsed = typeof campanha.config_formulario === 'string' ? JSON.parse(campanha.config_formulario) : campanha.config_formulario;
        formCampos = parsed?.campos || [];
      } catch (_e) {}
    }

    // Monta Cabeçalhos do CSV
    let headers = ['Matrícula', 'Posto/Graduação', 'Nome Completo', 'Lotação', 'Celular', 'Status Resposta', 'Data Resposta'];

    if (campanha.tipo === 'FORMULARIO_DINAMICO') {
      formCampos.forEach((c) => {
        headers.push(`"${c.pergunta.replace(/"/g, '""')}"`);
      });
    } else if (campanha.tipo === 'ASSINATURA_DOCUMENTO') {
      headers.push('Arquivo Devolvido URL', 'Arquivo Devolvido Nome', 'Termo Ciência');
    } else if (campanha.tipo === 'PLANO_FERIAS') {
      headers.push('Opção 1', 'Opção 2', 'Opção 3');
    } else {
      headers.push('Detalhes');
    }

    // Linhas
    const rows = militares.map((m) => {
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

      const row = [
        `"${m.militar_matricula || ''}"`,
        `"${m.militar_posto || ''}"`,
        `"${m.militar_nome || ''}"`,
        `"${m.militar_lotacao || ''}"`,
        `"${m.militar_celular || ''}"`,
        `"${m.status_resposta || 'Pendente'}"`,
        `"${m.data_resposta || ''}"`,
      ];

      if (campanha.tipo === 'FORMULARIO_DINAMICO') {
        formCampos.forEach((c) => {
          if (c.tipo === 'upload_arquivo') {
            const anexo = arquivosObj[c.id];
            row.push(`"${anexo?.url || ''}"`);
          } else {
            const val = respostasObj[c.id];
            const strVal = Array.isArray(val) ? val.join(', ') : (val !== undefined && val !== null ? String(val) : '');
            row.push(`"${strVal.replace(/"/g, '""')}"`);
          }
        });
      } else if (campanha.tipo === 'ASSINATURA_DOCUMENTO') {
        row.push(
          `"${resp.arquivo_devolucao_url || ''}"`,
          `"${resp.arquivo_devolucao_nome || ''}"`,
          `"${resp.termo_aceite ? 'Sim' : 'Não'}"`
        );
      } else if (campanha.tipo === 'PLANO_FERIAS') {
        row.push(`"${m.detalhes_resposta || ''}"`, '""', '""');
      } else {
        row.push(`"${m.detalhes_resposta || ''}"`);
      }

      return row.join(';');
    });

    const csvContent = '\uFEFF' + headers.join(';') + '\n' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `retorno_${campanha.titulo.toLowerCase().replace(/[^a-z0-9]/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
  }, [campanhas, searchTerm, mostrarArquivadas]);

  const totalItems = campanhasFiltradas.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const validCurrentPage = Math.min(currentPage, totalPages);

  const currentItems = useMemo(() => {
    const start = (validCurrentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return campanhasFiltradas.slice(start, end);
  }, [campanhasFiltradas, validCurrentPage, itemsPerPage]);

  const handlePrevPage = () => setCurrentPage((p) => Math.max(1, p - 1));
  const handleNextPage = () => setCurrentPage((p) => Math.min(totalPages, p + 1));

  const unidadesFiltradas = unidadesList.filter((u) => {
    if (!buscaUnidade.trim()) return true;
    return (u.nome || u.id || '').toLowerCase().includes(buscaUnidade.toLowerCase().trim());
  });

  const militaresFiltrados = (detalhesRetorno.dados?.militares || []).filter((m) => {
    if (detalhesRetorno.filtro === 'TODOS') return true;
    return m.status_resposta === detalhesRetorno.filtro;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-[#1e3a5f] rounded-full animate-spin"></div>
        <p className="text-sm text-slate-500 font-medium">Carregando painel de campanhas...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* CABEÇALHO PRINCIPAL COM BOTÕES DE AÇÃO */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 shadow-inner">
              <Megaphone className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-[#1e3a5f] tracking-tight">
                Gestor de Campanhas & Formulários do Portal
              </h1>
              <p className="text-xs text-slate-500">
                Lance planos de férias, atualizações cadastrais, devolução de documentos e formulários dinâmicos com adesão nominal em tempo real
              </p>
            </div>
          </div>

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
              Nova Assinatura de Documento
            </Button>

            <Button
              type="button"
              onClick={() => abrirCriacaoCampanha('FORMULARIO_DINAMICO')}
              className="bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-semibold shadow-xs h-9 px-3"
            >
              <Layers className="w-3.5 h-3.5 mr-1" />
              Novo Formulário Dinâmico
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
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
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
                  className="pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[#1e3a5f] shadow-sm w-full sm:w-64 transition-all"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={carregarDados}
                className="h-9 rounded-md px-3 border-slate-300"
                title="Atualizar"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            <div className="flex items-center gap-4 text-slate-600">
              <span className="font-medium">{totalItems} resultados</span>
              <div className="h-4 w-px bg-slate-300"></div>
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

          {/* CORPO DA TABELA */}
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
                              onClick={() => handleAbrirRetorno(camp)}
                              disabled={actionLoading}
                              className="p-1.5 text-[#1e3a5f] hover:bg-blue-50 rounded transition-colors"
                              title="Acompanhamento Nominal"
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

          {/* PAGINAÇÃO */}
          <div className="p-4 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between text-sm gap-4">
            <span className="text-slate-500">
              Mostrando {totalItems === 0 ? 0 : (validCurrentPage - 1) * itemsPerPage + 1} a {Math.min(validCurrentPage * itemsPerPage, totalItems)} de {totalItems} registros
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={handlePrevPage}
                disabled={validCurrentPage === 1}
                className={`px-3 py-1 border rounded font-medium transition-colors ${
                  validCurrentPage === 1
                    ? 'border-slate-200 text-slate-400 cursor-not-allowed bg-slate-50'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50 bg-white'
                }`}
              >
                Anterior
              </button>

              {Array.from({ length: totalPages }).map((_, idx) => {
                const page = idx + 1;
                const isCurrent = page === validCurrentPage;
                if (totalPages > 5) {
                  if (page !== 1 && page !== totalPages && Math.abs(page - validCurrentPage) > 1) {
                    if (page === 2 || page === totalPages - 1) return <span key={page} className="px-2 py-1">...</span>;
                    return null;
                  }
                }

                return (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1 border rounded transition-colors font-medium ${
                      isCurrent
                        ? 'border-[#1e3a5f] bg-blue-50 text-[#1e3a5f]'
                        : 'border-slate-300 text-slate-600 bg-white hover:bg-slate-50'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={handleNextPage}
                disabled={validCurrentPage === totalPages || totalPages === 0}
                className={`px-3 py-1 border rounded font-medium transition-colors ${
                  validCurrentPage === totalPages || totalPages === 0
                    ? 'border-slate-200 text-slate-400 cursor-not-allowed bg-slate-50'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50 bg-white'
                }`}
              >
                Próximo
              </button>
            </div>
          </div>
        </div>

        {/* MODAL: NOVA / EDITAR CAMPANHA COM FORM BUILDER */}
        {modalNovaCampanha.open && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full p-5 sm:p-7 space-y-5 text-xs animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-slate-800 text-base flex items-center">
                  <Megaphone className="w-5 h-5 mr-2 text-[#1e3a5f]" />
                  {modalNovaCampanha.isEditing
                    ? `Editar: ${modalNovaCampanha.titulo}`
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
                {/* TIPO DE CAMPANHA & TÍTULO */}
                <div className={`grid grid-cols-1 ${modalNovaCampanha.isEditing ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-3`}>
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

                  <div className={`${modalNovaCampanha.isEditing ? 'sm:col-span-2' : 'sm:col-span-2'} space-y-1`}>
                    <label className="font-bold text-slate-700 block">Título da Campanha *</label>
                    <Input
                      type="text"
                      value={modalNovaCampanha.titulo}
                      onChange={(e) => setModalNovaCampanha({ ...modalNovaCampanha, titulo: e.target.value })}
                      required
                      placeholder="Ex: Declaração de Acúmulo de Cargos 2026"
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
                    <div className="pt-2 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Input
                          type="text"
                          placeholder="Buscar unidade..."
                          value={buscaUnidade}
                          onChange={(e) => setBuscaUnidade(e.target.value)}
                          className="h-8 text-xs max-w-xs"
                        />
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={handleSelecionarTodasUnidades}
                            className="text-[11px] font-bold text-blue-700 hover:underline"
                          >
                            Marcar Todas ({unidadesList.length})
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            type="button"
                            onClick={handleLimparSelecaoUnidades}
                            className="text-[11px] font-bold text-slate-500 hover:underline"
                          >
                            Limpar
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto p-2 bg-white rounded-xl border border-slate-200">
                        {unidadesFiltradas.map((u) => {
                          const checked = modalNovaCampanha.escopo_unidades_ids.includes(u.id);
                          return (
                            <label
                              key={u.id}
                              className={`p-1.5 rounded-lg border text-[11px] flex items-center space-x-1.5 cursor-pointer transition-colors ${
                                checked ? 'bg-blue-50 border-blue-200 text-[#1e3a5f] font-bold' : 'border-slate-100 hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => handleToggleUnidadeEscopo(u.id)}
                                className="accent-[#1e3a5f] rounded"
                              />
                              <span className="truncate">{u.nome}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* PRAZOS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Prazo Limite para o Militar</label>
                    <Input
                      type="date"
                      value={modalNovaCampanha.data_fim_militar}
                      onChange={(e) => setModalNovaCampanha({ ...modalNovaCampanha, data_fim_militar: e.target.value })}
                      required
                      className="h-10 text-xs rounded-xl"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Prazo Limite para a Unidade</label>
                    <Input
                      type="date"
                      value={modalNovaCampanha.data_fim_unidade}
                      onChange={(e) => setModalNovaCampanha({ ...modalNovaCampanha, data_fim_unidade: e.target.value })}
                      required
                      className="h-10 text-xs rounded-xl"
                    />
                  </div>
                </div>

                {/* INSTRUÇÕES */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Instruções aos Militares</label>
                  <textarea
                    rows={3}
                    value={modalNovaCampanha.instrucoes}
                    onChange={(e) => setModalNovaCampanha({ ...modalNovaCampanha, instrucoes: e.target.value })}
                    required
                    className="w-full p-3 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                  />
                </div>

                {/* CONFIGURAÇÃO ESPECÍFICA DE ASSINATURA DE DOCUMENTO */}
                {modalNovaCampanha.tipo === 'ASSINATURA_DOCUMENTO' && (
                  <div className="space-y-3 p-4 bg-amber-50/70 rounded-2xl border border-amber-200">
                    <label className="font-bold text-amber-950 block flex items-center">
                      <FileSignature className="w-4 h-4 mr-1.5 text-amber-700" />
                      Configurações do Documento & Devolução Assinada
                    </label>

                    {/* UPLOAD DE MODELO PELO GESTOR */}
                    <div className="space-y-1.5">
                      <span className="font-semibold text-slate-700 block text-[11px]">
                        Arquivo Modelo Oficial (Disponibilizado para os militares baixarem):
                      </span>
                      {modalNovaCampanha.arquivo_modelo_url ? (
                        <div className="p-2.5 bg-white border border-amber-300 rounded-xl flex items-center justify-between">
                          <span className="font-bold text-slate-800 truncate max-w-sm">
                            {modalNovaCampanha.arquivo_modelo_nome || 'Arquivo modelo anexado'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setModalNovaCampanha({ ...modalNovaCampanha, arquivo_modelo_url: '', arquivo_modelo_nome: '' })}
                            className="text-red-500 hover:text-red-700 text-xs font-bold"
                          >
                            Remover
                          </button>
                        </div>
                      ) : (
                        <div className="border border-dashed border-amber-300 rounded-xl p-3 text-center bg-white">
                          <input
                            type="file"
                            onChange={(e) => handleUploadModeloGestor(e.target.files?.[0])}
                            className="text-xs"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">Anexe o modelo em PDF ou DOCX para os militares baixarem no portal</p>
                        </div>
                      )}
                    </div>

                    <label className="flex items-center space-x-2 cursor-pointer p-2 bg-white rounded-xl border border-amber-200">
                      <input
                        type="checkbox"
                        checked={modalNovaCampanha.exigir_devolucao_arquivo}
                        onChange={(e) => setModalNovaCampanha({ ...modalNovaCampanha, exigir_devolucao_arquivo: e.target.checked })}
                        className="w-4 h-4 accent-amber-600 rounded"
                      />
                      <span className="font-semibold text-slate-800 text-xs">
                        Exigir que o militar anexe o documento assinado para concluir o envio
                      </span>
                    </label>

                    <div className="space-y-1">
                      <span className="font-semibold text-slate-700 block text-[11px]">
                        Texto do Termo de Declaração / Ciência do Militar:
                      </span>
                      <Input
                        type="text"
                        value={modalNovaCampanha.texto_termo_aceite}
                        onChange={(e) => setModalNovaCampanha({ ...modalNovaCampanha, texto_termo_aceite: e.target.value })}
                        placeholder="Ex: Declaro sob as penas da lei a exatidão das informações..."
                        className="text-xs rounded-xl bg-white"
                      />
                    </div>
                  </div>
                )}

                {/* VISUAL FORM BUILDER (PARA FORMULARIO_DINAMICO - GOOGLE FORMS STYLE) */}
                {modalNovaCampanha.tipo === 'FORMULARIO_DINAMICO' && (
                  <div className="space-y-4 p-4 bg-purple-50/60 rounded-2xl border border-purple-200">
                    <div className="flex items-center justify-between border-b border-purple-200 pb-2">
                      <div>
                        <label className="font-extrabold text-purple-950 block flex items-center text-sm">
                          <Layers className="w-4 h-4 mr-1.5 text-purple-700" />
                          Construtor de Formulário ({modalNovaCampanha.campos_formulario.length} perguntas)
                        </label>
                        <p className="text-[11px] text-purple-800">
                          Adicione perguntas, seleções, caixas de texto e uploads de arquivos
                        </p>
                      </div>

                      {/* MENU RÁPIDO DE ADIÇÃO DE CAMPOS */}
                      <div className="flex items-center space-x-1.5">
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              handleAdicionarPergunta(e.target.value);
                              e.target.value = '';
                            }
                          }}
                          className="h-8 px-2.5 bg-purple-700 text-white rounded-lg text-xs font-bold outline-none cursor-pointer"
                        >
                          <option value="">+ Adicionar Pergunta...</option>
                          {TIPOS_CAMPOS_FORMULARIO.map((t) => (
                            <option key={t.tipo} value={t.tipo}>
                              {t.icone} {t.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* LISTA DE PERGUNTAS */}
                    {modalNovaCampanha.campos_formulario.length === 0 ? (
                      <div className="p-6 text-center bg-white rounded-xl border border-purple-200 text-slate-500">
                        Nenhuma pergunta adicionada. Use o menu acima para adicionar a primeira pergunta.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {modalNovaCampanha.campos_formulario.map((campo, cIdx) => (
                          <div key={campo.id || cIdx} className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3">
                            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                              <div className="flex items-center space-x-2">
                                <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-900 font-bold flex items-center justify-center text-xs">
                                  {cIdx + 1}
                                </span>
                                <span className="font-bold text-slate-800">
                                  {TIPOS_CAMPOS_FORMULARIO.find((t) => t.tipo === campo.tipo)?.icone}{' '}
                                  {TIPOS_CAMPOS_FORMULARIO.find((t) => t.tipo === campo.tipo)?.label}
                                </span>
                              </div>

                              <div className="flex items-center space-x-1">
                                <button
                                  type="button"
                                  onClick={() => handleMoverPergunta(cIdx, -1)}
                                  disabled={cIdx === 0}
                                  className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                                  title="Mover para cima"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoverPergunta(cIdx, 1)}
                                  disabled={cIdx === modalNovaCampanha.campos_formulario.length - 1}
                                  className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                                  title="Mover para baixo"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoverPergunta(cIdx)}
                                  className="p-1 text-red-500 hover:text-red-700 ml-1"
                                  title="Excluir pergunta"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* TÍTULO E AJUDA */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div className="sm:col-span-2 space-y-1">
                                <label className="text-[11px] font-bold text-slate-700 block">Título da Pergunta *</label>
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

                            {/* CONFIGURAÇÃO DE OPÇÕES PARA ESCOLHAS (RÁDIO / CHECKBOX / SELECT) */}
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

                            {/* ANEXO DE MODELO ESPECÍFICO DESTA PERGUNTA (UPLOAD DE ARQUIVO) */}
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

        {/* MODAL / DRAWER DE ACOMPANHAMENTO NOMINAL & EXPORTAÇÃO */}
        {detalhesRetorno.open && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full p-5 sm:p-7 space-y-4 text-xs animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base flex items-center">
                    <Users className="w-5 h-5 mr-2 text-[#1e3a5f]" />
                    Retorno Nominal: {detalhesRetorno.campanha?.titulo}
                  </h3>
                  <p className="text-slate-500 text-[11px]">
                    Acompanhamento individual de cada militar atribuído ao escopo desta campanha
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDetalhesRetorno({ ...detalhesRetorno, open: false })}
                  className="text-slate-400 hover:text-slate-600 font-bold text-base"
                >
                  ✕
                </button>
              </div>

              {/* STATS RÁPIDOS & BOTÃO EXPORTAR */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 shrink-0">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <span className="text-slate-500 block text-[11px]">Total Alvo</span>
                  <strong className="text-lg text-slate-900">{detalhesRetorno.dados?.total_alvo || 0}</strong>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
                  <span className="text-emerald-700 block text-[11px]">Respondidos</span>
                  <strong className="text-lg text-emerald-800">{detalhesRetorno.dados?.total_respondidos || 0} ({detalhesRetorno.dados?.percentual || 0}%)</strong>
                </div>
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-center">
                  <span className="text-amber-700 block text-[11px]">Pendentes</span>
                  <strong className="text-lg text-amber-800">{detalhesRetorno.dados?.total_pendentes || 0}</strong>
                </div>
                <div className="flex items-center justify-center p-2 bg-blue-50/60 rounded-xl border border-blue-200">
                  <Button
                    type="button"
                    onClick={handleExportarPlanilha}
                    className="w-full bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold h-full rounded-lg shadow-xs"
                  >
                    <FileSpreadsheet className="w-4 h-4 mr-1.5" />
                    Exportar Planilha (CSV)
                  </Button>
                </div>
              </div>

              {/* FILTRO DE STATUS */}
              <div className="flex items-center space-x-2 shrink-0">
                <span className="font-bold text-slate-700">Filtrar:</span>
                {['TODOS', 'Respondido', 'Pendente'].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setDetalhesRetorno({ ...detalhesRetorno, filtro: f })}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      detalhesRetorno.filtro === f
                        ? 'bg-[#1e3a5f] text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {f === 'TODOS' ? 'Todos' : f}
                  </button>
                ))}
              </div>

              {/* TABELA DE MILITARES */}
              <div className="flex-1 overflow-y-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-bold sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="p-3">Militar</th>
                      <th className="p-3">Lotação</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Data / Detalhes</th>
                      <th className="p-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {militaresFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="p-6 text-center text-slate-400">
                          Nenhum militar correspondente ao filtro.
                        </td>
                      </tr>
                    ) : (
                      militaresFiltrados.map((m) => {
                        const hasRespObj = Boolean(m.resposta_completa);

                        return (
                          <tr key={m.militar_id} className="hover:bg-slate-50">
                            <td className="p-3">
                              <span className="font-bold text-slate-900 block">{m.militar_posto} {m.militar_nome}</span>
                              <span className="text-[10px] text-slate-400 font-mono">Mat: {m.militar_matricula}</span>
                            </td>
                            <td className="p-3 text-slate-600">{m.militar_lotacao}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                m.status_resposta === 'Respondido'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}>
                                {m.status_resposta}
                              </span>
                            </td>
                            <td className="p-3 text-slate-600">
                              {m.data_resposta ? (
                                <div>
                                  <span className="font-medium">{m.data_resposta.split('T')[0]}</span>
                                  {m.detalhes_resposta && (
                                    <p className="text-[11px] text-slate-500 italic mt-0.5 truncate max-w-xs">
                                      {m.detalhes_resposta}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">Pendente de resposta</span>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              {hasRespObj && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setModalRespostaMilitar({
                                    open: true,
                                    militar: m,
                                    resposta: m.resposta_completa,
                                    observacaoRH: m.resposta_completa?.observacao_gestor || '',
                                  })}
                                  className="text-[11px] h-7 px-2.5 rounded-lg border-blue-200 text-blue-700 hover:bg-blue-50"
                                >
                                  <Eye className="w-3 h-3 mr-1" />
                                  Ver Respostas
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDetalhesRetorno({ ...detalhesRetorno, open: false })}
                  className="text-xs h-9 rounded-xl"
                >
                  Fechar
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DE RESPOSTA INDIVIDUAL DO MILITAR */}
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
                  if (detalhesRetorno.campanha?.config_formulario) {
                    try {
                      const p = typeof detalhesRetorno.campanha.config_formulario === 'string' ? JSON.parse(detalhesRetorno.campanha.config_formulario) : detalhesRetorno.campanha.config_formulario;
                      formCampos = p?.campos || [];
                    } catch (_e) {}
                  }

                  let respostasObj = {};
                  let arquivosObj = {};
                  if (modalRespostaMilitar.resposta?.respostas_json) {
                    try {
                      respostasObj = typeof modalRespostaMilitar.resposta.respostas_json === 'string' ? JSON.parse(modalRespostaMilitar.resposta.respostas_json) : modalRespostaMilitar.resposta.respostas_json;
                    } catch (_e) {}
                  }
                  if (modalRespostaMilitar.resposta?.arquivos_anexados_json) {
                    try {
                      arquivosObj = typeof modalRespostaMilitar.resposta.arquivos_anexados_json === 'string' ? JSON.parse(modalRespostaMilitar.resposta.arquivos_anexados_json) : modalRespostaMilitar.resposta.arquivos_anexados_json;
                    } catch (_e) {}
                  }

                  if (formCampos.length === 0) return null;

                  return (
                    <div className="space-y-3">
                      <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Perguntas Respondidas:</h4>
                      {formCampos.map((c, i) => {
                        const val = respostasObj[c.id];
                        const anexo = arquivosObj[c.id];

                        return (
                          <div key={c.id || i} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                            <span className="font-bold text-slate-700 block">
                              {i + 1}. {c.pergunta}
                            </span>
                            {c.tipo === 'upload_arquivo' ? (
                              anexo?.url ? (
                                <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200 mt-1">
                                  <span className="font-semibold text-slate-800 truncate">{anexo.nome || 'Arquivo anexado'}</span>
                                  <a
                                    href={anexo.url}
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
                        await handleAbrirRetorno(detalhesRetorno.campanha);
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
      </div>
    </div>
  );
}
