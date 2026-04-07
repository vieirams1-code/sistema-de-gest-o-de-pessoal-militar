import React, { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Save, ArrowLeft, Upload, FileText, User as UserIcon, Calendar, Clipboard, BookOpen, Download, Trash2 } from 'lucide-react';
import { createPageUrl } from '@/utils';

import FormSection from '@/components/militar/FormSection';
import FormField from '@/components/militar/FormField';
import MilitarSelector from '@/components/atestado/MilitarSelector';
import CidSelector from '@/components/atestado/CidSelector';
import DateCalculator from '@/components/atestado/DateCalculator';
import { sincronizarAtestadoJisoNoQuadro } from '@/components/quadro/quadroHelpers';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';

const initialFormData = {
  militar_id: '',
  militar_nome: '',
  militar_posto: '',
  militar_matricula: '',
  medico: '',
  arquivo_atestado: '',
  tipo_afastamento: 'Afastamento Total',
  cid_10: '',
  cid_descricao: '',
  acompanhado: false,
  grau_parentesco: '',
  data_inicio: '',
  dias: '',
  data_termino: '',
  data_retorno: '',
  status: 'Ativo',
  fluxo_homologacao: '', // 'comandante' ou 'jiso' — definido pelo usuário ou forçado quando dias > 15
  necessita_jiso: false,
  homologado_comandante: false,
  encaminhado_jiso: false,
  data_jiso_agendada: '',
  observacoes: ''
};

export default function CadastrarAtestado() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const queryClient = useQueryClient();
  const { canAccessModule, isLoading: loadingUser, isAccessResolved } = useCurrentUser();
  const hasAtestadosAccess = canAccessModule('atestados');

  const [formData, setFormData] = useState(initialFormData);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

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

  // Ao escolher fluxo manualmente, sincronizar campos derivados
  const handleFluxoChange = (fluxo) => {
    setFormData(prev => ({
      ...prev,
      fluxo_homologacao: fluxo,
      necessita_jiso: fluxo === 'jiso',
      homologado_comandante: false,
      encaminhado_jiso: fluxo === 'jiso',
    }));
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
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveFile = () => {
    handleChange('arquivo_atestado', '');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Quando dias muda: forçar JISO se >15, sem sobrescrever decisão manual para <=15
  React.useEffect(() => {
    const dias = parseInt(formData.dias) || 0;
    if (dias > 15) {
      setFormData(prev => ({
        ...prev,
        fluxo_homologacao: 'jiso',
        necessita_jiso: true,
        homologado_comandante: false,
        encaminhado_jiso: true,
      }));
    }
  }, [formData.dias]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const dataToSave = {
      ...formData,
      dias: formData.dias ? parseInt(formData.dias) : 0,
    };

    // Remover campos que não existem mais no schema
    delete dataToSave.texto_publicacao;
    delete dataToSave.nota_para_bg;
    delete dataToSave.numero_bg;
    delete dataToSave.data_bg;
    delete dataToSave.status_publicacao;
    delete dataToSave.data_jiso;
    delete dataToSave.secao_jiso;
    delete dataToSave.finalidade_jiso;
    delete dataToSave.nup;
    delete dataToSave.resultado_jiso;
    delete dataToSave.dias_jiso;
    delete dataToSave.ata_jiso;
    delete dataToSave.parecer_jiso;

    let atestadoSalvo;
    if (editId) {
      await base44.entities.Atestado.update(editId, dataToSave);
      atestadoSalvo = { id: editId, ...formData, ...dataToSave };
    } else {
      atestadoSalvo = await base44.entities.Atestado.create(dataToSave);
    }

    await sincronizarAtestadoJisoNoQuadro(atestadoSalvo);

    queryClient.invalidateQueries({ queryKey: ['atestados'] });
    queryClient.invalidateQueries({ queryKey: ['cards'] });
    queryClient.invalidateQueries({ queryKey: ['conciliacao-atestados-publicacao'] });
    setLoading(false);
    navigate(createPageUrl('Atestados'));
  };

  if (loadingUser || !isAccessResolved) return null;
  if (!hasAtestadosAccess) return <AccessDenied modulo="Atestados" />;

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
              <FormField
                label="Nome do Médico"
                name="medico"
                value={formData.medico}
                onChange={handleChange}
                placeholder="Dr(a)..."
              />

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
                    ref={fileInputRef}
                  />
                  {formData.arquivo_atestado && (
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={formData.arquivo_atestado}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Baixar arquivo anexado
                      </a>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="h-8"
                      >
                        <Upload className="w-4 h-4 mr-1" />
                        Substituir arquivo
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleRemoveFile}
                        className="h-8 text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Remover arquivo
                      </Button>
                    </div>
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

          {/* Tipo de Afastamento */}
          <FormSection title="Tipo de Afastamento" icon={Clipboard}>
            <FormField
              label="Tipo de Afastamento"
              name="tipo_afastamento"
              value={formData.tipo_afastamento}
              onChange={handleChange}
              type="select"
              options={['Afastamento Total', 'Esforço Físico']}
            />
          </FormSection>

          {/* Fluxo de Homologação — decisão do usuário ou forçada */}
          {formData.dias > 0 && (
            <FormSection title="Fluxo de Homologação" icon={Clipboard}>
              {parseInt(formData.dias) > 15 ? (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-semibold text-blue-800">
                    Atestado com mais de 15 dias — encaminhamento obrigatório para JISO.
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    A publicação será gerada pelo módulo de Ata JISO após a realização da inspeção.
                  </p>
                  {formData.data_jiso_agendada !== undefined && (
                    <div className="mt-3">
                      <FormField
                        label="Data JISO Agendada"
                        name="data_jiso_agendada"
                        value={formData.data_jiso_agendada || ''}
                        onChange={handleChange}
                        type="date"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">
                    Atestado com até 15 dias. Selecione o fluxo de homologação:
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleFluxoChange('comandante')}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        formData.fluxo_homologacao === 'comandante'
                          ? 'border-[#1e3a5f] bg-[#1e3a5f]/5'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <p className={`text-sm font-semibold ${formData.fluxo_homologacao === 'comandante' ? 'text-[#1e3a5f]' : 'text-slate-700'}`}>
                        Comandante
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">Homologação direta pelo Comandante</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFluxoChange('jiso')}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        formData.fluxo_homologacao === 'jiso'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <p className={`text-sm font-semibold ${formData.fluxo_homologacao === 'jiso' ? 'text-blue-700' : 'text-slate-700'}`}>
                        JISO
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">Encaminhar para inspeção de saúde</p>
                    </button>
                  </div>
                  {formData.fluxo_homologacao === 'jiso' && (
                    <FormField
                      label="Data JISO Agendada"
                      name="data_jiso_agendada"
                      value={formData.data_jiso_agendada || ''}
                      onChange={handleChange}
                      type="date"
                    />
                  )}
                  {formData.fluxo_homologacao === 'comandante' && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      <p className="text-xs text-slate-500">
                        A publicação de Homologação pelo Comandante será gerada em <strong>Publicação Ex Officio → Homologação de Atestado</strong>.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </FormSection>
          )}

          {/* Status */}
          <FormSection title="Status" icon={Clipboard}>
            <FormField
              label="Status do Atestado"
              name="status"
              value={formData.status}
              onChange={handleChange}
              type="select"
              options={['Ativo', 'Encerrado']}
            />
          </FormSection>

          {/* Observações */}
          <FormSection title="Observações" icon={FileText}>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">Observações</Label>
              <Textarea
                value={formData.observacoes}
                onChange={(e) => handleChange('observacoes', e.target.value)}
                placeholder="Observações gerais..."
                className="min-h-24 border-slate-200"
              />
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