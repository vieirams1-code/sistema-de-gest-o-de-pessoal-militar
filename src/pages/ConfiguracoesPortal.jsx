import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Shield,
  Calendar,
  UserCheck,
  Smartphone,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Check,
  X,
  Inbox,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export default function ConfiguracoesPortal() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [activeTab, setActiveTab] = useState('ferias'); // 'ferias' | 'cadastro' | 'canais' | 'solicitacoes'

  // ID do registro de configuração
  const [configId, setConfigId] = useState(null);

  // Estados de Férias
  const [feriasAtivo, setFeriasAtivo] = useState(true);
  const [feriasModoSelecao, setFeriasModoSelecao] = useState('mais_antigo');
  const [permitir1Etapa, setPermitir1Etapa] = useState(true);
  const [permitir2Etapas, setPermitir2Etapas] = useState(true);
  const [permitir3Etapas, setPermitir3Etapas] = useState(true);
  const [permitirCustom, setPermitirCustom] = useState(false);
  const [feriasPrazoLimite, setFeriasPrazoLimite] = useState('');
  const [feriasInstrucoes, setFeriasInstrucoes] = useState('');

  // Estados de Cadastro
  const [cadastroAtivo, setCadastroAtivo] = useState(true);
  const [cadastroPermitirSolicitacao, setCadastroPermitirSolicitacao] = useState(true);
  const [cadastroInstrucoes, setCadastroInstrucoes] = useState('');

  // Estados de Canais
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [otpTtlSeconds, setOtpTtlSeconds] = useState(300);
  const [otpResendSeconds, setOtpResendSeconds] = useState(60);

  // Solicitações do RH
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [loadingSolicitacoes, setLoadingSolicitacoes] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState('Pendente');

  const loadConfig = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const records = await base44.entities.PortalAuthConfig.list();
      if (Array.isArray(records) && records.length > 0) {
        const c = records[0];
        setConfigId(c.id);
        setFeriasAtivo(c.ferias_ativo !== false);
        setFeriasModoSelecao(c.ferias_modo_selecao_periodo || 'mais_antigo');
        setPermitir1Etapa(c.ferias_permitir_1_etapa_30d !== false);
        setPermitir2Etapas(c.ferias_permitir_2_etapas_15d !== false);
        setPermitir3Etapas(c.ferias_permitir_3_etapas_10d !== false);
        setPermitirCustom(Boolean(c.ferias_permitir_custom));
        setFeriasPrazoLimite(c.ferias_prazo_limite || '');
        setFeriasInstrucoes(c.ferias_instrucoes || '');

        setCadastroAtivo(c.cadastro_ativo !== false);
        setCadastroPermitirSolicitacao(c.cadastro_permitir_solicitacao !== false);
        setCadastroInstrucoes(c.cadastro_instrucoes || '');

        setWhatsappEnabled(c.whatsapp_enabled !== false);
        setEmailEnabled(c.email_enabled !== false);
        setOtpTtlSeconds(c.otp_ttl_seconds || 300);
        setOtpResendSeconds(c.otp_resend_seconds || 60);
      }
    } catch (err) {
      console.warn('Configuração padrão em uso:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSolicitacoes = async () => {
    setLoadingSolicitacoes(true);
    try {
      const list = await base44.entities.SolicitacaoAtualizacao.list();
      setSolicitacoes(list || []);
    } catch (err) {
      console.error('Falha ao carregar solicitações:', err);
    } finally {
      setLoadingSolicitacoes(false);
    }
  };

  useEffect(() => {
    loadConfig();
    loadSolicitacoes();
  }, []);

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    const payload = {
      ferias_ativo: feriasAtivo,
      ferias_modo_selecao_periodo: feriasModoSelecao,
      ferias_permitir_1_etapa_30d: permitir1Etapa,
      ferias_permitir_2_etapas_15d: permitir2Etapas,
      ferias_permitir_3_etapas_10d: permitir3Etapas,
      ferias_permitir_custom: permitirCustom,
      ferias_prazo_limite: feriasPrazoLimite,
      ferias_instrucoes: feriasInstrucoes,
      cadastro_ativo: cadastroAtivo,
      cadastro_permitir_solicitacao: cadastroPermitirSolicitacao,
      cadastro_instrucoes: cadastroInstrucoes,
      whatsapp_enabled: whatsappEnabled,
      email_enabled: emailEnabled,
      otp_ttl_seconds: Number(otpTtlSeconds) || 300,
      otp_resend_seconds: Number(otpResendSeconds) || 60,
    };

    try {
      if (configId) {
        await base44.entities.PortalAuthConfig.update(configId, payload);
      } else {
        const created = await base44.entities.PortalAuthConfig.create(payload);
        setConfigId(created.id);
      }
      setSuccessMsg('Configurações do Portal do Militar salvas com sucesso!');
    } catch (err) {
      setErrorMsg(err.message || 'Falha ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  };

  const handleDecidirSolicitacao = async (solId, novoStatus) => {
    try {
      const sol = solicitacoes.find((s) => s.id === solId);
      await base44.entities.SolicitacaoAtualizacao.update(solId, {
        status: novoStatus,
        data_decisao: new Date().toISOString().split('T')[0],
      });

      if (novoStatus === 'Aprovada' && sol?.militar_id && sol?.campo_chave) {
        const campo = sol.campo_chave;
        const valor = sol.valor_proposto;
        const updateData = {};

        if (campo === 'endereco_logradouro' || campo === 'logradouro' || campo === 'endereco') {
          updateData.logradouro = valor;
        } else if (campo === 'endereco_numero' || campo === 'numero_endereco' || campo === 'numero') {
          updateData.numero_endereco = valor;
        } else if (campo === 'endereco_bairro' || campo === 'bairro') {
          updateData.bairro = valor;
        } else if (campo === 'endereco_cidade' || campo === 'cidade') {
          updateData.cidade = valor;
        } else if (campo === 'endereco_cep' || campo === 'cep') {
          updateData.cep = valor;
        } else if (campo === 'endereco_complemento' || campo === 'complemento') {
          updateData.complemento = valor;
        } else if (campo === 'telefone_celular' || campo === 'telefone' || campo === 'celular') {
          updateData.telefone = valor;
          updateData.telefone_celular = valor;
        } else if (campo === 'email_funcional') {
          updateData.email_funcional = valor;
        } else if (campo === 'email_particular' || campo === 'email') {
          updateData.email_particular = valor;
        } else if (campo === 'estado_civil') {
          updateData.estado_civil = valor;
        } else {
          updateData[campo] = valor;
        }

        try {
          await base44.entities.Militar.update(sol.militar_id, updateData);
        } catch (_errUpd) {}
      }

      setSuccessMsg(`Solicitação marcada como ${novoStatus}.`);
      await loadSolicitacoes();
    } catch (err) {
      setErrorMsg(err.message || 'Falha ao atualizar solicitação.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-[#1e3a5f] rounded-full animate-spin"></div>
        <p className="text-sm text-slate-500 font-medium">Carregando painel do portal...</p>
      </div>
    );
  }

  const solicitacoesFiltradas = solicitacoes.filter((s) => {
    if (filtroStatus === 'TODOS') return true;
    return s.status === filtroStatus;
  });

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* CABEÇALHO */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#1e3a5f] shadow-inner">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-[#1e3a5f] tracking-tight">
                Gestão do Portal do Militar
              </h1>
              <p className="text-xs text-slate-500">
                Configure como as informações de férias, cadastro e canais aparecem para os usuários
              </p>
            </div>
          </div>

          <Button
            type="button"
            onClick={handleSaveConfig}
            disabled={saving}
            className="bg-[#1e3a5f] hover:bg-[#2a4d7d] text-white rounded-xl text-xs font-semibold shadow-md h-10 px-5"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin mr-1.5" />
            ) : (
              <Save className="w-4 h-4 mr-1.5" />
            )}
            Salvar Configurações
          </Button>
        </div>

        {/* FEEDBACK ALERTS */}
        {successMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-start space-x-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start space-x-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ABAS DO PAINEL */}
        <div className="flex space-x-2 border-b border-slate-200 overflow-x-auto pb-px">
          {[
            { id: 'ferias', label: 'Gestão de Férias', icon: Calendar },
            { id: 'cadastro', label: 'Gestão de Cadastro', icon: UserCheck },
            { id: 'canais', label: 'Canais & OTP', icon: Smartphone },
            { id: 'solicitacoes', label: `Mesa do RH (${solicitacoes.filter(s => s.status === 'Pendente').length})`, icon: Inbox },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 flex items-center space-x-2 transition-all whitespace-nowrap ${
                  activeTab === t.id
                    ? 'border-[#1e3a5f] text-[#1e3a5f] bg-white shadow-sm'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* CONTEÚDO DA ABA 1: GESTÃO DE FÉRIAS */}
        {activeTab === 'ferias' && (
          <div className="space-y-4">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-800 flex items-center">
                  <Calendar className="w-4 h-4 mr-2 text-emerald-700" />
                  Regras de Exibição e Período de Férias
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Defina qual período aquisitivo é exibido em destaque e as regras de parcelamento
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 space-y-4 text-xs">
                {/* Ativar Módulo */}
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <span className="font-bold text-slate-800 block">Módulo de Férias Ativo no Portal</span>
                    <span className="text-slate-500 text-[11px]">Permite que os militares visualizem saldos e submetam opções</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={feriasAtivo}
                    onChange={(e) => setFeriasAtivo(e.target.checked)}
                    className="w-4 h-4 accent-[#1e3a5f] rounded"
                  />
                </div>

                {/* Regra de Priorização do Período */}
                <div className="space-y-2 pt-2">
                  <label className="font-bold text-slate-800 block">
                    Critério de Período Aquisitivo em Destaque
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className={`p-3.5 rounded-xl border flex items-start space-x-3 cursor-pointer transition-all ${
                      feriasModoSelecao === 'mais_antigo'
                        ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600 font-bold text-emerald-950'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}>
                      <input
                        type="radio"
                        name="modoSelecao"
                        value="mais_antigo"
                        checked={feriasModoSelecao === 'mais_antigo'}
                        onChange={(e) => setFeriasModoSelecao(e.target.value)}
                        className="mt-1 accent-emerald-600"
                      />
                      <div>
                        <span className="text-xs block">Período Mais Antigo com Saldo (Recomendado)</span>
                        <span className="text-[11px] text-slate-500 font-normal">
                          Destaca automaticamente o período pendente mais antigo do militar com datas de início e fim.
                        </span>
                      </div>
                    </label>

                    <label className={`p-3.5 rounded-xl border flex items-start space-x-3 cursor-pointer transition-all ${
                      feriasModoSelecao === 'todos'
                        ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600 font-bold text-emerald-950'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}>
                      <input
                        type="radio"
                        name="modoSelecao"
                        value="todos"
                        checked={feriasModoSelecao === 'todos'}
                        onChange={(e) => setFeriasModoSelecao(e.target.value)}
                        className="mt-1 accent-emerald-600"
                      />
                      <div>
                        <span className="text-xs block">Exibir Todos os Períodos em Grade</span>
                        <span className="text-[11px] text-slate-500 font-normal">
                          Exibe todos os períodos aquisitivos abertos com seleção manual pelo militar.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Modalidades de Fracionamento Autorizadas */}
                <div className="space-y-2 pt-2">
                  <label className="font-bold text-slate-800 block">
                    Modalidades de Parcelamento Autorizadas aos Militares
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-50">
                      <div>
                        <span className="font-semibold text-slate-800 block">1 Parcela Integral (30 dias)</span>
                        <span className="text-[11px] text-slate-500">Gozo integral sem fracionamento</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={permitir1Etapa}
                        onChange={(e) => setPermitir1Etapa(e.target.checked)}
                        className="w-4 h-4 accent-[#1e3a5f] rounded"
                      />
                    </label>

                    <label className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-50">
                      <div>
                        <span className="font-semibold text-slate-800 block">2 Parcelas de 15 + 15 dias</span>
                        <span className="text-[11px] text-slate-500">Divisão padrão em duas etapas iguais</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={permitir2Etapas}
                        onChange={(e) => setPermitir2Etapas(e.target.checked)}
                        className="w-4 h-4 accent-[#1e3a5f] rounded"
                      />
                    </label>

                    <label className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-50">
                      <div>
                        <span className="font-semibold text-slate-800 block">3 Parcelas de 10 + 10 + 10 dias</span>
                        <span className="text-[11px] text-slate-500">Divisão em três etapas de 10 dias</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={permitir3Etapas}
                        onChange={(e) => setPermitir3Etapas(e.target.checked)}
                        className="w-4 h-4 accent-[#1e3a5f] rounded"
                      />
                    </label>

                    <label className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-50">
                      <div>
                        <span className="font-semibold text-slate-800 block">Fracionamento Personalizado (Custom)</span>
                        <span className="text-[11px] text-slate-500">Permite ao militar sugerir (ex: 20 + 10 dias)</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={permitirCustom}
                        onChange={(e) => setPermitirCustom(e.target.checked)}
                        className="w-4 h-4 accent-[#1e3a5f] rounded"
                      />
                    </label>
                  </div>
                </div>

                {/* Prazo Limite e Instruções */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-800 block">Prazo Limite para Envio da Opção</label>
                    <Input
                      type="date"
                      value={feriasPrazoLimite}
                      onChange={(e) => setFeriasPrazoLimite(e.target.value)}
                      className="h-10 text-xs rounded-xl bg-white"
                    />
                    <p className="text-[11px] text-slate-500">Data final para o militar enviar suas opções.</p>
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="font-bold text-slate-800 block">Instruções aos Militares (Aviso no Portal)</label>
                    <textarea
                      rows={3}
                      value={feriasInstrucoes}
                      onChange={(e) => setFeriasInstrucoes(e.target.value)}
                      placeholder="Ex: Prezados militares, registrem suas opções de férias para o plano da unidade até a data limite."
                      className="w-full p-3 border border-slate-300 rounded-xl text-xs bg-white outline-none focus:border-[#1e3a5f]"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* CONTEÚDO DA ABA 2: GESTÃO DE CADASTRO */}
        {activeTab === 'cadastro' && (
          <div className="space-y-4">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-800 flex items-center">
                  <UserCheck className="w-4 h-4 mr-2 text-blue-600" />
                  Regras de Conferência e Atualização Cadastral
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 space-y-4 text-xs">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <span className="font-bold text-slate-800 block">Módulo Cadastral Ativo</span>
                    <span className="text-slate-500 text-[11px]">Permite que os militares visualizem seus dados e confirmem</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={cadastroAtivo}
                    onChange={(e) => setCadastroAtivo(e.target.checked)}
                    className="w-4 h-4 accent-[#1e3a5f] rounded"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <span className="font-bold text-slate-800 block">Permitir Solicitações de Alteração</span>
                    <span className="text-slate-500 text-[11px]">Militares podem enviar pedidos de alteração de endereço/contato</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={cadastroPermitirSolicitacao}
                    onChange={(e) => setCadastroPermitirSolicitacao(e.target.checked)}
                    className="w-4 h-4 accent-[#1e3a5f] rounded"
                  />
                </div>

                <div className="space-y-1.5 pt-2">
                  <label className="font-bold text-slate-800 block">Instruções de Conferência</label>
                  <textarea
                    rows={3}
                    value={cadastroInstrucoes}
                    onChange={(e) => setCadastroInstrucoes(e.target.value)}
                    placeholder="Instruções para os militares sobre a conferência anual obrigatória."
                    className="w-full p-3 border border-slate-300 rounded-xl text-xs bg-white outline-none focus:border-[#1e3a5f]"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* CONTEÚDO DA ABA 3: CANAIS & OTP */}
        {activeTab === 'canais' && (
          <div className="space-y-4">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-800 flex items-center">
                  <Smartphone className="w-4 h-4 mr-2 text-emerald-600" />
                  Canais de Envio de Código de Acesso (OTP)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 space-y-4 text-xs">
                <div className="flex items-center justify-between p-3 bg-emerald-50/60 rounded-xl border border-emerald-200">
                  <div>
                    <span className="font-bold text-emerald-950 block">WhatsApp (Evolution API)</span>
                    <span className="text-emerald-700 text-[11px]">Canal prioritário e gratuito • Conectado à nuvem</span>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-600 text-white rounded-full font-bold text-[10px]">
                    Ativo & Conectado
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-blue-50/60 rounded-xl border border-blue-200">
                  <div>
                    <span className="font-bold text-blue-950 block">E-mail (Base44 Core / Resend)</span>
                    <span className="text-blue-700 text-[11px]">Envio para e-mails cadastrados</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailEnabled}
                    onChange={(e) => setEmailEnabled(e.target.checked)}
                    className="w-4 h-4 accent-[#1e3a5f] rounded"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 block">Tempo de Expiração do OTP (segundos)</label>
                    <Input
                      type="number"
                      value={otpTtlSeconds}
                      onChange={(e) => setOtpTtlSeconds(Number(e.target.value))}
                      className="h-10 text-xs rounded-xl"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 block">Intervalo de Reenvio (segundos)</label>
                    <Input
                      type="number"
                      value={otpResendSeconds}
                      onChange={(e) => setOtpResendSeconds(Number(e.target.value))}
                      className="h-10 text-xs rounded-xl"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* CONTEÚDO DA ABA 4: MESA DO RH (SOLICITAÇÕES RECEBIDAS) */}
        {activeTab === 'solicitacoes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-1">
              <div className="flex space-x-2">
                {['Pendente', 'Aprovada', 'Rejeitada', 'TODOS'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setFiltroStatus(st)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      filtroStatus === st
                        ? 'bg-[#1e3a5f] text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={loadSolicitacoes}
                className="text-xs h-8 rounded-lg"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loadingSolicitacoes ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>

            {solicitacoesFiltradas.length === 0 ? (
              <Card className="border-slate-200">
                <CardContent className="p-8 text-center text-xs text-slate-500">
                  Nenhuma solicitação encontrada com o status "{filtroStatus}".
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {solicitacoesFiltradas.map((sol) => (
                  <Card key={sol.id} className="border-slate-200 shadow-sm">
                    <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900 text-sm">
                            {sol.militar_posto} {sol.militar_nome}
                          </span>
                          <span className="text-slate-400">• Matrícula: {sol.militar_matricula || '-'}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            sol.status === 'Aprovada'
                              ? 'bg-emerald-100 text-emerald-800'
                              : sol.status === 'Rejeitada'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {sol.status || 'Pendente'}
                          </span>
                        </div>

                        <div className="text-slate-700">
                          <strong>{sol.campo_label || sol.campo_chave}:</strong>{' '}
                          <span className="text-slate-500 line-through mr-1">{sol.valor_atual || '(vazio)'}</span>
                          <span className="text-emerald-700 font-bold">➔ {sol.valor_proposto}</span>
                        </div>

                        {sol.justificativa && (
                          <p className="text-[11px] text-slate-500 italic">"{sol.justificativa}"</p>
                        )}
                      </div>

                      {sol.status === 'Pendente' && (
                        <div className="flex items-center space-x-2 self-end sm:self-center">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleDecidirSolicitacao(sol.id, 'Aprovada')}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs h-8 px-3"
                          >
                            <Check className="w-3.5 h-3.5 mr-1" />
                            Aprovar
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleDecidirSolicitacao(sol.id, 'Rejeitada')}
                            className="border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs h-8 px-3"
                          >
                            <X className="w-3.5 h-3.5 mr-1" />
                            Rejeitar
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
