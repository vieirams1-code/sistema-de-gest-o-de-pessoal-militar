import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/lib/base44';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Save, CheckCircle2 } from 'lucide-react';

import {
  getTiposRPFiltrados,
  groupTiposRP,
  matchesTipoRPSearch,
  getRPTipoLabel,
  getModuloByTipo,
  MODULO_LIVRO,
  MODULO_EX_OFFICIO
} from '@/components/rp/rpTiposConfig';

import RPSpecificFieldsLivro from '@/components/rp/RPSpecificFieldsLivro';
import RPSpecificFieldsExOfficio from '@/components/rp/RPSpecificFieldsExOfficio';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchMilitar } from '@/components/SearchMilitar';

export default function CadastrarRegistroRP() {
  const { id: editId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canAccessModule } = useAuth();

  // 10. ACESSO
  if (!canAccessModule('livro') && !canAccessModule('publicacoes')) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-red-600">Acesso Negado</h1>
        <p className="mt-2 text-gray-600">Você não tem permissão para acessar esta área.</p>
      </div>
    );
  }

  // ESTADOS (2. Adicionado moduloAtual)
  const [step, setStep] = useState(1);
  const [militarSelecionado, setMilitarSelecionado] = useState(null);
  const [moduloAtual, setModuloAtual] = useState(null);
  
  const [formData, setFormData] = useState({
    tipo_registro: '',
    data_fato: new Date().toISOString().split('T')[0],
    bg_numero: '',
    bg_data: '',
    texto_gerado: '',
    // Campos que podem ser usados por Livro ou ExOfficio
    assunto: '',
    referencia: '',
    dias: '',
    comportamento_novo: '',
    atestado_id: '',
    observacoes: '',
  });

  // 5. TIPOS CUSTOMIZADOS (sem filtro de modulo)
  const { data: tiposCustom = [] } = useQuery({
    queryKey: ['tipos-custom-rp'],
    queryFn: () => base44.entities.TipoPublicacaoCustom.filter({ ativo: true })
  });

  // 4. BUSCA DE TEMPLATES (sem filtro de modulo)
  const { data: templates = [] } = useQuery({
    queryKey: ['templates-texto'],
    queryFn: () => base44.entities.TemplateTexto.list()
  });

  // 3. DETECÇÃO AUTOMÁTICA DE MÓDULO
  useEffect(() => {
    if (formData.tipo_registro) {
      const modulo = getModuloByTipo(formData.tipo_registro, tiposCustom);
      setModuloAtual(modulo);
    } else {
      setModuloAtual(null);
    }
  }, [formData.tipo_registro, tiposCustom]);

  // Função de gerar texto 
  const gerarTextoPublicacao = () => {
    // O aplicarOuErro deve buscar template usando modulo === 'Livro' ou modulo === 'ExOfficio'
    const templateModulo = moduloAtual === MODULO_LIVRO ? 'Livro' : 'ExOfficio';
    
    const templateEncontrado = templates.find(t => 
      t.tipo_registro === formData.tipo_registro && 
      t.modulo === templateModulo
    );

    if (!templateEncontrado) {
      toast.error(`Template não configurado para ${formData.tipo_registro} (${templateModulo}).`);
      return false;
    }

    let texto = templateEncontrado.texto_padrao || '';

    // Variáveis universais
    texto = texto.replace(/{{NOME}}/g, militarSelecionado?.nome || '');
    texto = texto.replace(/{{MATRICULA}}/g, militarSelecionado?.matricula || '');
    texto = texto.replace(/{{POSTO_GRADUACAO}}/g, militarSelecionado?.posto_graduacao || '');
    texto = texto.replace(/{{DATA}}/g, formData.data_fato || '');

    // Lógica do Livro
    if (moduloAtual === MODULO_LIVRO) {
      texto = texto.replace(/{{ASSUNTO}}/g, formData.assunto || '');
      texto = texto.replace(/{{REFERENCIA}}/g, formData.referencia || '');
    }

    // Cases do gerarTextoPublicacao do CadastrarPublicacao.jsx (ExOfficio)
    if (moduloAtual === MODULO_EX_OFFICIO) {
      if (formData.tipo_registro === 'Punição') {
        texto = texto.replace(/{{DIAS_PUNICAO}}/g, formData.dias || '');
      } 
      if (formData.tipo_registro === 'Ata JISO' || formData.tipo_registro === 'Homologação de Atestado') {
        texto = texto.replace(/{{DIAS_AFASTAMENTO}}/g, formData.dias || '');
      }
      if (formData.tipo_registro === 'Melhoria de Comportamento' || formData.tipo_registro === 'Punição') {
        texto = texto.replace(/{{COMPORTAMENTO_NOVO}}/g, formData.comportamento_novo || '');
      }
    }

    setFormData(prev => ({ ...prev, texto_gerado: texto }));
    return true;
  };

  // 6. renderSpecificFields()
  const renderSpecificFields = () => {
    if (moduloAtual === MODULO_LIVRO) {
      return (
        <RPSpecificFieldsLivro 
          formData={formData} 
          setFormData={setFormData} 
          militar={militarSelecionado} 
        />
      );
    }
    if (moduloAtual === MODULO_EX_OFFICIO) {
      return (
        <RPSpecificFieldsExOfficio 
          formData={formData} 
          setFormData={setFormData} 
          militar={militarSelecionado} 
        />
      );
    }
    return null;
  };

  const handleNext = () => {
    if (step === 1 && !militarSelecionado) {
      return toast.warning('Selecione um militar para continuar.');
    }
    if (step === 2 && !formData.tipo_registro) {
      return toast.warning('Selecione o tipo de registro.');
    }
    if (step === 2) {
      const gerou = gerarTextoPublicacao();
      if (!gerou) return;
    }
    setStep(prev => prev + 1);
  };

  const handleBack = () => {
    setStep(prev => prev - 1);
  };

  // 7. handleSubmit
  const handleSubmit = async () => {
    try {
      // Validação de duplicidade (Ata JISO / Homologação) mantida do CadastrarPublicacao
      if (moduloAtual === MODULO_EX_OFFICIO && (formData.tipo_registro === 'Ata JISO' || formData.tipo_registro === 'Homologação de Atestado')) {
        if (!formData.atestado_id) {
          toast.warning('Obrigatório vincular um atestado para este tipo de registro.');
          return;
        }
      }

      const basePayload = {
        ...formData,
        militar_id: militarSelecionado.id,
      };

      if (editId) {
        await base44.entities.RegistroRP.update(editId, basePayload);
      } else {
        // Adicionado o modulo no create
        await base44.entities.RegistroRP.create({ ...basePayload, modulo: moduloAtual });

        // Lógica ExOfficio após o save
        if (moduloAtual === MODULO_EX_OFFICIO) {
          // Punição ou Melhoria de Comportamento
          if (['Melhoria de Comportamento', 'Punição'].includes(formData.tipo_registro) && formData.comportamento_novo) {
            await base44.entities.Militar.update(militarSelecionado.id, { 
              comportamento: formData.comportamento_novo 
            });
            await base44.entities.HistoricoComportamento.create({
              militar_id: militarSelecionado.id,
              comportamento: formData.comportamento_novo,
              data: formData.data_fato,
              motivo: formData.tipo_registro,
              bg_numero: formData.bg_numero
            });
          }

          // Atualização de Atestado
          if (['Ata JISO', 'Homologação de Atestado'].includes(formData.tipo_registro) && formData.atestado_id) {
            await base44.entities.Atestado.update(formData.atestado_id, {
              status: 'Homologado',
              bg_publicacao: formData.bg_numero
            });
          }
        }
      }

      // 8. INVALIDAÇÕES DE CACHE
      const queryKeys = [
        ['registros-livro'], ['registros-rp'], ['publicacoes-ex-officio'],
        ['publicacoes'], ['ferias'], ['periodos-aquisitivos'],
        ['livro-consulta'], ['atestados'], ['cards'], ['militares']
      ];
      queryKeys.forEach(key => queryClient.invalidateQueries({ queryKey: key }));

      toast.success('Registro salvo com sucesso!');
      navigate('/rp');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar registro.');
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* 9. TÍTULO DO WIZARD */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{editId ? 'Editar Registro RP' : 'Novo Registro RP'}</h1>
        <p className="text-gray-500">Livro · Ex Officio unificado</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {step === 1 && (
            <div className="space-y-4">
              <Label>Militar</Label>
              <SearchMilitar onSelect={setMilitarSelecionado} selected={militarSelecionado} />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <Label>Tipo de Registro</Label>
              <Select value={formData.tipo_registro} onValueChange={(val) => setFormData(p => ({ ...p, tipo_registro: val }))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {getTiposRPFiltrados(tiposCustom).map(tipo => (
                    <SelectItem key={tipo.value} value={tipo.value}>{tipo.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {formData.tipo_registro && renderSpecificFields()}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <Label>Texto do Registro</Label>
              <Textarea 
                rows={10} 
                value={formData.texto_gerado} 
                onChange={(e) => setFormData(p => ({ ...p, texto_gerado: e.target.value }))}
              />
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Resumo do Registro</h3>
              <div className="bg-gray-50 p-4 rounded-md space-y-2">
                <p><strong>Militar:</strong> {militarSelecionado?.nome}</p>
                <p><strong>Módulo:</strong> {moduloAtual === MODULO_LIVRO ? 'Livro' : 'Ex Officio'}</p>
                <p><strong>Tipo:</strong> {formData.tipo_registro}</p>
                <p><strong>Texto Final:</strong> {formData.texto_gerado}</p>
              </div>
            </div>
          )}
        </CardContent>
        <div className="flex justify-between p-6 border-t">
          <Button variant="outline" onClick={step === 1 ? () => navigate('/rp') : handleBack}>
            {step === 1 ? 'Cancelar' : <><ArrowLeft className="w-4 h-4 mr-2" /> Voltar</>}
          </Button>
          
          {step < 4 ? (
            <Button onClick={handleNext}>
              Avançar <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} className="bg-green-600 hover:bg-green-700">
              <Save className="w-4 h-4 mr-2" /> Concluir e Salvar
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}