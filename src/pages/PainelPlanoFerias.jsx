import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Calendar,
  Users,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Zap,
  Sliders,
  Check,
  Edit3,
  Layers,
  ChevronRight,
  Medal,
  Award,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function PainelPlanoFerias() {
  const [ano, setAno] = useState(new Date().getFullYear() + 1); // 2027
  const [campanha, setCampanha] = useState(null);
  const [opcoes, setOpcoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', msg: '' });

  // Modal / Ajuste manual de mês do gestor
  const [modalAjuste, setModalAjuste] = useState({ open: false, opcao: null, mes1: '01', mes2: '07', justificativa: '' });

  const loadPlano = async (anoRef = ano) => {
    setLoading(true);
    setFeedback({ type: '', msg: '' });
    try {
      // 1. Obtém ou cria a campanha do ano
      const resCamp = await base44.functions.invoke('portal_servicos', {
        acao: 'PLANO_CAMPANHA_OBTER_OU_CRIAR',
        ano_referencia: Number(anoRef),
      });
      setCampanha(resCamp.data?.campanha || null);

      // 2. Lista opções enviadas pelos militares
      const resEscala = await base44.functions.invoke('portal_servicos', {
        acao: 'PLANO_ESCALA_LISTAR',
        ano_referencia: Number(anoRef),
      });
      setOpcoes(resEscala.data?.opcoes || []);
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Falha ao carregar dados do plano de férias.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlano(ano);
  }, [ano]);

  // Decisão Camada 1: Aprovar Opção 1, 2 ou 3
  const handleAprovarOpcaoCamada1 = async (op, tipoOpcao) => {
    setActionLoading(true);
    try {
      let parcelas = [];
      if (tipoOpcao === 'OPCAO_1') parcelas = JSON.parse(op.opcao_1_detalhes || '[]');
      if (tipoOpcao === 'OPCAO_2') parcelas = JSON.parse(op.opcao_2_detalhes || '[]');
      if (tipoOpcao === 'OPCAO_3') parcelas = JSON.parse(op.opcao_3_detalhes || '[]');

      await base44.functions.invoke('portal_servicos', {
        acao: 'PLANO_DECISAO_CAMADA_1',
        opcao_id: op.id,
        decisao_camada_1: {
          opcao_escolhida: tipoOpcao,
          parcelas: parcelas,
          gestor_nome: 'S1 / Gestor da Unidade',
        },
      });

      setFeedback({ type: 'success', msg: `Opção do militar ${op.militar_nome} aprovada com sucesso!` });
      await loadPlano(ano);
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Falha ao aprovar opção.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Decisão Camada 1: Ajustar Mês
  const handleSalvarAjusteGestor = async () => {
    if (!modalAjuste.opcao) return;
    setActionLoading(true);
    try {
      const op = modalAjuste.opcao;
      const parcelas = [
        { etapa: 1, dias: 15, mes: modalAjuste.mes1, data_inicio: `${ano}-${modalAjuste.mes1}-05` },
        { etapa: 2, dias: 15, mes: modalAjuste.mes2, data_inicio: `${ano}-${modalAjuste.mes2}-05` },
      ];

      await base44.functions.invoke('portal_servicos', {
        acao: 'PLANO_DECISAO_CAMADA_1',
        opcao_id: op.id,
        decisao_camada_1: {
          opcao_escolhida: 'AJUSTE_GESTOR',
          parcelas: parcelas,
          justificativa: modalAjuste.justificativa || 'Ajuste operacional da escala da unidade.',
          gestor_nome: 'S1 / Gestor da Unidade',
        },
      });

      setModalAjuste({ open: false, opcao: null, mes1: '01', mes2: '07', justificativa: '' });
      setFeedback({ type: 'success', msg: `Mês ajustado pelo gestor para ${op.militar_nome}.` });
      await loadPlano(ano);
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Falha ao salvar ajuste.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Homologação Camada 2 (Superior / Comandante)
  const handleHomologarCamada2Geral = async () => {
    setActionLoading(true);
    try {
      for (const op of opcoes) {
        if (op.status_camada_1 !== 'Pendente') {
          await base44.functions.invoke('portal_servicos', {
            acao: 'PLANO_HOMOLOGACAO_CAMADA_2',
            opcao_id: op.id,
            homologacao_camada_2: {
              status: 'Homologado_Superior',
              superior_nome: 'Comandante / DP-1',
              observacao: 'Homologação oficial do Plano Anual de Férias.',
            },
          });
        }
      }

      setFeedback({ type: 'success', msg: 'Todas as escalas aprovadas foram homologadas pela instância superior (Camada 2)!' });
      await loadPlano(ano);
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Falha na homologação superior.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Geração Automática em Lote
  const handleGerarLoteFerias = async () => {
    if (!window.confirm(`Deseja gerar automaticamente todos os lançamentos de férias de ${ano} no sistema SGP?`)) return;

    setActionLoading(true);
    try {
      const res = await base44.functions.invoke('portal_servicos', {
        acao: 'PLANO_GERAR_LOTE_FERIAS',
        ano_referencia: Number(ano),
      });

      setFeedback({ type: 'success', msg: res.data?.message || 'Férias geradas com sucesso no sistema!' });
      await loadPlano(ano);
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Falha na geração em lote.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Contagem de efetivo por mês para o gráfico
  const contagemPorMes = Array(12).fill(0);
  opcoes.forEach((op) => {
    const detalhes = op.decisao_camada_1_detalhes || op.opcao_1_detalhes;
    if (detalhes) {
      try {
        const pList = JSON.parse(detalhes);
        pList.forEach((p) => {
          const mNum = parseInt(p.mes || p.data_inicio?.slice(5, 7), 10);
          if (mNum >= 1 && mNum <= 12) contagemPorMes[mNum - 1]++;
        });
      } catch (_err) {}
    }
  });

  const totalHomologadasC2 = opcoes.filter((o) => o.status_camada_2 === 'Homologado_Superior').length;
  const totalGeradas = opcoes.filter((o) => o.gerado_ferias_efetivas).length;

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
        {/* BARRA SUPERIOR E SELETOR DE ANO */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shadow-inner">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-[#1e3a5f] tracking-tight flex items-center">
                Plano Anual de Férias — {ano}
              </h1>
              <p className="text-xs text-slate-500">
                Gestão e escalação em duas camadas: Unidade (Camada 1) e Comando Superior (Camada 2)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-xs font-bold text-slate-700">Ano do Plano:</label>
            <select
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
              className="h-10 px-3 bg-white border border-slate-300 rounded-xl text-xs font-bold text-[#1e3a5f] outline-none shadow-sm"
            >
              {[2026, 2027, 2028, 2029, 2030].map((y) => (
                <option key={y} value={y}>
                  Ano {y}
                </option>
              ))}
            </select>
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

        {/* CARDS DE STATS E AÇÕES PRINCIPAIS */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <Card className="border-slate-200 bg-white">
            <CardContent className="p-4 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-500 block">Opções Recebidas</span>
                <strong className="text-xl text-[#1e3a5f] font-extrabold">{opcoes.length}</strong>
              </div>
              <Users className="w-8 h-8 text-blue-500 opacity-30" />
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white">
            <CardContent className="p-4 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-500 block">Aprovadas na Unidade (C1)</span>
                <strong className="text-xl text-blue-700 font-extrabold">
                  {opcoes.filter((o) => o.status_camada_1 !== 'Pendente').length}
                </strong>
              </div>
              <ShieldCheck className="w-8 h-8 text-blue-500 opacity-30" />
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white">
            <CardContent className="p-4 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-500 block">Homologadas Superior (C2)</span>
                <strong className="text-xl text-emerald-700 font-extrabold">{totalHomologadasC2}</strong>
              </div>
              <CheckCircle2 className="w-8 h-8 text-emerald-500 opacity-30" />
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

        {/* DISTRIBUIÇÃO DE EFETIVO POR MÊS (EVITAR DESFALQUE OPERACIONAL) */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="p-4 pb-2 border-b border-slate-100">
            <CardTitle className="text-xs sm:text-sm font-bold text-slate-800 flex items-center">
              <Users className="w-4 h-4 mr-2 text-[#1e3a5f]" />
              Distribuição de Efetivo Previsto em Férias por Mês ({ano})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 text-xs">
            <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5 text-center">
              {MESES.map((m, idx) => {
                const count = contagemPorMes[idx];
                return (
                  <div
                    key={m}
                    className={`p-2 rounded-xl border ${
                      count > 0 ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <span className="text-[10px] text-slate-500 block truncate">{m.slice(0, 3)}</span>
                    <strong className={`text-sm ${count > 0 ? 'text-[#1e3a5f]' : 'text-slate-400'}`}>
                      {count}
                    </strong>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* AÇÕES DE HOMOLOGAÇÃO EM LOTE */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-blue-900 to-[#1e3a5f] p-4 rounded-2xl text-white shadow-md">
          <div>
            <h3 className="font-bold text-sm">Ações do Plano Anual</h3>
            <p className="text-xs text-blue-200">
              Homologue o plano superior ou gere todas as férias de forma automática
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              type="button"
              onClick={handleHomologarCamada2Geral}
              disabled={actionLoading || opcoes.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold h-9 px-3.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              Homologar Superior (Camada 2)
            </Button>

            <Button
              type="button"
              onClick={handleGerarLoteFerias}
              disabled={actionLoading || totalHomologadasC2 === 0}
              className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold h-9 px-3.5"
            >
              <Zap className="w-3.5 h-3.5 mr-1.5" />
              Gerar Férias no Sistema SGP
            </Button>
          </div>
        </div>

        {/* TABELA DE ESCALAÇÃO DOS MILITARES */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="p-4 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-slate-800 flex items-center">
              <Sliders className="w-4 h-4 mr-2 text-blue-600" />
              Relação de Militares & Escolha das 3 Opções
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Aprove a 1ª, 2ª ou 3ª preferência do militar ou ajuste o mês operacionalmente
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0 text-xs">
            {opcoes.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                Nenhum militar enviou opções de férias para o plano de {ano} até o momento.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {opcoes.map((op) => (
                  <div
                    key={op.id}
                    className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors"
                  >
                    {/* Militar Info */}
                    <div className="space-y-1 lg:w-1/3">
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-slate-900 text-sm">
                          {op.militar_posto} {op.militar_nome}
                        </span>
                        <span className="text-slate-400">• Mat: {op.militar_matricula || '-'}</span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Lotação: <strong className="text-slate-700">{op.lotacao_nome || 'Unidade'}</strong> | Período: {op.periodo_inicio} a {op.periodo_fim}
                      </p>
                      <div className="flex items-center space-x-1.5 pt-1">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          op.status_camada_2 === 'Homologado_Superior'
                            ? 'bg-emerald-100 text-emerald-800'
                            : op.status_camada_1 !== 'Pendente'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {op.status_camada_2 === 'Homologado_Superior'
                            ? 'Camada 2: Homologado'
                            : op.status_camada_1 !== 'Pendente'
                            ? `Camada 1: ${op.decisao_camada_1_opcao || 'Aprovado'}`
                            : 'Camada 1: Pendente'}
                        </span>
                        {op.gerado_ferias_efetivas && (
                          <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold">
                            Lançado no SGP
                          </span>
                        )}
                      </div>
                    </div>

                    {/* As 3 Opções Enviadas */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1 text-[11px]">
                      <div className={`p-2.5 rounded-xl border ${
                        op.decisao_camada_1_opcao === 'OPCAO_1' ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-500' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <div className="flex items-center justify-between pb-1">
                          <span className="font-bold text-slate-700 flex items-center">
                            <Medal className="w-3 h-3 text-amber-500 mr-1" /> 1ª Opção
                          </span>
                        </div>
                        <span className="font-semibold text-slate-900 block">{op.opcao_1_meses || '-'}</span>
                      </div>

                      <div className={`p-2.5 rounded-xl border ${
                        op.decisao_camada_1_opcao === 'OPCAO_2' ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-500' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <div className="flex items-center justify-between pb-1">
                          <span className="font-bold text-slate-700 flex items-center">
                            <Award className="w-3 h-3 text-slate-400 mr-1" /> 2ª Opção
                          </span>
                        </div>
                        <span className="font-semibold text-slate-900 block">{op.opcao_2_meses || '-'}</span>
                      </div>

                      <div className={`p-2.5 rounded-xl border ${
                        op.decisao_camada_1_opcao === 'OPCAO_3' ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-500' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <div className="flex items-center justify-between pb-1">
                          <span className="font-bold text-slate-700 flex items-center">
                            <Award className="w-3 h-3 text-amber-700 mr-1" /> 3ª Opção
                          </span>
                        </div>
                        <span className="font-semibold text-slate-900 block">{op.opcao_3_meses || '-'}</span>
                      </div>
                    </div>

                    {/* Botões de Ação do Gestor */}
                    <div className="flex items-center space-x-1.5 self-end lg:self-center">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleAprovarOpcaoCamada1(op, 'OPCAO_1')}
                        disabled={actionLoading}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs h-8 px-2.5"
                      >
                        <Check className="w-3 h-3 mr-1" />
                        Aprovar 1ª
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleAprovarOpcaoCamada1(op, 'OPCAO_2')}
                        disabled={actionLoading}
                        className="text-xs h-8 px-2.5"
                      >
                        Aprovar 2ª
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setModalAjuste({
                          open: true,
                          opcao: op,
                          mes1: '01',
                          mes2: '07',
                          justificativa: '',
                        })}
                        disabled={actionLoading}
                        className="text-xs h-8 px-2.5 text-blue-700 border-blue-200 hover:bg-blue-50"
                      >
                        <Edit3 className="w-3 h-3 mr-1" />
                        Ajustar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* MODAL DE AJUSTE DE MÊS PELO GESTOR */}
        {modalAjuste.open && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5 space-y-4 text-xs animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-800 text-sm flex items-center">
                  <Edit3 className="w-4 h-4 mr-2 text-blue-600" />
                  Ajustar Mês Operacional da Escala
                </h3>
                <button
                  type="button"
                  onClick={() => setModalAjuste({ open: false, opcao: null, mes1: '01', mes2: '07', justificativa: '' })}
                  className="text-slate-400 hover:text-slate-600 font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-slate-600">
                  Militar: <strong>{modalAjuste.opcao?.militar_posto} {modalAjuste.opcao?.militar_nome}</strong>
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 block">1ª Fração (Mês)</label>
                    <select
                      value={modalAjuste.mes1}
                      onChange={(e) => setModalAjuste({ ...modalAjuste, mes1: e.target.value })}
                      className="w-full h-9 px-2 border border-slate-300 rounded-lg text-xs font-semibold"
                    >
                      {MESES.map((m, idx) => {
                        const val = String(idx + 1).padStart(2, '0');
                        return <option key={val} value={val}>{m}</option>;
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-500 block">2ª Fração (Mês)</label>
                    <select
                      value={modalAjuste.mes2}
                      onChange={(e) => setModalAjuste({ ...modalAjuste, mes2: e.target.value })}
                      className="w-full h-9 px-2 border border-slate-300 rounded-lg text-xs font-semibold"
                    >
                      {MESES.map((m, idx) => {
                        const val = String(idx + 1).padStart(2, '0');
                        return <option key={val} value={val}>{m}</option>;
                      })}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 block">Justificativa Operacional</label>
                  <textarea
                    rows={2}
                    value={modalAjuste.justificativa}
                    onChange={(e) => setModalAjuste({ ...modalAjuste, justificativa: e.target.value })}
                    placeholder="Motivo da escala fora das opções do militar (ex: suprir escala de praia)."
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModalAjuste({ open: false, opcao: null, mes1: '01', mes2: '07', justificativa: '' })}
                  className="text-xs h-8"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSalvarAjusteGestor}
                  disabled={actionLoading}
                  className="bg-[#1e3a5f] hover:bg-[#2a4d7d] text-white text-xs h-8 px-4"
                >
                  Salvar Ajuste
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
