import React, { useState, useEffect } from 'react';
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
  const [buscaUnidade, setBuscaUnidade] = useState('');

  // Modal de Criação de Campanha
  const [modalNovaCampanha, setModalNovaCampanha] = useState({
    open: false,
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
      // 1. Carrega campanhas do portal
      const res = await base44.functions.invoke('portal_servicos', { acao: 'CAMPANHA_LISTAR' });
      setCampanhas(res.data?.campanhas || []);

      // 2. Carrega lista de unidades/estruturas/lotações
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

      // Fallback robusto: busca militares e extrai todas as lotações distintas reais cadastradas
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

    // Monta nomes resumidos das unidades
    let unidadesNomes = 'Toda a Corporação';
    if (modalNovaCampanha.tipo_escopo === 'UNIDADES' && modalNovaCampanha.escopo_unidades_ids.length > 0) {
      const nomes = unidadesList
        .filter((u) => modalNovaCampanha.escopo_unidades_ids.includes(u.id))
        .map((u) => u.nome || u.sigla || u.id);
      unidadesNomes = nomes.slice(0, 3).join(', ') + (nomes.length > 3 ? ` (+${nomes.length - 3} unidades)` : '');
    }

    try {
      const res = await base44.functions.invoke('portal_servicos', {
        acao: 'CAMPANHA_CRIAR',
        campanha_payload: {
          ...modalNovaCampanha,
          escopo_unidades_nomes: unidadesNomes,
        },
      });

      setFeedback({ type: 'success', msg: `Campanha "${res.data?.campanha?.titulo}" lançada com sucesso no Portal!` });
      setModalNovaCampanha({ ...modalNovaCampanha, open: false });
      await carregarDados();
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Falha ao criar campanha.' });
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
                Inicie novos planos de férias ou recadastramentos por público-alvo e acompanhe a adesão em tempo real
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
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800 flex items-center">
              <Clock className="w-4 h-4 mr-2 text-[#1e3a5f]" />
              Campanhas em Andamento & Histórico
            </h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={carregarDados}
              className="text-xs h-8 rounded-lg"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              Atualizar
            </Button>
          </div>

          {campanhas.length === 0 ? (
            <Card className="border-slate-200">
              <CardContent className="p-12 text-center text-xs text-slate-500 space-y-3">
                <Megaphone className="w-10 h-10 mx-auto text-slate-300" />
                <p className="font-semibold text-slate-700">Nenhuma campanha cadastrada até o momento.</p>
                <p>Clique em <strong>"Novo Plano de Férias"</strong> ou <strong>"Nova Atualização Cadastral"</strong> para iniciar.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {campanhas.map((camp) => {
                const totalAlvo = camp.total_publico_alvo || 0;
                const respondidos = camp.total_respondidos || 0;
                const percent = totalAlvo > 0 ? Math.round((respondidos / totalAlvo) * 100) : 0;
                const isFerias = camp.tipo === 'PLANO_FERIAS';

                return (
                  <Card key={camp.id} className="border-slate-200 shadow-sm bg-white hover:shadow-md transition-shadow">
                    <CardHeader className="p-4 sm:p-5 pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          isFerias ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                        }`}>
                          {isFerias ? <Calendar className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <CardTitle className="text-sm sm:text-base font-bold text-slate-900">
                              {camp.titulo}
                            </CardTitle>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              camp.status === 'Aberta_Coleta'
                                ? 'bg-emerald-100 text-emerald-800'
                                : camp.status === 'Encerrada'
                                ? 'bg-slate-100 text-slate-600'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {camp.status === 'Aberta_Coleta' ? 'Ativa • Coleta Aberta' : camp.status}
                            </span>
                          </div>
                          <CardDescription className="text-xs text-slate-500">
                            Público: <strong>{camp.escopo_unidades_nomes || 'Toda a Corporação'}</strong>
                          </CardDescription>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 self-end sm:self-center">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleAbrirRetorno(camp)}
                          disabled={actionLoading}
                          className="text-xs h-9 px-3 rounded-xl border-[#1e3a5f]/30 text-[#1e3a5f] hover:bg-blue-50 font-semibold"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1.5" />
                          Ver Retorno & Militares
                        </Button>

                        {camp.status === 'Aberta_Coleta' && (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleDispararLembretes(camp.id)}
                              disabled={actionLoading}
                              className="text-xs h-9 px-3 rounded-xl border-amber-300 text-amber-800 hover:bg-amber-50"
                            >
                              <Bell className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                              Lembrete aos Pendentes
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEncerrarCampanha(camp.id)}
                              disabled={actionLoading}
                              className="text-xs h-9 px-2 text-red-600 hover:bg-red-50 rounded-xl"
                            >
                              Encerrar
                            </Button>
                          </>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 sm:p-5 pt-3 text-xs space-y-3">
                      {/* BARRA DE PROGRESSO DE ADESÃO */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-slate-600">
                          <span>
                            Adesão do Público: <strong>{respondidos} de {totalAlvo} militares responderam</strong>
                          </span>
                          <strong className="text-[#1e3a5f] text-sm">{percent}%</strong>
                        </div>

                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                          <div
                            className={`h-2.5 rounded-full transition-all ${
                              percent >= 80 ? 'bg-emerald-600' : percent >= 40 ? 'bg-blue-600' : 'bg-amber-500'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>

                      {/* DATAS E INSTRUÇÕES */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-500 gap-2 border-t border-slate-100 pt-2">
                        <div>
                          <span>Início: <strong>{camp.data_inicio || '-'}</strong></span> |{' '}
                          <span>Prazo Militar: <strong className="text-emerald-800">{camp.data_fim_militar || 'Não definido'}</strong></span>
                        </div>
                        <span className="italic truncate max-w-md">"{camp.instrucoes}"</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* MODAL: NOVA CAMPANHA (FÉRIAS OU CADASTRAL) */}
        {modalNovaCampanha.open && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-5 sm:p-7 space-y-5 text-xs animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-slate-800 text-base flex items-center">
                  <Megaphone className="w-5 h-5 mr-2 text-[#1e3a5f]" />
                  {modalNovaCampanha.tipo === 'PLANO_FERIAS' ? 'Novo Plano Anual de Férias' : 'Nova Campanha de Atualização Cadastral'}
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

                  {/* Lista de Unidades com Barra de Busca e Ações Rápidas */}
                  {modalNovaCampanha.tipo_escopo === 'UNIDADES' && (
                    <div className="space-y-2 pt-2 border-t border-slate-200">
                      <div className="flex items-center justify-between gap-2">
                        <div className="relative flex-1">
                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                          <Input
                            type="text"
                            placeholder="Pesquisar unidade (ex: 1º GBM, ABM, DGP)..."
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

                {/* PRAZOS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Prazo Final para o Militar Responder</label>
                    <Input
                      type="date"
                      value={modalNovaCampanha.data_fim_militar}
                      onChange={(e) => setModalNovaCampanha({ ...modalNovaCampanha, data_fim_militar: e.target.value })}
                      required
                      className="h-10 text-xs rounded-xl"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Prazo para Homologação da Unidade</label>
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
                  <label className="font-bold text-slate-700 block">Instruções aos Militares (Aviso no Portal)</label>
                  <textarea
                    rows={2}
                    value={modalNovaCampanha.instrucoes}
                    onChange={(e) => setModalNovaCampanha({ ...modalNovaCampanha, instrucoes: e.target.value })}
                    required
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs outline-none focus:border-[#1e3a5f]"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setModalNovaCampanha({ ...modalNovaCampanha, open: false })}
                    className="text-xs h-9 px-4 rounded-xl"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={actionLoading}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold h-9 px-5 shadow-sm"
                  >
                    {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Megaphone className="w-3.5 h-3.5 mr-1.5" />}
                    Publicar e Iniciar Campanha
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL / DRAWER: DETALHES DE RETORNO & RELAÇÃO NOMINAL */}
        {detalhesRetorno.open && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full p-5 sm:p-7 space-y-5 text-xs animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base flex items-center">
                    <Eye className="w-5 h-5 mr-2 text-[#1e3a5f]" />
                    Retorno Nominal: {detalhesRetorno.campanha?.titulo}
                  </h3>
                  <p className="text-slate-500 text-[11px]">
                    Acompanhamento em tempo real dos militares convocados
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDetalhesRetorno({ open: false, campanha: null, dados: null, filtro: 'TODOS' })}
                  className="text-slate-400 hover:text-slate-600 font-bold text-base"
                >
                  ✕
                </button>
              </div>

              {/* STATS RÁPIDOS */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-center">
                  <span className="text-slate-500 block">Total do Público</span>
                  <strong className="text-base text-slate-900 font-extrabold">{detalhesRetorno.dados?.total_alvo || 0}</strong>
                </div>
                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-center">
                  <span className="text-emerald-700 block">Respondidos</span>
                  <strong className="text-base text-emerald-800 font-extrabold">{detalhesRetorno.dados?.total_respondidos || 0}</strong>
                </div>
                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-center">
                  <span className="text-amber-700 block">Pendentes</span>
                  <strong className="text-base text-amber-800 font-extrabold">{detalhesRetorno.dados?.total_pendentes || 0}</strong>
                </div>
              </div>

              {/* FILTROS E TABELA */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex space-x-2">
                    {['TODOS', 'Respondido', 'Pendente'].map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setDetalhesRetorno({ ...detalhesRetorno, filtro: f })}
                        className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                          detalhesRetorno.filtro === f
                            ? 'bg-[#1e3a5f] text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {f === 'TODOS' ? 'Todos' : f}
                      </button>
                    ))}
                  </div>

                  {detalhesRetorno.dados?.total_pendentes > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleDispararLembretes(detalhesRetorno.campanha?.id)}
                      className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs h-8 px-3 font-semibold"
                    >
                      <Bell className="w-3.5 h-3.5 mr-1" />
                      Notificar Pendentes
                    </Button>
                  )}
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {militaresFiltrados.length === 0 ? (
                    <div className="p-6 text-center text-slate-500">
                      Nenhum militar com status "{detalhesRetorno.filtro}".
                    </div>
                  ) : (
                    militaresFiltrados.map((m) => (
                      <div key={m.militar_id} className="p-3 flex items-center justify-between hover:bg-slate-50/80">
                        <div className="space-y-0.5">
                          <span className="font-bold text-slate-900 block">
                            {m.militar_posto} {m.militar_nome}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Matrícula: {m.militar_matricula || '-'} • Lotação: {m.militar_lotacao}
                          </span>
                          {m.detalhes_resposta && (
                            <span className="text-[11px] text-emerald-700 block font-semibold">
                              Opção/Resposta: {m.detalhes_resposta}
                            </span>
                          )}
                        </div>

                        <div className="text-right">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            m.status_resposta === 'Respondido'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {m.status_resposta}
                          </span>
                          {m.data_resposta && (
                            <span className="text-[10px] text-slate-400 block pt-0.5">
                              {new Date(m.data_resposta).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDetalhesRetorno({ open: false, campanha: null, dados: null, filtro: 'TODOS' })}
                  className="text-xs h-8 px-4 rounded-xl"
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
