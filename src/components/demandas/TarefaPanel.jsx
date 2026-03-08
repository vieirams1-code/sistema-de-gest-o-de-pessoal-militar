import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, CheckCircle2, Circle, Clock, XCircle, Pencil, Trash2 } from 'lucide-react';

const statusConfig = {
  Pendente: { icon: Circle, color: 'text-slate-400', bg: 'bg-slate-100 text-slate-600' },
  'Em andamento': { icon: Clock, color: 'text-blue-500', bg: 'bg-blue-100 text-blue-700' },
  'Aguardando terceiro': { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-100 text-amber-700' },
  Concluída: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-100 text-emerald-700' },
  Cancelada: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-100 text-red-600' },
};

const EMPTY_TAREFA = {
  titulo: '',
  descricao: '',
  tipo_tarefa: '',
  responsavel_nome: '',
  status: 'Pendente',
  prioridade: 'Média',
  prazo: '',
  exige_documento: false,
  exige_assinatura: false,
  observacoes: '',
};

export default function TarefaPanel({ demandaId }) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_TAREFA);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const { data: tarefas = [] } = useQuery({
    queryKey: ['tarefas-demanda', demandaId],
    queryFn: () => base44.entities.Tarefa.filter({ demanda_id: demandaId }),
    enabled: !!demandaId,
  });

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form.titulo) return;
    setSaving(true);
    const payload = { ...form, demanda_id: demandaId, data_criacao: new Date().toISOString().split('T')[0] };
    if (editingId) {
      await base44.entities.Tarefa.update(editingId, payload);
    } else {
      await base44.entities.Tarefa.create(payload);
    }
    queryClient.invalidateQueries({ queryKey: ['tarefas-demanda', demandaId] });
    setSaving(false);
    setAdding(false);
    setEditingId(null);
    setForm(EMPTY_TAREFA);
  };

  const handleEdit = (t) => {
    setForm({ ...EMPTY_TAREFA, ...t });
    setEditingId(t.id);
    setAdding(true);
  };

  const handleDelete = async (id) => {
    await base44.entities.Tarefa.delete(id);
    queryClient.invalidateQueries({ queryKey: ['tarefas-demanda', demandaId] });
  };

  const handleStatusChange = async (t, newStatus) => {
    await base44.entities.Tarefa.update(t.id, {
      status: newStatus,
      data_conclusao: newStatus === 'Concluída' ? new Date().toISOString().split('T')[0] : undefined,
    });
    queryClient.invalidateQueries({ queryKey: ['tarefas-demanda', demandaId] });
  };

  const sorted = [...tarefas].sort((a, b) => {
    const order = ['Em andamento', 'Pendente', 'Aguardando terceiro', 'Concluída', 'Cancelada'];
    return (order.indexOf(a.status) ?? 9) - (order.indexOf(b.status) ?? 9);
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">
          Tarefas ({tarefas.filter(t => t.status !== 'Concluída' && t.status !== 'Cancelada').length} ativas)
        </span>
        <Button size="sm" variant="outline" onClick={() => { setAdding(true); setEditingId(null); setForm(EMPTY_TAREFA); }}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Nova Tarefa
        </Button>
      </div>

      {adding && (
        <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase">{editingId ? 'Editar Tarefa' : 'Nova Tarefa'}</p>
          <div>
            <Label className="text-xs">Título *</Label>
            <Input value={form.titulo} onChange={e => set('titulo', e.target.value)} className="mt-1 h-8 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={form.tipo_tarefa || ''} onValueChange={v => set('tipo_tarefa', v)}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="Tipo..." /></SelectTrigger>
                <SelectContent>
                  {['Elaboração de Minuta', 'Conferência Documental', 'Protocolo', 'Assinatura', 'Encaminhamento', 'Notificação', 'Outro'].map(t => (
                    <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Responsável</Label>
              <Input value={form.responsavel_nome} onChange={e => set('responsavel_nome', e.target.value)} className="mt-1 h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Prazo</Label>
              <Input type="date" value={form.prazo} onChange={e => set('prazo', e.target.value)} className="mt-1 h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Prioridade</Label>
              <Select value={form.prioridade} onValueChange={v => set('prioridade', v)}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Baixa', 'Média', 'Alta', 'Urgente'].map(p => <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)} rows={2} className="mt-1 text-sm" />
          </div>
          <div className="flex gap-4">
            {[{ k: 'exige_documento', l: 'Exige documento' }, { k: 'exige_assinatura', l: 'Exige assinatura' }].map(({ k, l }) => (
              <label key={k} className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="checkbox" checked={!!form[k]} onChange={e => set(k, e.target.checked)} />
                {l}
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => { setAdding(false); setEditingId(null); }}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !form.titulo} className="bg-[#1e3a5f] text-white">
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      )}

      {sorted.length === 0 && !adding && (
        <p className="text-sm text-slate-400 italic text-center py-4">Nenhuma tarefa vinculada.</p>
      )}

      <div className="space-y-2">
        {sorted.map(t => {
          const cfg = statusConfig[t.status] || statusConfig.Pendente;
          const Icon = cfg.icon;
          const concluida = t.status === 'Concluída';
          return (
            <div key={t.id} className={`flex items-start gap-3 p-3 rounded-lg border ${concluida ? 'bg-slate-50 border-slate-100 opacity-70' : 'bg-white border-slate-200'}`}>
              <button
                className="mt-0.5 shrink-0"
                title="Alterar status"
                onClick={() => handleStatusChange(t, concluida ? 'Pendente' : 'Concluída')}
              >
                <Icon className={`w-5 h-5 ${cfg.color}`} />
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-medium ${concluida ? 'line-through text-slate-400' : 'text-slate-800'}`}>{t.titulo}</span>
                  <Badge className={`${cfg.bg} text-[10px]`}>{t.status}</Badge>
                  {t.tipo_tarefa && <Badge className="bg-slate-100 text-slate-500 text-[10px]">{t.tipo_tarefa}</Badge>}
                </div>
                {t.responsavel_nome && <p className="text-xs text-slate-500 mt-0.5">{t.responsavel_nome}</p>}
                {t.prazo && <p className="text-xs text-slate-400 mt-0.5">Prazo: {new Date(t.prazo + 'T00:00:00').toLocaleDateString('pt-BR')}</p>}
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => handleEdit(t)} className="p-1 text-slate-400 hover:text-[#1e3a5f]">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(t.id)} className="p-1 text-slate-400 hover:text-red-500">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}