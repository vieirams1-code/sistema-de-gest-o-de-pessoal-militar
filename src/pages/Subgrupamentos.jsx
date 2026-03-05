import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Pencil, Trash2, Building2, Check, X } from 'lucide-react';

export default function Subgrupamentos() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [editNome, setEditNome] = useState('');
  const [editSigla, setEditSigla] = useState('');
  const [editDescricao, setEditDescricao] = useState('');
  const [newNome, setNewNome] = useState('');
  const [newSigla, setNewSigla] = useState('');
  const [newDescricao, setNewDescricao] = useState('');
  const [showNew, setShowNew] = useState(false);

  const { data: subgrupamentos = [], isLoading } = useQuery({
    queryKey: ['subgrupamentos'],
    queryFn: () => base44.entities.Subgrupamento.list('nome'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Subgrupamento.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subgrupamentos'] });
      setNewNome(''); setNewSigla(''); setNewDescricao(''); setShowNew(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Subgrupamento.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subgrupamentos'] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Subgrupamento.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subgrupamentos'] }),
  });

  const startEdit = (s) => {
    setEditingId(s.id);
    setEditNome(s.nome);
    setEditSigla(s.sigla || '');
    setEditDescricao(s.descricao || '');
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#1e3a5f]">Subgrupamentos</h1>
            <p className="text-sm text-slate-500 mt-1">Gerencie os subgrupamentos da unidade</p>
          </div>
          <Button onClick={() => setShowNew(true)} className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white">
            <Plus className="w-4 h-4 mr-2" /> Novo Subgrupamento
          </Button>
        </div>

        {/* Formulário de criação */}
        {showNew && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 shadow-sm">
            <p className="font-semibold text-slate-700 mb-3">Novo Subgrupamento</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Input placeholder="Nome *" value={newNome} onChange={e => setNewNome(e.target.value)} />
              <Input placeholder="Sigla (ex: 1ª Cia)" value={newSigla} onChange={e => setNewSigla(e.target.value)} />
              <Input placeholder="Descrição" value={newDescricao} onChange={e => setNewDescricao(e.target.value)} className="col-span-2" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowNew(false)}><X className="w-4 h-4 mr-1" />Cancelar</Button>
              <Button size="sm" className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white" disabled={!newNome} onClick={() => createMutation.mutate({ nome: newNome, sigla: newSigla, descricao: newDescricao, ativo: true })}>
                <Check className="w-4 h-4 mr-1" />Salvar
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" /></div>
        ) : subgrupamentos.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Building2 className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">Nenhum subgrupamento cadastrado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {subgrupamentos.map(s => (
              <div key={s.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                {editingId === s.id ? (
                  <div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <Input value={editNome} onChange={e => setEditNome(e.target.value)} placeholder="Nome *" />
                      <Input value={editSigla} onChange={e => setEditSigla(e.target.value)} placeholder="Sigla" />
                      <Input value={editDescricao} onChange={e => setEditDescricao(e.target.value)} placeholder="Descrição" className="col-span-2" />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" size="sm" onClick={() => setEditingId(null)}><X className="w-4 h-4 mr-1" />Cancelar</Button>
                      <Button size="sm" className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white" onClick={() => updateMutation.mutate({ id: s.id, data: { nome: editNome, sigla: editSigla, descricao: editDescricao } })}>
                        <Check className="w-4 h-4 mr-1" />Salvar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#1e3a5f]/10 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-[#1e3a5f]" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{s.nome} {s.sigla && <span className="text-slate-400 font-normal text-sm">({s.sigla})</span>}</p>
                        {s.descricao && <p className="text-sm text-slate-500">{s.descricao}</p>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => startEdit(s)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700" onClick={() => deleteMutation.mutate(s.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}