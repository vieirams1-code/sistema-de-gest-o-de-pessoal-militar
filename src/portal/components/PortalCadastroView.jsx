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

export const GRUPOS_CAMPOS_ALTERAVEIS = [
  {
    grupo: 'Contatos & Comunicação',
    campos: [
      { chave: 'telefone_celular', label: 'Telefone Celular / WhatsApp', placeholder: '(99) 99999-9999' },
      { chave: 'email_particular', label: 'E-mail Particular', placeholder: 'seuemail@provedor.com' },
      { chave: 'email_funcional', label: 'E-mail Institucional (@cbm.ms.gov.br)', placeholder: 'militar@cbm.ms.gov.br' },
    ],
  },
  {
    grupo: 'Endereço Residencial',
    campos: [
      { chave: 'endereco_logradouro', label: 'Logradouro (Rua / Av / Rodovia)', placeholder: 'Ex: Rua das Palmeiras' },
      { chave: 'endereco_numero', label: 'Número da Residência', placeholder: 'Ex: 123 ou S/N' },
      { chave: 'endereco_complemento', label: 'Complemento (Apto, Bloco)', placeholder: 'Ex: Apto 402, Bloco B' },
      { chave: 'endereco_bairro', label: 'Bairro', placeholder: 'Ex: Centro' },
      { chave: 'endereco_cidade', label: 'Cidade / Município', placeholder: 'Ex: Campo Grande' },
      { chave: 'endereco_uf', label: 'UF do Endereço', placeholder: 'MS' },
      { chave: 'endereco_cep', label: 'CEP', placeholder: '79000-000' },
    ],
  },
  {
    grupo: 'Dados Pessoais & Físicos',
    campos: [
      { chave: 'nome_completo', label: 'Nome Completo (Certidão/RG)', placeholder: 'Nome completo sem abreviações' },
      { chave: 'nome_guerra', label: 'Nome de Guerra', placeholder: 'Ex: Silva' },
      { chave: 'data_nascimento', label: 'Data de Nascimento', placeholder: 'AAAA-MM-DD' },
      { chave: 'sexo', label: 'Sexo', placeholder: 'Masculino ou Feminino' },
      { chave: 'estado_civil', label: 'Estado Civil', placeholder: 'Solteiro(a), Casado(a), etc.' },
      { chave: 'tipo_sanguineo', label: 'Tipo Sanguíneo / Fator RH', placeholder: 'Ex: O+, A+, AB-' },
      { chave: 'etnia', label: 'Etnia / Cor', placeholder: 'Branca, Preta, Parda, etc.' },
      { chave: 'religiao', label: 'Religião / Crença', placeholder: 'Ex: Católica, Evangélica, etc.' },
      { chave: 'altura', label: 'Altura (m)', placeholder: 'Ex: 1.78' },
      { chave: 'peso', label: 'Peso (kg)', placeholder: 'Ex: 82' },
      { chave: 'naturalidade', label: 'Naturalidade (Cidade de Nascimento)', placeholder: 'Ex: Dourados' },
      { chave: 'naturalidade_uf', label: 'UF de Nascimento', placeholder: 'MS' },
      { chave: 'nome_pai', label: 'Filiação: Nome do Pai', placeholder: 'Nome completo do pai' },
      { chave: 'nome_mae', label: 'Filiação: Nome da Mãe', placeholder: 'Nome completo da mãe' },
    ],
  },
  {
    grupo: 'Documentação Civil & CNH',
    campos: [
      { chave: 'rg', label: 'Número do RG', placeholder: 'Número do RG' },
      { chave: 'orgao_expedidor_rg', label: 'Órgão Expedidor do RG', placeholder: 'Ex: SEJUSP' },
      { chave: 'uf_rg', label: 'UF do RG', placeholder: 'MS' },
      { chave: 'cpf', label: 'CPF', placeholder: '000.000.000-00' },
      { chave: 'cnh_numero', label: 'Número da CNH', placeholder: 'Número de registro da CNH' },
      { chave: 'cnh_categoria', label: 'Categoria da CNH', placeholder: 'Ex: AB, C, D, E' },
      { chave: 'cnh_validade', label: 'Validade da CNH', placeholder: 'AAAA-MM-DD' },
    ],
  },
  {
    grupo: 'Formação & Nível de Escolaridade',
    campos: [
      { chave: 'escolaridade', label: 'Nível de Escolaridade', placeholder: 'Ex: Ensino Superior Completo' },
      { chave: 'curso_superior', label: 'Curso Superior (Graduação)', placeholder: 'Ex: Bacharelado em Direito' },
      { chave: 'mestrado', label: 'Mestrado', placeholder: 'Ex: Mestrado em Gestão Pública' },
      { chave: 'doutorado', label: 'Doutorado', placeholder: 'Ex: Doutorado' },
    ],
  },
  {
    grupo: 'Dados Bancários para Folha de Pagamento',
    campos: [
      { chave: 'banco', label: 'Instituição Bancária', placeholder: 'Ex: Banco do Brasil (001)' },
      { chave: 'agencia', label: 'Agência Bancária', placeholder: 'Ex: 1234-5' },
      { chave: 'conta', label: 'Conta Corrente', placeholder: 'Ex: 98765-4' },
    ],
  },
  {
    grupo: 'Dados Funcionais (Com Validação de Rito pelo RH)',
    campos: [
      { chave: 'posto_graduacao', label: 'Posto / Graduação', placeholder: 'Ex: 2º Tenente' },
      { chave: 'quadro', label: 'Quadro Militar', placeholder: 'Ex: QOBM' },
      { chave: 'matricula', label: 'Matrícula Funcional', placeholder: 'Ex: 123456' },
      { chave: 'data_inclusao', label: 'Data de Inclusão na Corporação', placeholder: 'AAAA-MM-DD' },
      { chave: 'lotacao', label: 'Lotação / Unidade', placeholder: 'Ex: 1º SGBM / 1º GBM' },
      { chave: 'funcao', label: 'Função Exercida', placeholder: 'Ex: Comandante de Socorro' },
    ],
  },
];

export const TODOS_CAMPOS_ALTERAVEIS = GRUPOS_CAMPOS_ALTERAVEIS.flatMap((g) => g.campos);

export default function PortalCadastroView({ onBack }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Modal de Solicitação de Alteração
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [campoChave, setCampoChave] = useState('telefone_celular');
  const [campoLabel, setCampoLabel] = useState('Telefone Celular / WhatsApp');
  const [campoPlaceholder, setCampoPlaceholder] = useState('');
  const [valorAtual, setValorAtual] = useState('');
  const [valorProposto, setValorProposto] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);

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
    const item = TODOS_CAMPOS_ALTERAVEIS.find((c) => c.chave === chave);
    setCampoChave(chave);
    setCampoLabel(item ? item.label : chave);
    setCampoPlaceholder(item?.placeholder || `Informe o novo ${item?.label || chave}`);
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
          <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-bold text-slate-800 flex items-center">
              <UserCheck className="w-4 h-4 mr-2 text-[#1e3a5f]" />
              Identificação Funcional
            </CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleOpenModal('posto_graduacao')}
              className="text-[11px] h-7 text-blue-600 hover:bg-blue-50 px-2"
            >
              Solicitar Correção
            </Button>
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
                <span className="font-semibold text-slate-800">{formatarDataBR(cad.data_ingresso || cad.data_inclusao)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500 block">Lotação / Unidade</span>
                <span className="font-semibold text-slate-800">{cad.lotacao || cad.estrutura_nome || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Função</span>
                <span className="font-semibold text-slate-800">{cad.funcao || '-'}</span>
              </div>
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
                <span className="text-slate-500 block">Complemento</span>
                <span className="font-semibold text-slate-800">{cad.endereco_complemento || '-'}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500 block">Cidade / UF</span>
                <span className="font-semibold text-slate-800">{cad.endereco_cidade ? `${cad.endereco_cidade} / ${cad.endereco_uf || 'MS'}` : '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">CEP</span>
                <span className="font-semibold text-slate-800">{cad.endereco_cep || '-'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CARD 4: DADOS PESSOAIS, FÍSICOS & FILIAÇÃO */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-bold text-slate-800 flex items-center">
              <UserCheck className="w-4 h-4 mr-2 text-indigo-600" />
              Dados Pessoais & Filiação
            </CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleOpenModal('estado_civil')}
              className="text-[11px] h-7 text-blue-600 hover:bg-blue-50 px-2"
            >
              Alterar
            </Button>
          </CardHeader>
          <CardContent className="p-4 space-y-3 text-xs">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-slate-500 block">Nascimento</span>
                <span className="font-semibold text-slate-800">{formatarDataBR(cad.data_nascimento)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Estado Civil</span>
                <span className="font-semibold text-slate-800">{cad.estado_civil || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Sexo</span>
                <span className="font-semibold text-slate-800">{cad.sexo || '-'}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-slate-500 block">Tipo Sanguíneo</span>
                <span className="font-semibold text-slate-800">{cad.tipo_sanguineo || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Etnia / Cor</span>
                <span className="font-semibold text-slate-800">{cad.etnia || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Religião</span>
                <span className="font-semibold text-slate-800">{cad.religiao || '-'}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500 block">Pai</span>
                <span className="font-semibold text-slate-800 truncate block">{cad.nome_pai || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Mãe</span>
                <span className="font-semibold text-slate-800 truncate block">{cad.nome_mae || '-'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CARD 5: DOCUMENTAÇÃO CIVIL & CNH */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-bold text-slate-800 flex items-center">
              <ShieldCheck className="w-4 h-4 mr-2 text-teal-600" />
              Documentos Civis & CNH
            </CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleOpenModal('rg')}
              className="text-[11px] h-7 text-blue-600 hover:bg-blue-50 px-2"
            >
              Alterar
            </Button>
          </CardHeader>
          <CardContent className="p-4 space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500 block">RG</span>
                <span className="font-semibold text-slate-800">{cad.rg ? `${cad.rg} (${cad.orgao_expedidor_rg || ''}/${cad.uf_rg || ''})` : '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">CPF</span>
                <span className="font-semibold text-slate-800">{cad.cpf || '-'}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-slate-500 block">CNH</span>
                <span className="font-semibold text-slate-800">{cad.cnh_numero || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Categoria</span>
                <span className="font-semibold text-slate-800">{cad.cnh_categoria || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Validade</span>
                <span className="font-semibold text-slate-800">{formatarDataBR(cad.cnh_validade)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CARD 6: FORMAÇÃO ACADÊMICA & DADOS BANCÁRIOS */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-bold text-slate-800 flex items-center">
              <Clock className="w-4 h-4 mr-2 text-cyan-600" />
              Escolaridade & Dados Bancários
            </CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleOpenModal('escolaridade')}
              className="text-[11px] h-7 text-blue-600 hover:bg-blue-50 px-2"
            >
              Alterar
            </Button>
          </CardHeader>
          <CardContent className="p-4 space-y-3 text-xs">
            <div>
              <span className="text-slate-500 block">Escolaridade / Graduação</span>
              <span className="font-semibold text-slate-800">{cad.escolaridade || '-'} {cad.curso_superior ? `• ${cad.curso_superior}` : ''}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100">
              <div>
                <span className="text-slate-500 block">Banco</span>
                <span className="font-semibold text-slate-800">{cad.banco || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Agência</span>
                <span className="font-semibold text-slate-800">{cad.agencia || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Conta</span>
                <span className="font-semibold text-slate-800">{cad.conta || '-'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CARD 7: DEPENDENTES / FAMILIARES */}
        <Card className="border-slate-200 shadow-sm md:col-span-2">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
              Suas Solicitações de Alteração ao RH ({solicitacoes.length})
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
                  {sol.observacao_decisao && (
                    <p className="text-[11px] text-blue-600 font-medium mt-0.5">RH: {sol.observacao_decisao}</p>
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
          <Card className="w-full max-w-lg bg-white shadow-2xl rounded-2xl border-slate-200 max-h-[90vh] flex flex-col">
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

            <form onSubmit={handleEnviarSolicitacao} className="flex-1 overflow-y-auto">
              <CardContent className="p-4 sm:p-6 space-y-4 text-xs">
                {/* Alerta de Rito Administrativo */}
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px] leading-relaxed flex items-start space-x-2">
                  <ShieldCheck className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
                  <span>
                    Todas as solicitações de alteração de dados pessoais, civis ou funcionais passam por conferência documental do RH e só são efetivadas na ficha funcional após homologação formal do gestor.
                  </span>
                </div>

                {/* Seleção do Campo */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-700 block">Campo para Alteração *</label>
                  <select
                    value={campoChave}
                    onChange={(e) => handleCampoChange(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-300 rounded-xl text-xs bg-white focus:border-[#1e3a5f] outline-none font-medium"
                  >
                    {GRUPOS_CAMPOS_ALTERAVEIS.map((grupo) => (
                      <optgroup key={grupo.grupo} label={grupo.grupo}>
                        {grupo.campos.map((c) => (
                          <option key={c.chave} value={c.chave}>
                            {c.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                {/* Valor Atual */}
                <div className="space-y-1">
                  <label className="font-semibold text-slate-500 block">Valor Cadastrado Atual</label>
                  <div className="p-2.5 bg-slate-100 rounded-xl text-slate-700 font-mono text-xs truncate">
                    {valorAtual || '(não informado / vazio)'}
                  </div>
                </div>

                {/* Novo Valor Proposto */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-700 block">Novo Valor Proposto *</label>
                  <Input
                    type="text"
                    value={valorProposto}
                    onChange={(e) => setValorProposto(e.target.value)}
                    placeholder={campoPlaceholder || `Informe o novo ${campoLabel}`}
                    required
                    className="h-10 text-xs rounded-xl border-slate-300"
                  />
                </div>

                {/* Justificativa */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-700 block">Justificativa / Observação do Militar</label>
                  <Input
                    type="text"
                    value={justificativa}
                    onChange={(e) => setJustificativa(e.target.value)}
                    placeholder="Ex: Correção de número de telefone / mudança recente de residência"
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
                  Enviar Solicitação ao RH
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
