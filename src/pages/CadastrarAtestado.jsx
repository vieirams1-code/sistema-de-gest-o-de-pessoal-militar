import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Save, ArrowLeft, Upload, FileText, User as UserIcon, Calendar, Clipboard, BookOpen } from 'lucide-react';
import { createPageUrl } from '@/utils';

import FormSection from '@/components/militar/FormSection';
import FormField from '@/components/militar/FormField';
import MilitarSelector from '@/components/atestado/MilitarSelector';
import CidSelector from '@/components/atestado/CidSelector';
import DateCalculator from '@/components/atestado/DateCalculator';

const initialFormData = {
  militar_id: '',
  militar_nome: '',
  militar_posto: '',
  militar_matricula: '',
  medico: '',
  arquivo_atestado: '',
  tipo: 'Médico',
  cid_10: '',
  cid_descricao: '',
  acompanhado: false,
  grau_parentesco: '',
  data_inicio: '',
  dias: '',
  data_termino: '',
  data_retorno: '',
  status: 'Ativo',
  bg: '',
  data_bg: '',
  publicacao_nota: false,
  nota_para_bg: '',
  texto_publicacao: '',
  das_escusas: '',
  retorno: '',
  ocultos: '',
  observacoes: ''
};

export default function CadastrarAtestado() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState(initialFormData);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: editingAtestado, isLoading: loadingEdit } = useQuery({
    queryKey: ['atestado', editId],
    queryFn: async () => {
      if (!editId) return null;
      const list = await base44.entities.Atestado.filter({ id: editId });
      return list[0] || null;
    },
    enabled: !!editId
  });

  React.useEffect(() => {
    if (editingAtestado) {
      setFormData({ ...initialFormData, ...editingAtestado });
    }
  }, [editingAtestado]);

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleMilitarSelect = (militarData) => {
    setFormData(prev => ({ ...prev, ...militarData }));
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      handleChange('arquivo_atestado', file_url);
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const dataToSave = {
      ...formData,
      dias: formData.dias ? parseInt(formData.dias) : 0
    };

    if (editId) {
      await base44.entities.Atestado.update(editId, dataToSave);
    } else {
      await base44.entities.Atestado.create(dataToSave);
    }
    
    queryClient.invalidateQueries({ queryKey: ['atestados'] });
    setLoading(false);
    navigate(createPageUrl('Atestados'));
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
              onClick={() => navigate(createPageUrl('Atestados'))}
              className="hover:bg-slate-200"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-[#1e3a5f]">
                {editId ? 'Editar Atestado' : 'Cadastrar Atestado'}
              </h1>
              <p className="text-slate-500 text-sm">
                Preencha os dados do atestado médico
              </p>
            </div>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={loading || !formData.militar_id || !formData.data_inicio || !formData.dias}
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
          {/* Identificação do Militar */}
          <FormSection title="Militar" icon={UserIcon} defaultOpen={true}>
            <MilitarSelector
              value={formData.militar_id}
              onChange={handleChange}
              onMilitarSelect={handleMilitarSelect}
            />
          </FormSection>

          {/* Dados do Atestado */}
          <FormSection title="Dados do Atestado" icon={FileText}>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  label="Tipo de Atestado"
                  name="tipo"
                  value={formData.tipo}
                  onChange={handleChange}
                  type="select"
                  options={['Médico', 'Odontológico', 'Psicológico', 'Acompanhamento', 'Outro']}
                />
                <FormField
                  label="Nome do Médico"
                  name="medico"
                  value={formData.medico}
                  onChange={handleChange}
                  placeholder="Dr(a)..."
                />
              </div>

              <div className="flex items-center space-x-2 p-3 bg-slate-50 rounded-lg">
                <Checkbox
                  id="acompanhado"
                  checked={formData.acompanhado}
                  onCheckedChange={(checked) => handleChange('acompanhado', checked)}
                />
                <Label htmlFor="acompanhado" className="text-sm cursor-pointer">
                  Este é um atestado de acompanhamento
                </Label>
              </div>

              {formData.acompanhado && (
                <FormField
                  label="Grau de Parentesco"
                  name="grau_parentesco"
                  value={formData.grau_parentesco}
                  onChange={handleChange}
                  type="select"
                  options={['Pai', 'Mãe', 'Filho(a)', 'Cônjuge', 'Irmão(ã)', 'Avô(ó)', 'Outro']}
                />
              )}

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Arquivo do Atestado</Label>
                <div className="flex flex-col gap-3">
                  <label
                    htmlFor="arquivo-upload"
                    className="flex items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-[#1e3a5f] hover:bg-slate-50 transition-all"
                  >
                    {uploading ? (
                      <div className="w-5 h-5 border-2 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Upload className="w-5 h-5 text-slate-400" />
                        <span className="text-sm text-slate-600">
                          {formData.arquivo_atestado ? 'Trocar arquivo' : 'Clique para fazer upload'}
                        </span>
                      </>
                    )}
                  </label>
                  <input
                    id="arquivo-upload"
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  {formData.arquivo_atestado && (
                    <a
                      href={formData.arquivo_atestado}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      Ver arquivo anexado
                    </a>
                  )}
                </div>
              </div>
            </div>
          </FormSection>

          {/* CID-10 */}
          <FormSection title="CID-10" icon={BookOpen}>
            <CidSelector
              cidValue={formData.cid_10}
              descricaoValue={formData.cid_descricao}
              onChange={handleChange}
            />
          </FormSection>

          {/* Período e Vigência */}
          <FormSection title="Período e Vigência" icon={Calendar}>
            <DateCalculator
              dataInicio={formData.data_inicio}
              dias={formData.dias}
              dataTermino={formData.data_termino}
              dataRetorno={formData.data_retorno}
              onChange={handleChange}
            />
          </FormSection>

          {/* Status e Controle */}
          <FormSection title="Status e Controle" icon={Clipboard}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                label="Status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                type="select"
                options={['Ativo', 'Encerrado', 'Cancelado', 'Prorrogado']}
              />
              <FormField
                label="BG"
                name="bg"
                value={formData.bg}
                onChange={handleChange}
                placeholder="Número do Boletim Geral"
              />
              <FormField
                label="Data do BG"
                name="data_bg"
                value={formData.data_bg}
                onChange={handleChange}
                type="date"
              />
            </div>

            <div className="flex items-center space-x-2 mt-4 p-3 bg-slate-50 rounded-lg">
              <Checkbox
                id="publicacao_nota"
                checked={formData.publicacao_nota}
                onCheckedChange={(checked) => handleChange('publicacao_nota', checked)}
              />
              <Label htmlFor="publicacao_nota" className="text-sm cursor-pointer">
                Publicado em nota
              </Label>
            </div>
          </FormSection>

          {/* Informações Adicionais */}
          <FormSection title="Informações Adicionais" icon={FileText}>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">Nota para BG</Label>
                <Textarea
                  value={formData.nota_para_bg}
                  onChange={(e) => handleChange('nota_para_bg', e.target.value)}
                  placeholder="Nota para publicação no Boletim Geral..."
                  className="min-h-24 border-slate-200"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">Texto para Publicação</Label>
                <Textarea
                  value={formData.texto_publicacao}
                  onChange={(e) => handleChange('texto_publicacao', e.target.value)}
                  placeholder="Texto completo da publicação..."
                  className="min-h-24 border-slate-200"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">Das Escusas</Label>
                  <Textarea
                    value={formData.das_escusas}
                    onChange={(e) => handleChange('das_escusas', e.target.value)}
                    placeholder="Informações sobre escusas..."
                    className="min-h-20 border-slate-200"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">Retorno</Label>
                  <Textarea
                    value={formData.retorno}
                    onChange={(e) => handleChange('retorno', e.target.value)}
                    placeholder="Informações sobre o retorno..."
                    className="min-h-20 border-slate-200"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">Observações</Label>
                <Textarea
                  value={formData.observacoes}
                  onChange={(e) => handleChange('observacoes', e.target.value)}
                  placeholder="Observações gerais..."
                  className="min-h-24 border-slate-200"
                />
              </div>
            </div>
          </FormSection>

          {/* Submit Button Mobile */}
          <div className="md:hidden">
            <Button
              type="submit"
              disabled={loading || !formData.militar_id || !formData.data_inicio || !formData.dias}
              className="w-full bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white py-6"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <Save className="w-5 h-5 mr-2" />
              )}
              Salvar Atestado
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}