import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Save, ArrowLeft, Calendar, User as UserIcon, FileText } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { addDays, format } from 'date-fns';

import FormSection from '@/components/militar/FormSection';
import FormField from '@/components/militar/FormField';
import MilitarSelector from '@/components/atestado/MilitarSelector';
import DateCalculator from '@/components/atestado/DateCalculator';

const initialFormData = {
  militar_id: '',
  militar_nome: '',
  militar_posto: '',
  militar_matricula: '',
  periodo_aquisitivo_id: '',
  periodo_aquisitivo_ref: '',
  plano_ferias_id: '',
  tipo: 'Férias Regulares',
  data_inicio: '',
  data_fim: '',
  data_retorno: '',
  dias: 30,
  fracionamento: '',
  status: 'Prevista',
  bg_publicacao: '',
  data_bg: '',
  substituto_id: '',
  substituto_nome: '',
  observacoes: ''
};

export default function CadastrarFerias() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState(initialFormData);
  const [loading, setLoading] = useState(false);

  // Carregar períodos aquisitivos disponíveis do militar selecionado
  const { data: periodosDisponiveis = [] } = useQuery({
    queryKey: ['periodos-disponiveis', formData.militar_id],
    queryFn: async () => {
      if (!formData.militar_id) return [];
      const periodos = await base44.entities.PeriodoAquisitivo.filter({ 
        militar_id: formData.militar_id 
      }, '-inicio_aquisitivo');
      return periodos.filter(p => p.status !== 'Gozado' && p.status !== 'Vencido');
    },
    enabled: !!formData.militar_id
  });

  const { data: editingFerias, isLoading: loadingEdit } = useQuery({
    queryKey: ['ferias', editId],
    queryFn: async () => {
      if (!editId) return null;
      const list = await base44.entities.Ferias.filter({ id: editId });
      return list[0] || null;
    },
    enabled: !!editId
  });

  React.useEffect(() => {
    if (editingFerias) {
      setFormData({ ...initialFormData, ...editingFerias });
    }
  }, [editingFerias]);

  // Calcular datas automaticamente
  React.useEffect(() => {
    if (formData.data_inicio && formData.dias && formData.dias > 0) {
      const inicio = new Date(formData.data_inicio + 'T00:00:00');
      const fim = addDays(inicio, formData.dias - 1);
      const retorno = addDays(inicio, formData.dias);
      
      setFormData(prev => ({
        ...prev,
        data_fim: format(fim, 'yyyy-MM-dd'),
        data_retorno: format(retorno, 'yyyy-MM-dd')
      }));
    }
  }, [formData.data_inicio, formData.dias]);

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleMilitarSelect = (militarData) => {
    setFormData(prev => ({ 
      ...prev, 
      ...militarData,
      periodo_aquisitivo_id: '', // Reset período quando trocar militar
      periodo_aquisitivo_ref: ''
    }));
  };

  const handlePeriodoChange = (periodoId) => {
    const periodo = periodosDisponiveis.find(p => p.id === periodoId);
    if (periodo) {
      setFormData(prev => ({
        ...prev,
        periodo_aquisitivo_id: periodoId,
        periodo_aquisitivo_ref: periodo.ano_referencia
      }));
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
      await base44.entities.Ferias.update(editId, dataToSave);
    } else {
      await base44.entities.Ferias.create(dataToSave);
    }
    
    queryClient.invalidateQueries({ queryKey: ['ferias'] });
    queryClient.invalidateQueries({ queryKey: ['periodos-aquisitivos'] });
    setLoading(false);
    navigate(createPageUrl('Ferias'));
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
              onClick={() => navigate(createPageUrl('Ferias'))}
              className="hover:bg-slate-200"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-[#1e3a5f]">
                {editId ? 'Editar Férias' : 'Cadastrar Férias'}
              </h1>
              <p className="text-slate-500 text-sm">
                Registrar concessão de férias
              </p>
            </div>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={loading || !formData.militar_id || !formData.periodo_aquisitivo_id || !formData.data_inicio}
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
          {/* Militar */}
          <FormSection title="Militar" icon={UserIcon} defaultOpen={true}>
            <MilitarSelector
              value={formData.militar_id}
              onChange={handleChange}
              onMilitarSelect={handleMilitarSelect}
            />
          </FormSection>

          {/* Período Aquisitivo */}
          {formData.militar_id && (
            <FormSection title="Período Aquisitivo" icon={Calendar}>
              <div className="space-y-4">
                {periodosDisponiveis.length > 0 ? (
                  <>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">
                        Selecione o Período <span className="text-red-500">*</span>
                      </Label>
                      <Select value={formData.periodo_aquisitivo_id} onValueChange={handlePeriodoChange}>
                        <SelectTrigger className="h-10 border-slate-200">
                          <SelectValue placeholder="Escolha o período aquisitivo..." />
                        </SelectTrigger>
                        <SelectContent>
                          {periodosDisponiveis.map((periodo) => (
                            <SelectItem key={periodo.id} value={periodo.id}>
                              {periodo.ano_referencia} - {periodo.dias_direito - (periodo.dias_gozados || 0)} dias disponíveis
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-sm text-slate-500">
                      💡 Selecionado automaticamente o período aquisitivo mais antigo disponível
                    </p>
                  </>
                ) : (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-700">
                      Nenhum período aquisitivo disponível para este militar.
                    </p>
                  </div>
                )}
              </div>
            </FormSection>
          )}

          {/* Dados das Férias */}
          <FormSection title="Dados das Férias" icon={FileText}>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  label="Tipo"
                  name="tipo"
                  value={formData.tipo}
                  onChange={handleChange}
                  type="select"
                  options={['Férias Regulares', 'Férias Prêmio', 'Recesso', 'Abono Pecuniário']}
                />
                <FormField
                  label="Status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  type="select"
                  options={['Prevista', 'Autorizada', 'Em Curso', 'Gozada', 'Interrompida', 'Cancelada']}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormField
                  label="Data de Início"
                  name="data_inicio"
                  value={formData.data_inicio}
                  onChange={handleChange}
                  type="date"
                  required
                />
                <FormField
                  label="Quantidade de Dias"
                  name="dias"
                  value={formData.dias}
                  onChange={handleChange}
                  type="number"
                  required
                />
                <FormField
                  label="Data de Retorno"
                  name="data_retorno"
                  value={formData.data_retorno}
                  onChange={handleChange}
                  type="date"
                />
              </div>

              <FormField
                label="Fracionamento"
                name="fracionamento"
                value={formData.fracionamento}
                onChange={handleChange}
                placeholder="Ex: 1ª parcela de 20 dias"
              />
            </div>
          </FormSection>

          {/* Controle */}
          <FormSection title="Controle e Publicação" icon={FileText}>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  label="BG"
                  name="bg_publicacao"
                  value={formData.bg_publicacao}
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

              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">Observações</Label>
                <Textarea
                  value={formData.observacoes}
                  onChange={(e) => handleChange('observacoes', e.target.value)}
                  placeholder="Observações sobre as férias..."
                  className="min-h-24 border-slate-200"
                />
              </div>
            </div>
          </FormSection>
        </form>
      </div>
    </div>
  );
}