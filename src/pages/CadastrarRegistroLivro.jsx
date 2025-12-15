import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Calendar } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { format, addDays } from 'date-fns';

import MilitarSelector from '@/components/atestado/MilitarSelector';
import FeriasSelector from '@/components/livro/FeriasSelector';
import FormField from '@/components/militar/FormField';

const initialFormData = {
  militar_id: '',
  militar_nome: '',
  militar_posto: '',
  militar_matricula: '',
  ferias_id: '',
  tipo_registro: 'Saída Férias',
  data_registro: new Date().toISOString().split('T')[0],
  nota_para_bg: '',
  numero_bg: '',
  data_bg: '',
  status: 'Aguardando Nota',
  observacoes: ''
};

export default function CadastrarRegistroLivro() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState(initialFormData);
  const [loading, setLoading] = useState(false);
  const [selectedFerias, setSelectedFerias] = useState(null);
  const [textoPublicacao, setTextoPublicacao] = useState('');

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleMilitarSelect = (militar) => {
    setFormData(prev => ({
      ...prev,
      militar_id: militar.id,
      militar_nome: militar.nome_completo,
      militar_posto: militar.posto_graduacao,
      militar_matricula: militar.matricula
    }));
    setSelectedFerias(null);
  };

  const handleFeriasSelect = (ferias) => {
    setSelectedFerias(ferias);
    setFormData(prev => ({
      ...prev,
      ferias_id: ferias.id,
      data_registro: ferias.data_inicio
    }));
    
    // Gerar texto automático
    gerarTextoPublicacao(ferias, formData);
  };

  const gerarTextoPublicacao = (ferias, dados) => {
    const postoNome = ferias.militar_posto ? `${ferias.militar_posto} QOBM` : '';
    const nomeCompleto = ferias.militar_nome || '';
    const matricula = ferias.militar_matricula || '';
    const dataInicio = ferias.data_inicio ? format(new Date(ferias.data_inicio + 'T00:00:00'), 'dd/MM/yyyy') : '';
    const dataRetorno = ferias.data_retorno ? format(new Date(ferias.data_retorno + 'T00:00:00'), 'dd/MM/yyyy') : '';
    const dias = ferias.dias || 0;
    const periodoRef = ferias.periodo_aquisitivo_ref || '';

    const texto = `Torno público o Livro de Férias e outras Concessões de Oficiais e Praças, cujo conteúdo segue: em consequência (1) Ao Chefe da B-1: proceder nos assentamentos do militar; (2) publique-se: ${postoNome} ${nomeCompleto}, matrícula ${matricula}, em ${dataInicio} entrará em gozo de férias regulamentares, 30 (trinta) dias, referente ao período aquisitivo ${periodoRef}.`;

    setTextoPublicacao(texto);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Criar registro de livro
      const registroData = {
        ...formData,
        texto_publicacao: textoPublicacao
      };
      
      await base44.entities.RegistroLivro.create(registroData);

      // Atualizar status das férias para "Em Curso"
      if (formData.ferias_id) {
        await base44.entities.Ferias.update(formData.ferias_id, {
          status: 'Em Curso',
          data_saida_registrada: new Date().toISOString()
        });
      }

      queryClient.invalidateQueries({ queryKey: ['registros-livro'] });
      queryClient.invalidateQueries({ queryKey: ['ferias'] });
      
      navigate(createPageUrl('Militares'));
    } catch (error) {
      console.error('Erro ao salvar registro:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="hover:bg-slate-200"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-[#1e3a5f]">Cadastrar Livro</h1>
              <p className="text-slate-500 text-sm">Registro de saída de férias</p>
            </div>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={loading || !formData.militar_id || !formData.ferias_id}
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
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Identificação</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <MilitarSelector
                  value={formData.militar_id}
                  onChange={handleMilitarSelect}
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">Tipo de Registro</Label>
                <Select value={formData.tipo_registro} onValueChange={(v) => handleChange('tipo_registro', v)}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Saída Férias">Férias</SelectItem>
                    <SelectItem value="Retorno Férias">Retorno Férias</SelectItem>
                    <SelectItem value="Saída Licença">Saída Licença</SelectItem>
                    <SelectItem value="Retorno Licença">Retorno Licença</SelectItem>
                    <SelectItem value="Apresentação">Apresentação</SelectItem>
                    <SelectItem value="Desligamento">Desligamento</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <FormField
                label="Data"
                name="data_registro"
                value={formData.data_registro}
                onChange={handleChange}
                type="date"
                required
              />
            </div>
          </div>

          {/* Férias */}
          {formData.militar_id && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Férias</h3>
              <FeriasSelector
                militarId={formData.militar_id}
                value={formData.ferias_id}
                onChange={handleFeriasSelect}
              />

              {selectedFerias && (
                <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-slate-500">Tipo</p>
                      <p className="font-medium">{selectedFerias.tipo}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Início de Férias</p>
                      <p className="font-medium">
                        {selectedFerias.data_inicio ? format(new Date(selectedFerias.data_inicio + 'T00:00:00'), 'dd/MM/yyyy') : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Data</p>
                      <p className="font-medium">
                        {selectedFerias.data_inicio ? format(new Date(selectedFerias.data_inicio + 'T00:00:00'), 'dd/MM/yyyy') : '-'}
                      </p>
                    </div>
                    <div className="md:col-span-3">
                      <p className="text-slate-500">Período Aquisitivo</p>
                      <p className="font-medium">{selectedFerias.periodo_aquisitivo_ref} - Integral</p>
                    </div>
                  </div>

                  {textoPublicacao && (
                    <div className="mt-4">
                      <Label className="text-sm font-medium text-slate-700 mb-2 block">
                        Texto para publicação
                      </Label>
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-slate-700 leading-relaxed">
                          A Comandante do 1° Grupamento de Bombeiros Militar torna público o Livro de Férias e outras Concessões de Oficiais e Praças, cujo conteúdo segue: em consequência (1) Ao Chefe da B-1: proceder nos assentamentos do militar; (2) publique-se: {selectedFerias.militar_posto ? `${selectedFerias.militar_posto} QOBM ` : ''}{selectedFerias.militar_nome}, matrícula {selectedFerias.militar_matricula}, em {selectedFerias.data_inicio ? format(new Date(selectedFerias.data_inicio + 'T00:00:00'), 'dd/MM/yyyy') : ''} entrará em gozo de férias regulamentares, {selectedFerias.dias} ({selectedFerias.dias === 30 ? 'trinta' : selectedFerias.dias}) dias, referente ao período aquisitivo {selectedFerias.periodo_aquisitivo_ref}.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Publicação e Status */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Publicação e Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label className="text-sm font-medium text-slate-700">Nota para BG</Label>
                <Textarea
                  value={formData.nota_para_bg}
                  onChange={(e) => handleChange('nota_para_bg', e.target.value)}
                  className="mt-1.5 border-slate-200"
                  rows={3}
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">Status</Label>
                <Select value={formData.status} onValueChange={(v) => handleChange('status', v)}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Aguardando Nota">Aguardando Nota</SelectItem>
                    <SelectItem value="Aguardando Publicação">Aguardando Publicação</SelectItem>
                    <SelectItem value="Publicado">Publicado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <FormField
                  label="Número do BG"
                  name="numero_bg"
                  value={formData.numero_bg}
                  onChange={handleChange}
                />
              </div>
              <FormField
                label="Data do BG"
                name="data_bg"
                value={formData.data_bg}
                onChange={handleChange}
                type="date"
              />
            </div>
          </div>

          {/* Observações */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Observações para Alterações</h3>
            <Textarea
              value={formData.observacoes}
              onChange={(e) => handleChange('observacoes', e.target.value)}
              className="border-slate-200"
              rows={4}
              placeholder="Observações gerais..."
            />
          </div>

          {/* Submit Button Mobile */}
          <div className="md:hidden">
            <Button
              type="submit"
              disabled={loading || !formData.militar_id || !formData.ferias_id}
              className="w-full bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white py-6"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <Save className="w-5 h-5 mr-2" />
              )}
              Salvar Registro
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}