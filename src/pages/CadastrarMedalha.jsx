import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MilitarSelector from '@/components/atestado/MilitarSelector';
import FormField from '@/components/militar/FormField';

export default function CadastrarMedalha() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canAccessModule, isLoading: loadingUser, isAccessResolved } = useCurrentUser();
  const hasMedalhasAccess = canAccessModule('medalhas');

  const [searchParams] = useSearchParams();
  const medalhaId = searchParams.get('id');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    militar_id: '',
    militar_nome: '',
    militar_posto: '',
    militar_matricula: '',
    tipo_medalha_id: '',
    tipo_medalha_nome: '',
    data_indicacao: new Date().toISOString().split('T')[0],
    data_concessao: '',
    status: 'Indicado',
    documento_referencia: '',
    observacoes: ''
  });

  const { data: tiposMedalha = [] } = useQuery({
    queryKey: ['tipos-medalha'],
    queryFn: () => base44.entities.TipoMedalha.filter({ ativa: true }, 'nome')
  });

  const { data: medalhaExistente, isLoading: loadingMedalha } = useQuery({
    queryKey: ['medalha', medalhaId],
    queryFn: async () => {
      const result = await base44.entities.Medalha.filter({ id: medalhaId });
      return result[0];
    },
    enabled: !!medalhaId
  });

  useEffect(() => {
    if (medalhaExistente) {
      setFormData(medalhaExistente);
    }
  }, [medalhaExistente]);

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const isConcedido = formData.status === 'Concedido';

  const handleTipoMedalhaChange = (tipoId) => {
    const tipo = tiposMedalha.find(t => t.id === tipoId);
    setFormData(prev => ({
      ...prev,
      tipo_medalha_id: tipoId,
      tipo_medalha_nome: tipo?.nome || ''
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (medalhaId) {
        await base44.entities.Medalha.update(medalhaId, formData);
      } else {
        await base44.entities.Medalha.create(formData);
      }
      queryClient.invalidateQueries({ queryKey: ['medalhas'] });
      navigate(createPageUrl('Medalhas'));
    } catch (error) {
      console.error('Erro ao salvar:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loadingUser || !isAccessResolved) return null;
  if (!hasMedalhasAccess) return <AccessDenied modulo="Medalhas" />;

  if (loadingMedalha) {
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
              <h1 className="text-2xl font-bold text-[#1e3a5f]">{medalhaId ? 'Editar' : 'Nova'} Indicação</h1>
              <p className="text-slate-500 text-sm">{medalhaId ? 'Editar indicação de medalha' : 'Indicar militar para medalha'}</p>
            </div>
          </div>
          <Button onClick={handleSubmit} disabled={loading || !formData.militar_id || !formData.tipo_medalha_id} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
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
                  militar_matricula: data.matricula_atual || data.militar_matricula || data.matricula
                }));
              }}
            />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Dados da Medalha</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Tipo de Medalha</Label>
                <Select value={formData.tipo_medalha_id} onValueChange={handleTipoMedalhaChange}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposMedalha.map(tipo => (
                      <SelectItem key={tipo.id} value={tipo.id}>{tipo.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <FormField
                label="Data de Indicação"
                name="data_indicacao"
                value={formData.data_indicacao}
                onChange={handleChange}
                type="date"
                required
              />
              <FormField
                label="Data de Concessão"
                name="data_concessao"
                value={formData.data_concessao}
                onChange={handleChange}
                type="date"
              />
              <div className="col-span-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => handleChange('status', v)}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Indicado">Indicado</SelectItem>
                    <SelectItem value="Concedido">Concedido</SelectItem>
                    <SelectItem value="Negado">Negado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isConcedido && (
                <>
                  <FormField
                    label="Boletim Geral / DOEMS"
                    name="documento_referencia"
                    value={formData.documento_referencia}
                    onChange={handleChange}
                    placeholder="Ex: BG nº 045/2025 ou DOEMS nº 001"
                  />
                  <FormField
                    label="Data do BG/DOEMS"
                    name="data_concessao"
                    value={formData.data_concessao}
                    onChange={handleChange}
                    type="date"
                  />
                </>
              )}
              {!isConcedido && (
                <div className="col-span-2">
                  <FormField
                    label="Documento de Referência"
                    name="documento_referencia"
                    value={formData.documento_referencia}
                    onChange={handleChange}
                  />
                </div>
              )}
              <div className="col-span-2">
                <Label>Observações</Label>
                <Textarea
                  value={formData.observacoes}
                  onChange={(e) => handleChange('observacoes', e.target.value)}
                  className="mt-1.5"
                  rows={3}
                />
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}