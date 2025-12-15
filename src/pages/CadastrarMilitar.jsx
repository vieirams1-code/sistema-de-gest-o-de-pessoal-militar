import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Save, ArrowLeft, User, Briefcase, FileText, Building, Phone, Heart, MapPin, GraduationCap } from 'lucide-react';
import { createPageUrl } from '@/utils';

import FormSection from '@/components/militar/FormSection';
import FormField from '@/components/militar/FormField';
import PhotoUpload from '@/components/militar/PhotoUpload';
import TagInput from '@/components/militar/TagInput';

const initialFormData = {
  nome_completo: '',
  foto: '',
  status_cadastro: 'Ativo',
  funcoes: [],
  lotacao: '',
  condicao: '',
  cedencia: '',
  origem_destino: '',
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
  cursos: [],
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
    }
  }, [editingMilitar]);

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

    if (editId) {
      await base44.entities.Militar.update(editId, dataToSave);
    } else {
      await base44.entities.Militar.create(dataToSave);
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
                  options={['Ativo', 'Inativo', 'Reserva', 'Reforma', 'Falecido']}
                />
                <FormField
                  label="Lotação"
                  name="lotacao"
                  value={formData.lotacao}
                  onChange={handleChange}
                />
                <FormField
                  label="Condição"
                  name="condicao"
                  value={formData.condicao}
                  onChange={handleChange}
                  type="select"
                  options={['Efetivo', 'Adido', 'Agregado', 'Cedido', 'À Disposição']}
                />
                <FormField
                  label="Cedência"
                  name="cedencia"
                  value={formData.cedencia}
                  onChange={handleChange}
                />
                <FormField
                  label="Origem ou Destino"
                  name="origem_destino"
                  value={formData.origem_destino}
                  onChange={handleChange}
                />
                <div className="md:col-span-2 lg:col-span-3">
                  <TagInput
                    label="Funções"
                    name="funcoes"
                    value={formData.funcoes}
                    onChange={handleChange}
                    placeholder="Adicionar função..."
                  />
                </div>
              </div>
            </div>
          </FormSection>

          {/* Dados Funcionais */}
          <FormSection title="Dados Funcionais" icon={Briefcase}>
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
                options={['Soldado', 'Cabo', '3º Sargento', '2º Sargento', '1º Sargento', 'Subtenente', 'Aspirante', '2º Tenente', '1º Tenente', 'Capitão', 'Major', 'Tenente-Coronel', 'Coronel']}
              />
              <FormField
                label="Quadro"
                name="quadro"
                value={formData.quadro}
                onChange={handleChange}
                type="select"
                options={['QOBM', 'QOPM', 'QPM', 'QPBM', 'QOC', 'QPCPM']}
              />
              <FormField
                label="Data de Inclusão"
                name="data_inclusao"
                value={formData.data_inclusao}
                onChange={handleChange}
                type="date"
              />
              <FormField
                label="Comportamento"
                name="comportamento"
                value={formData.comportamento}
                onChange={handleChange}
                type="select"
                options={['Excepcional', 'Ótimo', 'Bom', 'Regular', 'Insuficiente']}
              />
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

          {/* Habilidades e Cursos */}
          <FormSection title="Habilidades e Cursos" icon={GraduationCap}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <TagInput
                label="Habilidades"
                name="habilidades"
                value={formData.habilidades}
                onChange={handleChange}
                placeholder="Adicionar habilidade..."
              />
              <TagInput
                label="Cursos"
                name="cursos"
                value={formData.cursos}
                onChange={handleChange}
                placeholder="Adicionar curso..."
              />
            </div>
          </FormSection>

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