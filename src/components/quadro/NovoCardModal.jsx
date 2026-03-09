import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PRIORIDADES = ['Baixa', 'Média', 'Alta', 'Urgente'];
const ETIQUETAS = [
  { cor: '#ef4444', label: 'Urgente' },
  { cor: '#f97316', label: 'Atenção' },
  { cor: '#3b82f6', label: 'Rotina' },
  { cor: '#10b981', label: 'Concluído' },
  { cor: '#8b5cf6', label: 'Pessoal' },
  { cor: '#6366f1', label: 'Administrativo' },
];

export default function NovoCardModal({ coluna, onSalvar, onClose, salvando }) {
  const [form, setForm] = useState({
    titulo: '',
    descricao: '',
    prioridade: 'Média',
    prazo: '',
    militar_nome_snapshot: '',
    etiqueta_cor: '',
    etiqueta_texto: '',
    responsavel_nome: '',
    protocolo: '',
    origem_tipo: 'Manual',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[440px] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Novo Card</h3>
            <p className="text-[11px] text-slate-400">Coluna: {coluna.nome}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto max-h-[70vh]">
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Título *</label>
            <Input
              value={form.titulo}
              onChange={e => set('titulo', e.target.value)}
              placeholder="Descreva o card..."
              className="text-sm"
              autoFocus
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Descrição</label>
            <Textarea value={form.descricao} onChange={e => set('descricao', e.target.value)} rows={2} className="text-sm resize-none" placeholder="Detalhes..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Prioridade</label>
              <Select value={form.prioridade} onValueChange={v => set('prioridade', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORIDADES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Prazo</label>
              <Input type="date" value={form.prazo} onChange={e => set('prazo', e.target.value)} className="h-8 text-xs" />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Militar</label>
            <Input value={form.militar_nome_snapshot} onChange={e => set('militar_nome_snapshot', e.target.value)} placeholder="Nome do militar..." className="text-sm" />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Responsável</label>
            <Input value={form.responsavel_nome} onChange={e => set('responsavel_nome', e.target.value)} placeholder="Nome do responsável..." className="text-sm" />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Protocolo</label>
            <Input value={form.protocolo} onChange={e => set('protocolo', e.target.value)} placeholder="Nº protocolo ou referência..." className="text-sm" />
          </div>

          {/* Etiqueta */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Etiqueta</label>
            <div className="flex flex-wrap gap-2">
              {ETIQUETAS.map(et => (
                <button
                  key={et.cor}
                  onClick={() => { set('etiqueta_cor', et.cor); set('etiqueta_texto', et.label); }}
                  className={`px-2 py-1 rounded-full text-[10px] font-bold text-white border-2 transition-all ${form.etiqueta_cor === et.cor ? 'border-slate-800 scale-105' : 'border-transparent'}`}
                  style={{ backgroundColor: et.cor }}
                >
                  {et.label}
                </button>
              ))}
              <button
                onClick={() => { set('etiqueta_cor', ''); set('etiqueta_texto', ''); }}
                className="px-2 py-1 rounded-full text-[10px] font-bold text-slate-400 border-2 border-slate-200 hover:border-slate-300"
              >
                Nenhuma
              </button>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button
            size="sm"
            disabled={!form.titulo.trim() || salvando}
            onClick={() => onSalvar(form)}
            className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white"
          >
            Criar card
          </Button>
        </div>
      </div>
    </div>
  );
}