import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Edit3,
  RotateCcw,
  CheckCheck,
  User,
  RefreshCw,
  Check,
  X,
  Inbox,
  ChevronDown,
  ChevronUp,
  Search,
  ClipboardList,
  AlertCircle,
  CheckCircle2,
  ChevronsUpDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import RequireAdmin from '@/components/auth/RequireAdmin';

function formatDate(d) {
  if (!d) return '—';
  try { return format(new Date(d + 'T00:00:00'), 'dd/MM/yyyy'); } catch { return d; }
}

export default function SolicitacoesAtualizacao() {
  const queryClient = useQueryClient();
  const { user, isAdmin } = useCurrentUser();
  const [filtroStatus, setFiltroStatus] = useState('Pendente');
  const [buscaTermo, setBuscaTermo] = useState('');
  const [valoresEditados, setValoresEditados] = useState({}); // { [solId]: valorCorrigido }
  const [modosEdicao, setModosEdicao] = useState({}); // { [solId]: boolean }
  const [expandidos, setExpandidos] = useState({}); // { [militarKey]: boolean }
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const { data: solicitacoes = [], isLoading, refetch } = useQuery({
    queryKey: ['solicitacoes-atualizacao', filtroStatus],
    queryFn: () => base44.entities.SolicitacaoAtualizacao.filter(
      filtroStatus === 'todos' ? {} : { status: filtroStatus },
      '-data_solicitacao'
    ),
  });

  const handleEditarValor = (solId, valor) => {
    setValoresEditados((prev) => ({ ...prev, [solId]: valor }));
  };

  const handleRestaurarValor = (solId) => {
    setValoresEditados((prev) => {
      const next = { ...prev };
      delete next[solId];
      return next;
    });
    setModosEdicao((prev) => ({ ...prev, [solId]: false }));
  };

  const handleToggleEdicao = (solId, valorAtual) => {
    setModosEdicao((prev) => {
      const nextState = !prev[solId];
      if (nextState && valoresEditados[solId] === undefined) {
        setValoresEditados((v) => ({ ...v, [solId]: valorAtual }));
      }
      return { ...prev, [solId]: nextState };
    });
  };

  const handleToggleExpansao = (key) => {
    setExpandidos((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleExpandirTodos = (grupos, expandir) => {
    const novoEstado = {};
    grupos.forEach((g) => {
      const key = g.militar_id || g.militar_matricula || g.militar_nome || 'desconhecido';
      novoEstado[key] = expandir;
    });
    setExpandidos(novoEstado);
  };

  const handleDecidirItem = async (sol, novoStatus) => {
    if (!isAdmin) return;
    setProcessing(true);
    setFeedback(null);
    try {
      const valorCorrigido = valoresEditados[sol.id];
      const res = await base44.functions.invoke('portal_servicos', {
        acao: 'CADASTRO_DECIDIR_SOLICITACAO',
        solicitacao_id: sol.id,
        decisao: novoStatus,
        valor_corrigido: valorCorrigido,
      });

      if (res.data?.ok) {
        setFeedback({ type: 'success', msg: `Solicitação ${novoStatus.toLowerCase()} e aplicada na ficha do militar com sucesso!` });
      } else {
        const foiEditado = valorCorrigido !== undefined && valorCorrigido !== sol.valor_proposto;
        const valorFinal = foiEditado ? valorCorrigido : sol.valor_proposto;

        const updatePayload = {
          status: novoStatus,
          usuario_decisao: user?.full_name || user?.email || 'Usuário',
          data_decisao: new Date().toISOString().split('T')[0],
        };
        if (foiEditado) {
          updatePayload.valor_original_militar = sol.valor_proposto;
          updatePayload.valor_proposto = valorFinal;
          updatePayload.editado_pelo_gestor = true;
          updatePayload.observacao_decisao = `Retificado pelo gestor (original: "${sol.valor_proposto}")`;
        }

        await base44.entities.SolicitacaoAtualizacao.update(sol.id, updatePayload);
        setFeedback({ type: 'success', msg: `Solicitação ${novoStatus.toLowerCase()} com sucesso.` });
      }

      await queryClient.invalidateQueries({ queryKey: ['solicitacoes-atualizacao'] });
      await refetch();
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Falha ao decidir solicitação.' });
    } finally {
      setProcessing(false);
    }
  };

  const handleDecidirLote = async (militarId, itens, novoStatus) => {
    if (!isAdmin) return;
    setProcessing(true);
    setFeedback(null);
    try {
      const itensDecisao = itens.map((item) => ({
        solicitacao_id: item.id,
        valor_corrigido: valoresEditados[item.id] !== undefined ? valoresEditados[item.id] : item.valor_proposto,
      }));

      const res = await base44.functions.invoke('portal_servicos', {
        acao: 'CADASTRO_DECIDIR_LOTE_MILITAR',
        militar_id: militarId,
        decisao: novoStatus,
        itens_decisao: itensDecisao,
      });

      if (res.data?.ok) {
        setFeedback({ type: 'success', msg: `Todas as alterações do militar foram ${novoStatus.toLowerCase()}s com sucesso!` });
      } else {
        for (const item of itens) {
          await handleDecidirItem(item, novoStatus);
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['solicitacoes-atualizacao'] });
      await refetch();
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Falha ao processar lote.' });
    } finally {
      setProcessing(false);
    }
  };

  // Agrupa solicitações por militar e aplica busca textual
  const gruposMilitares = useMemo(() => {
    const map = new Map();
    const termo = (buscaTermo || '').toLowerCase();

    solicitacoes.forEach((sol) => {
      const key = sol.militar_id || sol.militar_matricula || sol.militar_nome || 'desconhecido';
      if (!map.has(key)) {
        map.set(key, {
          key,
          militar_id: sol.militar_id,
          militar_nome: sol.militar_nome || 'Militar',
          militar_posto: sol.militar_posto || '',
          militar_matricula: sol.militar_matricula || '',
          militar_lotacao: sol.militar_lotacao || '',
          itens: [],
        });
      }
      map.get(key).itens.push(sol);
    });

    const lista = Array.from(map.values());

    if (!termo) return lista;

    return lista.filter((g) => {
      const matchNome = (g.militar_nome || '').toLowerCase().includes(termo);
      const matchMat = (g.militar_matricula || '').toLowerCase().includes(termo);
      const matchPosto = (g.militar_posto || '').toLowerCase().includes(termo);
      const matchLot = (g.militar_lotacao || '').toLowerCase().includes(termo);
      const matchCampos = g.itens.some((i) =>
        (i.campo_label || i.campo_chave || '').toLowerCase().includes(termo) ||
        (i.valor_proposto || '').toLowerCase().includes(termo)
      );
      return matchNome || matchMat || matchPosto || matchLot || matchCampos;
    });
  }, [solicitacoes, buscaTermo]);

  const totalPendentesGeral = useMemo(() => {
    return solicitacoes.filter((s) => s.status === 'Pendente').length;
  }, [solicitacoes]);

  return (
    <RequireAdmin>
      <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 font-sans">
        <div className="max-w-5xl mx-auto space-y-6">
          
          {/* CABEÇALHO */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-[#1e3a5f] text-white flex items-center justify-center shadow-md">
                <ClipboardList className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Solicitações Cadastrais dos Militares
                </h1>
                <p className="text-slate-500 text-xs mt-0.5">
                  Analise as alterações solicitadas via Portal, retifique se necessário e aprove em lote ou individualmente por militar
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="text-xs h-9 rounded-xl font-semibold bg-white"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>
          </div>

          {/* BARRA DE CONTROLE: FILTROS DE STATUS, BUSCA E EXPANSÃO */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            {/* BUSCA */}
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nome, matrícula ou campo..."
                value={buscaTermo}
                onChange={(e) => setBuscaTermo(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none focus:ring-1 focus:ring-[#1e3a5f] focus:bg-white"
              />
            </div>

            {/* FILTROS DE STATUS */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
              {[
                { id: 'Pendente', label: 'Pendentes' },
                { id: 'Aprovada', label: 'Aprovadas' },
                { id: 'Rejeitada', label: 'Rejeitadas' },
                { id: 'todos', label: 'Todas' },
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setFiltroStatus(st.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    filtroStatus === st.id
                      ? 'bg-[#1e3a5f] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {/* BOTÕES EXPANDIR / RECOLHER TODOS */}
            <div className="flex items-center gap-1.5 w-full md:w-auto justify-end">
              <button
                type="button"
                onClick={() => handleExpandirTodos(gruposMilitares, true)}
                className="text-xs font-bold text-[#1e3a5f] hover:underline px-2 py-1 rounded-lg hover:bg-blue-50"
              >
                Expandir Todos
              </button>
              <span className="text-slate-300">•</span>
              <button
                type="button"
                onClick={() => handleExpandirTodos(gruposMilitares, false)}
                className="text-xs font-bold text-slate-500 hover:underline px-2 py-1 rounded-lg hover:bg-slate-100"
              >
                Recolher Todos
              </button>
            </div>
          </div>

          {/* MENSAGEM DE FEEDBACK */}
          {feedback && (
            <div className={`p-4 rounded-2xl text-xs font-semibold flex items-center justify-between animate-in fade-in-50 ${
              feedback.type === 'success' ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-red-50 text-red-900 border border-red-200'
            }`}>
              <div className="flex items-center space-x-2">
                {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />}
                <span>{feedback.msg}</span>
              </div>
              <button type="button" onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600 font-bold ml-2">✕</button>
            </div>
          )}

          {/* LISTA AGRUPADA POR MILITAR COM ACCORDION */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="w-10 h-10 border-4 border-slate-200 border-t-[#1e3a5f] rounded-full animate-spin"></div>
              <p className="text-sm text-slate-500 font-medium">Carregando solicitações...</p>
            </div>
          ) : gruposMilitares.length === 0 ? (
            <Card className="border-slate-200 shadow-sm rounded-2xl bg-white">
              <CardContent className="p-12 text-center text-xs text-slate-500 space-y-2">
                <Inbox className="w-8 h-8 mx-auto text-slate-300" />
                <p className="font-semibold text-slate-700">Nenhuma solicitação cadastral encontrada.</p>
                <p className="text-slate-400">Não há registros para o filtro selecionado ({filtroStatus}).</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {gruposMilitares.map((grupo) => {
                const key = grupo.key;
                const isExpandido = expandidos[key] !== false; // expandido por padrão na primeira carga ou conforme toggle
                const totalItens = grupo.itens.length;
                const itensPendentes = grupo.itens.filter((i) => i.status === 'Pendente');
                const itensAprovados = grupo.itens.filter((i) => i.status === 'Aprovada');
                const itensRejeitados = grupo.itens.filter((i) => i.status === 'Rejeitada');
                const temPendentes = itensPendentes.length > 0;

                return (
                  <div
                    key={key}
                    className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden transition-all duration-200"
                  >
                    {/* CABEÇALHO DO MILITAR (BARRA CLICÁVEL DO ACCORDION) */}
                    <div
                      onClick={() => handleToggleExpansao(key)}
                      className="p-4 bg-slate-50/70 hover:bg-blue-50/50 cursor-pointer border-b border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors select-none"
                    >
                      {/* IDENTIFICAÇÃO DO MILITAR E NUMERAL DE SOLICITAÇÕES */}
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-[#1e3a5f] text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                          <User className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-0.5">
                            <span className="font-extrabold text-slate-900 text-sm truncate">
                              {grupo.militar_posto} {grupo.militar_nome}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700 font-mono text-[10px] font-bold">
                              Mat: {grupo.militar_matricula || '-'}
                            </span>
                            {grupo.militar_lotacao && (
                              <span className="text-[11px] text-slate-500 font-medium truncate max-w-xs">
                                • {grupo.militar_lotacao}
                              </span>
                            )}
                          </div>

                          {/* NUMERAIS E STATUS */}
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-100 text-[#1e3a5f]">
                              {totalItens} {totalItens === 1 ? 'solicitação' : 'solicitações'}
                            </span>

                            {temPendentes ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-900 border border-amber-200">
                                ⏳ {itensPendentes.length} pendente(s)
                              </span>
                            ) : itensAprovados.length === totalItens ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                                ✓ Todas aprovadas
                              </span>
                            ) : itensRejeitados.length === totalItens ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800">
                                ✕ Todas rejeitadas
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600">
                                {itensAprovados.length} aprovada(s), {itensRejeitados.length} rejeitada(s)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* AÇÕES EM LOTE E BOTÃO EXPANDIR/RECOLHER */}
                      <div className="flex items-center space-x-2 self-end sm:self-center shrink-0" onClick={(e) => e.stopPropagation()}>
                        {isAdmin && temPendentes && (
                          <div className="flex items-center space-x-1.5 mr-2">
                            <Button
                              type="button"
                              size="sm"
                              disabled={processing}
                              onClick={() => handleDecidirLote(grupo.militar_id, itensPendentes, 'Aprovada')}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs h-8 px-3 font-bold shadow-xs"
                            >
                              <CheckCheck className="w-3.5 h-3.5 mr-1" />
                              Aprovar Todas
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={processing}
                              onClick={() => handleDecidirLote(grupo.militar_id, itensPendentes, 'Rejeitada')}
                              className="border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-xs h-8 px-2.5 font-bold"
                            >
                              <X className="w-3.5 h-3.5 mr-1" />
                              Rejeitar Todas
                            </Button>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => handleToggleExpansao(key)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-colors"
                          title={isExpandido ? 'Recolher alterações deste militar' : 'Expandir alterações deste militar'}
                        >
                          {isExpandido ? <ChevronUp className="w-5 h-5 text-[#1e3a5f]" /> : <ChevronDown className="w-5 h-5 text-slate-600" />}
                        </button>
                      </div>
                    </div>

                    {/* CONTEÚDO EXPANSÍVEL (LISTAGEM DE ALTERAÇÕES DO MILITAR) */}
                    {isExpandido && (
                      <div className="divide-y divide-slate-100 bg-white animate-in slide-in-from-top-1 duration-150">
                        {grupo.itens.map((sol) => {
                          const estaEditando = modosEdicao[sol.id];
                          const valorEditado = valoresEditados[sol.id];
                          const valorExibido = valorEditado !== undefined ? valorEditado : sol.valor_proposto;
                          const foiModificadoPeloGestor = (valorEditado !== undefined && valorEditado !== sol.valor_proposto) || sol.editado_pelo_gestor;

                          return (
                            <div key={sol.id} className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                              <div className="space-y-2 flex-1 min-w-0">
                                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 font-bold text-slate-800 text-xs">
                                    {sol.campo_label || sol.campo_chave}
                                  </span>

                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    sol.status === 'Aprovada'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : sol.status === 'Rejeitada'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}>
                                    {sol.status || 'Pendente'}
                                  </span>

                                  {foiModificadoPeloGestor && (
                                    <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-300 text-amber-900 text-[10px] font-bold flex items-center gap-1">
                                      <Edit3 className="w-3 h-3 text-amber-600" />
                                      Retificado pelo Gestor
                                    </span>
                                  )}

                                  <span className="text-slate-400 text-[11px]">
                                    Solicitado em: {formatDate(sol.data_solicitacao)}
                                  </span>
                                </div>

                                {/* COMPARAÇÃO: VALOR ATUAL -> PROPOSTO / EDITADO */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                                    <span className="text-[10px] font-bold text-slate-400 block mb-0.5 uppercase tracking-wider">
                                      Valor Atual no Sistema
                                    </span>
                                    <span className="text-slate-600 font-medium break-all">
                                      {sol.valor_atual || '(vazio)'}
                                    </span>
                                  </div>

                                  <div className={`p-2.5 rounded-xl border transition-all ${
                                    foiModificadoPeloGestor
                                      ? 'bg-amber-50/50 border-amber-300 ring-1 ring-amber-300'
                                      : 'bg-emerald-50/50 border-emerald-200'
                                  }`}>
                                    <div className="flex items-center justify-between mb-0.5">
                                      <span className={`text-[10px] font-bold uppercase tracking-wider ${
                                        foiModificadoPeloGestor ? 'text-amber-800' : 'text-emerald-800'
                                      }`}>
                                        {foiModificadoPeloGestor ? 'Valor Corrigido a ser Aplicado' : 'Valor Solicitado pelo Militar'}
                                      </span>

                                      {isAdmin && sol.status === 'Pendente' && (
                                        <button
                                          type="button"
                                          onClick={() => handleToggleEdicao(sol.id, sol.valor_proposto)}
                                          className="text-[11px] text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1"
                                        >
                                          <Edit3 className="w-3 h-3" />
                                          {estaEditando ? 'Fechar Edição' : 'Corrigir Dado'}
                                        </button>
                                      )}
                                    </div>

                                    {/* ENTRADA DE CORREÇÃO OU VISUALIZAÇÃO */}
                                    {estaEditando && sol.status === 'Pendente' ? (
                                      <div className="flex items-center gap-2 mt-1">
                                        <Input
                                          type="text"
                                          value={valorExibido}
                                          onChange={(e) => handleEditarValor(sol.id, e.target.value)}
                                          className="h-8 text-xs bg-white rounded-lg border-amber-400 font-semibold text-slate-900"
                                          placeholder="Digite a correção..."
                                          autoFocus
                                        />
                                        {valorEditado !== undefined && valorEditado !== sol.valor_proposto && (
                                          <button
                                            type="button"
                                            onClick={() => handleRestaurarValor(sol.id)}
                                            className="p-1 text-slate-400 hover:text-slate-700 rounded"
                                            title="Restaurar valor original do militar"
                                          >
                                            <RotateCcw className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-between">
                                        <span className="text-emerald-950 font-bold break-all">
                                          {valorExibido}
                                        </span>
                                        {foiModificadoPeloGestor && sol.valor_original_militar && (
                                          <span className="text-[10px] text-slate-400 line-through ml-2">
                                            (Original: {sol.valor_original_militar})
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {sol.justificativa && (
                                  <p className="text-[11px] text-slate-500 italic bg-slate-50/50 p-2 rounded-lg border border-slate-100">
                                    <strong>Justificativa do militar:</strong> "{sol.justificativa}"
                                  </p>
                                )}

                                {sol.observacao_decisao && (
                                  <p className="text-[11px] text-blue-800 bg-blue-50/40 p-2 rounded-lg border border-blue-100">
                                    <strong>Obs. da decisão:</strong> {sol.observacao_decisao}
                                  </p>
                                )}
                              </div>

                              {/* AÇÕES INDIVIDUAIS */}
                              {isAdmin && sol.status === 'Pendente' && (
                                <div className="flex sm:flex-col lg:flex-row items-center gap-2 shrink-0 self-end lg:self-center">
                                  <Button
                                    type="button"
                                    size="sm"
                                    disabled={processing}
                                    onClick={() => handleDecidirItem(sol, 'Aprovada')}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs h-8 px-3 font-semibold shadow-sm"
                                  >
                                    <Check className="w-3.5 h-3.5 mr-1" />
                                    Aprovar Campo
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={processing}
                                    onClick={() => handleDecidirItem(sol, 'Rejeitada')}
                                    className="border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-xs h-8 px-3 font-semibold"
                                  >
                                    <X className="w-3.5 h-3.5 mr-1" />
                                    Rejeitar
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </RequireAdmin>
  );
}