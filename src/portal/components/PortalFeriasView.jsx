import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Lock,
  ChevronRight,
  UserCheck,
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

function formatarDataBR(dataStr) {
  if (!dataStr) return '-';
  const str = String(dataStr).trim();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  return str;
}

export default function PortalFeriasView({ onBack }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  // Período selecionado
  const [selectedPeriodoId, setSelectedPeriodoId] = useState('');
  const [modalidade, setModalidade] = useState('2_ETAPAS_15');

  // 3 Meses de Opção (Iniciam em branco, sem seleção prévia)
  const [mesOpcao1, setMesOpcao1] = useState('');
  const [mesOpcao2, setMesOpcao2] = useState('');
  const [mesOpcao3, setMesOpcao3] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await getFerias();
      setData(res);

      if (res?.periodo_mais_antigo_id) {
        setSelectedPeriodoId(res.periodo_mais_antigo_id);
        const periodoPlano = (res?.periodos || []).find((p) => p.id === res.periodo_mais_antigo_id);
        if (periodoPlano && Number(periodoPlano.dias_sem_previsao || 0) !== 30) {
          setModalidade('CUSTOM');
        }
      } else {
        setSelectedPeriodoId('');
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
        setMesOpcao1('');
        setMesOpcao2('');
        setMesOpcao3('');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Falha ao carregar informações de férias.');
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
    const periodoPlano = (data?.periodos || []).find((p) => p.id === selectedPeriodoId);
    const regraMes = (periodoPlano?.meses_elegiveis || []).find((m) => m.mes === mesVal);
    const diasPlanejar = Number(periodoPlano?.dias_sem_previsao || periodoPlano?.saldo_disponivel || 30);
    const dataInicio = regraMes?.data_inicio || `${ano}-${mesVal}-01`;

    // Cada opção representa uma preferência alternativa de mês. O fracionamento
    // (30, 15+15 ou 10+10+10) será efetivamente distribuído pelo gestor na escala.
    return [{ etapa: 1, dias: diasPlanejar, mes: mesVal, data_inicio: dataInicio }];
  };

  const handleSubmeter = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!selectedPeriodoId) {
      setErrorMsg('Selecione o período aquisitivo de férias.');
      return;
    }

    if (!mesOpcao1 || !mesOpcao2 || !mesOpcao3) {
      setErrorMsg('É obrigatório escolher as 3 opções de meses.');
      return;
    }

    // Validação: os 3 meses de preferência devem ser diferentes
    if (mesOpcao1 === mesOpcao2 || mesOpcao1 === mesOpcao3 || mesOpcao2 === mesOpcao3) {
      setErrorMsg('As 3 opções de preferência de meses devem ser diferentes entre si (1ª, 2ª e 3ª opção).');
      return;
    }

    const campanha = data?.campanha;
    const anoCampanha = campanha?.ano_referencia || (new Date().getFullYear() + 1);

    const payload = {
      periodo_aquisitivo_id: selectedPeriodoId,
      ano_referencia: anoCampanha,
      campanha_id: campanha?.id,
      modalidade,
      opcao_1: {
        meses_resumo: `${getNomeMes(mesOpcao1)}`,
        parcelas: buildParcelasForMes(mesOpcao1, anoCampanha),
      },
      opcao_2: {
        meses_resumo: `${getNomeMes(mesOpcao2)}`,
        parcelas: buildParcelasForMes(mesOpcao2, anoCampanha),
      },
      opcao_3: {
        meses_resumo: `${getNomeMes(mesOpcao3)}`,
        parcelas: buildParcelasForMes(mesOpcao3, anoCampanha),
      },
    };

    setSubmitting(true);
    try {
      const res = await submeterOpcaoFerias(payload);
      setSuccessMsg(res.message || 'Opção de férias registrada com sucesso!');
      setIsEditing(false);
      await loadData();
    } catch (err) {
      setErrorMsg(err.message || 'Falha ao salvar opção de férias.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin"></div>
        <p className="text-sm text-slate-500 font-medium">Carregando plano de férias...</p>
      </div>
    );
  }

  const campanha = data?.campanha;
  const periodoMaisAntigo = (data?.periodos || []).find((p) => p.is_mais_antigo_pendente);
  const opcaoEnviada = data?.opcao_militar_enviada;
  const anoCampanha = campanha?.ano_referencia || (new Date().getFullYear() + 1);
  const isBloqueadoPorDependencia = Boolean(data?.bloqueado_por_dependencia);

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
            {campanha ? `Prazo para envio: até ${campanha.data_fim_militar || 'o encerramento da campanha'}` : 'Autoatendimento VIVICAS'}
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

      {/* CASO 0: BLOQUEIO POR DEPENDÊNCIA EM CASCATA */}
      {isBloqueadoPorDependencia ? (
        <Card className="border-amber-200 bg-gradient-to-b from-amber-50/60 to-white shadow-md rounded-2xl sm:rounded-3xl overflow-hidden">
          <CardContent className="p-6 sm:p-10 space-y-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800 shrink-0 shadow-sm">
                <Lock className="w-7 h-7" />
              </div>
              <div className="space-y-1.5 flex-1">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-200/80 border border-amber-300 text-amber-900 text-[11px] font-extrabold uppercase tracking-wide inline-block">
                  🔒 Etapa Obrigatória Prévia
                </span>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                  Conclua sua Atualização Cadastral para Liberar o Plano de Férias
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Para registrar suas opções de meses de férias para o <strong>Plano {anoCampanha}</strong>, é obrigatório realizar primeiro a conferência periódica de seus dados pessoais, contatos e endereço no portal.
                </p>
              </div>
            </div>

            {/* FLUXO VISUAL EM PASSOS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-inner">
              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-[#1e3a5f] text-white flex items-center justify-center font-bold text-xs shrink-0">
                  1
                </div>
                <div>
                  <span className="font-bold text-slate-900 text-xs block">Atualização Cadastral</span>
                  <span className="text-[11px] text-amber-800 font-semibold flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    Pendente • Ação Necessária
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center space-x-3 opacity-60">
                <div className="w-8 h-8 rounded-full bg-slate-300 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                  2
                </div>
                <div>
                  <span className="font-bold text-slate-700 text-xs block">Escolha de Férias ({anoCampanha})</span>
                  <span className="text-[11px] text-slate-500 font-medium flex items-center">
                    <Lock className="w-3 h-3 mr-1" />
                    Liberada após o Passo 1
                  </span>
                </div>
              </div>
            </div>

            {/* BOTÃO DE AÇÃO */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-amber-200/60">
              <span className="text-xs text-slate-500 font-medium">
                Leva menos de 1 minuto para conferir e confirmar seus dados.
              </span>
              <Button
                type="button"
                onClick={() => navigate('/portal/cadastro')}
                className="w-full sm:w-auto bg-[#1e3a5f] hover:bg-[#152943] text-white rounded-xl text-xs h-10 px-6 font-bold shadow-md flex items-center justify-center"
              >
                <UserCheck className="w-4 h-4 mr-2" />
                Ir para a Conferência Cadastral Agora
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : !campanha ? (
        /* CASO 1: NENHUMA CAMPANHA ATIVA NO MOMENTO */
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
                    <strong className="text-slate-800 text-sm">{formatarDataBR(periodoMaisAntigo.inicio_aquisitivo)}</strong>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-emerald-200">
                    <span className="text-slate-500 block text-[11px]">Fim do Período</span>
                    <strong className="text-slate-800 text-sm">{formatarDataBR(periodoMaisAntigo.fim_aquisitivo)}</strong>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-emerald-200">
                    <span className="text-slate-500 block text-[11px]">Data Limite para Fruição</span>
                    <strong className="text-emerald-800 text-sm font-extrabold">{formatarDataBR(periodoMaisAntigo.limite_fruicao || `${anoCampanha}-12-31`)}</strong>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* FORMULÁRIO DE ESCOLHA DOS 3 MESES DE FÉRIAS (EXIBE SE NÃO TEM OPÇÃO OU CLICOU EM ALTERAR) */}
          {(isEditing || !opcaoEnviada) && (
            <form onSubmit={handleSubmeter} className="space-y-6">
              {/* PASSO 1: ESCOLHA A MODALIDADE */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-5">
                  <h4 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <i className="ph ph-list-numbers text-green-600 text-xl"></i> Passo 1: Escolha a Modalidade
                  </h4>
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
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(data?.config?.permitir_1_etapa !== false) && (
                    <label className="relative flex cursor-pointer rounded-lg border border-slate-300 bg-white p-4 shadow-sm focus:outline-none hover:bg-slate-50 has-[:checked]:border-green-500 has-[:checked]:bg-green-50 has-[:checked]:ring-1 has-[:checked]:ring-green-500 transition-all">
                      <input
                        type="radio"
                        name="modalidade"
                        value="1_ETAPA_30"
                        className="peer sr-only"
                        checked={modalidade === '1_ETAPA_30'}
                        onChange={() => setModalidade('1_ETAPA_30')}
                      />
                      <span className="flex flex-col flex-1">
                        <span className="block text-sm font-bold text-slate-900 mb-1">Integral (30 dias)</span>
                      </span>
                      <i className="ph ph-check-circle text-green-600 text-xl opacity-0 peer-checked:opacity-100 absolute right-4 top-4"></i>
                    </label>
                  )}

                  {(data?.config?.permitir_2_etapas !== false) && (
                    <label className="relative flex cursor-pointer rounded-lg border border-slate-300 bg-white p-4 shadow-sm focus:outline-none hover:bg-slate-50 has-[:checked]:border-green-500 has-[:checked]:bg-green-50 has-[:checked]:ring-1 has-[:checked]:ring-green-500 transition-all">
                      <input
                        type="radio"
                        name="modalidade"
                        value="2_ETAPAS_15"
                        className="peer sr-only"
                        checked={modalidade === '2_ETAPAS_15'}
                        onChange={() => setModalidade('2_ETAPAS_15')}
                      />
                      <span className="flex flex-col flex-1">
                        <span className="block text-sm font-bold text-slate-900 mb-1">2 Frações (15 + 15)</span>
                      </span>
                      <i className="ph ph-check-circle text-green-600 text-xl opacity-0 peer-checked:opacity-100 absolute right-4 top-4"></i>
                    </label>
                  )}

                  {(data?.config?.permitir_3_etapas !== false) && (
                    <label className="relative flex cursor-pointer rounded-lg border border-slate-300 bg-white p-4 shadow-sm focus:outline-none hover:bg-slate-50 has-[:checked]:border-green-500 has-[:checked]:bg-green-50 has-[:checked]:ring-1 has-[:checked]:ring-green-500 transition-all">
                      <input
                        type="radio"
                        name="modalidade"
                        value="3_ETAPAS_10"
                        className="peer sr-only"
                        checked={modalidade === '3_ETAPAS_10'}
                        onChange={() => setModalidade('3_ETAPAS_10')}
                      />
                      <span className="flex flex-col flex-1">
                        <span className="block text-sm font-bold text-slate-900 mb-1">3 Frações (10 + 10 + 10)</span>
                      </span>
                      <i className="ph ph-check-circle text-green-600 text-xl opacity-0 peer-checked:opacity-100 absolute right-4 top-4"></i>
                    </label>
                  )}
                </div>
              </div>

              {/* PASSO 2: PREFERÊNCIA DE MESES */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h4 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 mb-5 flex items-center gap-2">
                  <i className="ph ph-calendar-star text-green-600 text-xl"></i> Passo 2: Preferência de Meses no Ano de {anoCampanha}
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">1ª Opção (Preferencial)</label>
                    <select
                      value={mesOpcao1}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v && v === mesOpcao2) setMesOpcao2(mesOpcao1);
                        if (v && v === mesOpcao3) setMesOpcao3(mesOpcao1);
                        setMesOpcao1(v);
                      }}
                      className="w-full border border-slate-300 rounded-lg p-3 text-slate-900 focus:ring-2 focus:ring-green-500 outline-none font-medium bg-white"
                    >
                      <option value="">Selecione o mês...</option>
                      {MESES_ANO.map((m) => (
                        <option
                          key={m.valor}
                          value={m.valor}
                          disabled={m.valor === mesOpcao2 || m.valor === mesOpcao3}
                        >
                          {m.nome} {m.valor === mesOpcao2 ? '(Em uso na 2ª Opção)' : m.valor === mesOpcao3 ? '(Em uso na 3ª Opção)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">2ª Opção (Alternativa A)</label>
                    <select
                      value={mesOpcao2}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v && v === mesOpcao1) setMesOpcao1(mesOpcao2);
                        if (v && v === mesOpcao3) setMesOpcao3(mesOpcao2);
                        setMesOpcao2(v);
                      }}
                      className="w-full border border-slate-300 rounded-lg p-3 text-slate-900 focus:ring-2 focus:ring-green-500 outline-none font-medium bg-white"
                    >
                      <option value="">Selecione o mês...</option>
                      {MESES_ANO.map((m) => (
                        <option
                          key={m.valor}
                          value={m.valor}
                          disabled={m.valor === mesOpcao1 || m.valor === mesOpcao3}
                        >
                          {m.nome} {m.valor === mesOpcao1 ? '(Em uso na 1ª Opção)' : m.valor === mesOpcao3 ? '(Em uso na 3ª Opção)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">3ª Opção (Alternativa B)</label>
                    <select
                      value={mesOpcao3}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v && v === mesOpcao1) setMesOpcao1(mesOpcao3);
                        if (v && v === mesOpcao2) setMesOpcao2(mesOpcao3);
                        setMesOpcao3(v);
                      }}
                      className="w-full border border-slate-300 rounded-lg p-3 text-slate-900 focus:ring-2 focus:ring-green-500 outline-none font-medium bg-white"
                    >
                      <option value="">Selecione o mês...</option>
                      {MESES_ANO.map((m) => (
                        <option
                          key={m.valor}
                          value={m.valor}
                          disabled={m.valor === mesOpcao1 || m.valor === mesOpcao2}
                        >
                          {m.nome} {m.valor === mesOpcao1 ? '(Em uso na 1ª Opção)' : m.valor === mesOpcao2 ? '(Em uso na 2ª Opção)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-500">
                    * Ao confirmar, suas opções serão enviadas para a homologação do gestor (início no dia 01).
                  </p>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold shadow-sm transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    <i className="ph ph-paper-plane-tilt text-lg"></i>
                    {opcaoEnviada ? 'Salvar Alterações das Opções' : 'Registrar Minhas Opções'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
