import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, ArrowLeft, User, Briefcase, FileText, Building, Phone, Heart, MapPin, GraduationCap, History, GitBranch } from 'lucide-react';
import { createPageUrl } from '@/utils';

import FormSection from '@/components/militar/FormSection';
import FormField from '@/components/militar/FormField';
import PhotoUpload from '@/components/militar/PhotoUpload';
import TagInput from '@/components/militar/TagInput';
import LotacaoSelector from '@/components/militar/LotacaoSelector';
import FuncaoSelector from '@/components/militar/FuncaoSelector';
import HistoricoComportamentoModal from '@/components/militar/HistoricoComportamentoModal';
import TempoServico from '@/components/militar/TempoServico';
import AlertasContrato from '@/components/militar/AlertasContrato';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { garantirImplantacaoHistoricoComportamento, registrarEventoHistoricoComportamento } from '@/services/justicaDisciplinaService';

const initialFormData = {
  nome_completo: '',
  foto: '',
  status_cadastro: 'Ativo',
  situacao_militar: 'Ativa',
  funcao: '',
  lotacao: '',
  condicao: '',
  destino: '',
  nome_guerra: '',
  matricula: '',
  subgrupamento_id: '',
  subgrupamento_nome: '',
  posto_graduacao: '',
  quadro: '',
  data_inclusao: '',
  comportamento: 'Bom',
  data_nascimento: '',
  sexo: '',
  estado_civil: '',
  tipo_sanguineo: '',
  religiao: '',
  escolaridade: '',
  curso_superior: '',
  pos_graduacao: [],
  mestrado: '',
  doutorado: '',
  naturalidade: '',
  naturalidade_uf: '',
  nome_pai: '',
  nome_mae: '',
  rg: '',
  orgao_expedidor_rg: '',
  uf_rg: '',
  cnh_categoria: '',
  cnh_validade: '',
  cnh_numero: '',
  cpf: '',
  banco: '',
  agencia: '',
  conta: '',
  email_particular: '',
  telefone: '',
  email_funcional: '',
  altura: '',
  peso: '',
  etnia: '',
  logradouro: '',
  numero_endereco: '',
  cep: '',
  bairro: '',
  cidade: '',
  uf: '',
  complemento: '',
  habilidades: [],
  link_alteracoes_anteriores: ''
};

const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

const POSTOS_GRADUACOES = [
  // Oficiais
  { value: 'Coronel', label: 'Coronel (Cel)', grupo: 'Oficiais' },
  { value: 'Tenente Coronel', label: 'Tenente Coronel (TC)', grupo: 'Oficiais' },
  { value: 'Major', label: 'Major (Maj)', grupo: 'Oficiais' },
  { value: 'Capitão', label: 'Capitão (Cap)', grupo: 'Oficiais' },
  { value: '1º Tenente', label: '1º Tenente (1º Ten)', grupo: 'Oficiais' },
  { value: '2º Tenente', label: '2º Tenente (2º Ten)', grupo: 'Oficiais' },
  { value: 'Aspirante', label: 'Aspirante (Asp Of)', grupo: 'Oficiais' },
  // Praças
  { value: 'Subtenente', label: 'Subtenente (ST)', grupo: 'Praças' },
  { value: '1º Sargento', label: '1º Sargento (1º Sgt)', grupo: 'Praças' },
  { value: '2º Sargento', label: '2º Sargento (2º Sgt)', grupo: 'Praças' },
  { value: '3º Sargento', label: '3º Sargento (3º Sgt)', grupo: 'Praças' },
  { value: 'Cabo', label: 'Cabo (CB)', grupo: 'Praças' },
  { value: 'Soldado', label: 'Soldado (SD)', grupo: 'Praças' },
];

const POSTOS_OFICIAIS = ['Coronel', 'Tenente Coronel', 'Major', 'Capitão', '1º Tenente', '2º Tenente', 'Aspirante'];
const isOficial = (posto) => POSTOS_OFICIAIS.includes(posto);

export default function CadastrarMilitar() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const queryClient = useQueryClient();
  const { isAdmin, subgrupamentoId, subgrupamentoTipo, user, canAccessModule, isLoading: loadingUser, isAccessResolved } = useCurrentUser();
  const hasMilitaresAccess = canAccessModule('militares');

  const [formData, setFormData] = useState(initialFormData);

  const [loading, setLoading] = useState(false);
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [comportamentoOriginal, setComportamentoOriginal] = useState(null);

  const { data: subgrupamentosAll = [] } = useQuery({
    queryKey: ['subgrupamentos'],
    queryFn: () => base44.entities.Subgrupamento.list('nome'),
  });
  // Nomenclatura: Grupamento = Setor, Subgrupamento = Subsetor/Seção
  const grupamentos = subgrupamentosAll.filter(s => s.tipo === 'Grupamento');
  const subgrupamentosLista = subgrupamentosAll.filter(s => s.tipo === 'Subgrupamento');

  const { data: editingMilitar, isLoading: loadingEdit } = useQuery({
    queryKey: ['militar', editId],
    queryFn: async () => {
      if (!editId) return null;
      const list = await base44.entities.Militar.filter({ id: editId });
      return list[0] || null;
    },
    enabled: !!editId,
    onSuccess: (data) => {
      if (data) {
        setFormData({ ...initialFormData, ...data });
      }
    }
  });

  React.useEffect(() => {
    if (editingMilitar) {
      setFormData({ ...initialFormData, ...editingMilitar });
      setComportamentoOriginal(editingMilitar.comportamento || null);
    }
  }, [editingMilitar]);

  const [motivoComportamento, setMotivoComportamento] = useState('');

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const dataToSave = {
      ...formData,
      altura: formData.altura ? parseFloat(formData.altura) : null,
      peso: formData.peso ? parseFloat(formData.peso) : null
    };

    // Preencher subgrupamento automaticamente para usuários não-admin
    if (!editId && !isAdmin && subgrupamentoId) {
      dataToSave.subgrupamento_id = subgrupamentoId;
      dataToSave.subgrupamento_nome = user?.subgrupamento_nome || '';
    }

    let militarId = editId;
    if (editId) {
      await base44.entities.Militar.update(editId, dataToSave);
    } else {
      const criado = await base44.entities.Militar.create(dataToSave);
      militarId = criado.id;
    }

    if (!editId && militarId) {
      await garantirImplantacaoHistoricoComportamento({
        militarId,
        comportamentoAtual: formData.comportamento || 'Bom',
        origemTipo: 'Militar',
        origemId: militarId,
        createdBy: user?.email || '',
      });
    } else if (editId && formData.comportamento !== comportamentoOriginal && militarId) {
      await garantirImplantacaoHistoricoComportamento({
        militarId,
        comportamentoAtual: comportamentoOriginal || 'Bom',
        origemTipo: 'Militar',
        origemId: militarId,
        createdBy: user?.email || '',
      });
      await registrarEventoHistoricoComportamento({
        militarId,
        comportamentoAnterior: comportamentoOriginal || 'Bom',
        comportamento: formData.comportamento || 'Bom',
        motivoMudanca: motivoComportamento || 'Revisão manual de comportamento no cadastro do militar.',
        origemTipo: 'Militar',
        origemId: militarId,
        observacoes: motivoComportamento || '',
        createdBy: user?.email || '',
      });
    }
    
    queryClient.invalidateQueries({ queryKey: ['militares'] });
    setLoading(false);
    navigate(createPageUrl('Militares'));
  };

  if (loadingUser || !isAccessResolved) return null;
  if (!hasMilitaresAccess) return <AccessDenied modulo="Efetivo" />;

  if (loadingEdit) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(createPageUrl('Militares'))}
              className="hover:bg-slate-200"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-[#1e3a5f]">
                {editId ? 'Editar Militar' : 'Cadastrar Militar'}
              </h1>
              <p className="text-slate-500 text-sm">
                Preencha os dados do militar
              </p>
            </div>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={loading || !formData.nome_completo || !formData.matricula}
            className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white px-6"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
            ) : (
              <Save className="w-5 h-5 mr-2" />
            )}
            Salvar
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Identificação */}
          <FormSection title="Identificação" icon={User} defaultOpen={true}>
            <div className="flex flex-col md:flex-row gap-6">
              <PhotoUpload value={formData.foto} onChange={handleChange} />
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormField
                  label="Nome Completo"
                  name="nome_completo"
                  value={formData.nome_completo}
                  onChange={handleChange}
                  required
                  className="md:col-span-2"
                />
                <FormField
                  label="Status do Cadastro"
                  name="status_cadastro"
                  value={formData.status_cadastro}
                  onChange={handleChange}
                  type="select"
                  options={['Ativo', 'Inativo']}
                />
                <FormField
                  label="Situação Militar"
                  name="situacao_militar"
                  value={formData.situacao_militar}
                  onChange={handleChange}
                  type="select"
                  options={['Ativa', 'Reserva Remunerada', 'Reformado', 'Designado', 'Convocado']}
                  hint={['Designado', 'Convocado'].includes(formData.situacao_militar) ? 'Situação vinculada a vínculo temporário.' : ''}
                />
                <LotacaoSelector
                  value={formData.lotacao}
                  onChange={handleChange}
                  name="lotacao"
                />
                <FuncaoSelector
                  value={formData.funcao}
                  onChange={handleChange}
                  name="funcao"
                />
                <FormField
                  label="Condição"
                  name="condicao"
                  value={formData.condicao}
                  onChange={handleChange}
                  type="select"
                  options={['Efetivo', 'Adido', 'Agregado', 'Cedido', 'À Disposição']}
                />
                {['Adido', 'Agregado', 'Cedido', 'À Disposição'].includes(formData.condicao) && (
                  <FormField
                    label="Destino"
                    name="destino"
                    value={formData.destino}
                    onChange={handleChange}
                    className="md:col-span-2"
                  />
                )}
              </div>
            </div>
          </FormSection>

          {/* Alertas de contrato para edição */}
          {editId && (
            <div className="space-y-2">
              <AlertasContrato militarId={editId} />
              {formData.data_inclusao && (
                <TempoServico dataInclusao={formData.data_inclusao} />
              )}
            </div>
          )}

          {/* Dados Funcionais */}
          <FormSection title="Dados Funcionais" icon={Briefcase} defaultOpen={true}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Grupamento / Subgrupamento */}
              <div className="col-span-full">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                     <GitBranch className="w-4 h-4 text-[#1e3a5f]" />
                     <span className="text-sm font-semibold text-slate-700">Vinculação Organizacional</span>
                     {!isAdmin && <span className="text-xs text-slate-400">(definido automaticamente)</span>}
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                     <div className="space-y-1">
                       <label className="text-xs font-medium text-slate-600">Setor</label>
                      <select
                        disabled={!isAdmin}
                        className={`w-full border border-slate-200 rounded-md px-3 py-2 text-sm ${!isAdmin ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white'}`}
                        value={formData.grupamento_id || ''}
                        onChange={e => {
                          const gp = grupamentos.find(g => g.id === e.target.value);
                          setFormData(prev => ({
                            ...prev,
                            grupamento_id: e.target.value,
                            grupamento_nome: gp?.nome || '',
                            subgrupamento_id: '',
                            subgrupamento_nome: ''
                          }));
                        }}
                      >
                        <option value="">Nenhum / Selecione...</option>
                        {grupamentos.map(g => (
                          <option key={g.id} value={g.id}>{g.nome} {g.sigla && `(${g.sigla})`}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600">Subsetor / Seção</label>
                      <select
                        disabled={!isAdmin}
                        className={`w-full border border-slate-200 rounded-md px-3 py-2 text-sm ${!isAdmin ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white'}`}
                        value={formData.subgrupamento_id || ''}
                        onChange={e => {
                          const sg = subgrupamentosLista.find(s => s.id === e.target.value);
                          setFormData(prev => ({
                            ...prev,
                            subgrupamento_id: e.target.value,
                            subgrupamento_nome: sg?.nome || ''
                          }));
                        }}
                      >
                        <option value="">Nenhum / Selecione...</option>
                        {(formData.grupamento_id
                          ? subgrupamentosLista.filter(s => s.grupamento_id === formData.grupamento_id)
                          : subgrupamentosLista
                        ).map(s => (
                          <option key={s.id} value={s.id}>{s.nome} {s.sigla && `(${s.sigla})`}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              <FormField
                label="Nome de Guerra"
                name="nome_guerra"
                value={formData.nome_guerra}
                onChange={handleChange}
              />
              <FormField
                label="Matrícula"
                name="matricula"
                value={formData.matricula}
                onChange={handleChange}
                required
              />
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Posto/Graduação</label>
                <Select value={formData.posto_graduacao} onValueChange={(v) => handleChange('posto_graduacao', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_header_oficiais" disabled className="font-semibold text-slate-400 text-xs uppercase">— Oficiais —</SelectItem>
                    {POSTOS_GRADUACOES.filter(p => p.grupo === 'Oficiais').map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                    <SelectItem value="_header_pracas" disabled className="font-semibold text-slate-400 text-xs uppercase">— Praças —</SelectItem>
                    {POSTOS_GRADUACOES.filter(p => p.grupo === 'Praças').map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <FormField
                label="Quadro"
                name="quadro"
                value={formData.quadro}
                onChange={handleChange}
                type="select"
                options={['QOBM', 'QAOBM', 'QOEBM', 'QOSAU', 'QBMP-1.a', 'QBMP-1.b', 'QBMP-2', 'QBMPT']}
              />
              <FormField
                label="Data de Inclusão"
                name="data_inclusao"
                value={formData.data_inclusao}
                onChange={handleChange}
                type="date"
              />
              <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-medium text-slate-700">Comportamento</label>
              {isOficial(formData.posto_graduacao) ? (
                <div className="px-3 py-2 border rounded-md bg-slate-100 text-slate-400 text-sm italic">
                  Não aplicável para Oficiais
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <FormField
                      label=""
                      name="comportamento"
                      value={formData.comportamento}
                      onChange={handleChange}
                      type="select"
                      options={['Excepcional', 'Ótimo', 'Bom', 'Insuficiente', 'MAU']}
                    />
                  </div>
                  {editId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setHistoricoOpen(true)}
                      className="flex-shrink-0 self-end h-10 w-10"
                      title="Ver histórico de comportamento"
                    >
                      <History className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              )}
              {!isOficial(formData.posto_graduacao) && formData.comportamento !== comportamentoOriginal && comportamentoOriginal !== null && (
                <div className="mt-2">
                  <label className="text-xs font-medium text-slate-600">Motivo da alteração <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={motivoComportamento}
                    onChange={e => setMotivoComportamento(e.target.value)}
                    placeholder="Descreva o motivo da alteração do comportamento..."
                    className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]"
                  />
                </div>
              )}
              </div>
            </div>
          </FormSection>

          {/* Dados Pessoais */}
          <FormSection title="Dados Pessoais" icon={User}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <FormField
                label="Data de Nascimento"
                name="data_nascimento"
                value={formData.data_nascimento}
                onChange={handleChange}
                type="date"
              />
              <FormField
                label="Sexo"
                name="sexo"
                value={formData.sexo}
                onChange={handleChange}
                type="select"
                options={['Masculino', 'Feminino']}
              />
              <FormField
                label="Estado Civil"
                name="estado_civil"
                value={formData.estado_civil}
                onChange={handleChange}
                type="select"
                options={['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União Estável']}
              />
              <FormField
                label="Tipo Sanguíneo"
                name="tipo_sanguineo"
                value={formData.tipo_sanguineo}
                onChange={handleChange}
                type="select"
                options={['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']}
              />
              <FormField
                label="Religião"
                name="religiao"
                value={formData.religiao}
                onChange={handleChange}
              />
              <FormField
                label="Escolaridade"
                name="escolaridade"
                value={formData.escolaridade}
                onChange={handleChange}
                type="select"
                options={['Ensino Fundamental Incompleto', 'Ensino Fundamental Completo', 'Ensino Médio Incompleto', 'Ensino Médio Completo', 'Ensino Superior Incompleto', 'Ensino Superior Completo', 'Pós-Graduação', 'Mestrado', 'Doutorado']}
              />
              {['Ensino Superior Completo', 'Pós-Graduação', 'Mestrado', 'Doutorado'].includes(formData.escolaridade) && (
                <>
                  <FormField
                    label="Curso Superior"
                    name="curso_superior"
                    value={formData.curso_superior}
                    onChange={handleChange}
                    placeholder="Ex: Engenharia Civil"
                  />
                  <div className="md:col-span-2">
                    <TagInput
                      label="Pós-Graduações"
                      name="pos_graduacao"
                      value={formData.pos_graduacao}
                      onChange={handleChange}
                      placeholder="Adicionar pós-graduação..."
                    />
                  </div>
                  {['Mestrado', 'Doutorado'].includes(formData.escolaridade) && (
                    <FormField
                      label="Mestrado"
                      name="mestrado"
                      value={formData.mestrado}
                      onChange={handleChange}
                      placeholder="Área do mestrado"
                    />
                  )}
                  {formData.escolaridade === 'Doutorado' && (
                    <FormField
                      label="Doutorado"
                      name="doutorado"
                      value={formData.doutorado}
                      onChange={handleChange}
                      placeholder="Área do doutorado"
                    />
                  )}
                </>
              )}
              <FormField
                label="Naturalidade"
                name="naturalidade"
                value={formData.naturalidade}
                onChange={handleChange}
              />
              <FormField
                label="Naturalidade UF"
                name="naturalidade_uf"
                value={formData.naturalidade_uf}
                onChange={handleChange}
                type="select"
                options={UFS}
              />
            </div>
          </FormSection>

          {/* Filiação */}
          <FormSection title="Filiação" icon={Heart}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                label="Nome do Pai"
                name="nome_pai"
                value={formData.nome_pai}
                onChange={handleChange}
              />
              <FormField
                label="Nome da Mãe"
                name="nome_mae"
                value={formData.nome_mae}
                onChange={handleChange}
              />
            </div>
          </FormSection>

          {/* Documentos */}
          <FormSection title="Documentos" icon={FileText}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <FormField
                label="RG"
                name="rg"
                value={formData.rg}
                onChange={handleChange}
              />
              <FormField
                label="Órgão Expedidor"
                name="orgao_expedidor_rg"
                value={formData.orgao_expedidor_rg}
                onChange={handleChange}
              />
              <FormField
                label="UF RG"
                name="uf_rg"
                value={formData.uf_rg}
                onChange={handleChange}
                type="select"
                options={UFS}
              />
              <FormField
                label="Categoria CNH"
                name="cnh_categoria"
                value={formData.cnh_categoria}
                onChange={handleChange}
                type="select"
                options={['A', 'B', 'AB', 'C', 'D', 'E', 'AC', 'AD', 'AE']}
              />
              <FormField
                label="Validade CNH"
                name="cnh_validade"
                value={formData.cnh_validade}
                onChange={handleChange}
                type="date"
              />
              <FormField
                label="Número CNH"
                name="cnh_numero"
                value={formData.cnh_numero}
                onChange={handleChange}
              />
              <FormField
                label="CPF"
                name="cpf"
                value={formData.cpf}
                onChange={handleChange}
              />
            </div>
          </FormSection>

          {/* Dados Bancários */}
          <FormSection title="Dados Bancários" icon={Building}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                label="Banco"
                name="banco"
                value={formData.banco}
                onChange={handleChange}
              />
              <FormField
                label="Agência"
                name="agencia"
                value={formData.agencia}
                onChange={handleChange}
              />
              <FormField
                label="Conta"
                name="conta"
                value={formData.conta}
                onChange={handleChange}
              />
            </div>
          </FormSection>

          {/* Contatos */}
          <FormSection title="Contatos" icon={Phone}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <FormField
                label="Email Particular"
                name="email_particular"
                value={formData.email_particular}
                onChange={handleChange}
                type="email"
              />
              <FormField
                label="Telefone"
                name="telefone"
                value={formData.telefone}
                onChange={handleChange}
              />
              <FormField
                label="Email Funcional"
                name="email_funcional"
                value={formData.email_funcional}
                onChange={handleChange}
                type="email"
              />
            </div>
          </FormSection>

          {/* Dados Antropométricos */}
          <FormSection title="Dados Antropométricos" icon={User}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                label="Altura (m)"
                name="altura"
                value={formData.altura}
                onChange={handleChange}
                type="number"
                placeholder="Ex: 1.75"
              />
              <FormField
                label="Peso (kg)"
                name="peso"
                value={formData.peso}
                onChange={handleChange}
                type="number"
                placeholder="Ex: 75"
              />
              <FormField
                label="Etnia"
                name="etnia"
                value={formData.etnia}
                onChange={handleChange}
                type="select"
                options={['Branca', 'Preta', 'Parda', 'Amarela', 'Indígena']}
              />
            </div>
          </FormSection>

          {/* Endereço */}
          <FormSection title="Endereço" icon={MapPin}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <FormField
                label="Logradouro"
                name="logradouro"
                value={formData.logradouro}
                onChange={handleChange}
                className="md:col-span-2"
              />
              <FormField
                label="Número"
                name="numero_endereco"
                value={formData.numero_endereco}
                onChange={handleChange}
              />
              <FormField
                label="CEP"
                name="cep"
                value={formData.cep}
                onChange={handleChange}
              />
              <FormField
                label="Bairro"
                name="bairro"
                value={formData.bairro}
                onChange={handleChange}
              />
              <FormField
                label="Cidade"
                name="cidade"
                value={formData.cidade}
                onChange={handleChange}
              />
              <FormField
                label="UF"
                name="uf"
                value={formData.uf}
                onChange={handleChange}
                type="select"
                options={UFS}
              />
              <FormField
                label="Complemento"
                name="complemento"
                value={formData.complemento}
                onChange={handleChange}
                className="md:col-span-2"
              />
            </div>
          </FormSection>

          {/* Habilidades */}
          <FormSection title="Habilidades" icon={GraduationCap}>
            <TagInput
              label="Habilidades"
              name="habilidades"
              value={formData.habilidades}
              onChange={handleChange}
              placeholder="Adicionar habilidade..."
            />
          </FormSection>

          {/* Link de Alterações Anteriores */}
          <FormSection title="Documentos Externos" icon={FileText}>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Link para Alterações Anteriores (Drive/Pasta)</label>
              <p className="text-xs text-slate-400">Cole o link de uma pasta no Drive com os documentos de alterações anteriores deste militar.</p>
              <input
                type="url"
                value={formData.link_alteracoes_anteriores || ''}
                onChange={e => handleChange('link_alteracoes_anteriores', e.target.value)}
                placeholder="https://drive.google.com/..."
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]"
              />
            </div>
          </FormSection>

          {/* Histórico de Comportamento */}
          <HistoricoComportamentoModal
            militarId={editId}
            open={historicoOpen}
            onClose={() => setHistoricoOpen(false)}
          />

          {/* Submit Button Mobile */}
          <div className="md:hidden">
            <Button
              type="submit"
              disabled={loading || !formData.nome_completo || !formData.matricula}
              className="w-full bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white py-6"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <Save className="w-5 h-5 mr-2" />
              )}
              Salvar Cadastro
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
