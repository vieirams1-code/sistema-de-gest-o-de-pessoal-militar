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
  Plus,
  Trash2,
  ShieldCheck,
  Star,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

export default function PortalFeriasView({ onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Formulário de Opção
  const [selectedPeriodoId, setSelectedPeriodoId] = useState('');
  const [modalidade, setModalidade] = useState('2_ETAPAS_15');
  const [parcelas, setParcelas] = useState([
    { etapa: 1, dias: 15, data_inicio: '' },
    { etapa: 2, dias: 15, data_inicio: '' }
  ]);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await getFerias();
      setData(res);

      // Prioriza o período mais antigo com saldo identificado pelo backend
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

      // Ajusta a modalidade inicial conforme as regras do administrador
      const config = res?.config || {};
      if (config.permitir_2_etapas !== false) {
        setModalidade('2_ETAPAS_15');
        setParcelas([
          { etapa: 1, dias: 15, data_inicio: '' },
          { etapa: 2, dias: 15, data_inicio: '' }
        ]);
      } else if (config.permitir_1_etapa !== false) {
        setModalidade('1_ETAPA_30');
        setParcelas([{ etapa: 1, dias: 30, data_inicio: '' }]);
      } else if (config.permitir_3_etapas !== false) {
        setModalidade('3_ETAPAS_10');
        setParcelas([
          { etapa: 1, dias: 10, data_inicio: '' },
          { etapa: 2, dias: 10, data_inicio: '' },
          { etapa: 3, dias: 10, data_inicio: '' }
        ]);
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
    if (modo === '1_ETAPA_30') {
      setParcelas([{ etapa: 1, dias: 30, data_inicio: '' }]);
    } else if (modo === '2_ETAPAS_15') {
      setParcelas([
        { etapa: 1, dias: 15, data_inicio: '' },
        { etapa: 2, dias: 15, data_inicio: '' }
      ]);
    } else if (modo === '3_ETAPAS_10') {
      setParcelas([
        { etapa: 1, dias: 10, data_inicio: '' },
        { etapa: 2, dias: 10, data_inicio: '' },
        { etapa: 3, dias: 10, data_inicio: '' }
      ]);
    }
  };

  const handleParcelaChange = (index, field, value) => {
    const updated = [...parcelas];
    updated[index] = { ...updated[index], [field]: value };
    setParcelas(updated);
  };

  const handleAddParcela = () => {
    if (parcelas.length >= 3) return;
    setParcelas([...parcelas, { etapa: parcelas.length + 1, dias: 10, data_inicio: '' }]);
  };

  const handleRemoveParcela = (index) => {
    if (parcelas.length <= 1) return;
    const updated = parcelas.filter((_, i) => i !== index).map((p, idx) => ({ ...p, etapa: idx + 1 }));
    setParcelas(updated);
  };

  const totalDiasEscolhidos = parcelas.reduce((acc, p) => acc + (Number(p.dias) || 0), 0);

  const periodoSelecionado = (data?.periodos || []).find((p) => p.id === selectedPeriodoId);
  const saldoDisponivel = periodoSelecionado
    ? (periodoSelecionado.saldo_disponivel ?? ((periodoSelecionado.dias_direito || 30) - (periodoSelecionado.dias_gozados || 0)))
    : 30;

  const handleSubmitOpcao = async (e) => {
    e.preventDefault();
    if (!selectedPeriodoId) {
      setErrorMsg('Selecione um período aquisitivo.');
      return;
    }

    if (totalDiasEscolhidos !== saldoDisponivel) {
      setErrorMsg(`A soma dos dias das parcelas (${totalDiasEscolhidos}) deve ser exatamente igual ao saldo disponível (${saldoDisponivel} dias).`);
      return;
    }

    const invalidDate = parcelas.some((p) => !p.data_inicio);
    if (invalidDate) {
      setErrorMsg('Informe a data de início de todas as parcelas.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await submeterOpcaoFerias({
        periodo_aquisitivo_id: selectedPeriodoId,
        parcelas: parcelas,
      });

      setSuccessMsg(res.message || 'Opção de férias submetida com sucesso!');
      await loadData();
    } catch (err) {
      setErrorMsg(err.message || 'Falha ao submeter opção de férias.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-[#1e3a5f] rounded-full animate-spin"></div>
        <p className="text-sm text-slate-500 font-medium">Carregando períodos e regras de férias...</p>
      </div>
    );
  }

  const periodos = data?.periodos || [];
  const ferias = data?.ferias || [];
  const config = data?.config || {};
  const periodoMaisAntigo = periodos.find((p) => p.is_mais_antigo_pendente);

  // Lista de modalidades ativadas pelo administrador
  const modalidadesAtivas = [
    config.permitir_1_etapa !== false && { id: '1_ETAPA_30', label: '1 Etapa (30 dias)' },
    config.permitir_2_etapas !== false && { id: '2_ETAPAS_15', label: '2 Etapas (15 + 15)' },
    config.permitir_3_etapas !== false && { id: '3_ETAPAS_10', label: '3 Etapas (10+10+10)' },
    config.permitir_custom && { id: 'CUSTOM', label: 'Personalizado' },
  ].filter(Boolean);

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
            Plano de Férias & Saldos
          </h2>
          <p className="text-xs text-slate-500">
            Consulte seus períodos aquisitivos e registre sua opção de parcelamento
          </p>
        </div>
      </div>

      {/* ORIENTAÇÃO / INSTRUÇÕES DO ADMINISTRADOR */}
      {config.instrucoes && (
        <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-2xl flex items-start space-x-3 text-xs text-[#1e3a5f]">
          <Info className="w-5 h-5 text-[#1e3a5f] flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold block">Orientações da Chefia / RH:</span>
            <p className="text-slate-700 leading-relaxed">{config.instrucoes}</p>
            {config.prazo_limite && (
              <p className="font-semibold text-emerald-800 pt-1">
                ⏳ Prazo final para envio: <strong>{new Date(config.prazo_limite).toLocaleDateString('pt-BR')}</strong>
              </p>
            )}
          </div>
        </div>
      )}

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

      {/* CARD DE DESTAQUE: PERÍODO AQUISITIVO MAIS ANTIGO PENDENTE */}
      {periodoMaisAntigo && (
        <Card className="border-2 border-emerald-600 bg-gradient-to-br from-emerald-50/70 to-emerald-100/30 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="p-4 sm:p-5 pb-2 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center shadow-sm">
                <Star className="w-3.5 h-3.5 mr-1 fill-white" />
                Período Prioritário para Gozo (Mais Antigo)
              </span>
            </div>
            <span className="text-xs font-bold text-emerald-800">
              Saldo: {periodoMaisAntigo.saldo_disponivel} dias
            </span>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-2 space-y-2 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200">
                <span className="text-slate-500 block text-[11px]">Data Início do Período</span>
                <strong className="text-slate-800 text-sm">{periodoMaisAntigo.inicio_aquisitivo || '-'}</strong>
              </div>
              <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200">
                <span className="text-slate-500 block text-[11px]">Data Fim do Período</span>
                <strong className="text-slate-800 text-sm">{periodoMaisAntigo.fim_aquisitivo || '-'}</strong>
              </div>
              <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200">
                <span className="text-slate-500 block text-[11px]">Data Limite para Gozo</span>
                <strong className="text-amber-700 text-sm">{periodoMaisAntigo.data_limite_gozo || '-'}</strong>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* LISTA COMPLETA DE PERÍODOS */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-800">Todos os Períodos Aquisitivos</h3>

        {periodos.length === 0 ? (
          <Card className="border-slate-200">
            <CardContent className="p-6 text-center text-xs text-slate-500">
              Nenhum período aquisitivo registrado até o momento.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {periodos.map((p) => {
              const saldo = p.saldo_disponivel ?? ((p.dias_direito || 30) - (p.dias_gozados || 0));
              const percentGozado = Math.min(100, Math.round(((p.dias_gozados || 0) / (p.dias_direito || 30)) * 100));

              return (
                <Card
                  key={p.id}
                  onClick={() => setSelectedPeriodoId(p.id)}
                  className={`border transition-all cursor-pointer ${
                    selectedPeriodoId === p.id
                      ? 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-600/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-xs font-bold text-slate-800 flex items-center">
                      {p.is_mais_antigo_pendente && <Star className="w-3.5 h-3.5 text-emerald-600 mr-1 fill-emerald-600" />}
                      Período {p.inicio_aquisitivo || '-'} a {p.fim_aquisitivo || '-'}
                    </CardTitle>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                      {p.status || 'Disponível'}
                    </span>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 text-xs space-y-2">
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Saldo Disponível:</span>
                      <strong className="text-emerald-700 text-sm">{saldo} dias</strong>
                    </div>

                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-emerald-600 h-2 rounded-full transition-all"
                        style={{ width: `${percentGozado}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>Gozados: {p.dias_gozados || 0}d</span>
                      <span>Limite: {p.data_limite_gozo || '-'}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* FORMULÁRIO DE OPÇÃO DE FRACIONAMENTO */}
      {periodos.length > 0 && (
        <Card className="border-slate-200 shadow-md">
          <CardHeader className="p-4 sm:p-5 border-b border-slate-100">
            <CardTitle className="text-sm sm:text-base font-bold text-[#1e3a5f] flex items-center">
              <Calendar className="w-4 h-4 mr-2 text-emerald-700" />
              Opção de Fracionamento de Férias
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Escolha a modalidade autorizada pelo RH para o período selecionado
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmitOpcao}>
            <CardContent className="p-4 sm:p-6 space-y-5 text-xs">
              {/* Modalidades Autorizadas pelo Administrador */}
              <div className="space-y-2">
                <label className="font-semibold text-slate-700 block">Modalidade de Parcelamento</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {modalidadesAtivas.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleModalidadeChange(m.id)}
                      className={`p-2.5 rounded-xl border text-center font-medium transition-all text-xs ${
                        modalidade === m.id
                          ? 'border-[#1e3a5f] bg-blue-50/70 text-[#1e3a5f] font-bold ring-1 ring-[#1e3a5f]'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Parcelas Detalhadas */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Etapas do Parcelamento</span>
                  <span className={`text-xs font-bold ${
                    totalDiasEscolhidos === saldoDisponivel ? 'text-emerald-600' : 'text-amber-600'
                  }`}>
                    Total: {totalDiasEscolhidos} de {saldoDisponivel} dias
                  </span>
                </div>

                <div className="space-y-2.5">
                  {parcelas.map((p, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50/80 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="w-6 h-6 rounded-full bg-[#1e3a5f] text-white flex items-center justify-center text-[11px] font-bold">
                          {p.etapa}
                        </span>
                        <span className="font-semibold text-slate-800 text-xs">
                          {p.etapa}ª Parcela
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 flex-1 sm:justify-end">
                        <div className="w-24">
                          <label className="text-[10px] text-slate-500 block">Qtd. Dias</label>
                          <Input
                            type="number"
                            min="5"
                            max="30"
                            value={p.dias}
                            disabled={modalidade !== 'CUSTOM'}
                            onChange={(e) => handleParcelaChange(idx, 'dias', Number(e.target.value))}
                            className="h-9 text-xs font-semibold rounded-lg bg-white"
                          />
                        </div>

                        <div className="flex-1 sm:max-w-xs">
                          <label className="text-[10px] text-slate-500 block">Data de Início Prevista *</label>
                          <Input
                            type="date"
                            value={p.data_inicio}
                            onChange={(e) => handleParcelaChange(idx, 'data_inicio', e.target.value)}
                            required
                            className="h-9 text-xs rounded-lg bg-white"
                          />
                        </div>

                        {modalidade === 'CUSTOM' && parcelas.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveParcela(idx)}
                            className="h-9 px-2 text-red-600 hover:bg-red-50 mt-3 sm:mt-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {modalidade === 'CUSTOM' && parcelas.length < 3 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddParcela}
                    className="text-xs h-8 rounded-lg text-slate-700"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Adicionar Parcela
                  </Button>
                )}
              </div>
            </CardContent>

            <CardFooter className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end space-x-2 rounded-b-xl">
              <Button
                type="submit"
                disabled={submitting || totalDiasEscolhidos !== saldoDisponivel}
                className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-sm h-10 px-4"
              >
                {submitting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                ) : (
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                )}
                Submeter Opção de Férias
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {/* HISTÓRICO DE FÉRIAS REGISTRADAS */}
      {ferias.length > 0 && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="p-4 pb-2 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-slate-800 flex items-center">
              <Clock className="w-4 h-4 mr-2 text-blue-600" />
              Histórico de Férias Cadastradas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 text-xs space-y-2">
            {ferias.map((f) => (
              <div key={f.id} className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 block">
                    {f.tipo || 'Férias Regulares'} • {f.dias || 30} dias
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    Período: {f.data_inicio || '-'} até {f.data_fim || '-'} (Retorno: {f.data_retorno || '-'})
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-[10px]">
                  {f.status || 'Cadastrada'}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
