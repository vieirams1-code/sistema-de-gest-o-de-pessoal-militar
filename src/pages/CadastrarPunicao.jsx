import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MilitarSelector from '@/components/atestado/MilitarSelector';
import FormField from '@/components/militar/FormField';

export default function CadastrarPunicao() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    militar_id: '',
    militar_nome: '',
    militar_posto: '',
    militar_matricula: '',
    tipo: 'Advertência Verbal',
    data_aplicacao: new Date().toISOString().split('T')[0],
    data_inicio: '',
    data_termino: '',
    motivo: '',
    documento_referencia: '',
    observacoes: ''
  });

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await base44.entities.Punicao.create(formData);
      queryClient.invalidateQueries({ queryKey: ['punicoes'] });
      navigate(createPageUrl('Punicoes'));
    } catch (error) {
      console.error('Erro ao salvar:', error);
    } finally {
      setLoading(false);
    }
  };

  const necessitaPeriodo = ['Detenção', 'Prisão'].includes(formData.tipo);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-[#1e3a5f]">Cadastrar Punição</h1>
              <p className="text-slate-500 text-sm">Registrar punição disciplinar</p>
            </div>
          </div>
          <Button onClick={handleSubmit} disabled={loading || !formData.militar_id} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
            Salvar
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Dados do Militar</h3>
            <MilitarSelector
              value={formData.militar_id}
              onChange={handleChange}
              onMilitarSelect={(data) => {
                setFormData(prev => ({
                  ...prev,
                  militar_id: data.id || prev.militar_id,
                  militar_nome: data.militar_nome || data.nome_completo,
                  militar_posto: data.militar_posto || data.posto_graduacao,
                  militar_matricula: data.militar_matricula || data.matricula
                }));
              }}
            />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Dados da Punição</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo de Punição</Label>
                <Select value={formData.tipo} onValueChange={(v) => handleChange('tipo', v)}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Advertência Verbal">Advertência Verbal</SelectItem>
                    <SelectItem value="Repreensão">Repreensão</SelectItem>
                    <SelectItem value="Detenção">Detenção</SelectItem>
                    <SelectItem value="Prisão">Prisão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <FormField
                label="Data de Aplicação"
                name="data_aplicacao"
                value={formData.data_aplicacao}
                onChange={handleChange}
                type="date"
                required
              />
              {necessitaPeriodo && (
                <>
                  <FormField
                    label="Data de Início"
                    name="data_inicio"
                    value={formData.data_inicio}
                    onChange={handleChange}
                    type="date"
                    required
                  />
                  <FormField
                    label="Data de Término"
                    name="data_termino"
                    value={formData.data_termino}
                    onChange={handleChange}
                    type="date"
                    required
                  />
                </>
              )}
            </div>
            <div className="mt-4">
              <Label>Motivo</Label>
              <Textarea
                value={formData.motivo}
                onChange={(e) => handleChange('motivo', e.target.value)}
                className="mt-1.5"
                rows={3}
                placeholder="Descreva o motivo da punição..."
              />
            </div>
            <div className="mt-4">
              <FormField
                label="Documento de Referência"
                name="documento_referencia"
                value={formData.documento_referencia}
                onChange={handleChange}
                placeholder="Ex: Portaria nº 123/2025"
              />
            </div>
            <div className="mt-4">
              <Label>Observações</Label>
              <Textarea
                value={formData.observacoes}
                onChange={(e) => handleChange('observacoes', e.target.value)}
                className="mt-1.5"
                rows={2}
              />
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}