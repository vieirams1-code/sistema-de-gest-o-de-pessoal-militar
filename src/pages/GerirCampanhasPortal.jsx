import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { fetchScopedLotacoes } from '@/services/getScopedLotacoesClient';
import {
  Megaphone,
  Plus,
  Calendar,
  UserCheck,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Bell,
  ChevronRight,
  Shield,
  Eye,
  Filter,
  Check,
  X,
  Building,
  Search,
  Edit,
  Trash2,
  Archive,
  Ban,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

export default function GerirCampanhasPortal() {
  const [campanhas, setCampanhas] = useState([]);
  const [unidadesList, setUnidadesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', msg: '' });

  // Busca interna no modal de unidades
  
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
    tipo: 'PLANO_FERIAS', // 'PLANO_FERIAS' | 'ATUALIZACAO_CADASTRAL'
    titulo: 'Plano Anual de Férias 2027',
    ano_referencia: new Date().getFullYear() + 1,
    tipo_escopo: 'TODOS', // 'TODOS' | 'UNIDADES' | 'QUADROS'
    escopo_unidades_ids: [],
    escopo_quadros: [],
    data_inicio: new Date().toISOString().split('T')[0],
    data_fim_militar: `${new Date().getFullYear()}-10-31`,
    data_fim_unidade: `${new Date().getFullYear()}-11-30`,
    instrucoes: 'Prezados militares, registrem suas 3 opções de meses para o plano de férias.',
  });

  // Modal / Drawer de Retorno e Acompanhamento Nominal
  const [detalhesRetorno, setDetalhesRetorno] = useState({
    open: false,
    campanha: null,
    dados: null,
    filtro: 'TODOS', // 'TODOS' | 'Pendente' | 'Respondido'
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
      });
    } else {
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
        instrucoes: 'Conferência cadastral obrigatória de dados pessoais, contatos, endereço e dependentes.',
      });
    }
  };

  const abrirEdicaoCampanha = (camp) => {
    setBuscaUnidade('');
    setModalNovaCampanha({
      open: true,
      isEditing: true,
      editId: camp.id,
      tipo: camp.tipo || 'PLANO_FERIAS',
      titulo: camp.titulo || '',
      ano_referencia: camp.ano_referencia || (new Date().getFullYear() + 1),
      tipo_escopo: camp.tipo_escopo || 'TODOS',
      escopo_unidades_ids: camp.escopo_unidades_ids || [],
      escopo_quadros: camp.escopo_quadros || [],
      data_inicio: camp.data_inicio || new Date().toISOString().split('T')[0],
      data_fim_militar: camp.data_fim_militar || '',
      data_fim_unidade: camp.data_fim_unidade || '',
      instrucoes: camp.instrucoes || '',
    });
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

    setActionLoading(true);
    setFeedback({ type: '', msg: '' });

    let unidadesNomes = 'Toda a Corporação';
    if (modalNovaCampanha.tipo_escopo === 'UNIDADES' && modalNovaCampanha.escopo_unidades_ids.length > 0) {
      const nomes = unidadesList
        .filter((u) => modalNovaCampanha.escopo_unidades_ids.includes(u.id))
        .map((u) => u.nome || u.sigla || u.id);
      unidadesNomes = nomes.slice(0, 3).join(', ') + (nomes.length > 3 ? ` (+${nomes.length - 3} unidades)` : '');
    }

    try {
      if (modalNovaCampanha.isEditing) {
        await base44.functions.invoke('portal_servicos', {
          acao: 'CAMPANHA_EDITAR',
          campanha_id: modalNovaCampanha.editId,
          campanha_payload: {
            ...modalNovaCampanha,
            escopo_unidades_nomes: unidadesNomes,
          },
        });
        setFeedback({ type: 'success', msg: `Campanha "${modalNovaCampanha.titulo}" atualizada com sucesso!` });
      } else {
        const res = await base44.functions.invoke('portal_servicos', {
          acao: 'CAMPANHA_CRIAR',
          campanha_payload: {
            ...modalNovaCampanha,
            escopo_unidades_nomes: unidadesNomes,
          },
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

  const handleEncerrarCampanha = async (campId) => {
    if (!window.confirm('Deseja realmente encerrar esta campanha? Ela não receberá mais respostas dos militares.')) return;
    setActionLoading(true);
    try {
      await base44.functions.invoke('portal_servicos', {
        acao: 'CAMPANHA_ENCERRAR',
        campanha_id: campId,
      });
      setFeedback({ type: 'success', msg: 'Campanha encerrada com sucesso.' });
      await carregarDados();
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Falha ao encerrar campanha.' });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-[#1e3a5f] rounded-full animate-spin"></div>
        <p className="text-sm text-slate-500 font-medium">Carregando painel de campanhas...</p>
      </div>
    );
  }

  
  const campanhasFiltradas = useMemo(() => {
    return campanhas.filter(camp => {
      // Filtro de Arquivadas
      if (!mostrarArquivadas && camp.status === 'Arquivada') {
        return false;
      }
      
      // Filtro de Texto (Busca)
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

  const handlePrevPage = () => setCurrentPage(p => Math.max(1, p - 1));
  const handleNextPage = () => setCurrentPage(p => Math.min(totalPages, p + 1));

  const unidadesFiltradas = unidadesList.filter((u) => {
    if (!buscaUnidade.trim()) return true;
    return (u.nome || u.id || '').toLowerCase().includes(buscaUnidade.toLowerCase().trim());
  });

  const militaresFiltrados = (detalhesRetorno.dados?.militares || []).filter((m) => {
    if (detalhesRetorno.filtro === 'TODOS') return true;
    return m.status_resposta === detalhesRetorno.filtro;
  });

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
                Gestor de Campanhas do Portal
              </h1>
              <p className="text-xs text-slate-500">
                Inicie novos planos de férias ou recadastramentos, edite prazos e acompanhe a adesão em tempo real
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              type="button"
              onClick={() => abrirCriacaoCampanha('PLANO_FERIAS')}
              className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-md h-10 px-4"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Novo Plano de Férias
            </Button>

            <Button
              type="button"
              onClick={() => abrirCriacaoCampanha('ATUALIZACAO_CADASTRAL')}
              className="bg-[#1e3a5f] hover:bg-[#2a4d7d] text-white rounded-xl text-xs font-semibold shadow-md h-10 px-4"
            >
              <UserCheck className="w-4 h-4 mr-1.5" />
              Nova Atualização Cadastral
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
                  placeholder="Filtrar tabela..." 
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
                  <th className="p-4 font-semibold w-10 text-center">
                    <input type="checkbox" className="rounded text-[#1e3a5f]" />
                  </th>
                  <th className="p-4 font-semibold cursor-pointer hover:bg-slate-200 transition-colors group min-w-[200px]">
                    Nome da Campanha
                  </th>
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
                    const isEncerrada = camp.status === 'Encerrada';
                    const isArquivada = camp.status === 'Arquivada';

                    let statusStyles = { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500 animate-pulse', label: 'Ativa' };
                    if (isArquivada) statusStyles = { bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-300', label: 'Arquivada' };
                    else if (isEncerrada) statusStyles = { bg: 'bg-slate-100', text: 'text-slate-800', dot: 'bg-slate-500', label: 'Encerrada' };
                    else if (camp.status === 'Aberta_Coleta') statusStyles = { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500 animate-pulse', label: 'Aberta' };

                    return (
                      <tr key={camp.id} className="hover:bg-blue-50/50 transition-colors bg-white">
                        <td className="p-4 text-center">
                          <input type="checkbox" className="rounded text-[#1e3a5f] focus:ring-[#1e3a5f] border-slate-300" />
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                              isFerias ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                            }`}>
                              {isFerias ? <Calendar className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                            </div>
                            <div>
                              <p className="font-bold text-slate-800">{camp.titulo}</p>
                              <p className="text-xs text-slate-500 truncate max-w-[200px]" title={camp.instrucoes}>{camp.instrucoes}</p>
                            </div>
                          </div>
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
                            {camp.status === 'Aberta_Coleta' && (
                              <button 
                                onClick={() => handleDispararLembretes(camp.id)}
                                disabled={actionLoading}
                                className="p-1.5 text-amber-600 hover:bg-amber-50 rounded transition-colors" 
                                title="Lembretes"
                              >
                                <Bell className="w-4 h-4" />
                              </button>
                            )}
                            <button 
                              onClick={() => handleAbrirRetorno(camp)}
                              disabled={actionLoading}
                              className="p-1.5 text-[#1e3a5f] hover:bg-blue-50 rounded transition-colors" 
                              title="Ver Retorno"
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
                            
                            {!isArquivada && (
                              <div className="w-px h-4 bg-slate-300 mx-1"></div>
                            )}

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
              Mostrando {totalItems === 0 ? 0 : ((validCurrentPage - 1) * itemsPerPage) + 1} a {Math.min(validCurrentPage * itemsPerPage, totalItems)} de {totalItems} registros
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
                // Simple pagination display: max 5 pages
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

        {/* MODAL: NOVA / EDITAR CAMPANHA */}
        {modalNovaCampanha.open && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-5 sm:p-7 space-y-5 text-xs animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-slate-800 text-base flex items-center">
                  <Megaphone className="w-5 h-5 mr-2 text-[#1e3a5f]" />
                  {modalNovaCampanha.isEditing
                    ? 'Editar Campanha'
                    : modalNovaCampanha.tipo === 'PLANO_FERIAS'
                    ? 'Novo Plano Anual de Férias'
                    : 'Nova Campanha de Atualização Cadastral'}
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
                {/* Título & Ano */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="font-bold text-slate-700 block">Título da Campanha</label>
                    <Input
                      type="text"
                      value={modalNovaCampanha.titulo}
                      onChange={(e) => setModalNovaCampanha({ ...modalNovaCampanha, titulo: e.target.value })}
                      required
                      className="h-10 text-xs rounded-xl"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Ano de Referência</label>
                    <Input
                      type="number"
                      value={modalNovaCampanha.ano_referencia}
                      onChange={(e) => setModalNovaCampanha({ ...modalNovaCampanha, ano_referencia: Number(e.target.value) })}
                      required
                      className="h-10 text-xs rounded-xl font-bold text-[#1e3a5f]"
                    />
                  </div>
                </div>

                {/* SELEÇÃO DE ESCOPO / PÚBLICO-ALVO */}
                <div className="space-y-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800 block flex items-center">
                      <Building className="w-4 h-4 mr-1.5 text-blue-600" />
                      Público-Alvo / Escopo de Atribuição
                    </label>
                    {modalNovaCampanha.tipo_escopo === 'UNIDADES' && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                        {modalNovaCampanha.escopo_unidades_ids.length} selecionada(s)
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'TODOS', label: 'Toda a Corporação (Geral)' },
                      { id: 'UNIDADES', label: 'Unidades / Lotações Específicas' },
                    ].map((esc) => (
                      <button
                        key={esc.id}
                        type="button"
                        onClick={() => setModalNovaCampanha({ ...modalNovaCampanha, tipo_escopo: esc.id })}
                        className={`p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                          modalNovaCampanha.tipo_escopo === esc.id
                            ? 'border-[#1e3a5f] bg-blue-50 text-[#1e3a5f] ring-1 ring-[#1e3a5f]'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {esc.label}
                      </button>
                    ))}
                  </div>

                  {modalNovaCampanha.tipo_escopo === 'UNIDADES' && (
                    <div className="space-y-2 pt-2 border-t border-slate-200">
                      <div className="flex items-center justify-between gap-2">
                        <div className="relative flex-1">
                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                          <Input
                            type="text"
                            placeholder="Pesquisar unidade..."
                            value={buscaUnidade}
                            onChange={(e) => setBuscaUnidade(e.target.value)}
                            className="h-8 pl-8 text-xs rounded-lg bg-white"
                          />
                        </div>
                        <div className="flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={handleSelecionarTodasUnidades}
                            className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-[10px] font-bold text-slate-700"
                          >
                            Todas
                          </button>
                          <button
                            type="button"
                            onClick={handleLimparSelecaoUnidades}
                            className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-[10px] font-bold text-slate-500"
                          >
                            Limpar
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto p-1.5 bg-white rounded-xl border border-slate-200">
                        {unidadesFiltradas.length === 0 ? (
                          <div className="col-span-2 p-3 text-center text-slate-400 text-[11px]">
                            Nenhuma unidade encontrada para "{buscaUnidade}".
                          </div>
                        ) : (
                          unidadesFiltradas.map((u) => {
                            const checked = modalNovaCampanha.escopo_unidades_ids.includes(u.id);
                            return (
                              <label
                                key={u.id}
                                className={`p-2 rounded-lg border text-[11px] flex items-center space-x-2 cursor-pointer transition-colors ${
                                  checked ? 'bg-blue-50/80 border-blue-200 text-[#1e3a5f] font-bold' : 'border-slate-100 hover:bg-slate-50 text-slate-700'
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
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* PRAZOS DE VIGÊNCIA */}
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

        {/* MODAL / DRAWER DE ACOMPANHAMENTO NOMINAL */}
        {detalhesRetorno.open && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full p-5 sm:p-7 space-y-4 text-xs animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
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

              {/* STATS RÁPIDOS */}
              <div className="grid grid-cols-3 gap-3 shrink-0">
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
                      <th className="p-3">Data Envio / Detalhes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {militaresFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="p-6 text-center text-slate-400">
                          Nenhum militar correspondente ao filtro.
                        </td>
                      </tr>
                    ) : (
                      militaresFiltrados.map((m) => (
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
                        </tr>
                      ))
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
      </div>
    </div>
  );
}
