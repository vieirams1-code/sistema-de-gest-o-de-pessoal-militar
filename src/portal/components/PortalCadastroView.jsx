import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCadastro, confirmarCadastro, solicitarAlteracaoCadastral } from '../api/PortalApiClient';
import {
  UserCheck,
  Phone,
  Mail,
  MapPin,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowLeft,
  Edit3,
  RefreshCw,
  Send,
  X,
  ShieldCheck,
  Calendar,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

function formatarDataBR(dataStr) {
  if (!dataStr) return '-';
  const str = String(dataStr).trim();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  return str;
}

export default function PortalCadastroView({ onBack }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Modal de Solicitação de Alteração
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [campoChave, setCampoChave] = useState('telefone_celular');
  const [campoLabel, setCampoLabel] = useState('Telefone Celular');
  const [valorAtual, setValorAtual] = useState('');
  const [valorProposto, setValorProposto] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const camposAlteraveis = [
    { chave: 'telefone_celular', label: 'Telefone Celular' },
    { chave: 'email_particular', label: 'E-mail Particular' },
    { chave: 'email_funcional', label: 'E-mail Funcional' },
    { chave: 'endereco_logradouro', label: 'Endereço (Rua/Avenida)' },
    { chave: 'endereco_numero', label: 'Número da Residência' },
    { chave: 'endereco_bairro', label: 'Bairro' },
    { chave: 'endereco_cidade', label: 'Cidade' },
    { chave: 'endereco_cep', label: 'CEP' },
    { chave: 'estado_civil', label: 'Estado Civil' },
  ];

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await getCadastro();
      setData(res);
    } catch (err) {
      setErrorMsg(err.message || 'Falha ao carregar dados cadastrais.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCampoChange = (chave) => {
    const item = camposAlteraveis.find((c) => c.chave === chave);
    setCampoChave(chave);
    setCampoLabel(item ? item.label : chave);
    setValorAtual(data?.cadastro?.[chave] || '');
  };

  const handleOpenModal = (defaultKey = 'telefone_celular') => {
    handleCampoChange(defaultKey);
    setValorProposto('');
    setJustificativa('');
    setIsModalOpen(true);
  };

  const handleConfirmarCadastro = async () => {
    setConfirming(true);
    setErrorMsg(null);
    try {
      const res = await confirmarCadastro();
      setSuccessMsg(res.message || 'Conferência cadastral confirmada com sucesso!');
      await loadData();
    } catch (err) {
      setErrorMsg(err.message || 'Falha ao confirmar dados cadastrais.');
    } finally {
      setConfirming(false);
    }
  };

  const handleEnviarSolicitacao = async (e) => {
    e.preventDefault();
    if (!valorProposto.trim()) {
      setErrorMsg('Informe o novo valor proposto.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      await solicitarAlteracaoCadastral({
        campo_chave: campoChave,
        campo_label: campoLabel,
        valor_atual: valorAtual,
        valor_proposto: valorProposto,
        justificativa: justificativa,
      });

      setSuccessMsg(`Solicitação de alteração para "${campoLabel}" enviada para análise do RH.`);
      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      setErrorMsg(err.message || 'Falha ao submeter solicitação.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-[#1e3a5f] rounded-full animate-spin"></div>
        <p className="text-sm text-slate-500 font-medium">Carregando dados cadastrais...</p>
      </div>
    );
  }

  const cad = data?.cadastro || {};
  const dependentes = data?.dependentes || [];
  const solicitacoes = data?.solicitacoes || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      {/* BARRA SUPERIOR: VOLTAR E AÇÕES */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div className="flex items-center space-x-3">
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
              <UserCheck className="w-5 h-5 mr-2 text-[#1e3a5f]" />
              Ficha & Conferência Cadastral
            </h2>
            <p className="text-xs text-slate-500">
              Revise seus dados funcionais e solicite atualizações
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenModal()}
            className="text-xs h-9 rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            <Edit3 className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
            Solicitar Alteração
          </Button>

          <Button
            type="button"
            onClick={handleConfirmarCadastro}
            disabled={confirming}
            className="text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm font-semibold"
          >
            {confirming ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
            )}
            Confirmar Meus Dados
          </Button>
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

      {/* STATUS DA ÚLTIMA CONFERÊNCIA & ATALHO DE FÉRIAS */}
      {cad.data_ultima_conferencia && (
        <div className="space-y-3">
          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-[#1e3a5f]">
            <span className="flex items-center">
              <ShieldCheck className="w-4 h-4 mr-1.5 text-emerald-600 shrink-0" />
              Dados conferidos pelo militar em:{' '}
              <strong className="ml-1">
                {new Date(cad.data_ultima_conferencia).toLocaleDateString('pt-BR')}
              </strong>
            </span>
          </div>

          {data?.tem_campanha_ferias_ativa && (
            <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-sm">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-emerald-950 block text-xs">
                    Etapa Cadastral Concluída! Opção de Férias Liberada
                  </span>
                  <span className="text-emerald-700 text-[11px]">
                    Você já pode registrar suas 3 opções de meses para o Plano de Férias.
                  </span>
                </div>
              </div>

              <Button
                type="button"
                onClick={() => navigate('/portal/ferias')}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs h-8 px-4 font-bold shadow-sm shrink-0 flex items-center justify-center"
              >
                Ir para Férias Agora
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* GRADE DE CARDS CADASTRADOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CARD 1: DADOS FUNCIONAIS */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-slate-800 flex items-center">
              <UserCheck className="w-4 h-4 mr-2 text-[#1e3a5f]" />
              Identificação Funcional
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500 block">Nome Completo</span>
                <span className="font-semibold text-slate-800">{cad.nome_completo || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Nome de Guerra</span>
                <span className="font-semibold text-slate-800">{cad.nome_guerra || '-'}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500 block">Posto / Graduação</span>
                <span className="font-semibold text-slate-800">{cad.posto_graduacao || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Quadro</span>
                <span className="font-semibold text-slate-800">{cad.quadro || '-'}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500 block">Matrícula</span>
                <span className="font-semibold text-slate-800">{cad.matricula || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Data de Ingresso</span>
                <span className="font-semibold text-slate-800">{formatarDataBR(cad.data_ingresso)}</span>
              </div>
            </div>

            <div>
              <span className="text-slate-500 block">Lotação / Unidade</span>
              <span className="font-semibold text-slate-800">{cad.lotacao || cad.estrutura_nome || '-'}</span>
            </div>
          </CardContent>
        </Card>

        {/* CARD 2: CONTATO E COMUNICAÇÃO */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-bold text-slate-800 flex items-center">
              <Phone className="w-4 h-4 mr-2 text-emerald-600" />
              Canais de Contato
            </CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleOpenModal('telefone_celular')}
              className="text-[11px] h-7 text-blue-600 hover:bg-blue-50 px-2"
            >
              Alterar
            </Button>
          </CardHeader>
          <CardContent className="p-4 space-y-3 text-xs">
            <div>
              <span className="text-slate-500 block">Telefone Celular (WhatsApp)</span>
              <span className="font-semibold text-slate-800">{cad.telefone_celular || '-'}</span>
            </div>

            <div>
              <span className="text-slate-500 block">E-mail Funcional</span>
              <span className="font-semibold text-slate-800">{cad.email_funcional || '-'}</span>
            </div>

            <div>
              <span className="text-slate-500 block">E-mail Particular</span>
              <span className="font-semibold text-slate-800">{cad.email_particular || '-'}</span>
            </div>
          </CardContent>
        </Card>

        {/* CARD 3: ENDEREÇO RESIDENCIAL */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-bold text-slate-800 flex items-center">
              <MapPin className="w-4 h-4 mr-2 text-amber-600" />
              Endereço Residencial
            </CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleOpenModal('endereco_logradouro')}
              className="text-[11px] h-7 text-blue-600 hover:bg-blue-50 px-2"
            >
              Alterar
            </Button>
          </CardHeader>
          <CardContent className="p-4 space-y-3 text-xs">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <span className="text-slate-500 block">Logradouro</span>
                <span className="font-semibold text-slate-800">{cad.endereco_logradouro || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Número</span>
                <span className="font-semibold text-slate-800">{cad.endereco_numero || 'S/N'}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500 block">Bairro</span>
                <span className="font-semibold text-slate-800">{cad.endereco_bairro || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Cidade</span>
                <span className="font-semibold text-slate-800">{cad.endereco_cidade || '-'}</span>
              </div>
            </div>

            <div>
              <span className="text-slate-500 block">CEP</span>
              <span className="font-semibold text-slate-800">{cad.endereco_cep || '-'}</span>
            </div>
          </CardContent>
        </Card>

        {/* CARD 4: DEPENDENTES / FAMILIARES */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-slate-800 flex items-center">
              <Users className="w-4 h-4 mr-2 text-purple-600" />
              Dependentes Cadastrados ({dependentes.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 text-xs">
            {dependentes.length === 0 ? (
              <p className="text-slate-500 italic py-2">Nenhum dependente cadastrado.</p>
            ) : (
              <div className="space-y-2">
                {dependentes.map((dep, idx) => (
                  <div key={idx} className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-800 block">{dep.nome_completo}</span>
                      <span className="text-[11px] text-slate-500">
                        {dep.grau_parentesco} {dep.data_nascimento ? `• Nasc: ${dep.data_nascimento}` : ''}
                      </span>
                    </div>
                    {dep.dependente_ir && (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-[10px] font-bold">
                        Dep. IR
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* HISTÓRICO DE SOLICITAÇÕES RECENTES */}
      {solicitacoes.length > 0 && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-slate-800 flex items-center">
              <Clock className="w-4 h-4 mr-2 text-blue-600" />
              Suas Solicitações de Alteração ao RH
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 text-xs space-y-2">
            {solicitacoes.map((sol) => (
              <div key={sol.id} className="p-3 bg-white rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-800">{sol.campo_label || sol.campo_chave}</span>
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
                  <p className="text-slate-600 mt-1">
                    Proposto: <strong className="text-slate-900">{sol.valor_proposto}</strong>
                  </p>
                  {sol.justificativa && (
                    <p className="text-[11px] text-slate-500 italic mt-0.5">"{sol.justificativa}"</p>
                  )}
                </div>
                <div className="text-[11px] text-slate-400">
                  {formatarDataBR(sol.data_solicitacao) || 'Recentemente'}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* MODAL / DIALOG DE SOLICITAÇÃO DE ALTERAÇÃO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <Card className="w-full max-w-md bg-white shadow-2xl rounded-2xl border-slate-200">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base font-bold text-[#1e3a5f] flex items-center">
                <Edit3 className="w-4 h-4 mr-2" />
                Solicitar Atualização Cadastral
              </CardTitle>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </CardHeader>

            <form onSubmit={handleEnviarSolicitacao}>
              <CardContent className="p-4 sm:p-6 space-y-4 text-xs">
                {/* Seleção do Campo */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-700 block">Campo para Alteração</label>
                  <select
                    value={campoChave}
                    onChange={(e) => handleCampoChange(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-300 rounded-xl text-xs bg-white focus:border-[#1e3a5f] outline-none"
                  >
                    {camposAlteraveis.map((c) => (
                      <option key={c.chave} value={c.chave}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Valor Atual */}
                <div className="space-y-1">
                  <label className="font-semibold text-slate-500 block">Valor Cadastrado Atual</label>
                  <div className="p-2.5 bg-slate-100 rounded-xl text-slate-700 font-mono text-xs truncate">
                    {valorAtual || '(vazio)'}
                  </div>
                </div>

                {/* Novo Valor Proposto */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-700 block">Novo Valor Proposto *</label>
                  <Input
                    type="text"
                    value={valorProposto}
                    onChange={(e) => setValorProposto(e.target.value)}
                    placeholder={`Informe o novo ${campoLabel}`}
                    required
                    className="h-10 text-xs rounded-xl border-slate-300"
                  />
                </div>

                {/* Justificativa */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-700 block">Justificativa / Motivo</label>
                  <Input
                    type="text"
                    value={justificativa}
                    onChange={(e) => setJustificativa(e.target.value)}
                    placeholder="Ex: Mudança de endereço residencial recente"
                    className="h-10 text-xs rounded-xl border-slate-300"
                  />
                </div>
              </CardContent>

              <CardFooter className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end space-x-2 rounded-b-2xl">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || !valorProposto.trim()}
                  className="bg-[#1e3a5f] hover:bg-[#2a4d7d] text-white rounded-xl text-xs font-semibold shadow-sm"
                >
                  {submitting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
                  ) : (
                    <Send className="w-3.5 h-3.5 mr-1" />
                  )}
                  Enviar ao RH
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
