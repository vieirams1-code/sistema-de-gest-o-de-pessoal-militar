import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Trash2, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
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
import {
  getPunicaoEntity,
  validarPunicaoDisciplinar,
  recalcularComportamentoEMarcarPendencia,
  criarCardPunicaoNoQuadro,
  diagnosticarFluxoPunicaoRuntime,
  registrarEventoHistoricoComportamento,
} from '@/services/justicaDisciplinaService';

export default function CadastrarPunicao() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canAccessModule, isLoading: loadingUser, isAccessResolved, user } = useCurrentUser();
  const hasMilitaresAccess = canAccessModule('militares');

  const [searchParams] = useSearchParams();
  const punicaoId = searchParams.get('id');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const isSubmittingRef = useRef(false);
  const [erroValidacao, setErroValidacao] = useState('');
  const [formData, setFormData] = useState({
    militar_id: '',
    militar_nome: '',
    posto_graduacao: '',
    tipo_punicao: 'Advertência',
    dias_punicao: 0,
    data_inicio_cumprimento: new Date().toISOString().split('T')[0],
    data_fim_cumprimento: '',
    agravada_prisao_em_separado: false,
    status_punicao: 'Ativa',
    boletim_numero: '',
    boletim_data: '',
    autoridade_aplicadora: '',
    observacoes: '',
    publicada_no_livro: false,
    card_operacional_id: ''
  });

  const [entityError, setEntityError] = useState(null);
  let entity = null;
  try {
    entity = getPunicaoEntity();
  } catch (err) {
    if (!entityError) setEntityError(err.message);
  }

  const { data: punicaoExistente, isLoading: loadingPunicao } = useQuery({
    queryKey: ['punicao-disciplinar', punicaoId],
    queryFn: async () => {
      const result = await entity.filter({ id: punicaoId });
      return result[0];
    },
    enabled: !!punicaoId && !!entity
  });

  useEffect(() => {
    if (punicaoExistente) {
      setFormData((prev) => ({ ...prev, ...punicaoExistente }));
    }
  }, [punicaoExistente]);

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const deleteMutation = useMutation({
    mutationFn: (id) => entity.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['punicoes-disciplinares'] });
      navigate(createPageUrl('Punicoes'));
    }
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      setErroValidacao('');
      validarPunicaoDisciplinar(formData);

      try {
        const diagnostico = await diagnosticarFluxoPunicaoRuntime();
        console.info('[JD] diagnóstico de runtime', diagnostico);
      } catch (error) {
        console.warn('[JD] erro em etapa: diagnóstico de runtime', error);
      }

      let punicaoSalva;
      if (punicaoId) {
        punicaoSalva = await entity.update(punicaoId, formData);
        console.info('[JD] punicao criada', { punicao_id: punicaoId, modo: 'update' });
      } else {
        punicaoSalva = await entity.create({
          ...formData,
          created_date: new Date().toISOString(),
        });
        console.info('[JD] punicao criada', { punicao_id: punicaoSalva?.id, modo: 'create' });
      }

      try {
        const resultadoPendencia = await recalcularComportamentoEMarcarPendencia(
          formData.militar_id,
          punicaoId ? 'Punição disciplinar atualizada' : 'Punição disciplinar registrada'
        );
        if (resultadoPendencia?.pendenciaEsperada && !resultadoPendencia?.pendenciaCriada) {
          console.warn('[JD] erro em etapa: pendência esperada não foi criada', resultadoPendencia);
        }
      } catch (error) {
        console.warn('[JD] erro em etapa: recálculo de comportamento', error);
      }

      if (!punicaoId) {
        await registrarEventoHistoricoComportamento({
          militarId: formData.militar_id,
          tipoEvento: 'Punição',
          comportamentoAnterior: '',
          comportamentoNovo: '',
          fundamentoLegal: '',
          origemTipo: 'PunicaoDisciplinar',
          origemId: punicaoSalva?.id,
          observacoes: `${formData.tipo_punicao || 'Punição'}${formData.boletim_numero ? ` - BI ${formData.boletim_numero}` : ''}`,
          createdBy: user?.email || '',
          dataEvento: formData.data_inicio_cumprimento || new Date().toISOString().slice(0, 10),
        });

        try {
          const card = await criarCardPunicaoNoQuadro(punicaoSalva);
          if (card?.id) {
            await entity.update(punicaoSalva.id, { card_operacional_id: card.id });
          }
        } catch (error) {
          console.warn('[JD] erro em etapa: criação de card operacional', error);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['punicoes-disciplinares'] });
      queryClient.invalidateQueries({ queryKey: ['militares'] });
      queryClient.invalidateQueries({ queryKey: ['cards'] });
    },
    onSuccess: () => {
      navigate(createPageUrl('Punicoes'));
    },
    onError: (error) => {
      console.warn('[JD] erro em etapa: salvar punição', error);
      setErroValidacao(error?.message || 'Não foi possível salvar a punição.');
    },
    onSettled: () => {
      isSubmittingRef.current = false;
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSubmittingRef.current || saveMutation.isPending) return;
    isSubmittingRef.current = true;
    saveMutation.mutate();
  };

  const necessitaDias = ['Detenção', 'Prisão', 'Prisão em Separado'].includes(formData.tipo_punicao);

  if (loadingUser || !isAccessResolved) return null;
  if (!hasMilitaresAccess) return <AccessDenied modulo="Justiça e Disciplina" />;

  if (entityError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-8">
        <div className="bg-white rounded-xl shadow-sm border border-red-200 p-8 max-w-md text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-red-700 mb-2">Schema não encontrado</h2>
          <p className="text-slate-600 text-sm mb-4">
            A entidade <strong>PunicaoDisciplinar</strong> não está disponível no app.
            Aguarde a publicação do schema e recarregue a página.
          </p>
          <Button onClick={() => window.location.reload()} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
            Recarregar página
          </Button>
        </div>
      </div>
    );
  }

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
              <h1 className="text-2xl font-bold text-[#1e3a5f]">{punicaoId ? 'Editar' : 'Lançar'} Punição Disciplinar</h1>
              <p className="text-slate-500 text-sm">Módulo próprio para controle disciplinar e cálculo de comportamento</p>
              {base44.entities.PunicaoDisciplinar && (
                <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> schema-punicao-ok
                </span>
              )}
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
            <Button
              onClick={handleSubmit}
              disabled={saveMutation.isPending || !formData.militar_id}
              className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
            >
              {saveMutation.isPending ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
              {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
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
                  posto_graduacao: data.posto_graduacao || data.militar_posto,
                }));
              }}
            />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Dados da Punição</h3>
            {erroValidacao && <p className="text-sm text-red-600 mb-3">{erroValidacao}</p>}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo de Punição</Label>
                <Select value={formData.tipo_punicao} onValueChange={(v) => handleChange('tipo_punicao', v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Advertência">Advertência</SelectItem>
                    <SelectItem value="Repreensão">Repreensão</SelectItem>
                    <SelectItem value="Detenção">Detenção</SelectItem>
                    <SelectItem value="Prisão">Prisão</SelectItem>
                    <SelectItem value="Prisão em Separado">Prisão em Separado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <FormField label="Data Início Cumprimento" name="data_inicio_cumprimento" value={formData.data_inicio_cumprimento} onChange={handleChange} type="date" required />
              <FormField label="Data Fim Cumprimento" name="data_fim_cumprimento" value={formData.data_fim_cumprimento} onChange={handleChange} type="date" />
              <FormField label="Dias de Punição" name="dias_punicao" value={formData.dias_punicao} onChange={handleChange} type="number" required={necessitaDias} />
              <div>
                <Label>Status</Label>
                <Select value={formData.status_punicao || 'Ativa'} onValueChange={(v) => handleChange('status_punicao', v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ativa">Ativa</SelectItem>
                    <SelectItem value="Cumprida">Cumprida</SelectItem>
                    <SelectItem value="Reabilitada">Reabilitada</SelectItem>
                    <SelectItem value="Anulada">Anulada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Agravada p/ Prisão em Separado</Label>
                <Select value={formData.agravada_prisao_em_separado ? 'sim' : 'nao'} onValueChange={(v) => handleChange('agravada_prisao_em_separado', v === 'sim')}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nao">Não</SelectItem>
                    <SelectItem value="sim">Sim</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <FormField label="Boletim Número" name="boletim_numero" value={formData.boletim_numero} onChange={handleChange} placeholder="Ex: 021/2026" />
              <FormField label="Data do Boletim" name="boletim_data" value={formData.boletim_data} onChange={handleChange} type="date" />
              <FormField label="Autoridade Aplicadora" name="autoridade_aplicadora" value={formData.autoridade_aplicadora} onChange={handleChange} />
            </div>
            <div className="mt-4">
              <Label>Observações</Label>
              <Textarea value={formData.observacoes} onChange={(e) => handleChange('observacoes', e.target.value)} className="mt-1.5" rows={2} />
            </div>
          </div>
        </form>

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir esta punição?
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
