import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Trash2, Plus, User, Clock, X } from 'lucide-react';
import { format } from 'date-fns';

const STATUSES = ['A Fazer', 'Em Andamento', 'Aguardando Info', 'Concluído', 'Arquivado'];
const PRIORIDADES = ['Baixa', 'Média', 'Alta', 'Urgente'];
const TIPOS = ['Renovação de Contrato', 'Processo Administrativo', 'Processo Judicial', 'Designação de Serviço', 'Temporário', 'Licença', 'Outro'];

export default function ProcessoModal({ open, onClose, processo }) {
  const queryClient = useQueryClient();
  const isNew = !processo?.id;

  const defaultForm = {
    titulo: '', descricao: '', tipo: '', status: 'A Fazer', prioridade: 'Média',
    militar_id: '', militar_nome: '', militar_posto: '', militar_matricula: '',
    numero_protocolo: '', data_limite: '', data_renovacao: '',
    responsavel: '', tags: [], observacoes: '', historico_acoes: []
  };

  const [form, setForm] = useState(defaultForm);
  const [novaAcao, setNovaAcao] = useState('');
  const [novaTag, setNovaTag] = useState('');
  const [militarSearch, setMilitarSearch] = useState('');
  const [showMilitarSearch, setShowMilitarSearch] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(processo ? { ...defaultForm, ...processo } : defaultForm);
      setNovaAcao('');
      setNovaTag('');
      setMilitarSearch('');
    }
  }, [open, processo]);

  const { data: militares = [] } = useQuery({
    queryKey: ['militares-ativos'],
    queryFn: () => base44.entities.Militar.filter({ status_cadastro: 'Ativo' }),
    enabled: open,
  });

  const filteredMilitares = militares.filter(m =>
    m.nome_completo?.toLowerCase().includes(militarSearch.toLowerCase()) ||
    m.matricula?.includes(militarSearch)
  ).slice(0, 8);

  const handleSave = async () => {
    setSaving(true);
    const data = { ...form };
    if (!data.tags) data.tags = [];
    if (!data.historico_acoes) data.historico_acoes = [];
    if (isNew) {
      await base44.entities.Processo.create(data);
    } else {
      await base44.entities.Processo.update(processo.id, data);
    }
    queryClient.invalidateQueries({ queryKey: ['processos'] });
    setSaving(false);
    onClose();
  };

  const handleDelete = async () => {
    if (!window.confirm('Excluir este processo?')) return;
    await base44.entities.Processo.delete(processo.id);
    queryClient.invalidateQueries({ queryKey: ['processos'] });
    onClose();
  };

  const addAcao = async () => {
    if (!novaAcao.trim()) return;
    const user = await base44.auth.me();
    const acao = {
      data: new Date().toISOString(),
      autor: user?.full_name || user?.email || 'Sistema',
      descricao: novaAcao.trim()
    };
    const hist = [...(form.historico_acoes || []), acao];
    setForm(p => ({ ...p, historico_acoes: hist }));
    setNovaAcao('');
  };

  const addTag = () => {
    if (!novaTag.trim() || form.tags?.includes(novaTag.trim())) return;
    setForm(p => ({ ...p, tags: [...(p.tags || []), novaTag.trim()] }));
    setNovaTag('');
  };

  const removeTag = (tag) => {
    setForm(p => ({ ...p, tags: p.tags.filter(t => t !== tag) }));
  };

  const selectMilitar = (m) => {
    setForm(p => ({
      ...p,
      militar_id: m.id,
      militar_nome: m.nome_completo,
      militar_posto: m.posto_graduacao || '',
      militar_matricula: m.matricula || ''
    }));
    setShowMilitarSearch(false);
    setMilitarSearch('');
  };

  const clearMilitar = () => {
    setForm(p => ({ ...p, militar_id: '', militar_nome: '', militar_posto: '', militar_matricula: '' }));
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#1e3a5f]">
            {isNew ? 'Novo Processo / Tarefa' : 'Editar Processo'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Título */}
          <div>
            <Label className="text-sm font-medium">Título <span className="text-red-500">*</span></Label>
            <Input
              value={form.titulo}
              onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
              placeholder="Ex: Renovação de contrato - Sgt. Silva"
              className="mt-1"
            />
          </div>

          {/* Tipo / Status / Prioridade */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-sm font-medium">Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm(p => ({ ...p, tipo: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium">Status</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium">Prioridade</Label>
              <Select value={form.prioridade} onValueChange={v => setForm(p => ({ ...p, prioridade: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORIDADES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Data Limite / Prazo</Label>
              <Input type="date" value={form.data_limite} onChange={e => setForm(p => ({ ...p, data_limite: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-sm font-medium">Data Renovação de Contrato</Label>
              <Input type="date" value={form.data_renovacao} onChange={e => setForm(p => ({ ...p, data_renovacao: e.target.value }))} className="mt-1" />
            </div>
          </div>

          {/* Protocolo / Responsável */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Nº Protocolo</Label>
              <Input value={form.numero_protocolo} onChange={e => setForm(p => ({ ...p, numero_protocolo: e.target.value }))} placeholder="Ex: 2025.0001.123456" className="mt-1" />
            </div>
            <div>
              <Label className="text-sm font-medium">Responsável</Label>
              <Input value={form.responsavel} onChange={e => setForm(p => ({ ...p, responsavel: e.target.value }))} placeholder="Nome da auxiliar ou encarregado" className="mt-1" />
            </div>
          </div>

          {/* Militar vinculado */}
          <div>
            <Label className="text-sm font-medium">Militar Vinculado</Label>
            {form.militar_id ? (
              <div className="mt-1 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
                <User className="w-4 h-4 text-blue-500 shrink-0" />
                <span className="text-sm font-medium text-blue-800">{form.militar_posto} {form.militar_nome}</span>
                <span className="text-xs text-blue-500">Mat. {form.militar_matricula}</span>
                <button onClick={clearMilitar} className="ml-auto text-blue-400 hover:text-red-500"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="mt-1 relative">
                <Input
                  placeholder="Buscar militar por nome ou matrícula..."
                  value={militarSearch}
                  onChange={e => { setMilitarSearch(e.target.value); setShowMilitarSearch(true); }}
                  onFocus={() => setShowMilitarSearch(true)}
                />
                {showMilitarSearch && militarSearch && filteredMilitares.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 bg-white border border-slate-200 rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
                    {filteredMilitares.map(m => (
                      <button
                        key={m.id}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm flex items-center gap-2"
                        onClick={() => selectMilitar(m)}
                      >
                        <User className="w-3 h-3 text-slate-400" />
                        <span className="font-medium">{m.posto_graduacao} {m.nome_completo}</span>
                        <span className="text-slate-400 text-xs ml-auto">{m.matricula}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Descrição */}
          <div>
            <Label className="text-sm font-medium">Descrição</Label>
            <Textarea value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} rows={3} placeholder="Detalhes do processo..." className="mt-1" />
          </div>

          {/* Tags */}
          <div>
            <Label className="text-sm font-medium">Tags</Label>
            <div className="flex gap-2 mt-1">
              <Input value={novaTag} onChange={e => setNovaTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())} placeholder="Nova tag..." className="flex-1" />
              <Button variant="outline" size="sm" onClick={addTag}><Plus className="w-4 h-4" /></Button>
            </div>
            {form.tags && form.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.tags.map((tag, i) => (
                  <span key={i} className="flex items-center gap-1 bg-slate-100 text-slate-700 text-xs px-2 py-1 rounded-full">
                    {tag}
                    <button onClick={() => removeTag(tag)} className="text-slate-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Histórico de Ações */}
          <div>
            <Label className="text-sm font-medium flex items-center gap-1"><Clock className="w-4 h-4" /> Histórico de Ações</Label>
            <div className="flex gap-2 mt-1">
              <Input value={novaAcao} onChange={e => setNovaAcao(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addAcao())} placeholder="Registrar nova ação ou andamento..." className="flex-1" />
              <Button variant="outline" size="sm" onClick={addAcao}><Plus className="w-4 h-4" /></Button>
            </div>
            {form.historico_acoes && form.historico_acoes.length > 0 && (
              <div className="mt-2 space-y-2 max-h-40 overflow-y-auto border border-slate-100 rounded-md p-2 bg-slate-50">
                {[...form.historico_acoes].reverse().map((a, i) => (
                  <div key={i} className="text-xs border-l-2 border-[#1e3a5f] pl-2">
                    <span className="text-slate-400">{a.data ? format(new Date(a.data), 'dd/MM/yyyy HH:mm') : ''} · {a.autor}</span>
                    <p className="text-slate-700 mt-0.5">{a.descricao}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Observações */}
          <div>
            <Label className="text-sm font-medium">Observações</Label>
            <Textarea value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} rows={2} className="mt-1" />
          </div>

          {/* Ações */}
          <div className="flex items-center justify-between pt-2 border-t">
            {!isNew ? (
              <Button variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={handleDelete}>
                <Trash2 className="w-4 h-4 mr-1" /> Excluir
              </Button>
            ) : <div />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button
                disabled={saving || !form.titulo}
                onClick={handleSave}
                className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white"
              >
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" /> : null}
                {isNew ? 'Criar Processo' : 'Salvar'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}