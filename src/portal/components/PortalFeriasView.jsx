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
  Edit3,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

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
  const [isEditing, setIsEditing] = useState(false);

  // Período selecionado
  const [selectedPeriodoId, setSelectedPeriodoId] = useState('');
  const [modalidade, setModalidade] = useState('2_ETAPAS_15');

  // 3 Meses de Opção (Sem seleção de dia; internamente sempre dia 01)
  const [mesOpcao1, setMesOpcao1] = useState('01');
  const [mesOpcao2, setMesOpcao2] = useState('07');
  const [mesOpcao3, setMesOpcao3] = useState('10');

  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await getFerias();
      setData(res);

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

      // Se o militar já havia enviado opções
      if (res?.opcao_militar_enviada) {
        const opEnviada = res.opcao_militar_enviada;
        if (opEnviada.modalidade) setModalidade(opEnviada.modalidade);
        setIsEditing(false);

        try {
          const p1 = JSON.parse(opEnviada.opcao_1_detalhes || '[]');
          if (p1[0]?.mes) setMesOpcao1(p1[0].mes);

          const p2 = JSON.parse(opEnviada.opcao_2_detalhes || '[]');
          if (p2[0]?.mes) setMesOpcao2(p2[0].mes);

          const p3 = JSON.parse(opEnviada.opcao_3_detalhes || '[]');
          if (p3[0]?.mes) setMesOpcao3(p3[0].mes);
        } catch (_err) {}
      } else {
        setIsEditing(true);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Falha ao carregar dados do plano de férias.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getNomeMes = (mesVal) => {
    return MESES_ANO.find((m) => m.valor === mesVal)?.nome || mesVal;
  };

  const buildParcelasForMes = (mesVal, ano) => {
    const dataInicio = `${ano}-${mesVal}-01`;

    if (modalidade === '1_ETAPA_30') {
      return [{ etapa: 1, dias: 30, mes: mesVal, data_inicio: dataInicio }];
    } else if (modalidade === '2_ETAPAS_15') {
      return [
        { etapa: 1, dias: 15, mes: mesVal, data_inicio: dataInicio },
        { etapa: 2, dias: 15, mes: mesVal, data_inicio: dataInicio },
      ];
    } else if (modalidade === '3_ETAPAS_10') {
      return [
        { etapa: 1, dias: 10, mes: mesVal, data_inicio: dataInicio },
        { etapa: 2, dias: 10, mes: mesVal, data_inicio: dataInicio },
        { etapa: 3, dias: 10, mes: mesVal, data_inicio: dataInicio },
      ];
    }
    return [{ etapa: 1, dias: 30, mes: mesVal, data_inicio: dataInicio }];
  };

  const handleSubmitOpcoes = async (e) => {
    e.preventDefault();
    if (!selectedPeriodoId) {
      setErrorMsg('Selecione o período aquisitivo.');
      return;
    }

    const campanha = data?.campanha;
    const anoCampanha = campanha?.ano_referencia || (new Date().getFullYear() + 1);

    if (mesOpcao1 === mesOpcao2 || mesOpcao1 === mesOpcao3 || mesOpcao2 === mesOpcao3) {
      if (!window.confirm('Você selecionou meses iguais para diferentes opções. Deseja manter mesmo assim?')) {
        return;
      }
    }

    setSubmitting(true);
    setErrorMsg(null);

    const descModalidade =
      modalidade === '1_ETAPA_30'
        ? 'Integral (30 dias)'
        : modalidade === '2_ETAPAS_15'
        ? '2 Frações (15 + 15 dias)'
        : '3 Frações (10 + 10 + 10 dias)';

    const payload = {
      periodo_aquisitivo_id: selectedPeriodoId,
      ano_referencia: anoCampanha,
      campanha_id: campanha?.id,
      modalidade,
      opcao_1: {
        meses_resumo: `${getNomeMes(mesOpcao1)} • ${descModalidade}`,
        parcelas: buildParcelasForMes(mesOpcao1, anoCampanha),
      },
      opcao_2: {
        meses_resumo: `${getNomeMes(mesOpcao2)} • ${descModalidade}`,
        parcelas: buildParcelasForMes(mesOpcao2, anoCampanha),
      },
      opcao_3: {
        meses_resumo: `${getNomeMes(mesOpcao3)} • ${descModalidade}`,
        parcelas: buildParcelasForMes(mesOpcao3, anoCampanha),
      },
    };

    try {
      const res = await submeterOpcaoFerias(payload);
      setSuccessMsg(res.message || `Opções para o Plano de ${anoCampanha} registradas com sucesso!`);
      setIsEditing(false);
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
        <p className="text-sm text-slate-500 font-medium">Carregando plano de férias...</p>
      </div>
    );
  }

  const campanha = data?.campanha;
  const periodoMaisAntigo = (data?.periodos || []).find((p) => p.is_mais_antigo_pendente);
  const opcaoEnviada = data?.opcao_militar_enviada;
  const anoCampanha = campanha?.ano_referencia || (new Date().getFullYear() + 1);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      {/* BARRA SUPERIOR */}
      <div className="flex items-center space-x-3 pb-2 border-b border-slate-200">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-slate-600 hover:text-slate-900 rounded-xl"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Voltar
        </Button>
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-[#1e3a5f] flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-emerald-700" />
            {campanha ? campanha.titulo : 'Plano Anual de Férias'}
          </h2>
          <p className="text-xs text-slate-500">
            {campanha ? `Prazo para envio: até ${campanha.data_fim_militar || 'o encerramento da campanha'}` : 'Autoatendimento CBMMS'}
          </p>
        </div>
      </div>

      {/* FEEDBACK ALERTS */}
      {successMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center space-x-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* CASO 1: NENHUMA CAMPANHA ATIVA NO MOMENTO */}
      {!campanha ? (
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="p-8 sm:p-12 text-center space-y-4">
            <div className="w-14 h-14 rounded-3xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 mx-auto">
              <Clock className="w-7 h-7" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="font-extrabold text-slate-800 text-base">
                Nenhuma Campanha de Férias Aberta no Momento
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                A coleta de preferências para o próximo Plano Anual de Férias ainda não foi iniciada ou foi encerrada para a sua unidade. Quando o RH/Comando abrir o período de opções, ela será liberada aqui automaticamente.
              </p>
            </div>

            {/* Consulta Informativa do Período mais Antigo */}
            {periodoMaisAntigo && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 max-w-lg mx-auto text-left text-xs space-y-1">
                <span className="font-bold text-slate-700 flex items-center">
                  <Info className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                  Seu Período Aquisitivo Mais Antigo Pendente:
                </span>
                <p className="text-slate-600 text-[11px]">
                  Período: <strong>{periodoMaisAntigo.inicio_aquisitivo}</strong> até <strong>{periodoMaisAntigo.fim_aquisitivo}</strong> • Saldo: <strong>{periodoMaisAntigo.saldo_disponivel || 30} dias de direito</strong>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* CASO 2: CAMPANHA ATIVA */
        <div className="space-y-6">
          {/* INSTRUÇÕES DO COMANDO */}
          {campanha.instrucoes && (
            <Card className="border-blue-100 bg-blue-50/50 shadow-none">
              <CardContent className="p-4 flex items-start space-x-3 text-xs text-blue-900">
                <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold block">Instruções do Comando da Unidade:</span>
                  <p className="text-blue-800 text-[11px] leading-relaxed">{campanha.instrucoes}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* COMPROVANTE DAS OPÇÕES JÁ REGISTRADAS (SE JÁ ENVIOU E NÃO ESTÁ EM MODO DE EDIÇÃO) */}
          {opcaoEnviada && !isEditing && (
            <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-white shadow-sm overflow-hidden">
              <CardHeader className="p-4 sm:p-5 pb-3 border-b border-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <CardTitle className="text-sm sm:text-base font-bold text-emerald-950">
                        Opções Registradas para o Plano de {anoCampanha}
                      </CardTitle>
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 border border-amber-200 text-amber-800 text-[10px] font-bold">
                        {opcaoEnviada.status_camada_2 === 'Homologado_Superior'
                          ? 'Homologado Superior'
                          : opcaoEnviada.status_camada_1?.replace(/_/g, ' ') || 'Aguardando Análise do Gestor'}
                      </span>
                    </div>
                    <CardDescription className="text-xs text-emerald-800">
                      Enviado em: {new Date(opcaoEnviada.data_envio_militar || opcaoEnviada.created_date).toLocaleDateString('pt-BR')}
                    </CardDescription>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="border-emerald-300 text-emerald-900 hover:bg-emerald-100 rounded-xl text-xs h-9 font-semibold"
                >
                  <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                  Alterar Minhas Opções
                </Button>
              </CardHeader>

              <CardContent className="p-4 sm:p-5 text-xs space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="p-3 bg-white rounded-xl border border-emerald-100 shadow-2xs space-y-1">
                    <span className="font-bold text-emerald-800 flex items-center text-[11px]">
                      <Star className="w-3 h-3 mr-1 text-emerald-600 fill-emerald-600" />
                      1ª Opção (Preferencial)
                    </span>
                    <strong className="text-sm text-slate-800 block">
                      {opcaoEnviada.opcao_1_meses || 'Não informada'}
                    </strong>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
                    <span className="font-semibold text-slate-600 text-[11px] block">
                      2ª Opção (Alternativa A)
                    </span>
                    <strong className="text-sm text-slate-800 block">
                      {opcaoEnviada.opcao_2_meses || 'Não informada'}
                    </strong>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
                    <span className="font-semibold text-slate-600 text-[11px] block">
                      3ª Opção (Alternativa B)
                    </span>
                    <strong className="text-sm text-slate-800 block">
                      {opcaoEnviada.opcao_3_meses || 'Não informada'}
                    </strong>
                  </div>
                </div>

                <div className="p-3 bg-emerald-50/60 rounded-xl text-[11px] text-emerald-900 border border-emerald-100">
                  <span>
                    Modalidade selecionada: <strong>
                      {opcaoEnviada.modalidade === '1_ETAPA_30'
                        ? 'Integral (30 dias)'
                        : opcaoEnviada.modalidade === '2_ETAPAS_15'
                        ? '2 Frações (15 + 15 dias)'
                        : '3 Frações (10 + 10 + 10 dias)'}
                    </strong>. As frações serão escaladas pelo gestor da unidade dentro dos 3 meses escolhidos acima.
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* DESTAQUE DO PERÍODO AQUISITIVO VINCULADO (MAIS ANTIGO) */}
          {periodoMaisAntigo && (
            <Card className="border-2 border-emerald-500 bg-emerald-50/20 shadow-sm rounded-2xl sm:rounded-3xl">
              <CardHeader className="p-4 sm:p-5 pb-2 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-700 text-white font-bold text-xs flex items-center shadow-xs">
                    <Star className="w-3.5 h-3.5 mr-1 fill-white" />
                    Período Aquisitivo Vinculado a este Plano (Mais Antigo)
                  </span>
                </div>
                <span className="text-xs font-bold text-emerald-900">
                  Saldo: {periodoMaisAntigo.saldo_disponivel || 30} dias de direito
                </span>
              </CardHeader>
              <CardContent className="p-4 sm:p-5 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-emerald-200">
                    <span className="text-slate-500 block text-[11px]">Início do Período</span>
                    <strong className="text-slate-800 text-sm">{periodoMaisAntigo.inicio_aquisitivo}</strong>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-emerald-200">
                    <span className="text-slate-500 block text-[11px]">Fim do Período</span>
                    <strong className="text-slate-800 text-sm">{periodoMaisAntigo.fim_aquisitivo}</strong>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-emerald-200">
                    <span className="text-slate-500 block text-[11px]">Data Limite para Fruição</span>
                    <strong className="text-emerald-800 text-sm font-extrabold">{periodoMaisAntigo.limite_fruicao || `${anoCampanha}-12-31`}</strong>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* FORMULÁRIO DE ESCOLHA DOS 3 MESES DE FÉRIAS (EXIBE SE NÃO TEM OPÇÃO OU CLICOU EM ALTERAR) */}
          {(isEditing || !opcaoEnviada) && (
            <Card className="border-slate-200 shadow-sm bg-white rounded-2xl sm:rounded-3xl">
              <CardHeader className="p-4 sm:p-5 border-b border-slate-100 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm sm:text-base font-bold text-slate-900 flex items-center">
                    <Calendar className="w-4 h-4 mr-2 text-emerald-700" />
                    Escolha de Modalidade & 3 Meses de Preferência
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Indique a modalidade e selecione 3 opções de meses para a escala do Plano de {anoCampanha}
                  </CardDescription>
                </div>
                {opcaoEnviada && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditing(false)}
                    className="text-xs text-slate-500 hover:text-slate-800 rounded-xl"
                  >
                    Cancelar Edição
                  </Button>
                )}
              </CardHeader>

              <form onSubmit={handleSubmitOpcoes} className="p-4 sm:p-6 space-y-6">
                {/* 1. SELEÇÃO DE MODALIDADE */}
                <div className="space-y-2">
                  <label className="font-bold text-slate-800 text-xs block">
                    1. Modalidade de Parcelamento das Férias:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                    {[
                      { id: '1_ETAPA_30', label: 'Integral (30 dias em 1 mês)' },
                      { id: '2_ETAPAS_15', label: '2 Frações (15 + 15 dias)' },
                      { id: '3_ETAPAS_10', label: '3 Frações (10 + 10 + 10 dias)' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setModalidade(m.id)}
                        className={`p-3 rounded-2xl border text-xs font-semibold text-center transition-all ${
                          modalidade === m.id
                            ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white shadow-md'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. SELEÇÃO DOS 3 MESES DE OPÇÃO (1ª, 2ª E 3ª PREFERÊNCIA) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800 text-xs block">
                      2. Suas 3 Opções de Meses no Ano de {anoCampanha}:
                    </label>
                    <span className="text-[11px] text-slate-500">
                      As frações serão distribuídas dentro desses 3 meses
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* 1ª OPÇÃO */}
                    <div className="p-4 bg-emerald-50/40 rounded-2xl border-2 border-emerald-200 space-y-3">
                      <div className="flex items-center space-x-1.5 text-emerald-900 font-bold text-xs">
                        <Star className="w-4 h-4 text-emerald-600 fill-emerald-600" />
                        <span>1ª Opção (Preferencial)</span>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">Mês Pretendido</label>
                        <select
                          value={mesOpcao1}
                          onChange={(e) => setMesOpcao1(e.target.value)}
                          className="w-full h-11 px-3 bg-white border border-emerald-300 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          {MESES_ANO.map((m) => (
                            <option key={m.valor} value={m.valor}>
                              {m.nome} / {anoCampanha}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* 2ª OPÇÃO */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                      <div className="flex items-center space-x-1.5 text-slate-800 font-bold text-xs">
                        <span>2ª Opção (Alternativa A)</span>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">Mês Pretendido</label>
                        <select
                          value={mesOpcao2}
                          onChange={(e) => setMesOpcao2(e.target.value)}
                          className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                        >
                          {MESES_ANO.map((m) => (
                            <option key={m.valor} value={m.valor}>
                              {m.nome} / {anoCampanha}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* 3ª OPÇÃO */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                      <div className="flex items-center space-x-1.5 text-slate-800 font-bold text-xs">
                        <span>3ª Opção (Alternativa B)</span>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">Mês Pretendido</label>
                        <select
                          value={mesOpcao3}
                          onChange={(e) => setMesOpcao3(e.target.value)}
                          className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                        >
                          {MESES_ANO.map((m) => (
                            <option key={m.valor} value={m.valor}>
                              {m.nome} / {anoCampanha}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
                  <p className="text-[11px] text-slate-500">
                    * Ao confirmar, suas opções serão enviadas para elaboração da escala pelo gestor (início fixado em dia 01).
                  </p>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold h-10 px-6 shadow-md"
                  >
                    {submitting ? (
                      <RefreshCw className="w-4 h-4 animate-spin mr-1.5" />
                    ) : (
                      <Send className="w-4 h-4 mr-1.5" />
                    )}
                    {opcaoEnviada ? 'Salvar Alterações das Opções' : 'Registrar Minhas 3 Opções de Férias'}
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
