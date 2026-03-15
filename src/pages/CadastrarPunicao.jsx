import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MilitarSelector from '@/components/atestado/MilitarSelector';
import FormField from '@/components/militar/FormField';
import { calcularComportamento } from '@/components/utils/comportamentoCalculator';

export default function CadastrarPunicao() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canAccessModule, isLoading: loadingUser, isAccessResolved } = useCurrentUser();
  const hasMilitaresAccess = canAccessModule('militares');

  const [searchParams] = useSearchParams();
  const punicaoId = searchParams.get('id');
  const [loading, setLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
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

  const { data: punicaoExistente, isLoading: loadingPunicao } = useQuery({
    queryKey: ['punicao', punicaoId],
    queryFn: async () => {
      const result = await base44.entities.Punicao.filter({ id: punicaoId });
      return result[0];
    },
    enabled: !!punicaoId
  });

  useEffect(() => {
    if (punicaoExistente) {
      setFormData(punicaoExistente);
    }
  }, [punicaoExistente]);

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Punicao.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['punicoes'] });
      navigate(createPageUrl('Punicoes'));
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Criar ou atualizar punição
      if (punicaoId) {
        await base44.entities.Punicao.update(punicaoId, formData);
      } else {
        await base44.entities.Punicao.create(formData);
      }
      
      // Buscar militar e todas as suas punições
      const militarList = await base44.entities.Militar.filter({ id: formData.militar_id });
      const militar = militarList[0];
      
      // Verificar se é praça
      const pracas = ['Soldado', 'Cabo', '3º Sargento', '2º Sargento', '1º Sargento', 'Subtenente', 'Aspirante'];
      if (militar && pracas.includes(militar.posto_graduacao)) {
        // Buscar todas as punições do militar (incluindo a recém-criada)
        const punicoesMilitar = await base44.entities.Punicao.filter({ militar_id: formData.militar_id });
        
        // Calcular novo comportamento
        const resultado = calcularComportamento(punicoesMilitar, militar.data_inclusao);
        
        // Atualizar comportamento do militar
        await base44.entities.Militar.update(militar.id, {
          comportamento: resultado.comportamento
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['punicoes'] });
      queryClient.invalidateQueries({ queryKey: ['militares'] });
      queryClient.invalidateQueries({ queryKey: ['militares-ativos'] });
      navigate(createPageUrl('Punicoes'));
    } catch (error) {
      console.error('Erro ao salvar:', error);
    } finally {
      setLoading(false);
    }
  };

  const necessitaPeriodo = ['Detenção', 'Prisão'].includes(formData.tipo);

  if (loadingUser || !isAccessResolved) return null;
  if (!hasMilitaresAccess) return <AccessDenied modulo="Efetivo" />;

  if (loadingPunicao) {
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
              <h1 className="text-2xl font-bold text-[#1e3a5f]">{punicaoId ? 'Editar' : 'Cadastrar'} Punição</h1>
              <p className="text-slate-500 text-sm">{punicaoId ? 'Editar punição disciplinar' : 'Registrar punição disciplinar'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {punicaoId && (
              <Button 
                variant="outline" 
                onClick={() => setShowDeleteDialog(true)}
                className="text-red-600 border-red-300 hover:bg-red-50"
              >
                <Trash2 className="w-5 h-5 mr-2" />
                Excluir
              </Button>
            )}
            <Button onClick={handleSubmit} disabled={loading || !formData.militar_id} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
              {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
              Salvar
            </Button>
          </div>
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

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir esta punição? Esta ação não pode ser desfeita e pode afetar o cálculo de comportamento do militar.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteMutation.mutate(punicaoId)} className="bg-red-600 hover:bg-red-700">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}