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
import { Save, User, ArrowRight, Search, X } from 'lucide-react';

const TODAY = new Date().toISOString().split('T')[0];

const EMPTY = {
  titulo: '',
  descricao: '',
  tipo_demanda: '',
  categoria: '',
  subtipo: '',
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
  data_entrada: TODAY,
  proxima_acao: '',
  prazo_interno: '',
  prazo_final: '',
  exige_documentacao: false,
  exige_assinatura: false,
  impacto_no_efetivo: false,
  observacoes_internas: '',
};

const SectionTitle = ({ children }) => (
  <p className="text-xs font-bold text-[#1e3a5f]/60 uppercase tracking-widest mb-3">{children}</p>
);

const FormBlock = ({ children, className = '' }) => (
  <div className={`bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3 ${className}`}>
    {children}
  </div>
);

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

        <div className="space-y-4 py-2">

          {/* ── 1. DADOS PRINCIPAIS ── */}
          <FormBlock>
            <SectionTitle>Dados Principais</SectionTitle>
            <div>
              <Label className="text-slate-700">Título <span className="text-red-500">*</span></Label>
              <Input value={form.titulo} onChange={e => set('titulo', e.target.value)} className="mt-1.5 bg-white" placeholder="Descreva brevemente a demanda" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-slate-700">Tipo de Demanda</Label>
                <Select value={form.tipo_demanda || ''} onValueChange={v => set('tipo_demanda', v)}>
                  <SelectTrigger className="mt-1.5 bg-white"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {['Administrativa', 'Operacional', 'Pessoal', 'Saúde', 'Jurídica', 'Logística', 'Outro'].map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-700">Categoria</Label>
                <Input value={form.categoria || ''} onChange={e => set('categoria', e.target.value)} className="mt-1.5 bg-white" placeholder="Ex: Licença, Contrato..." />
              </div>
              <div>
                <Label className="text-slate-700">Subtipo</Label>
                <Input value={form.subtipo || ''} onChange={e => set('subtipo', e.target.value)} className="mt-1.5 bg-white" placeholder="Detalhe opcional" />
              </div>
            </div>
            <div>
              <Label className="text-slate-700">Descrição</Label>
              <Textarea value={form.descricao} onChange={e => set('descricao', e.target.value)} rows={2} className="mt-1.5 bg-white" placeholder="Contexto adicional sobre a demanda (opcional)" />
            </div>
          </FormBlock>

          {/* ── 2. ORIGEM ── */}
          <FormBlock>
            <SectionTitle>Origem</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-slate-700">Canal de Origem <span className="text-red-500">*</span></Label>
                <Select value={form.origem_tipo || ''} onValueChange={v => set('origem_tipo', v)}>
                  <SelectTrigger className="mt-1.5 bg-white"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {['TARS', 'EMS', 'Verbal', 'Interno', 'Documento Físico', 'E-mail', 'Outro'].map(o => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-700">Nº Protocolo / Ref.</Label>
                <Input value={form.origem_numero_protocolo} onChange={e => set('origem_numero_protocolo', e.target.value)} className="mt-1.5 bg-white" placeholder="Número ou referência" />
              </div>
              <div>
                <Label className="text-slate-700">Data de Entrada <span className="text-red-500">*</span></Label>
                <Input type="date" value={form.data_entrada} onChange={e => set('data_entrada', e.target.value)} className="mt-1.5 bg-white" />
              </div>
            </div>
            <div>
              <Label className="text-slate-700">Observações da Origem</Label>
              <Textarea value={form.origem_observacoes} onChange={e => set('origem_observacoes', e.target.value)} rows={2} className="mt-1.5 bg-white" placeholder="Ex: número do documento, quem trouxe..." />
            </div>
          </FormBlock>

          {/* ── 3. MILITAR VINCULADO ── */}
          <FormBlock>
            <SectionTitle>Militar Vinculado <span className="font-normal normal-case text-slate-400">(opcional)</span></SectionTitle>
            {form.militar_id ? (
              <div className="flex items-center justify-between gap-3 p-3 bg-[#1e3a5f]/5 border border-[#1e3a5f]/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-[#1e3a5f] shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-[#1e3a5f]">
                      {form.militar_posto_snapshot ? `${form.militar_posto_snapshot} ` : ''}{form.militar_nome_snapshot}
                    </p>
                    {form.militar_matricula_snapshot && <p className="text-xs text-slate-400">Mat: {form.militar_matricula_snapshot}</p>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { set('militar_id', ''); set('militar_nome_snapshot', ''); set('militar_posto_snapshot', ''); set('militar_matricula_snapshot', ''); setMilitarSearch(''); }}
                  className="text-slate-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Buscar por nome ou matrícula..."
                    value={militarSearch}
                    onChange={e => setMilitarSearch(e.target.value)}
                    className="pl-10 bg-white"
                  />
                </div>
                {militarSearch.length > 1 && (
                  <div className="mt-1 border border-slate-200 rounded-lg overflow-hidden shadow-sm max-h-48 overflow-y-auto">
                    {militaresFiltrados.length > 0 ? militaresFiltrados.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => { handleMilitar(m.id); setMilitarSearch(''); }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 border-b last:border-0 transition-colors"
                      >
                        <span className="text-slate-400 text-xs mr-2">{m.posto_graduacao}</span>
                        <span className="font-medium text-slate-800">{m.nome_completo}</span>
                        <span className="text-slate-400 text-xs ml-2">· {m.matricula}</span>
                      </button>
                    )) : (
                      <p className="px-4 py-3 text-sm text-slate-400">Nenhum militar encontrado.</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </FormBlock>

          {/* ── 4. RESPONSÁVEL E PRIORIDADE ── */}
          <FormBlock>
            <SectionTitle>Responsável e Prioridade</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-700">Responsável Atual</Label>
                <Input value={form.responsavel_atual_nome} onChange={e => set('responsavel_atual_nome', e.target.value)} className="mt-1.5 bg-white" placeholder="Nome de quem está cuidando" />
              </div>
              <div>
                <Label className="text-slate-700">Prioridade <span className="text-red-500">*</span></Label>
                <Select value={form.prioridade} onValueChange={v => set('prioridade', v)}>
                  <SelectTrigger className="mt-1.5 bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Baixa', 'Média', 'Alta', 'Urgente'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-700">Criticidade</Label>
                <Select value={form.criticidade} onValueChange={v => set('criticidade', v)}>
                  <SelectTrigger className="mt-1.5 bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Rotina', 'Prazo Próximo', 'Prazo Vencido', 'Impacta Efetivo', 'Determinação de Comando', 'Sensível'].map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-700">Status</Label>
                <Select value={form.status} onValueChange={v => set('status', v)}>
                  <SelectTrigger className="mt-1.5 bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Aberta', 'Em Andamento', 'Concluída', 'Arquivada', 'Cancelada'].map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Indicadores */}
            <div className="flex flex-wrap gap-4 pt-1">
              {[
                { key: 'exige_documentacao', label: 'Exige documentação' },
                { key: 'exige_assinatura', label: 'Exige assinatura' },
                { key: 'impacto_no_efetivo', label: 'Impacta efetivo' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm cursor-pointer select-none text-slate-700">
                  <input type="checkbox" checked={!!form[key]} onChange={e => set(key, e.target.checked)} className="rounded accent-[#1e3a5f]" />
                  {label}
                </label>
              ))}
            </div>
          </FormBlock>

          {/* ── 5. SITUAÇÃO E PRÓXIMA AÇÃO ── */}
          <FormBlock>
            <SectionTitle>Situação e Próxima Ação</SectionTitle>
            <div>
              <Label className="text-slate-700">Etapa do Fluxo <span className="text-red-500">*</span></Label>
              <Select value={form.etapa_fluxo} onValueChange={v => set('etapa_fluxo', v)}>
                <SelectTrigger className="mt-1.5 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Recebido', 'Triagem', 'Aguardando decisão do chefe', 'Aguardando assinatura do chefe', 'Em elaboração', 'Aguardando documento', 'Aguardando comando superior', 'Retornado para execução', 'Concluído', 'Arquivado'].map(e => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Próxima ação — campo em destaque */}
            <div className="rounded-lg border border-[#1e3a5f]/25 bg-[#1e3a5f]/5 p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <ArrowRight className="w-4 h-4 text-[#1e3a5f]" />
                <Label className="text-[#1e3a5f] font-semibold text-sm">Próxima Ação</Label>
                <span className="text-xs text-slate-400 font-normal">— orienta o andamento da demanda</span>
              </div>
              <Textarea
                value={form.proxima_acao || ''}
                onChange={e => set('proxima_acao', e.target.value)}
                rows={2}
                className="bg-white border-[#1e3a5f]/20 text-sm"
                placeholder="Ex: Aguardar assinatura do Ten Cel Silva. / Elaborar minuta de ofício até sexta."
              />
            </div>
          </FormBlock>

          {/* ── 6. PRAZOS ── */}
          <FormBlock>
            <SectionTitle>Prazos</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-700">Prazo Interno</Label>
                <Input type="date" value={form.prazo_interno} onChange={e => set('prazo_interno', e.target.value)} className="mt-1.5 bg-white" />
              </div>
              <div>
                <Label className="text-slate-700">Prazo Final</Label>
                <Input type="date" value={form.prazo_final} onChange={e => set('prazo_final', e.target.value)} className="mt-1.5 bg-white" />
              </div>
            </div>
          </FormBlock>

          {/* ── 7. OBSERVAÇÕES INTERNAS ── */}
          <FormBlock className="border-amber-200 bg-amber-50/60">
            <SectionTitle>Observações Internas</SectionTitle>
            <Textarea
              value={form.observacoes_internas}
              onChange={e => set('observacoes_internas', e.target.value)}
              rows={3}
              className="bg-white"
              placeholder="Notas internas da seção (não publicadas)"
            />
          </FormBlock>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.titulo || !form.origem_tipo || !form.data_entrada || !form.etapa_fluxo || !form.prioridade}
              className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Salvando...' : 'Salvar Demanda'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}