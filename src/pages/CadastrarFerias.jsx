import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Save, ArrowLeft, Calendar, User as UserIcon, Plus, Trash2 } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { addDays, format, addYears } from 'date-fns';

import FormSection from '@/components/militar/FormSection';
import FormField from '@/components/militar/FormField';
import MilitarSelector from '@/components/atestado/MilitarSelector';

// Gera opções de período aquisitivo: ano corrente + 1 próximo
const gerarOpcoesAnos = () => {
  const anoAtual = new Date().getFullYear();
  const opcoes = [];
  for (let ano = anoAtual - 15; ano <= anoAtual + 1; ano++) {
    opcoes.push(`${ano}/${ano + 1}`);
  }
  return opcoes.reverse();
};

// Fracoes válidas: 10 ou 20 dias, soma = 30
const OPCOES_FRACOES = [
  { label: '1 fração de 30 dias', fracoes: [30] },
  { label: '2 frações: 20 + 10', fracoes: [20, 10] },
  { label: '2 frações: 10 + 20', fracoes: [10, 20] },
  { label: '3 frações: 10 + 10 + 10', fracoes: [10, 10, 10] },
];

const calcularFim = (inicio, dias) => {
  if (!inicio || !dias) return '';
  const d = addDays(new Date(inicio + 'T00:00:00'), dias - 1);
  return format(d, 'yyyy-MM-dd');
};
const calcularRetorno = (inicio, dias) => {
  if (!inicio || !dias) return '';
  const d = addDays(new Date(inicio + 'T00:00:00'), dias);
  return format(d, 'yyyy-MM-dd');
};

const initialFormData = {
  militar_id: '', militar_nome: '', militar_posto: '', militar_matricula: '',
  periodo_aquisitivo_id: '', periodo_aquisitivo_ref: '',
  status: 'Prevista', observacoes: ''
};

export default function CadastrarFerias() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState(initialFormData);
  const [loading, setLoading] = useState(false);
  const [opcaoFracao, setOpcaoFracao] = useState(0);
  const [fracoes, setFracoes] = useState([{ dias: 30, data_inicio: '', data_fim: '', data_retorno: '' }]);

  // Carregar férias existentes do militar para validação
  const { data: feriasExistentes = [] } = useQuery({
    queryKey: ['ferias-existentes', formData.militar_id],
    queryFn: () => base44.entities.Ferias.filter({ militar_id: formData.militar_id }),
    enabled: !!formData.militar_id
  });

  // Períodos aquisitivos ativos do militar
  const { data: periodosExistentes = [] } = useQuery({
    queryKey: ['periodos-existentes', formData.militar_id],
    queryFn: () => base44.entities.PeriodoAquisitivo.filter({ militar_id: formData.militar_id }),
    enabled: !!formData.militar_id
  });

  // Só períodos ativos (não inativados)
  const periodosAtivos = periodosExistentes.filter(p => !p.inativo && p.status !== 'Inativo');

  // Carregar férias para edição
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
      setFracoes([{
        dias: editingFerias.dias || 30,
        data_inicio: editingFerias.data_inicio || '',
        data_fim: editingFerias.data_fim || '',
        data_retorno: editingFerias.data_retorno || ''
      }]);
    }
  }, [editingFerias]);

  const handleChange = (name, value) => setFormData(prev => ({ ...prev, [name]: value }));

  const handleMilitarSelect = (militarData) => {
    setFormData(prev => ({ ...prev, ...militarData, periodo_aquisitivo_id: '', periodo_aquisitivo_ref: '' }));
  };

  const handleOpcaoFracao = (idx) => {
    setOpcaoFracao(idx);
    const novasFracoes = OPCOES_FRACOES[idx].fracoes.map(d => ({ dias: d, data_inicio: '', data_fim: '', data_retorno: '' }));
    setFracoes(novasFracoes);
  };

  const handleFracaoChange = (i, field, value) => {
    setFracoes(prev => {
      const updated = [...prev];
      updated[i] = { ...updated[i], [field]: value };
      if (field === 'data_inicio' || field === 'dias') {
        const inicio = field === 'data_inicio' ? value : updated[i].data_inicio;
        const dias = field === 'dias' ? value : updated[i].dias;
        updated[i].data_fim = calcularFim(inicio, dias);
        updated[i].data_retorno = calcularRetorno(inicio, dias);
      }
      return updated;
    });
  };

  const handlePeriodoChange = (ref) => {
    const periodoExistente = periodosAtivos.find(p => p.ano_referencia === ref);
    setFormData(prev => ({
      ...prev,
      periodo_aquisitivo_ref: ref,
      periodo_aquisitivo_id: periodoExistente?.id || ''
    }));
  };

  // Verificar duplicidade de período
  const periodosJaCadastrados = feriasExistentes
    .filter(f => !editId || f.id !== editId)
    .map(f => f.periodo_aquisitivo_ref);

  // Usar somente os períodos ativos como opções
  const opcaoAnos = periodosAtivos
    .filter(p => !periodosJaCadastrados.includes(p.ano_referencia))
    .map(p => p.ano_referencia)
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.militar_id || !formData.periodo_aquisitivo_ref) return;
    setLoading(true);

    const labelFracao = (i, total) => {
      if (total === 1) return 'Integral';
      if (i === 0) return '1ª Fração';
      if (i === 1) return '2ª Fração';
      return '3ª Fração';
    };

    // Se é edição, atualizar registro único
    if (editId) {
      const f = fracoes[0];
      await base44.entities.Ferias.update(editId, {
        ...formData,
        dias: f.dias,
        data_inicio: f.data_inicio,
        data_fim: f.data_fim,
        data_retorno: f.data_retorno,
        fracionamento: labelFracao(0, fracoes.length)
      });
    } else {
      // Criar uma fração por registro
      for (let i = 0; i < fracoes.length; i++) {
        const f = fracoes[i];
        const fracionamento = labelFracao(i, fracoes.length);
        await base44.entities.Ferias.create({
          ...formData,
          dias: f.dias,
          data_inicio: f.data_inicio,
          data_fim: f.data_fim,
          data_retorno: f.data_retorno,
          fracionamento
        });
      }

      // Criar ou atualizar período aquisitivo se não existir
      if (!formData.periodo_aquisitivo_id) {
        const partes = formData.periodo_aquisitivo_ref.split('/');
        const anoInicio = parseInt(partes[0]);
        const anoFim = parseInt(partes[1]);
        const militar = await base44.entities.Militar.filter({ id: formData.militar_id });
        const m = militar[0];
        if (m) {
          const dataInclusao = new Date((m.data_inclusao || `${anoInicio}-01-01`) + 'T00:00:00');
          const diaAniversario = format(dataInclusao, 'MM-dd');
          const inicio = `${anoInicio}-${diaAniversario}`;
          const fim = format(addDays(new Date(`${anoFim}-${diaAniversario}T00:00:00`), -1), 'yyyy-MM-dd');
          const limite = format(addYears(new Date(fim + 'T00:00:00'), 2), 'yyyy-MM-dd');
          await base44.entities.PeriodoAquisitivo.create({
            militar_id: formData.militar_id,
            militar_nome: formData.militar_nome,
            militar_posto: formData.militar_posto,
            militar_matricula: formData.militar_matricula,
            inicio_aquisitivo: inicio,
            fim_aquisitivo: fim,
            data_limite_gozo: limite,
            dias_direito: 30,
            dias_gozados: 0,
            status: 'Disponível',
            ano_referencia: formData.periodo_aquisitivo_ref
          });
        }
      }
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
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('Ferias'))} className="hover:bg-slate-200">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-[#1e3a5f]">{editId ? 'Editar Férias' : 'Cadastrar Férias'}</h1>
              <p className="text-slate-500 text-sm">Registrar concessão de férias</p>
            </div>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={loading || !formData.militar_id || !formData.periodo_aquisitivo_ref || fracoes.some(f => !f.data_inicio)}
            className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white px-6"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
            Salvar
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <FormSection title="Militar" icon={UserIcon} defaultOpen={true}>
            <MilitarSelector value={formData.militar_id} onChange={handleChange} onMilitarSelect={handleMilitarSelect} />
          </FormSection>

          {formData.militar_id && (
            <FormSection title="Período Aquisitivo" icon={Calendar} defaultOpen={true}>
              <div className="space-y-3">
                <Label className="text-sm font-medium text-slate-700">Selecione o Período <span className="text-red-500">*</span></Label>
                <Select value={formData.periodo_aquisitivo_ref} onValueChange={handlePeriodoChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha o período aquisitivo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {opcaoAnos.map(ano => (
                      <SelectItem key={ano} value={ano}>{ano}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.periodo_aquisitivo_ref && periodosJaCadastrados.includes(formData.periodo_aquisitivo_ref) && (
                  <p className="text-xs text-red-500">⚠ Já existe férias cadastradas para este período.</p>
                )}
              </div>
            </FormSection>
          )}

          {formData.militar_id && formData.periodo_aquisitivo_ref && (
            <>
              {!editId && (
                <FormSection title="Fracionamento" icon={Calendar} defaultOpen={true}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {OPCOES_FRACOES.map((op, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleOpcaoFracao(i)}
                        className={`p-3 rounded-lg border text-sm text-left transition-all ${opcaoFracao === i ? 'border-[#1e3a5f] bg-[#1e3a5f]/5 text-[#1e3a5f] font-medium' : 'border-slate-200 hover:border-slate-300'}`}
                      >
                        {op.label}
                      </button>
                    ))}
                  </div>
                </FormSection>
              )}

              {fracoes.map((f, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200 p-6">
                  <h3 className="text-base font-semibold text-[#1e3a5f] mb-4">
                    {fracoes.length > 1 ? `${i + 1}ª Fração — ${f.dias} dias` : `Férias — ${f.dias} dias`}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Data de Início <span className="text-red-500">*</span></Label>
                      <Input
                        type="date"
                        value={f.data_inicio}
                        onChange={e => handleFracaoChange(i, 'data_inicio', e.target.value)}
                        className="mt-1.5"
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Data de Fim</Label>
                      <Input type="date" value={f.data_fim} disabled className="mt-1.5 bg-slate-50" />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Data de Retorno</Label>
                      <Input type="date" value={f.data_retorno} disabled className="mt-1.5 bg-slate-50" />
                    </div>
                  </div>
                </div>
              ))}

              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-slate-700">Status</Label>
                  <Select value={formData.status} onValueChange={v => handleChange('status', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Prevista">Prevista</SelectItem>
                      <SelectItem value="Em Curso">Em Curso</SelectItem>
                      <SelectItem value="Gozada">Gozada</SelectItem>
                      <SelectItem value="Interrompida">Interrompida</SelectItem>
                    </SelectContent>
                  </Select>
                  <Label className="text-sm font-medium text-slate-700 block mt-3">Observações</Label>
                  <Textarea
                    value={formData.observacoes}
                    onChange={e => handleChange('observacoes', e.target.value)}
                    placeholder="Observações sobre as férias..."
                    className="min-h-20 border-slate-200"
                  />
                </div>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}