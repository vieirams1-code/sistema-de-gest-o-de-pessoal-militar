import React, { useState, useEffect } from 'react';
import { getFerias, submeterOpcaoFerias } from '../api/PortalApiClient';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  Send,
  Star,
  Info,
  Medal,
  Award,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

const MESES_ANO = [
  { valor: '01', nome: 'Janeiro' },
  { valor: '02', nome: 'Fevereiro' },
  { valor: '03', nome: 'Março' },
  { valor: '04', nome: 'Abril' },
  { valor: '05', nome: 'Maio' },
  { valor: '06', nome: 'Junho' },
  { valor: '07', nome: 'Julho' },
  { valor: '08', nome: 'Agosto' },
  { valor: '09', nome: 'Setembro' },
  { valor: '10', nome: 'Outubro' },
  { valor: '11', nome: 'Novembro' },
  { valor: '12', nome: 'Dezembro' },
];

export default function PortalFeriasView({ onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Ano da Campanha
  const [anoReferencia, setAnoReferencia] = useState(new Date().getFullYear() + 1);

  // Período selecionado
  const [selectedPeriodoId, setSelectedPeriodoId] = useState('');
  const [modalidade, setModalidade] = useState('2_ETAPAS_15');

  // Aba ativa das 3 opções (1, 2 ou 3)
  const [activeTabOpcao, setActiveTabOpcao] = useState(1);

  // 3 Preferências completas
  const [opcao1, setOpcao1] = useState({
    parcelas: [
      { etapa: 1, dias: 15, mes: '01', data_inicio: `${anoReferencia}-01-05` },
      { etapa: 2, dias: 15, mes: '07', data_inicio: `${anoReferencia}-07-05` }
    ]
  });

  const [opcao2, setOpcao2] = useState({
    parcelas: [
      { etapa: 1, dias: 15, mes: '02', data_inicio: `${anoReferencia}-02-05` },
      { etapa: 2, dias: 15, mes: '08', data_inicio: `${anoReferencia}-08-05` }
    ]
  });

  const [opcao3, setOpcao3] = useState({
    parcelas: [
      { etapa: 1, dias: 15, mes: '03', data_inicio: `${anoReferencia}-03-05` },
      { etapa: 2, dias: 15, mes: '09', data_inicio: `${anoReferencia}-09-05` }
    ]
  });

  const [submitting, setSubmitting] = useState(false);

  const initParcelasForModalidade = (modo, ano, offset = 0) => {
    if (modo === '1_ETAPA_30') {
      const mesNum = String(((1 + offset - 1) % 12) + 1).padStart(2, '0');
      return [{ etapa: 1, dias: 30, mes: mesNum, data_inicio: `${ano}-${mesNum}-05` }];
    } else if (modo === '2_ETAPAS_15') {
      const mes1 = String(((1 + offset - 1) % 12) + 1).padStart(2, '0');
      const mes2 = String(((7 + offset - 1) % 12) + 1).padStart(2, '0');
      return [
        { etapa: 1, dias: 15, mes: mes1, data_inicio: `${ano}-${mes1}-05` },
        { etapa: 2, dias: 15, mes: mes2, data_inicio: `${ano}-${mes2}-05` },
      ];
    } else if (modo === '3_ETAPAS_10') {
      const mes1 = String(((1 + offset - 1) % 12) + 1).padStart(2, '0');
      const mes2 = String(((5 + offset - 1) % 12) + 1).padStart(2, '0');
      const mes3 = String(((9 + offset - 1) % 12) + 1).padStart(2, '0');
      return [
        { etapa: 1, dias: 10, mes: mes1, data_inicio: `${ano}-${mes1}-05` },
        { etapa: 2, dias: 10, mes: mes2, data_inicio: `${ano}-${mes2}-05` },
        { etapa: 3, dias: 10, mes: mes3, data_inicio: `${ano}-${mes3}-05` },
      ];
    }
    return [{ etapa: 1, dias: 30, mes: '01', data_inicio: `${ano}-01-05` }];
  };

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await getFerias();
      setData(res);

      const ano = res?.ano_referencia || (new Date().getFullYear() + 1);
      setAnoReferencia(ano);

      if (res?.periodo_mais_antigo_id) {
        setSelectedPeriodoId(res.periodo_mais_antigo_id);
      } else {
        const periodosDisponiveis = (res?.periodos || []).filter(
          (p) => p.status !== 'Inativo' && (p.saldo_disponivel > 0 || (p.dias_direito || 30) > (p.dias_gozados || 0))
        );
        if (periodosDisponiveis.length > 0) {
          setSelectedPeriodoId(periodosDisponiveis[0].id);
        }
      }

      // Se o militar já havia enviado opções anteriormente, carrega
      if (res?.opcao_militar_enviada) {
        const opEnviada = res.opcao_militar_enviada;
        if (opEnviada.modalidade) setModalidade(opEnviada.modalidade);
        try {
          if (opEnviada.opcao_1_detalhes) setOpcao1({ parcelas: JSON.parse(opEnviada.opcao_1_detalhes) });
          if (opEnviada.opcao_2_detalhes) setOpcao2({ parcelas: JSON.parse(opEnviada.opcao_2_detalhes) });
          if (opEnviada.opcao_3_detalhes) setOpcao3({ parcelas: JSON.parse(opEnviada.opcao_3_detalhes) });
        } catch (_err) {}
      } else {
        // Inicializa opções com valores padrão
        setOpcao1({ parcelas: initParcelasForModalidade('2_ETAPAS_15', ano, 0) });
        setOpcao2({ parcelas: initParcelasForModalidade('2_ETAPAS_15', ano, 1) });
        setOpcao3({ parcelas: initParcelasForModalidade('2_ETAPAS_15', ano, 2) });
      }
    } catch (err) {
      setErrorMsg(err.message || 'Falha ao carregar períodos de férias.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleModalidadeChange = (modo) => {
    setModalidade(modo);
    setOpcao1({ parcelas: initParcelasForModalidade(modo, anoReferencia, 0) });
    setOpcao2({ parcelas: initParcelasForModalidade(modo, anoReferencia, 1) });
    setOpcao3({ parcelas: initParcelasForModalidade(modo, anoReferencia, 2) });
  };

  const handleParcelaFieldChange = (opcaoIdx, parcelaIdx, field, value) => {
    let setter = setOpcao1;
    let curr = opcao1;
    if (opcaoIdx === 2) {
      setter = setOpcao2;
      curr = opcao2;
    } else if (opcaoIdx === 3) {
      setter = setOpcao3;
      curr = opcao3;
    }

    const updatedParcelas = [...curr.parcelas];
    const item = { ...updatedParcelas[parcelaIdx] };

    if (field === 'mes') {
      item.mes = value;
      item.data_inicio = `${anoReferencia}-${value}-05`;
    } else if (field === 'data_inicio') {
      item.data_inicio = value;
      if (value && value.length >= 7) {
        item.mes = value.slice(5, 7);
      }
    } else if (field === 'dias') {
      item.dias = Number(value);
    }

    updatedParcelas[parcelaIdx] = item;
    setter({ parcelas: updatedParcelas });
  };

  const formatMesesResumo = (parcelas) => {
    return (parcelas || []).map((p) => {
      const mesObj = MESES_ANO.find((m) => m.valor === p.mes);
      return `${mesObj?.nome || p.mes} (${p.dias}d)`;
    }).join(' + ');
  };

  const handleSubmitOpcoes = async (e) => {
    e.preventDefault();
    if (!selectedPeriodoId) {
      setErrorMsg('Selecione o período aquisitivo de direito.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    const payload = {
      periodo_aquisitivo_id: selectedPeriodoId,
      ano_referencia: anoReferencia,
      modalidade,
      opcao_1: {
        meses_resumo: formatMesesResumo(opcao1.parcelas),
        parcelas: opcao1.parcelas,
      },
      opcao_2: {
        meses_resumo: formatMesesResumo(opcao2.parcelas),
        parcelas: opcao2.parcelas,
      },
      opcao_3: {
        meses_resumo: formatMesesResumo(opcao3.parcelas),
        parcelas: opcao3.parcelas,
      },
    };

    try {
      const res = await submeterOpcaoFerias(payload);
      setSuccessMsg(res.message || 'Suas 3 opções de férias foram registradas com sucesso!');
      await loadData();
    } catch (err) {
      setErrorMsg(err.message || 'Falha ao registrar opções de férias.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-[#1e3a5f] rounded-full animate-spin"></div>
        <p className="text-sm text-slate-500 font-medium">Carregando plano de férias {anoReferencia}...</p>
      </div>
    );
  }

  const periodos = data?.periodos || [];
  const ferias = data?.ferias || [];
  const config = data?.config || {};
  const opcaoEnviada = data?.opcao_militar_enviada;
  const periodoMaisAntigo = periodos.find((p) => p.is_mais_antigo_pendente);

  const currentOpcaoState = activeTabOpcao === 1 ? opcao1 : activeTabOpcao === 2 ? opcao2 : opcao3;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      {/* BARRA SUPERIOR */}
      <div className="flex items-center space-x-3 pb-2 border-b border-slate-200">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="h-9 px-2 text-slate-600 hover:text-[#1e3a5f] hover:bg-slate-100 rounded-xl"
        >
          <ArrowLeft className="w-5 h-5 mr-1" />
          Voltar
        </Button>
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-emerald-700" />
            Plano Anual de Férias — {anoReferencia}
          </h2>
          <p className="text-xs text-slate-500">
            Informe suas 3 preferências de meses para a elaboração da escala anual da corporação
          </p>
        </div>
      </div>

      {/* FEEDBACK ALERTS */}
      {errorMsg && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-start space-x-2">
          <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* STATUS DA OPÇÃO JÁ ENVIADA */}
      {opcaoEnviada && (
        <Card className="border-blue-200 bg-blue-50/60 shadow-sm rounded-2xl">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-[#1e3a5f] text-sm flex items-center">
                  <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-600" />
                  Opções Registradas para o Plano de {anoReferencia}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  opcaoEnviada.status_camada_2 === 'Homologado_Superior'
                    ? 'bg-emerald-600 text-white'
                    : opcaoEnviada.status_camada_1?.includes('Aprovada')
                    ? 'bg-blue-600 text-white'
                    : 'bg-amber-500 text-white'
                }`}>
                  {opcaoEnviada.status_camada_2 === 'Homologado_Superior'
                    ? 'Homologado pelo Comando'
                    : opcaoEnviada.status_camada_1 !== 'Pendente'
                    ? `Aprovado na Unidade (${opcaoEnviada.decisao_camada_1_opcao || ''})`
                    : 'Aguardando Análise do Gestor (Camada 1)'}
                </span>
              </div>
              <p className="text-slate-600">
                1ª Opção: <strong>{opcaoEnviada.opcao_1_meses}</strong> | 2ª Opção: <strong>{opcaoEnviada.opcao_2_meses}</strong> | 3ª Opção: <strong>{opcaoEnviada.opcao_3_meses}</strong>
              </p>
            </div>
            <span className="text-[11px] text-slate-500 self-end sm:self-center">
              Enviado em: {new Date(opcaoEnviada.data_envio_militar || opcaoEnviada.created_date || Date.now()).toLocaleDateString('pt-BR')}
            </span>
          </CardContent>
        </Card>
      )}

      {/* ORIENTAÇÃO / INSTRUÇÕES DO ADMINISTRADOR */}
      {config.instrucoes && (
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-start space-x-3 text-xs text-[#1e3a5f]">
          <Info className="w-5 h-5 text-[#1e3a5f] flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold block">Instruções do Comando da Unidade:</span>
            <p className="text-slate-700 leading-relaxed">{config.instrucoes}</p>
            {config.prazo_limite && (
              <p className="font-semibold text-emerald-800 pt-1">
                ⏳ Prazo final de envio: <strong>{new Date(config.prazo_limite).toLocaleDateString('pt-BR')}</strong>
              </p>
            )}
          </div>
        </div>
      )}

      {/* CARD DE DESTAQUE: PERÍODO AQUISITIVO MAIS ANTIGO */}
      {periodoMaisAntigo && (
        <Card className="border-2 border-emerald-600 bg-gradient-to-br from-emerald-50/70 to-emerald-100/30 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="p-4 sm:p-5 pb-2 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center shadow-sm">
                <Star className="w-3.5 h-3.5 mr-1 fill-white" />
                Período Aquisitivo Vinculado a este Plano (Mais Antigo)
              </span>
            </div>
            <span className="text-xs font-bold text-emerald-800">
              Saldo: {periodoMaisAntigo.saldo_disponivel} dias de direito
            </span>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-2 space-y-2 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200">
                <span className="text-slate-500 block text-[11px]">Início do Período</span>
                <strong className="text-slate-800 text-sm">{periodoMaisAntigo.inicio_aquisitivo || '-'}</strong>
              </div>
              <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200">
                <span className="text-slate-500 block text-[11px]">Fim do Período</span>
                <strong className="text-slate-800 text-sm">{periodoMaisAntigo.fim_aquisitivo || '-'}</strong>
              </div>
              <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200">
                <span className="text-slate-500 block text-[11px]">Data Limite para Fruição</span>
                <strong className="text-amber-700 text-sm">{periodoMaisAntigo.data_limite_gozo || '-'}</strong>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* FORMULÁRIO DE 3 OPÇÕES DE PREFERÊNCIAS */}
      <Card className="border-slate-200 shadow-md">
        <CardHeader className="p-4 sm:p-5 border-b border-slate-100">
          <CardTitle className="text-sm sm:text-base font-bold text-[#1e3a5f] flex items-center">
            <Calendar className="w-4 h-4 mr-2 text-emerald-700" />
            Escolha de Modalidade & 3 Preferências de Meses
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Selecione a modalidade e indique suas 3 opções de meses em ordem de preferência
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmitOpcoes}>
          <CardContent className="p-4 sm:p-6 space-y-5 text-xs">
            {/* Modalidade de Fracionamento */}
            <div className="space-y-2">
              <label className="font-semibold text-slate-700 block">Modalidade de Parcelamento</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: '1_ETAPA_30', label: 'Integral (30 dias em 1 mês)' },
                  { id: '2_ETAPAS_15', label: '2 Frações (15 + 15 dias em 2 meses)' },
                  { id: '3_ETAPAS_10', label: '3 Frações (10 + 10 + 10 dias em 3 meses)' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleModalidadeChange(m.id)}
                    className={`p-3 rounded-xl border text-center font-medium transition-all text-xs ${
                      modalidade === m.id
                        ? 'border-[#1e3a5f] bg-blue-50/70 text-[#1e3a5f] font-bold ring-2 ring-[#1e3a5f]'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* SELETOR DE ABAS: 1ª, 2ª E 3ª OPÇÃO */}
            <div className="space-y-3 pt-2">
              <div className="flex border-b border-slate-200 gap-2">
                {[
                  { idx: 1, label: '1ª Opção (Preferencial)', icon: Medal, color: 'text-amber-500' },
                  { idx: 2, label: '2ª Opção (Alternativa A)', icon: Award, color: 'text-slate-400' },
                  { idx: 3, label: '3ª Opção (Alternativa B)', icon: Award, color: 'text-amber-700' },
                ].map((op) => {
                  const Icon = op.icon;
                  return (
                    <button
                      key={op.idx}
                      type="button"
                      onClick={() => setActiveTabOpcao(op.idx)}
                      className={`px-3 py-2.5 rounded-t-xl text-xs font-bold flex items-center space-x-1.5 transition-all border-b-2 ${
                        activeTabOpcao === op.idx
                          ? 'border-[#1e3a5f] text-[#1e3a5f] bg-blue-50/50'
                          : 'border-transparent text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${op.color}`} />
                      <span>{op.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* CAMPOS DA OPÇÃO ATIVA */}
              <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-xs">
                    {activeTabOpcao === 1 ? '🥇 1ª Opção de Preferência'
                      : activeTabOpcao === 2 ? '🥈 2ª Opção (Alternativa A)'
                      : '🥉 3ª Opção (Alternativa B)'}
                  </span>
                  <span className="text-emerald-700 font-semibold text-xs">
                    Resumo: {formatMesesResumo(currentOpcaoState.parcelas)}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {currentOpcaoState.parcelas.map((p, pIdx) => (
                    <div
                      key={pIdx}
                      className="p-3 bg-white rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="w-6 h-6 rounded-full bg-[#1e3a5f] text-white flex items-center justify-center text-[11px] font-bold">
                          {p.etapa}
                        </span>
                        <span className="font-bold text-slate-800 text-xs">
                          {p.etapa}ª Etapa ({p.dias} dias)
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 flex-1 sm:justify-end">
                        {/* Seletor de Mês */}
                        <div className="w-36">
                          <label className="text-[10px] text-slate-500 block">Mês Pretendido</label>
                          <select
                            value={p.mes}
                            onChange={(e) => handleParcelaFieldChange(activeTabOpcao, pIdx, 'mes', e.target.value)}
                            className="w-full h-9 px-2 text-xs font-semibold rounded-lg bg-white border border-slate-300 outline-none"
                          >
                            {MESES_ANO.map((m) => (
                              <option key={m.valor} value={m.valor}>
                                {m.nome} / {anoReferencia}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Data Início Prevista */}
                        <div className="flex-1 sm:max-w-xs">
                          <label className="text-[10px] text-slate-500 block">Data de Início Prevista</label>
                          <Input
                            type="date"
                            value={p.data_inicio}
                            onChange={(e) => handleParcelaFieldChange(activeTabOpcao, pIdx, 'data_inicio', e.target.value)}
                            required
                            className="h-9 text-xs rounded-lg bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-b-xl">
            <span className="text-[11px] text-slate-500">
              * Ao submeter, suas 3 preferências serão enviadas para escalação do gestor da unidade.
            </span>

            <Button
              type="submit"
              disabled={submitting}
              className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-sm h-10 px-5"
            >
              {submitting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
              ) : (
                <Send className="w-3.5 h-3.5 mr-1.5" />
              )}
              Registrar Minhas 3 Opções de Férias
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
