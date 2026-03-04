import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Save, ArrowLeft, User, Briefcase, FileText, Building, Phone, Heart, MapPin, GraduationCap, History } from 'lucide-react';
import { createPageUrl } from '@/utils';

import FormSection from '@/components/militar/FormSection';
import FormField from '@/components/militar/FormField';
import PhotoUpload from '@/components/militar/PhotoUpload';
import TagInput from '@/components/militar/TagInput';
import LotacaoSelector from '@/components/militar/LotacaoSelector';
import FuncaoSelector from '@/components/militar/FuncaoSelector';
import HistoricoComportamentoModal from '@/components/militar/HistoricoComportamentoModal';

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
  habilidades: []
};

const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

export default function CadastrarMilitar() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState(initialFormData);
  const [loading, setLoading] = useState(false);
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [comportamentoOriginal, setComportamentoOriginal] = useState(null);

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

    let militarId = editId;
    if (editId) {
      await base44.entities.Militar.update(editId, dataToSave);
    } else {
      const criado = await base44.entities.Militar.create(dataToSave);
      militarId = criado.id;
    }

    // Registrar alteração manual de comportamento
    const comportamentoMudou = editId
      ? formData.comportamento !== comportamentoOriginal
      : formData.comportamento; // novo cadastro com comportamento definido

    if (comportamentoMudou && militarId) {
      await base44.entities.HistoricoComportamento.create({
        militar_id: militarId,
        militar_nome: formData.nome_completo,
        comportamento_anterior: comportamentoOriginal || null,
        comportamento_novo: formData.comportamento,
        motivo: 'Manual',
        data_alteracao: new Date().toISOString().split('T')[0],
        observacoes: editId ? (motivoComportamento || 'Alteração manual no cadastro') : 'Definição inicial no cadastro'
      });
    }
    
    queryClient.invalidateQueries({ queryKey: ['militares'] });
    setLoading(false);
    navigate(createPageUrl('Militares'));
  };

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

          {/* Dados Funcionais */}
          <FormSection title="Dados Funcionais" icon={Briefcase} defaultOpen={true}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
              <FormField
                label="Posto/Graduação"
                name="posto_graduacao"
                value={formData.posto_graduacao}
                onChange={handleChange}
                type="select"
                options={['Coronel', 'Tenente Coronel', 'Major', 'Capitão', '1º Tenente', '2º Tenente', 'Aspirante', 'Subtenente', '1º Sargento', '2º Sargento', '3º Sargento', 'Cabo', 'Soldado']}
              />
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
              {formData.comportamento !== comportamentoOriginal && comportamentoOriginal !== null && (
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