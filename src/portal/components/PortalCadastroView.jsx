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
      { chave: 'cnh_categoria', label: 'Categoria da CNH', placeholder: 'Ex: A, B, AB, C, AC, D, AD, E, AE' },
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

export const CAMPOS_OBRIGATORIOS_ATUALIZACAO = [
  { chave: 'telefone_celular', label: 'Telefone Celular / WhatsApp', aliases: ['telefone_celular', 'telefone', 'celular'] },
  { chave: 'email_particular', label: 'E-mail Particular', aliases: ['email_particular'] },
  { chave: 'endereco_logradouro', label: 'Logradouro (Rua/Avenida)', aliases: ['endereco_logradouro', 'logradouro', 'endereco'] },
  { chave: 'endereco_numero', label: 'Número da Residência', aliases: ['endereco_numero', 'numero_endereco', 'numero'] },
  { chave: 'endereco_bairro', label: 'Bairro', aliases: ['endereco_bairro', 'bairro'] },
  { chave: 'endereco_cidade', label: 'Cidade / Município', aliases: ['endereco_cidade', 'cidade', 'municipio'] },
  { chave: 'endereco_uf', label: 'UF do Endereço', aliases: ['endereco_uf', 'uf'] },
  { chave: 'endereco_cep', label: 'CEP', aliases: ['endereco_cep', 'cep'] },
  { chave: 'nome_completo', label: 'Nome Completo', aliases: ['nome_completo'] },
  { chave: 'nome_guerra', label: 'Nome de Guerra', aliases: ['nome_guerra'] },
  { chave: 'data_nascimento', label: 'Data de Nascimento', aliases: ['data_nascimento'] },
  { chave: 'sexo', label: 'Sexo', aliases: ['sexo'] },
  { chave: 'estado_civil', label: 'Estado Civil', aliases: ['estado_civil'] },
  { chave: 'tipo_sanguineo', label: 'Tipo Sanguíneo / Fator RH', aliases: ['tipo_sanguineo'] },
  { chave: 'etnia', label: 'Etnia / Cor', aliases: ['etnia'] },
  { chave: 'religiao', label: 'Religião / Crença', aliases: ['religiao'] },
  { chave: 'altura', label: 'Altura (m)', aliases: ['altura'] },
  { chave: 'peso', label: 'Peso (kg)', aliases: ['peso'] },
  { chave: 'naturalidade', label: 'Naturalidade (Cidade de Nascimento)', aliases: ['naturalidade'] },
  { chave: 'naturalidade_uf', label: 'UF de Nascimento', aliases: ['naturalidade_uf'] },
  { chave: 'nome_mae', label: 'Filiação: Nome da Mãe', aliases: ['nome_mae', 'mae'] },
  { chave: 'rg', label: 'Número do RG', aliases: ['rg'] },
  { chave: 'orgao_expedidor_rg', label: 'Órgão Expedidor do RG', aliases: ['orgao_expedidor_rg'] },
  { chave: 'uf_rg', label: 'UF do RG', aliases: ['uf_rg'] },
  { chave: 'cpf', label: 'CPF', aliases: ['cpf'] },
  { chave: 'cnh_numero', label: 'Número de Registro da CNH', aliases: ['cnh_numero'] },
  { chave: 'cnh_categoria', label: 'Categoria da CNH', aliases: ['cnh_categoria'] },
  { chave: 'cnh_validade', label: 'Validade da CNH', aliases: ['cnh_validade'] },
  { chave: 'escolaridade', label: 'Nível de Escolaridade', aliases: ['escolaridade'] },
  { chave: 'banco', label: 'Instituição Bancária', aliases: ['banco'] },
  { chave: 'agencia', label: 'Agência Bancária', aliases: ['agencia'] },
  { chave: 'conta', label: 'Conta Corrente', aliases: ['conta'] },
  { chave: 'posto_graduacao', label: 'Posto / Graduação', aliases: ['posto_graduacao'] },
  { chave: 'quadro', label: 'Quadro Militar', aliases: ['quadro'] },
  { chave: 'matricula', label: 'Matrícula Funcional', aliases: ['matricula'] },
  { chave: 'data_inclusao', label: 'Data de Inclusão na Corporação', aliases: ['data_inclusao', 'data_ingresso', 'data_admissao'] },
];

export const OPCOES_PREDEFINIDAS = {
  cnh_categoria: [
    { valor: 'A', label: 'A (Motocicleta / Triciclo)' },
    { valor: 'B', label: 'B (Automóvel / Carro de Passeio)' },
    { valor: 'AB', label: 'AB (Moto e Carro de Passeio)' },
    { valor: 'C', label: 'C (Caminhão / Veículo de Carga)' },
    { valor: 'AC', label: 'AC (Moto e Caminhão)' },
    { valor: 'D', label: 'D (Ônibus / Micro-ônibus / Vans)' },
    { valor: 'AD', label: 'AD (Moto e Ônibus/Micro)' },
    { valor: 'E', label: 'E (Veículo Articulado / Carreta)' },
    { valor: 'AE', label: 'AE (Moto e Veículo Articulado/Carreta)' },
    { valor: 'ACC', label: 'ACC (Ciclomotor)' },
    { valor: 'Não Possui', label: 'Não Possui CNH' },
  ],
  estado_civil: [
    { valor: 'Solteiro(a)', label: 'Solteiro(a)' },
    { valor: 'Casado(a)', label: 'Casado(a)' },
    { valor: 'Divorciado(a)', label: 'Divorciado(a)' },
    { valor: 'Viúvo(a)', label: 'Viúvo(a)' },
    { valor: 'União Estável', label: 'União Estável' },
  ],
  sexo: [
    { valor: 'Masculino', label: 'Masculino' },
    { valor: 'Feminino', label: 'Feminino' },
  ],
  tipo_sanguineo: [
    { valor: 'A+', label: 'A+' },
    { valor: 'A-', label: 'A-' },
    { valor: 'B+', label: 'B+' },
    { valor: 'B-', label: 'B-' },
    { valor: 'AB+', label: 'AB+' },
    { valor: 'AB-', label: 'AB-' },
    { valor: 'O+', label: 'O+' },
    { valor: 'O-', label: 'O-' },
  ],
  etnia: [
    { valor: 'Branca', label: 'Branca' },
    { valor: 'Preta', label: 'Preta' },
    { valor: 'Parda', label: 'Parda' },
    { valor: 'Amarela', label: 'Amarela' },
    { valor: 'Indígena', label: 'Indígena' },
  ],
  escolaridade: [
    { valor: 'Ensino Fundamental Incompleto', label: 'Ensino Fundamental Incompleto' },
    { valor: 'Ensino Fundamental Completo', label: 'Ensino Fundamental Completo' },
    { valor: 'Ensino Médio Incompleto', label: 'Ensino Médio Incompleto' },
    { valor: 'Ensino Médio Completo', label: 'Ensino Médio Completo' },
    { valor: 'Ensino Superior Incompleto', label: 'Ensino Superior Incompleto' },
    { valor: 'Ensino Superior Completo', label: 'Ensino Superior Completo' },
    { valor: 'Pós-Graduação', label: 'Pós-Graduação' },
    { valor: 'Mestrado', label: 'Mestrado' },
    { valor: 'Doutorado', label: 'Doutorado' },
  ],
  posto_graduacao: [
    { valor: 'Coronel', label: 'Coronel' },
    { valor: 'Tenente Coronel', label: 'Tenente Coronel' },
    { valor: 'Major', label: 'Major' },
    { valor: 'Capitão', label: 'Capitão' },
    { valor: '1º Tenente', label: '1º Tenente' },
    { valor: '2º Tenente', label: '2º Tenente' },
    { valor: 'Aspirante', label: 'Aspirante' },
    { valor: 'Subtenente', label: 'Subtenente' },
    { valor: '1º Sargento', label: '1º Sargento' },
    { valor: '2º Sargento', label: '2º Sargento' },
    { valor: '3º Sargento', label: '3º Sargento' },
    { valor: 'Cabo', label: 'Cabo' },
    { valor: 'Soldado', label: 'Soldado' },
  ],
  quadro: [
    { valor: 'QOBM', label: 'QOBM (Quadro de Oficiais)' },
    { valor: 'QAOBM', label: 'QAOBM (Quadro de Administração)' },
    { valor: 'QOEBM', label: 'QOEBM (Quadro de Especialistas)' },
    { valor: 'QOSAU', label: 'QOSAU (Quadro de Saúde)' },
    { valor: 'QBMP-1.a', label: 'QBMP-1.a (Combatente)' },
    { valor: 'QBMP-1.b', label: 'QBMP-1.b (Condutor/Operador)' },
    { valor: 'QBMP-2', label: 'QBMP-2 (Especialista)' },
    { valor: 'QBMPT', label: 'QBMPT (Músico)' },
  ],
  uf_rg: ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(u => ({ valor: u, label: u })),
  endereco_uf: ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(u => ({ valor: u, label: u })),
  naturalidade_uf: ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(u => ({ valor: u, label: u })),
};

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

  const cad = data?.cadastro || {};
  const dependentes = data?.dependentes || [];
  const solicitacoes = data?.solicitacoes || [];

  const solicitacoesValidas = (solicitacoes || []).filter(
    (s) => s.status !== 'Rejeitada' && s.valor_proposto && String(s.valor_proposto).trim() !== ''
  );

  // Calcula campos obrigatórios pendentes de preenchimento
  const camposPendentes = CAMPOS_OBRIGATORIOS_ATUALIZACAO.filter((campo) => {
    const temNoCadastro = campo.aliases.some((al) => {
      const v = cad[al];
      return v !== null && v !== undefined && String(v).trim() !== '';
    });
    if (temNoCadastro) return false;

    const temSolicitacao = solicitacoesValidas.some((s) => {
      const ch = (s.campo_chave || '').trim().toLowerCase();
      return campo.chave.toLowerCase() === ch || campo.aliases.some((al) => al.toLowerCase() === ch);
    });
    if (temSolicitacao) return false;

    return true;
  });

  const handleConfirmarCadastro = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (camposPendentes.length > 0) {
      setErrorMsg(
        `Existem ${camposPendentes.length} campo(s) obrigatório(s) não preenchidos na sua ficha. Por favor, clique nos campos pendentes para preenchê-los antes de confirmar.`
      );
      handleOpenModal(camposPendentes[0].chave);
      return;
    }

    setConfirming(true);
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

  const renderCampoValor = (chave, valorFormatado, valorBruto) => {
    const isPendente = camposPendentes.some((c) => c.chave === chave);
    const temSol = solicitacoesValidas.some((s) => {
      const ch = (s.campo_chave || '').trim().toLowerCase();
      const item = CAMPOS_OBRIGATORIOS_ATUALIZACAO.find((c) => c.chave === chave);
      return chave.toLowerCase() === ch || item?.aliases.some((al) => al.toLowerCase() === ch);
    });

    if (temSol) {
      return (
        <div className="flex items-center space-x-1.5 flex-wrap">
          <span className="font-semibold text-slate-800">{valorFormatado || valorBruto || '(em análise)'}</span>
          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded">
            Pendente RH
          </span>
        </div>
      );
    }

    if (isPendente || (!valorBruto && !valorFormatado)) {
      return (
        <button
          type="button"
          onClick={() => handleOpenModal(chave)}
          className="inline-flex items-center text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-md px-1.5 py-0.5 transition-colors"
        >
          <AlertCircle className="w-3 h-3 mr-1 text-amber-600 shrink-0" />
          Preencher Obrigatório
        </button>
      );
    }

    return <span className="font-semibold text-slate-800">{valorFormatado || valorBruto}</span>;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-[#1e3a5f] rounded-full animate-spin"></div>
        <p className="text-sm text-slate-500 font-medium">Carregando dados cadastrais...</p>
      </div>
    );
  }

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

      {/* BANNER DE CAMPOS OBRIGATÓRIOS PENDENTES */}
      {camposPendentes.length > 0 && (
        <div className="p-4 bg-amber-50/90 border border-amber-300 rounded-2xl shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="flex items-start space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-amber-950 text-sm flex items-center">
                  Preenchimento Obrigatório Pendente
                  <span className="ml-2 px-2 py-0.5 bg-amber-200 text-amber-900 rounded-full text-xs font-extrabold">
                    {camposPendentes.length} {camposPendentes.length === 1 ? 'campo pendente' : 'campos pendentes'}
                  </span>
                </h3>
                <p className="text-xs text-amber-800 mt-0.5">
                  Para concluir sua atualização cadastral e liberar a etapa de escolha de férias, os itens abaixo não podem ficar em branco. Clique em qualquer um deles para preencher:
                </p>
              </div>
            </div>

            <Button
              type="button"
              size="sm"
              onClick={() => handleOpenModal(camposPendentes[0]?.chave)}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl h-8 px-3 shrink-0 shadow-sm"
            >
              Preencher Pendências
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {camposPendentes.map((p) => (
              <button
                key={p.chave}
                type="button"
                onClick={() => handleOpenModal(p.chave)}
                className="inline-flex items-center text-[11px] font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg px-2.5 py-1 transition-all"
              >
                <Edit3 className="w-3 h-3 mr-1 text-amber-700" />
                {p.label}
              </button>
            ))}
          </div>
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
                <span className="text-slate-500 block mb-0.5">Nome Completo</span>
                {renderCampoValor('nome_completo', cad.nome_completo, cad.nome_completo)}
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Nome de Guerra</span>
                {renderCampoValor('nome_guerra', cad.nome_guerra, cad.nome_guerra)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500 block mb-0.5">Posto / Graduação</span>
                {renderCampoValor('posto_graduacao', cad.posto_graduacao, cad.posto_graduacao)}
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Quadro</span>
                {renderCampoValor('quadro', cad.quadro, cad.quadro)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500 block mb-0.5">Matrícula</span>
                {renderCampoValor('matricula', cad.matricula, cad.matricula)}
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Data de Inclusão</span>
                {renderCampoValor('data_inclusao', formatarDataBR(cad.data_ingresso || cad.data_inclusao), cad.data_ingresso || cad.data_inclusao)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500 block mb-0.5">Lotação / Unidade</span>
                <span className="font-semibold text-slate-800">{cad.lotacao || cad.estrutura_nome || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Função</span>
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
              <span className="text-slate-500 block mb-0.5">Telefone Celular (WhatsApp)</span>
              {renderCampoValor('telefone_celular', cad.telefone_celular || cad.telefone, cad.telefone_celular || cad.telefone)}
            </div>

            <div>
              <span className="text-slate-500 block mb-0.5">E-mail Particular</span>
              {renderCampoValor('email_particular', cad.email_particular, cad.email_particular)}
            </div>

            <div>
              <span className="text-slate-500 block mb-0.5">E-mail Funcional (@cbm.ms.gov.br)</span>
              <span className="font-semibold text-slate-800">{cad.email_funcional || '-'}</span>
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
                <span className="text-slate-500 block mb-0.5">Logradouro</span>
                {renderCampoValor('endereco_logradouro', cad.endereco_logradouro || cad.logradouro, cad.endereco_logradouro || cad.logradouro)}
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Número</span>
                {renderCampoValor('endereco_numero', cad.endereco_numero || cad.numero_endereco, cad.endereco_numero || cad.numero_endereco)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500 block mb-0.5">Bairro</span>
                {renderCampoValor('endereco_bairro', cad.endereco_bairro || cad.bairro, cad.endereco_bairro || cad.bairro)}
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Complemento</span>
                <span className="font-semibold text-slate-800">{cad.endereco_complemento || cad.complemento || '-'}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <span className="text-slate-500 block mb-0.5">Cidade</span>
                {renderCampoValor('endereco_cidade', cad.endereco_cidade || cad.cidade, cad.endereco_cidade || cad.cidade)}
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">UF</span>
                {renderCampoValor('endereco_uf', cad.endereco_uf || cad.uf, cad.endereco_uf || cad.uf)}
              </div>
            </div>

            <div>
              <span className="text-slate-500 block mb-0.5">CEP</span>
              {renderCampoValor('endereco_cep', cad.endereco_cep || cad.cep, cad.endereco_cep || cad.cep)}
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
                <span className="text-slate-500 block mb-0.5">Nascimento</span>
                {renderCampoValor('data_nascimento', formatarDataBR(cad.data_nascimento), cad.data_nascimento)}
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Estado Civil</span>
                {renderCampoValor('estado_civil', cad.estado_civil, cad.estado_civil)}
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Sexo</span>
                {renderCampoValor('sexo', cad.sexo, cad.sexo)}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-slate-500 block mb-0.5">Tipo Sanguíneo</span>
                {renderCampoValor('tipo_sanguineo', cad.tipo_sanguineo, cad.tipo_sanguineo)}
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Etnia / Cor</span>
                {renderCampoValor('etnia', cad.etnia, cad.etnia)}
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Religião</span>
                {renderCampoValor('religiao', cad.religiao, cad.religiao)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500 block mb-0.5">Altura (m)</span>
                {renderCampoValor('altura', cad.altura ? `${cad.altura} m` : '', cad.altura)}
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Peso (kg)</span>
                {renderCampoValor('peso', cad.peso ? `${cad.peso} kg` : '', cad.peso)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500 block mb-0.5">Naturalidade</span>
                {renderCampoValor('naturalidade', cad.naturalidade, cad.naturalidade)}
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">UF Naturalidade</span>
                {renderCampoValor('naturalidade_uf', cad.naturalidade_uf, cad.naturalidade_uf)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500 block mb-0.5">Mãe (Obrigatório)</span>
                {renderCampoValor('nome_mae', cad.nome_mae, cad.nome_mae)}
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Pai</span>
                <span className="font-semibold text-slate-800 truncate block">{cad.nome_pai || '-'}</span>
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
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-slate-500 block mb-0.5">Número RG</span>
                {renderCampoValor('rg', cad.rg, cad.rg)}
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Órgão RG</span>
                {renderCampoValor('orgao_expedidor_rg', cad.orgao_expedidor_rg, cad.orgao_expedidor_rg)}
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">UF RG</span>
                {renderCampoValor('uf_rg', cad.uf_rg, cad.uf_rg)}
              </div>
            </div>

            <div>
              <span className="text-slate-500 block mb-0.5">CPF</span>
              {renderCampoValor('cpf', cad.cpf, cad.cpf)}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-slate-500 block mb-0.5">CNH Número</span>
                {renderCampoValor('cnh_numero', cad.cnh_numero, cad.cnh_numero)}
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Categoria CNH</span>
                {renderCampoValor('cnh_categoria', cad.cnh_categoria, cad.cnh_categoria)}
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Validade CNH</span>
                {renderCampoValor('cnh_validade', formatarDataBR(cad.cnh_validade), cad.cnh_validade)}
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
              <span className="text-slate-500 block mb-0.5">Nível de Escolaridade</span>
              {renderCampoValor('escolaridade', cad.escolaridade, cad.escolaridade)}
            </div>

            {cad.curso_superior && (
              <div>
                <span className="text-slate-500 block mb-0.5">Curso Superior</span>
                <span className="font-semibold text-slate-800">{cad.curso_superior}</span>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
              <div>
                <span className="text-slate-500 block mb-0.5">Banco</span>
                {renderCampoValor('banco', cad.banco, cad.banco)}
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Agência</span>
                {renderCampoValor('agencia', cad.agencia, cad.agencia)}
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Conta</span>
                {renderCampoValor('conta', cad.conta, cad.conta)}
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
                            {c.label} {camposPendentes.some((p) => p.chave === c.chave) ? '⚠️ (Obrigatório Vazio)' : ''}
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

                {/* Novo Valor Proposto com Preset Inteligente */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-700 block">Novo Valor Proposto *</label>
                  {OPCOES_PREDEFINIDAS[campoChave] ? (
                    <select
                      value={valorProposto}
                      onChange={(e) => setValorProposto(e.target.value)}
                      required
                      className="w-full h-10 px-3 border border-slate-300 rounded-xl text-xs bg-white focus:border-[#1e3a5f] outline-none font-medium"
                    >
                      <option value="">Selecione uma opção...</option>
                      {OPCOES_PREDEFINIDAS[campoChave].map((op) => (
                        <option key={op.valor} value={op.valor}>
                          {op.label}
                        </option>
                      ))}
                    </select>
                  ) : campoChave.includes('data') || campoChave.includes('validade') ? (
                    <Input
                      type="date"
                      value={valorProposto}
                      onChange={(e) => setValorProposto(e.target.value)}
                      required
                      className="h-10 text-xs rounded-xl border-slate-300"
                    />
                  ) : (
                    <Input
                      type="text"
                      value={valorProposto}
                      onChange={(e) => setValorProposto(e.target.value)}
                      placeholder={campoPlaceholder || `Informe o novo ${campoLabel}`}
                      required
                      className="h-10 text-xs rounded-xl border-slate-300"
                    />
                  )}
                </div>

                {/* Justificativa */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-700 block">Justificativa / Observação do Militar</label>
                  <Input
                    type="text"
                    value={justificativa}
                    onChange={(e) => setJustificativa(e.target.value)}
                    placeholder="Ex: Preenchimento de dados cadastrais obrigatórios"
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
