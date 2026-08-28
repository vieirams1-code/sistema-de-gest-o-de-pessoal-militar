import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  FileSpreadsheet,
  FolderDown,
  RefreshCw,
  Search,
  Users,
  CheckCircle2,
  Clock,
  Paperclip,
  Eye,
  Filter,
  Download,
  Check,
  Calendar,
  Layers,
  FileSignature,
  UserCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  baixarAnexosCampanhaZip,
  exportarPlanilhaCampanhaExcel,
  exportarPlanilhaCampanhaCsv,
} from '@/utils/portalCampanhasExport';

export default function CentralRespostasCampanhas() {
  const [searchParams, setSearchParams] = useSearchParams();
  const campanhaParamId = searchParams.get('campanhaId');

  const [campanhas, setCampanhas] = useState([]);
  const [campanhaSelecionada, setCampanhaSelecionada] = useState(null);
  const [respostasData, setRespostasData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingRespostas, setLoadingRespostas] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', msg: '' });

  // Filtros de Busca e Lotação
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('TODOS'); // 'TODOS' | 'Respondido' | 'Pendente'
  const [filtroLotacao, setFiltroLotacao] = useState('');
  const [pagina, setPagina] = useState(1);
  const itensPorPagina = 15;

  // Estado do Modal de Progresso do ZIP
  const [zipProgress, setZipProgress] = useState(null); // { open, atual, total, texto, loading }

  // Modal de Auditoria da Resposta Individual do Militar
  const [modalMilitar, setModalMilitar] = useState({
    open: false,
    militar: null,
    resposta: null,
    observacaoRH: '',
  });

  // Carrega todas as campanhas disponíveis
  const carregarCampanhas = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('portal_servicos', { acao: 'CAMPANHA_LISTAR' });
      const lista = res.data?.campanhas || [];
      setCampanhas(lista);

      if (lista.length > 0) {
        let selecionada = null;
        if (campanhaParamId) {
          selecionada = lista.find((c) => c.id === campanhaParamId);
        }
        if (!selecionada) {
          selecionada = lista.find((c) => c.status === 'Aberta_Coleta') || lista[0];
        }
        setCampanhaSelecionada(selecionada);
        await carregarRespostas(selecionada);
      }
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Falha ao carregar campanhas.' });
    } finally {
      setLoading(false);
    }
  };

  // Carrega respostas nominais da campanha selecionada
  const carregarRespostas = async (camp) => {
    if (!camp?.id) return;
    setLoadingRespostas(true);
    setFeedback({ type: '', msg: '' });
    try {
      const res = await base44.functions.invoke('portal_servicos', {
        acao: 'CAMPANHA_DETALHES_RETORNO',
        campanha_id: camp.id,
      });
      setRespostasData(res.data);
      setPagina(1);
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Falha ao carregar respostas da campanha.' });
    } finally {
      setLoadingRespostas(false);
    }
  };

  useEffect(() => {
    carregarCampanhas();
  }, []);

  const handleSelecionarCampanha = async (campId) => {
    const camp = campanhas.find((c) => c.id === campId);
    if (!camp) return;
    setCampanhaSelecionada(camp);
    setSearchParams({ campanhaId: camp.id });
    await carregarRespostas(camp);
  };

  // Download em Lote de Anexos com Renomeação Institucional
  const handleBaixarZipLote = async () => {
    if (!campanhaSelecionada || !respostasData?.militares) {
      alert('Não há dados carregados para download de anexos.');
      return;
    }
    setZipProgress({ open: true, atual: 0, total: 0, texto: 'Iniciando download dos anexos...', loading: true });
    try {
      const res = await baixarAnexosCampanhaZip(
        campanhaSelecionada,
        respostasData.militares,
        (atual, total, texto) => {
          setZipProgress({ open: true, atual, total, texto, loading: true });
        }
      );
      setZipProgress({
        open: true,
        atual: res.totalBaixados,
        total: res.totalEsperados,
        texto: `Sucesso! ${res.totalBaixados} arquivo(s) baixados e compactados em ZIP com nomes padronizados.`,
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

  // Exportação Excel (.xlsx)
  const handleExportarExcel = () => {
    if (!campanhaSelecionada || !respostasData?.militares) {
      alert('Não há dados para exportação.');
      return;
    }
    try {
      exportarPlanilhaCampanhaExcel(campanhaSelecionada, respostasData.militares);
      setFeedback({ type: 'success', msg: 'Planilha Excel (.xlsx) exportada com sucesso!' });
    } catch (err) {
      alert(err.message || 'Falha ao exportar planilha Excel.');
    }
  };

  // Exportação CSV (UTF-8 BOM)
  const handleExportarCsv = () => {
    if (!campanhaSelecionada || !respostasData?.militares) {
      alert('Não há dados para exportação.');
      return;
    }
    try {
      exportarPlanilhaCampanhaCsv(campanhaSelecionada, respostasData.militares);
      setFeedback({ type: 'success', msg: 'Arquivo CSV gerado com sucesso!' });
    } catch (err) {
      alert(err.message || 'Falha ao exportar CSV.');
    }
  };

  // Filtros de Respostas Nominais
  const militaresFiltrados = useMemo(() => {
    const lista = respostasData?.militares || [];
    const termo = (busca || '').toLowerCase();

    return lista.filter((m) => {
      if (filtroStatus !== 'TODOS' && m.status_resposta !== filtroStatus) return false;
      if (filtroLotacao && m.militar_lotacao !== filtroLotacao) return false;
      if (termo) {
        const matchNome = (m.militar_nome || '').toLowerCase().includes(termo);
        const matchMat = (m.militar_matricula || '').toLowerCase().includes(termo);
        const matchPosto = (m.militar_posto || '').toLowerCase().includes(termo);
        const matchLot = (m.militar_lotacao || '').toLowerCase().includes(termo);
        if (!matchNome && !matchMat && !matchPosto && !matchLot) return false;
      }
      return true;
    });
  }, [respostasData, busca, filtroStatus, filtroLotacao]);

  // Paginação de Respostas
  const totalPaginas = Math.ceil(militaresFiltrados.length / itensPorPagina) || 1;
  const currentItens = useMemo(() => {
    const start = (pagina - 1) * itensPorPagina;
    return militaresFiltrados.slice(start, start + itensPorPagina);
  }, [militaresFiltrados, pagina]);

  // Perguntas dinâmicas da campanha selecionada
  const perguntasCampanha = useMemo(() => {
    if (!campanhaSelecionada?.config_formulario) return [];
    try {
      const p = typeof campanhaSelecionada.config_formulario === 'string'
        ? JSON.parse(campanhaSelecionada.config_formulario)
        : campanhaSelecionada.config_formulario;
      return p?.campos || [];
    } catch (_e) {
      return [];
    }
  }, [campanhaSelecionada]);

  // Contagem de anexos
  const contagemAnexos = useMemo(() => {
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

  // Lotações distintas para o filtro
  const lotacoesDisponiveis = useMemo(() => {
    const distinct = new Set();
    (respostasData?.militares || []).forEach((m) => {
      if (m.militar_lotacao) distinct.add(m.militar_lotacao);
    });
    return Array.from(distinct).sort();
  }, [respostasData]);

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:p-8 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* BANNER PRINCIPAL */}
        <div className="bg-gradient-to-r from-[#1e3a5f] to-[#0f233a] rounded-3xl p-6 sm:p-7 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-blue-300 text-xs font-semibold uppercase tracking-wider mb-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Painel de Resultados & Auditoria
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2.5">
              <FileSpreadsheet className="w-7 h-7 text-blue-300" />
              Central de Respostas & Entregas de Campanhas
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl">
              Acompanhamento nominal unificado, auditoria de dados enviados, exportação em planilha e download em lote de anexos renomeados no padrão militar.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              type="button"
              onClick={handleExportarExcel}
              disabled={loadingRespostas || !respostasData?.militares?.length}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md h-10 px-4"
            >
              <FileSpreadsheet className="w-4 h-4 mr-1.5" />
              Exportar Excel (.xlsx)
            </Button>

            <Button
              type="button"
              onClick={handleExportarCsv}
              disabled={loadingRespostas || !respostasData?.militares?.length}
              variant="outline"
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs font-bold rounded-xl h-10 px-3.5"
            >
              CSV
            </Button>

            <Button
              type="button"
              onClick={handleBaixarZipLote}
              disabled={loadingRespostas || contagemAnexos === 0}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md h-10 px-4 disabled:opacity-40"
              title={contagemAnexos === 0 ? 'Esta campanha não possui anexos enviados' : 'Baixar todos os anexos organizados em ZIP'}
            >
              <FolderDown className="w-4 h-4 mr-1.5" />
              Baixar Anexos (ZIP)
            </Button>
          </div>
        </div>

        {/* FEEDBACK ALERTS */}
        {feedback.msg && (
          <div className={`p-3.5 rounded-xl text-xs flex items-start space-x-2 animate-in fade-in ${
            feedback.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />}
            <span>{feedback.msg}</span>
          </div>
        )}

        {/* SELETOR DE CAMPANHA & RESUMO */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto flex-1">
            <span className="text-xs font-bold text-slate-500 uppercase shrink-0 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-[#1e3a5f]" />
              Selecionar Campanha:
            </span>
            <select
              value={campanhaSelecionada?.id || ''}
              onChange={(e) => handleSelecionarCampanha(e.target.value)}
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
                {campanhaSelecionada?.tipo === 'PLANO_FERIAS' ? 'Plano de Férias' :
                 campanhaSelecionada?.tipo === 'ASSINATURA_DOCUMENTO' ? 'Assinatura Documento' :
                 campanhaSelecionada?.tipo === 'ATUALIZACAO_CADASTRAL' ? 'Atualização Cadastral' : 'Formulário Dinâmico'}
              </span>
              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1.5 ${
                campanhaSelecionada?.status === 'Aberta_Coleta' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${campanhaSelecionada?.status === 'Aberta_Coleta' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                {campanhaSelecionada?.status === 'Aberta_Coleta' ? 'Aberta' : (campanhaSelecionada?.status || 'Ativa')}
              </span>
            </div>
          </div>

          <Button
            type="button"
            onClick={() => carregarRespostas(campanhaSelecionada)}
            disabled={loadingRespostas}
            variant="outline"
            className="h-10 text-xs font-semibold rounded-xl"
            title="Recarregar Dados"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loadingRespostas ? 'animate-spin' : ''}`} />
            Recarregar Dados
          </Button>
        </div>

        {/* KPI CARDS RESUMO */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase">Público Alvo</p>
              <h3 className="text-2xl font-black text-slate-900 mt-0.5">
                {loadingRespostas ? '...' : respostasData?.total_alvo || 0}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-[180px]" title={campanhaSelecionada?.escopo_unidades_nomes || 'Toda a Corporação'}>
                {campanhaSelecionada?.escopo_unidades_nomes || 'Toda a Corporação'}
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-blue-50 text-[#1e3a5f] flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase">Respondidos</p>
              <h3 className="text-2xl font-black text-emerald-600 mt-0.5">
                {loadingRespostas ? '...' : respostasData?.total_respondidos || 0}
              </h3>
              <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                {loadingRespostas ? '' : `${respostasData?.percentual || 0}% de adesão`}
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase">Pendentes</p>
              <h3 className="text-2xl font-black text-amber-600 mt-0.5">
                {loadingRespostas ? '...' : respostasData?.total_pendentes || 0}
              </h3>
              <p className="text-[11px] text-amber-600 font-semibold mt-0.5">
                Aguardando submissão
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase">Arquivos Anexados</p>
              <h3 className="text-2xl font-black text-purple-700 mt-0.5">
                {loadingRespostas ? '...' : contagemAnexos}
              </h3>
              <p className="text-[11px] text-purple-700 font-semibold mt-0.5">
                {contagemAnexos > 0 ? 'Prontos para ZIP renomeado' : 'Sem uploads'}
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
              <Paperclip className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* PAINEL DE CONTROLE: BUSCA E FILTROS */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por Nome, Matrícula, Posto ou Lotação..."
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setPagina(1);
              }}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none focus:ring-1 focus:ring-[#1e3a5f] focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => {
                setFiltroStatus('TODOS');
                setPagina(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                filtroStatus === 'TODOS' ? 'bg-[#1e3a5f] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos ({respostasData?.total_alvo || 0})
            </button>

            <button
              type="button"
              onClick={() => {
                setFiltroStatus('Respondido');
                setPagina(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                filtroStatus === 'Respondido' ? 'bg-[#1e3a5f] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Respondidos ({respostasData?.total_respondidos || 0})
            </button>

            <button
              type="button"
              onClick={() => {
                setFiltroStatus('Pendente');
                setPagina(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                filtroStatus === 'Pendente' ? 'bg-[#1e3a5f] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Pendentes ({respostasData?.total_pendentes || 0})
            </button>

            {lotacoesDisponiveis.length > 0 && (
              <select
                value={filtroLotacao}
                onChange={(e) => {
                  setFiltroLotacao(e.target.value);
                  setPagina(1);
                }}
                className="h-8 px-2.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none"
              >
                <option value="">Todas as Lotações</option>
                {lotacoesDisponiveis.map((lot) => (
                  <option key={lot} value={lot}>{lot}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* TABELA DE RESULTADOS NOMINAIS COM COLUNAS DINÂMICAS */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 uppercase">Relação Nominal de Militares</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                {militaresFiltrados.length} registros
              </span>
            </div>
            <div className="text-xs text-slate-500 hidden sm:block">
              💡 Clique na linha ou no botão "Auditar" para ver a ficha completa com respostas e anexos
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

                  {/* Colunas Conforme o Tipo da Campanha */}
                  {campanhaSelecionada?.tipo === 'PLANO_FERIAS' && (
                    <>
                      <th className="p-3">1ª Opção</th>
                      <th className="p-3">2ª Opção</th>
                      <th className="p-3">3ª Opção</th>
                      <th className="p-3">Parcelamento</th>
                    </>
                  )}

                  {campanhaSelecionada?.tipo === 'ASSINATURA_DOCUMENTO' && (
                    <>
                      <th className="p-3">Documento Assinado</th>
                      <th className="p-3">Termo Ciência</th>
                    </>
                  )}

                  {campanhaSelecionada?.tipo === 'FORMULARIO_DINAMICO' && (
                    perguntasCampanha.map((p) => (
                      <th key={p.id} className="p-3 min-w-[160px] max-w-[240px]">
                        {p.pergunta}
                      </th>
                    ))
                  )}

                  {campanhaSelecionada?.tipo === 'ATUALIZACAO_CADASTRAL' && (
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
                ) : currentItens.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="p-8 text-center text-slate-400">
                      Nenhum militar encontrado com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  currentItens.map((m) => {
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
                            setModalMilitar({
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

                        {/* Férias */}
                        {campanhaSelecionada?.tipo === 'PLANO_FERIAS' && (
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

                        {/* Assinatura Documento */}
                        {campanhaSelecionada?.tipo === 'ASSINATURA_DOCUMENTO' && (
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

                        {/* Formulário Dinâmico */}
                        {campanhaSelecionada?.tipo === 'FORMULARIO_DINAMICO' && (
                          perguntasCampanha.map((p) => {
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

                        {/* Atualização Cadastral */}
                        {campanhaSelecionada?.tipo === 'ATUALIZACAO_CADASTRAL' && (
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
                              onClick={() => setModalMilitar({
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

          {/* PAGINAÇÃO */}
          {totalPaginas > 1 && (
            <div className="p-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
              <div>
                Mostrando {((pagina - 1) * itensPorPagina) + 1} a {Math.min(pagina * itensPorPagina, militaresFiltrados.length)} de {militaresFiltrados.length} registros
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPagina((p) => Math.max(p - 1, 1))}
                  disabled={pagina === 1}
                  className="h-8 px-2"
                >
                  Anterior
                </Button>
                {Array.from({ length: totalPaginas }, (_, i) => i + 1).slice(0, 7).map((p) => (
                  <Button
                    key={p}
                    type="button"
                    variant={pagina === p ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPagina(p)}
                    className={`h-8 w-8 p-0 ${pagina === p ? 'bg-[#1e3a5f] text-white' : ''}`}
                  >
                    {p}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPagina((p) => Math.min(p + 1, totalPaginas))}
                  disabled={pagina === totalPaginas}
                  className="h-8 px-2"
                >
                  Próximo
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* MODAL DE RESPOSTA INDIVIDUAL DO MILITAR */}
        {modalMilitar.open && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-5 sm:p-7 space-y-4 text-xs animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">
                    Respostas do Militar: {modalMilitar.militar?.militar_posto} {modalMilitar.militar?.militar_nome}
                  </h3>
                  <span className="text-slate-500 text-[11px]">
                    Matrícula: {modalMilitar.militar?.militar_matricula} • Lotação: {modalMilitar.militar?.militar_lotacao}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setModalMilitar({ open: false, militar: null, resposta: null, observacaoRH: '' })}
                  className="text-slate-400 hover:text-slate-600 font-bold text-base"
                >
                  ✕
                </button>
              </div>

              {/* CONTEÚDO DAS RESPOSTAS */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {/* Se for Assinatura de Documento */}
                {modalMilitar.resposta?.arquivo_devolucao_url && (
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-2">
                    <strong className="block text-amber-950 font-bold text-sm flex items-center">
                      <FileSignature className="w-4 h-4 mr-1.5 text-amber-700" />
                      Documento Assinado Enviado pelo Militar
                    </strong>
                    <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-amber-200">
                      <span className="font-bold text-slate-800 truncate max-w-sm">
                        {modalMilitar.resposta.arquivo_devolucao_nome || 'documento_assinado.pdf'}
                      </span>
                      <a
                        href={modalMilitar.resposta.arquivo_devolucao_url}
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
                  if (campanhaSelecionada?.config_formulario) {
                    try {
                      const p = typeof campanhaSelecionada.config_formulario === 'string'
                        ? JSON.parse(campanhaSelecionada.config_formulario)
                        : campanhaSelecionada.config_formulario;
                      formCampos = p?.campos || [];
                    } catch (_e) {}
                  }

                  let respostasObj = {};
                  let arquivosObj = {};
                  if (modalMilitar.resposta?.respostas_json) {
                    try {
                      respostasObj = typeof modalMilitar.resposta.respostas_json === 'string'
                        ? JSON.parse(modalMilitar.resposta.respostas_json)
                        : modalMilitar.resposta.respostas_json;
                    } catch (_e) {}
                  }
                  if (modalMilitar.resposta?.arquivos_anexados_json) {
                    try {
                      arquivosObj = typeof modalMilitar.resposta.arquivos_anexados_json === 'string'
                        ? JSON.parse(modalMilitar.resposta.arquivos_anexados_json)
                        : modalMilitar.resposta.arquivos_anexados_json;
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
                {modalMilitar.resposta?.termo_aceite && (
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
                  onClick={() => setModalMilitar({ open: false, militar: null, resposta: null, observacaoRH: '' })}
                  className="text-xs h-9 rounded-xl"
                >
                  Fechar
                </Button>

                <div className="flex items-center space-x-2">
                  <Button
                    type="button"
                    onClick={async () => {
                      if (!modalMilitar.resposta?.id) return;
                      setActionLoading(true);
                      try {
                        await base44.functions.invoke('portal_servicos', {
                          acao: 'CAMPANHA_HOMOLOGAR_RESPOSTA',
                          resposta_id: modalMilitar.resposta.id,
                          status: 'Homologado',
                          observacao_gestor: 'Aprovado pelo RH',
                        });
                        setFeedback({ type: 'success', msg: 'Resposta homologada com sucesso!' });
                        setModalMilitar({ open: false, militar: null, resposta: null, observacaoRH: '' });
                        if (campanhaSelecionada) {
                          await carregarRespostas(campanhaSelecionada);
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

        {/* MODAL DE PROGRESSO DO DOWNLOAD DE ANEXOS (ZIP) */}
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
