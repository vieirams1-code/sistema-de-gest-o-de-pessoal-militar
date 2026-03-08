import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Save, User } from 'lucide-react';

const EMPTY = {
  titulo: '',
  assunto_resumido: '',
  descricao: '',
  origem_tipo: '',
  origem_numero_protocolo: '',
  origem_data: '',
  origem_observacoes: '',
  militar_id: '',
  militar_nome_snapshot: '',
  militar_posto_snapshot: '',
  militar_matricula_snapshot: '',
  responsavel_atual_nome: '',
  prioridade: 'Média',
  criticidade: 'Rotina',
  status: 'Aberta',
  etapa_fluxo: 'Recebido',
  data_entrada: new Date().toISOString().split('T')[0],
  prazo_interno: '',
  prazo_final: '',
  tipo_demanda: '',
  exige_documentacao: false,
  exige_assinatura: false,
  impacto_no_efetivo: false,
  observacoes_internas: '',
};

export default function DemandaFormModal({ open, onClose, demanda, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [militarSearch, setMilitarSearch] = useState('');

  const { data: militares = [] } = useQuery({
    queryKey: ['militares-demanda'],
    queryFn: () => base44.entities.Militar.filter({ status_cadastro: 'Ativo' }),
    staleTime: 60000,
  });

  useEffect(() => {
    if (open) {
      setForm(demanda ? { ...EMPTY, ...demanda } : EMPTY);
    }
  }, [open, demanda]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleMilitar = (id) => {
    const m = militares.find(x => x.id === id);
    if (!m) return;
    set('militar_id', m.id);
    set('militar_nome_snapshot', m.nome_completo);
    set('militar_posto_snapshot', m.posto_graduacao || '');
    set('militar_matricula_snapshot', m.matricula || '');
  };

  const handleSave = async () => {
    if (!form.titulo) return;
    setSaving(true);
    const payload = { ...form };
    if (demanda?.id) {
      await base44.entities.Demanda.update(demanda.id, payload);
    } else {
      await base44.entities.Demanda.create(payload);
    }
    setSaving(false);
    onSaved?.();
    onClose();
  };

  const militaresFiltrados = militares.filter(m =>
    !militarSearch || m.nome_completo?.toLowerCase().includes(militarSearch.toLowerCase()) || m.matricula?.includes(militarSearch)
  ).slice(0, 20);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#1e3a5f]">
            {demanda ? 'Editar Demanda' : 'Nova Demanda'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Dados principais */}
          <div className="space-y-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Dados Principais</p>
            <div>
              <Label>Título *</Label>
              <Input value={form.titulo} onChange={e => set('titulo', e.target.value)} className="mt-1.5" placeholder="Descreva brevemente a demanda" />
            </div>
            <div>
              <Label>Assunto Resumido</Label>
              <Input value={form.assunto_resumido} onChange={e => set('assunto_resumido', e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={e => set('descricao', e.target.value)} rows={3} className="mt-1.5" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Tipo de Demanda</Label>
                <Select value={form.tipo_demanda || ''} onValueChange={v => set('tipo_demanda', v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {['Administrativa', 'Operacional', 'Pessoal', 'Saúde', 'Jurídica', 'Logística', 'Outro'].map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select value={form.prioridade} onValueChange={v => set('prioridade', v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Baixa', 'Média', 'Alta', 'Urgente'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Criticidade</Label>
                <Select value={form.criticidade} onValueChange={v => set('criticidade', v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Rotina', 'Prazo Próximo', 'Prazo Vencido', 'Impacta Efetivo', 'Determinação de Comando', 'Sensível'].map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Origem */}
          <div className="space-y-4 border-t pt-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Origem</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Tipo de Origem</Label>
                <Select value={form.origem_tipo || ''} onValueChange={v => set('origem_tipo', v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {['TARS', 'EMS', 'Verbal', 'Interno', 'Documento Físico', 'E-mail', 'Outro'].map(o => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nº Protocolo</Label>
                <Input value={form.origem_numero_protocolo} onChange={e => set('origem_numero_protocolo', e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label>Data de Origem</Label>
                <Input type="date" value={form.origem_data} onChange={e => set('origem_data', e.target.value)} className="mt-1.5" />
              </div>
            </div>
            <div>
              <Label>Observações da Origem</Label>
              <Textarea value={form.origem_observacoes} onChange={e => set('origem_observacoes', e.target.value)} rows={2} className="mt-1.5" />
            </div>
          </div>

          {/* Militar Vinculado */}
          <div className="space-y-4 border-t pt-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Militar Vinculado (opcional)</p>
            <div className="flex gap-2">
              <Input
                placeholder="Buscar por nome ou matrícula..."
                value={militarSearch}
                onChange={e => setMilitarSearch(e.target.value)}
                className="flex-1"
              />
              {form.militar_id && (
                <Button variant="outline" onClick={() => { set('militar_id', ''); set('militar_nome_snapshot', ''); setMilitarSearch(''); }}>
                  Limpar
                </Button>
              )}
            </div>
            {form.militar_id ? (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                <User className="w-4 h-4 inline mr-1" />
                {form.militar_posto_snapshot} {form.militar_nome_snapshot} — Mat: {form.militar_matricula_snapshot}
              </div>
            ) : militarSearch.length > 1 ? (
              <div className="border rounded-lg overflow-hidden">
                {militaresFiltrados.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { handleMilitar(m.id); setMilitarSearch(''); }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 border-b last:border-0"
                  >
                    <span className="text-slate-500 text-xs mr-2">{m.posto_graduacao}</span>
                    {m.nome_completo}
                    <span className="text-slate-400 text-xs ml-2">Mat: {m.matricula}</span>
                  </button>
                ))}
                {militaresFiltrados.length === 0 && (
                  <p className="px-4 py-3 text-sm text-slate-400">Nenhum militar encontrado.</p>
                )}
              </div>
            ) : null}
          </div>

          {/* Fluxo e responsável */}
          <div className="space-y-4 border-t pt-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Fluxo e Responsável</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Etapa do Fluxo</Label>
                <Select value={form.etapa_fluxo} onValueChange={v => set('etapa_fluxo', v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Recebido', 'Triagem', 'Aguardando decisão do chefe', 'Aguardando assinatura do chefe', 'Em elaboração', 'Aguardando documento', 'Aguardando comando superior', 'Retornado para execução', 'Concluído', 'Arquivado'].map(e => (
                      <SelectItem key={e} value={e}>{e}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => set('status', v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Aberta', 'Em Andamento', 'Concluída', 'Arquivada', 'Cancelada'].map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Responsável Atual</Label>
                <Input value={form.responsavel_atual_nome} onChange={e => set('responsavel_atual_nome', e.target.value)} className="mt-1.5" placeholder="Nome do responsável" />
              </div>
              <div>
                <Label>Data de Entrada</Label>
                <Input type="date" value={form.data_entrada} onChange={e => set('data_entrada', e.target.value)} className="mt-1.5" />
              </div>
            </div>
          </div>

          {/* Prazos */}
          <div className="space-y-4 border-t pt-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Prazos</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Prazo Interno</Label>
                <Input type="date" value={form.prazo_interno} onChange={e => set('prazo_interno', e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label>Prazo Final</Label>
                <Input type="date" value={form.prazo_final} onChange={e => set('prazo_final', e.target.value)} className="mt-1.5" />
              </div>
            </div>
          </div>

          {/* Checklist */}
          <div className="space-y-3 border-t pt-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Requisitos</p>
            <div className="flex flex-wrap gap-6">
              {[
                { key: 'exige_documentacao', label: 'Exige documentação' },
                { key: 'exige_assinatura', label: 'Exige assinatura' },
                { key: 'impacto_no_efetivo', label: 'Impacta efetivo' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!!form[key]}
                    onChange={e => set(key, e.target.checked)}
                    className="rounded"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Observações */}
          <div className="border-t pt-4">
            <Label>Observações Internas</Label>
            <Textarea value={form.observacoes_internas} onChange={e => set('observacoes_internas', e.target.value)} rows={3} className="mt-1.5" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.titulo} className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white">
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Salvando...' : 'Salvar Demanda'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}