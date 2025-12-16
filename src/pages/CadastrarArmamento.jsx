import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FormField from '@/components/militar/FormField';
import MilitarSelector from '@/components/atestado/MilitarSelector';

export default function CadastrarArmamento() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const armamentoId = searchParams.get('id');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    militar_id: '',
    militar_nome: '',
    militar_posto: '',
    militar_matricula: '',
    tipo: '',
    calibre: '',
    cad_bm: '',
    marca: '',
    numero_serie: '',
    numero_sigma: '',
    data_expedicao: '',
    status: 'Ativo',
    data_baixa: '',
    motivo_baixa: '',
    observacoes: ''
  });

  const { data: armamentoExistente, isLoading: loadingArmamento } = useQuery({
    queryKey: ['armamento', armamentoId],
    queryFn: async () => {
      const result = await base44.entities.Armamento.filter({ id: armamentoId });
      return result[0];
    },
    enabled: !!armamentoId
  });

  useEffect(() => {
    if (armamentoExistente) {
      setFormData(armamentoExistente);
    }
  }, [armamentoExistente]);

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (armamentoId) {
        await base44.entities.Armamento.update(armamentoId, formData);
      } else {
        await base44.entities.Armamento.create(formData);
      }
      queryClient.invalidateQueries({ queryKey: ['armamentos'] });
      navigate(createPageUrl('Armamentos'));
    } catch (error) {
      console.error('Erro ao salvar:', error);
    } finally {
      setLoading(false);
    }
  };

  const necessitaBaixa = ['Vendido', 'Extraviado', 'Furtado', 'Baixado'].includes(formData.status);

  if (loadingArmamento) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-[#1e3a5f]">{armamentoId ? 'Editar' : 'Cadastrar'} Armamento</h1>
              <p className="text-slate-500 text-sm">{armamentoId ? 'Editar registro de armamento' : 'Registrar novo armamento'}</p>
            </div>
          </div>
          <Button onClick={handleSubmit} disabled={loading || !formData.militar_id || !formData.tipo || !formData.numero_serie} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
            Salvar
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Militar</h3>
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
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Identificação da Arma</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Tipo" name="tipo" value={formData.tipo} onChange={handleChange} required />
              <FormField label="Calibre" name="calibre" value={formData.calibre} onChange={handleChange} />
              <FormField label="CAD BM" name="cad_bm" value={formData.cad_bm} onChange={handleChange} />
              <FormField label="Marca" name="marca" value={formData.marca} onChange={handleChange} />
              <FormField label="Número de Série" name="numero_serie" value={formData.numero_serie} onChange={handleChange} required />
              <FormField label="Número SIGMA" name="numero_sigma" value={formData.numero_sigma} onChange={handleChange} />
              <FormField label="Data de Expedição" name="data_expedicao" value={formData.data_expedicao} onChange={handleChange} type="date" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Status</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => handleChange('status', v)}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ativo">Ativo</SelectItem>
                    <SelectItem value="Vendido">Vendido</SelectItem>
                    <SelectItem value="Extraviado">Extraviado</SelectItem>
                    <SelectItem value="Furtado">Furtado</SelectItem>
                    <SelectItem value="Baixado">Baixado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {necessitaBaixa && (
                <>
                  <FormField label="Data da Baixa" name="data_baixa" value={formData.data_baixa} onChange={handleChange} type="date" />
                  <div className="col-span-2">
                    <Label>Motivo da Baixa</Label>
                    <Textarea
                      value={formData.motivo_baixa}
                      onChange={(e) => handleChange('motivo_baixa', e.target.value)}
                      className="mt-1.5"
                      rows={2}
                    />
                  </div>
                </>
              )}
              <div className="col-span-2">
                <Label>Observações</Label>
                <Textarea
                  value={formData.observacoes}
                  onChange={(e) => handleChange('observacoes', e.target.value)}
                  className="mt-1.5"
                  rows={2}
                />
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}