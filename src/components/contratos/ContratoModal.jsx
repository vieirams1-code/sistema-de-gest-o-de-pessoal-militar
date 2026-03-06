import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, AlertTriangle } from 'lucide-react';
import MilitarSelector from '@/components/atestado/MilitarSelector';

const POSTOS_OFICIAIS = ['Coronel', 'Tenente Coronel', 'Major', 'Capitão', '1º Tenente', '2º Tenente', 'Aspirante'];

const initialForm = {
  militar_id: '', militar_nome: '', militar_posto: '', militar_matricula: '',
  tipo_contrato: 'Convocação', data_inicio: '', data_fim: '',
  numero_doems: '', data_doems: '', status: 'Vigente', observacoes: ''
};

export default function ContratoModal({ contrato, onClose, onSave }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(contrato ? { ...initialForm, ...contrato } : initialForm);
  const [erroElegibilidade, setErroElegibilidade] = useState('');
  const [saving, setSaving] = useState(false);

  const handleChange = (name, value) => setForm(prev => ({ ...prev, [name]: value }));

  const validarElegibilidade = (posto, situacao, tipo) => {
    if (!posto || !situacao) return '';
    const isOficial = POSTOS_OFICIAIS.includes(posto);
    if (situacao !== 'Reserva Remunerada') {
      return 'Apenas militares da Reserva Remunerada podem ter contrato de Convocação/Designação.';
    }
    if (tipo === 'Convocação' && !isOficial) {
      return 'Convocação é exclusiva para Oficiais da Reserva Remunerada.';
    }
    if (tipo === 'Designação' && isOficial) {
      return 'Designação é exclusiva para Praças da Reserva Remunerada.';
    }
    return '';
  };

  const [militarSituacao, setMilitarSituacao] = useState('');

  const handleMilitarSelect = async (data) => {
    setForm(prev => ({
      ...prev,
      militar_id: data.id || data.militar_id,
      militar_nome: data.nome_completo || data.militar_nome,
      militar_posto: data.posto_graduacao || data.militar_posto,
      militar_matricula: data.matricula || data.militar_matricula,
    }));
    // Buscar situação militar
    try {
      const r = await base44.entities.Militar.filter({ id: data.id || data.militar_id });
      const m = r[0];
      setMilitarSituacao(m?.situacao_militar || '');
    } catch {}
  };

  useEffect(() => {
    if (form.militar_posto && form.tipo_contrato) {
      const err = validarElegibilidade(form.militar_posto, militarSituacao, form.tipo_contrato);
      setErroElegibilidade(err);
    }
  }, [form.militar_posto, form.tipo_contrato, militarSituacao]);

  const handleSubmit = async () => {
    if (erroElegibilidade) return;
    setSaving(true);
    if (contrato?.id) {
      await base44.entities.ContratoConvocacao.update(contrato.id, form);
    } else {
      await base44.entities.ContratoConvocacao.create(form);
      // Atualizar situação do militar
      if (form.militar_id) {
        await base44.entities.Militar.update(form.militar_id, {
          situacao_militar: form.tipo_contrato === 'Convocação' ? 'Convocado' : 'Designado'
        });
      }
    }
    setSaving(false);
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-bold text-[#1e3a5f]">{contrato ? 'Editar Contrato' : 'Novo Contrato'}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>
        <div className="p-6 space-y-4">
          {/* Tipo */}
          <div>
            <Label className="text-sm font-medium">Tipo de Contrato *</Label>
            <Select value={form.tipo_contrato} onValueChange={v => handleChange('tipo_contrato', v)}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Convocação">Convocação (Oficiais RR)</SelectItem>
                <SelectItem value="Designação">Designação (Praças RR)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-400 mt-1">Convocação: Oficiais | Designação: Praças — ambos da Reserva Remunerada</p>
          </div>

          {/* Militar */}
          <div>
            <Label className="text-sm font-medium">Militar *</Label>
            <div className="mt-1.5">
              <MilitarSelector
                value={form.militar_id}
                onChange={(n, v) => handleChange(n, v)}
                onMilitarSelect={handleMilitarSelect}
              />
            </div>
          </div>

          {/* Alerta de elegibilidade */}
          {erroElegibilidade && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{erroElegibilidade}</p>
            </div>
          )}

          {/* Datas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Data de Início *</Label>
              <Input type="date" value={form.data_inicio} onChange={e => handleChange('data_inicio', e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label className="text-sm font-medium">Data de Fim *</Label>
              <Input type="date" value={form.data_fim} onChange={e => handleChange('data_fim', e.target.value)} className="mt-1.5" />
            </div>
          </div>

          {/* DOEMS */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Nº DOEMS / Referência</Label>
              <Input value={form.numero_doems} onChange={e => handleChange('numero_doems', e.target.value)} placeholder="Ex: DOEMS 001/2025" className="mt-1.5" />
            </div>
            <div>
              <Label className="text-sm font-medium">Data do DOEMS</Label>
              <Input type="date" value={form.data_doems} onChange={e => handleChange('data_doems', e.target.value)} className="mt-1.5" />
            </div>
          </div>

          {/* Status manual */}
          {contrato && (
            <div>
              <Label className="text-sm font-medium">Status Manual</Label>
              <Select value={form.status} onValueChange={v => handleChange('status', v)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Vigente">Vigente</SelectItem>
                  <SelectItem value="Encerrado">Encerrado</SelectItem>
                  <SelectItem value="Cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Observações */}
          <div>
            <Label className="text-sm font-medium">Observações</Label>
            <textarea
              value={form.observacoes}
              onChange={e => handleChange('observacoes', e.target.value)}
              rows={3}
              className="mt-1.5 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button
              onClick={handleSubmit}
              disabled={saving || !!erroElegibilidade || !form.militar_id || !form.data_inicio || !form.data_fim}
              className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}