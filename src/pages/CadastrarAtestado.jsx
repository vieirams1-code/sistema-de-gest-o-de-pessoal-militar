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
  necessita_jiso: false,
  homologado_comandante: false,
  encaminhado_jiso: false,
  data_jiso: '',
  secao_jiso: '',
  finalidade_jiso: '',
  nup: '',
  resultado_jiso: '',
  dias_jiso: '',
  ata_jiso: '',
  parecer_jiso: '',
  texto_publicacao: '',
  nota_para_bg: '',
  numero_bg: '',
  data_bg: '',
  status_publicacao: 'Aguardando Nota',
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

  const gerarTextoPublicacao = () => {
    const postoNome = formData.militar_posto ? `${formData.militar_posto} QOBM` : '';
    const nomeCompleto = formData.militar_nome || '';
    const matricula = formData.militar_matricula || '';
    
    const formatarData = (dataStr) => {
      if (!dataStr) return '';
      const [ano, mes, dia] = dataStr.split('-');
      return `${dia}/${mes}/${ano}`;
    };

    if (formData.necessita_jiso && formData.encaminhado_jiso && formData.ata_jiso) {
      // Texto da Ata JISO
      return `A Comandante do 1° Grupamento de Bombeiros Militar torna público o seguinte: JISO ${formData.secao_jiso || ''}, realizada em ${formatarData(formData.data_jiso)}, com finalidade de ${formData.finalidade_jiso || ''}, NUP: ${formData.nup || ''}, Ata n° ${formData.ata_jiso}. Parecer: ${formData.parecer_jiso || ''}. ${postoNome} ${nomeCompleto}, matrícula ${matricula}. Em consequência: (1) Ao Chefe da B-1: proceder nos assentamentos do militar; (2) publique-se.`;
    } else if (formData.homologado_comandante) {
      // Texto de Homologação do Comandante
      const diasExtenso = {
        1: 'um', 2: 'dois', 3: 'três', 4: 'quatro', 5: 'cinco',
        6: 'seis', 7: 'sete', 8: 'oito', 9: 'nove', 10: 'dez',
        11: 'onze', 12: 'doze', 13: 'treze', 14: 'quatorze', 15: 'quinze'
      };
      const diasTexto = diasExtenso[formData.dias] || formData.dias;
      
      return `A Comandante do 1° Grupamento de Bombeiros Militar, no uso das atribuições que lhe confere o art. 49, II, do Decreto nº 5.698, de 21 de novembro de 1990, homologa o afastamento médico do ${postoNome} ${nomeCompleto}, matrícula ${matricula}, pelo período de ${formData.dias} (${diasTexto}) dias, ${formData.tipo_afastamento.toLowerCase()}, a contar de ${formatarData(formData.data_inicio)}, com término em ${formatarData(formData.data_termino)}. Em consequência: (1) Ao Chefe da B-1: proceder nos assentamentos do militar; (2) publique-se.`;
    }
    
    return '';
  };

  React.useEffect(() => {
    // Auto-marcar homologado_comandante quando necessita_jiso for false
    if (!formData.necessita_jiso && !formData.homologado_comandante && formData.dias > 0) {
      setFormData(prev => ({ ...prev, homologado_comandante: true }));
    }
  }, [formData.necessita_jiso, formData.dias]);

  React.useEffect(() => {
    if (formData.militar_nome && formData.data_inicio && formData.dias) {
      const textoGerado = gerarTextoPublicacao();
      if (textoGerado && textoGerado !== formData.texto_publicacao) {
        setFormData(prev => ({ ...prev, texto_publicacao: textoGerado }));
      }
    }
  }, [
    formData.militar_nome,
    formData.militar_posto,
    formData.militar_matricula,
    formData.data_inicio,
    formData.dias,
    formData.data_termino,
    formData.tipo_afastamento,
    formData.necessita_jiso,
    formData.encaminhado_jiso,
    formData.homologado_comandante,
    formData.ata_jiso,
    formData.data_jiso,
    formData.secao_jiso,
    formData.finalidade_jiso,
    formData.nup,
    formData.parecer_jiso
  ]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const dataToSave = {
      ...formData,
      dias: formData.dias ? parseInt(formData.dias) : 0,
      dias_jiso: formData.dias_jiso ? parseInt(formData.dias_jiso) : undefined
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

          {/* JISO */}
          <FormSection title="JISO - Junta de Inspeção de Saúde" icon={Clipboard}>
            <div className="space-y-4">
              <FormField
                label="Tipo de Afastamento"
                name="tipo_afastamento"
                value={formData.tipo_afastamento}
                onChange={handleChange}
                type="select"
                options={['Afastamento Total', 'Esforço Físico']}
              />

              <div className="flex items-center space-x-2 p-3 bg-slate-50 rounded-lg">
                <Checkbox
                  id="necessita_jiso"
                  checked={formData.necessita_jiso}
                  onCheckedChange={(checked) => handleChange('necessita_jiso', checked)}
                />
                <Label htmlFor="necessita_jiso" className="text-sm cursor-pointer">
                  Necessita encaminhamento para JISO (mais de 15 dias ou decisão do comandante)
                </Label>
              </div>

              {!formData.necessita_jiso && (
                <div className="flex items-center space-x-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <Checkbox
                    id="homologado_comandante"
                    checked={formData.homologado_comandante}
                    onCheckedChange={(checked) => handleChange('homologado_comandante', checked)}
                  />
                  <Label htmlFor="homologado_comandante" className="text-sm cursor-pointer font-medium text-green-900">
                    ✓ Homologado pelo Comandante (menos de 15 dias)
                  </Label>
                </div>
              )}

              {formData.necessita_jiso && (
                <>
                  <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg">
                    <Checkbox
                      id="encaminhado_jiso"
                      checked={formData.encaminhado_jiso}
                      onCheckedChange={(checked) => handleChange('encaminhado_jiso', checked)}
                    />
                    <Label htmlFor="encaminhado_jiso" className="text-sm cursor-pointer">
                      Encaminhado para JISO
                    </Label>
                  </div>

                  {formData.encaminhado_jiso && (
                    <div className="space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h4 className="font-semibold text-sm text-blue-900">Dados da Ata da JISO</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          label="Data da JISO"
                          name="data_jiso"
                          value={formData.data_jiso}
                          onChange={handleChange}
                          type="date"
                          required
                        />
                        <FormField
                          label="Seção JISO"
                          name="secao_jiso"
                          value={formData.secao_jiso}
                          onChange={handleChange}
                          placeholder="Ex: qwe"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          label="Finalidade"
                          name="finalidade_jiso"
                          value={formData.finalidade_jiso}
                          onChange={handleChange}
                          type="select"
                          options={['V.A.F', 'LTS', 'Reserva Remunerada', 'Atestado de Origem']}
                          required
                        />
                        <FormField
                          label="NUP"
                          name="nup"
                          value={formData.nup}
                          onChange={handleChange}
                          placeholder="Número do NUP"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          label="Número da Ata"
                          name="ata_jiso"
                          value={formData.ata_jiso}
                          onChange={handleChange}
                          placeholder="Ex: 001/2025"
                          required
                        />
                        <FormField
                          label="Resultado da JISO"
                          name="resultado_jiso"
                          value={formData.resultado_jiso}
                          onChange={handleChange}
                          type="select"
                          options={['Homologado', 'Diminuído', 'Prorrogado']}
                        />
                      </div>

                      {formData.resultado_jiso && (
                        <FormField
                          label="Dias definidos pela JISO"
                          name="dias_jiso"
                          value={formData.dias_jiso}
                          onChange={handleChange}
                          type="number"
                        />
                      )}

                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium text-slate-700">Parecer da JISO <span className="text-red-500">*</span></Label>
                        <Textarea
                          value={formData.parecer_jiso}
                          onChange={(e) => handleChange('parecer_jiso', e.target.value)}
                          placeholder="Parecer da junta..."
                          className="min-h-20 border-slate-200"
                          required
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </FormSection>

          {/* Controle de Publicação */}
          <FormSection title="Controle de Publicação" icon={Clipboard}>
            {formData.texto_publicacao && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <Label className="text-sm font-semibold text-blue-900 mb-2 block">
                  Texto Gerado para Publicação
                </Label>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {formData.texto_publicacao}
                </p>
              </div>
            )}
            
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
                label="Status da Publicação"
                name="status_publicacao"
                value={formData.status_publicacao}
                onChange={handleChange}
                type="select"
                options={['Aguardando Nota', 'Aguardando Publicação', 'Publicado']}
              />
              <FormField
                label="Nota para BG"
                name="nota_para_bg"
                value={formData.nota_para_bg}
                onChange={handleChange}
                placeholder="Ex: 001/2025"
              />
              <FormField
                label="Número do BG"
                name="numero_bg"
                value={formData.numero_bg}
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