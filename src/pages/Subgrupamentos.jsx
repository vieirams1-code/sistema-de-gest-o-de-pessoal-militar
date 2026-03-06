import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Pencil, Trash2, Building2, Check, X, ChevronRight, ChevronDown, GitBranch } from 'lucide-react';

export default function Subgrupamentos() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [showNew, setShowNew] = useState(false);
  const [newData, setNewData] = useState({ nome: '', sigla: '', descricao: '', tipo: 'Grupamento', grupamento_id: '' });
  const [expandedGrupamentos, setExpandedGrupamentos] = useState({});

  const { data: todos = [], isLoading } = useQuery({
    queryKey: ['subgrupamentos'],
    queryFn: () => base44.entities.Subgrupamento.list('nome'),
  });

  const grupamentos = todos.filter(s => s.tipo === 'Grupamento');
  const subgrupamentos = todos.filter(s => s.tipo === 'Subgrupamento');

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Subgrupamento.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subgrupamentos'] });
      setNewData({ nome: '', sigla: '', descricao: '', tipo: 'Grupamento', grupamento_id: '' });
      setShowNew(false);
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
    setEditData({ nome: s.nome, sigla: s.sigla || '', descricao: s.descricao || '', tipo: s.tipo, grupamento_id: s.grupamento_id || '' });
  };

  const saveEdit = (id) => {
    const grupamento = grupamentos.find(g => g.id === editData.grupamento_id);
    updateMutation.mutate({
      id,
      data: {
        ...editData,
        grupamento_nome: grupamento?.nome || '',
      }
    });
  };

  const handleCreate = () => {
    const grupamento = grupamentos.find(g => g.id === newData.grupamento_id);
    createMutation.mutate({
      ...newData,
      ativo: true,
      grupamento_nome: grupamento?.nome || '',
    });
  };

  const toggleExpand = (id) => {
    setExpandedGrupamentos(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getSubgrupamentosDo = (grupamentoId) =>
    subgrupamentos.filter(s => s.grupamento_id === grupamentoId);

  const semGrupamento = subgrupamentos.filter(s => !s.grupamento_id);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#1e3a5f]">Estrutura Organizacional</h1>
            <p className="text-sm text-slate-500 mt-1">Setores, Subsetores e Seções da unidade</p>
          </div>
          <Button onClick={() => setShowNew(true)} className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white">
            <Plus className="w-4 h-4 mr-2" /> Novo
          </Button>
        </div>

        {/* Formulário de criação */}
        {showNew && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 shadow-sm">
            <p className="font-semibold text-slate-700 mb-3">Nova Unidade Organizacional</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="col-span-2">
                <label className="text-xs font-medium text-slate-600 mb-1 block">Tipo *</label>
                <div className="flex gap-3">
                  {['Grupamento', 'Subgrupamento'].map(tipo => (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => setNewData(d => ({ ...d, tipo, grupamento_id: '' }))}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${newData.tipo === tipo ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]' : 'bg-white text-slate-600 border-slate-200 hover:border-[#1e3a5f]'}`}
                    >
                      {tipo === 'Grupamento' ? '🏢 Setor (Nível 1)' : '🔹 Subsetor / Seção (Nível 2/3)'}
                    </button>
                  ))}
                </div>
              </div>
              <Input placeholder="Nome *" value={newData.nome} onChange={e => setNewData(d => ({ ...d, nome: e.target.value }))} />
              <Input placeholder="Sigla (ex: 1ª Cia)" value={newData.sigla} onChange={e => setNewData(d => ({ ...d, sigla: e.target.value }))} />
              <Input placeholder="Descrição" value={newData.descricao} onChange={e => setNewData(d => ({ ...d, descricao: e.target.value }))} className="col-span-2" />
              {newData.tipo === 'Subgrupamento' && (
                <div className="col-span-2">
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Setor Pai *</label>
                  <select
                    className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                    value={newData.grupamento_id}
                    onChange={e => setNewData(d => ({ ...d, grupamento_id: e.target.value }))}
                  >
                    <option value="">Selecione o setor pai...</option>
                    {grupamentos.map(g => (
                      <option key={g.id} value={g.id}>{g.nome} {g.sigla && `(${g.sigla})`}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowNew(false)}><X className="w-4 h-4 mr-1" />Cancelar</Button>
              <Button size="sm" className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white"
                disabled={!newData.nome || (newData.tipo === 'Subgrupamento' && !newData.grupamento_id)}
                onClick={handleCreate}>
                <Check className="w-4 h-4 mr-1" />Salvar
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" /></div>
        ) : todos.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Building2 className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">Nenhum grupamento cadastrado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Grupamentos e seus filhos */}
            {grupamentos.map(g => {
              const filhos = getSubgrupamentosDo(g.id);
              const expanded = expandedGrupamentos[g.id] !== false; // expandido por padrão
              return (
                <div key={g.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  {/* Linha do Grupamento */}
                  {editingId === g.id ? (
                    <EditRow
                      data={editData}
                      setData={setEditData}
                      grupamentos={grupamentos}
                      onSave={() => saveEdit(g.id)}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <div className="flex items-center justify-between p-4 bg-[#1e3a5f]/5 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <button onClick={() => toggleExpand(g.id)} className="text-[#1e3a5f]">
                          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                        <div className="w-9 h-9 rounded-lg bg-[#1e3a5f]/15 flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-[#1e3a5f]" />
                        </div>
                        <div>
                          <p className="font-bold text-[#1e3a5f]">{g.nome} {g.sigla && <span className="font-normal text-slate-400 text-sm">({g.sigla})</span>}</p>
                          {g.descricao && <p className="text-xs text-slate-500">{g.descricao}</p>}
                        </div>
                        <span className="ml-2 text-xs bg-[#1e3a5f]/10 text-[#1e3a5f] px-2 py-0.5 rounded-full font-medium">{filhos.length} subsetor(es)/seção(ões)</span>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => startEdit(g)}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700" onClick={() => deleteMutation.mutate(g.id)}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </div>
                  )}

                  {/* Filhos */}
                  {expanded && filhos.length > 0 && (
                    <div className="divide-y divide-slate-100">
                      {filhos.map(s => (
                        <div key={s.id}>
                          {editingId === s.id ? (
                            <div className="pl-10 pr-4 py-3">
                              <EditRow
                                data={editData}
                                setData={setEditData}
                                grupamentos={grupamentos}
                                onSave={() => saveEdit(s.id)}
                                onCancel={() => setEditingId(null)}
                              />
                            </div>
                          ) : (
                            <div className="flex items-center justify-between px-4 py-3 pl-10 hover:bg-slate-50">
                              <div className="flex items-center gap-3">
                                <GitBranch className="w-4 h-4 text-slate-400" />
                                <div>
                                  <p className="font-medium text-slate-700">{s.nome} {s.sigla && <span className="text-slate-400 font-normal text-sm">({s.sigla})</span>}</p>
                                  {s.descricao && <p className="text-xs text-slate-500">{s.descricao}</p>}
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" onClick={() => startEdit(s)}><Pencil className="w-4 h-4" /></Button>
                                <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700" onClick={() => deleteMutation.mutate(s.id)}><Trash2 className="w-4 h-4" /></Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {expanded && filhos.length === 0 && editingId !== g.id && (
                    <p className="text-xs text-slate-400 px-10 py-2 italic">Nenhum subsetor/seção vinculado</p>
                  )}
                </div>
              );
            })}

            {/* Subgrupamentos sem grupamento pai */}
            {semGrupamento.length > 0 && (
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold mb-2 mt-4">Sem grupamento pai</p>
                {semGrupamento.map(s => (
                  <div key={s.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm mb-2">
                    {editingId === s.id ? (
                      <EditRow data={editData} setData={setEditData} grupamentos={grupamentos} onSave={() => saveEdit(s.id)} onCancel={() => setEditingId(null)} />
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <GitBranch className="w-4 h-4 text-slate-400" />
                          <p className="font-medium text-slate-700">{s.nome} {s.sigla && <span className="text-slate-400 font-normal text-sm">({s.sigla})</span>}</p>
                        </div>
                        <div className="flex gap-1">
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
        )}

        {/* Legenda */}
        <div className="mt-8 bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-sm font-semibold text-blue-800 mb-2">Como funciona a hierarquia organizacional:</p>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>🏢 <strong>Setor (Nível 1):</strong> Unidade principal (ex: 1º GBM)</li>
            <li>🔹 <strong>Subsetor (Nível 2):</strong> Subdivisão do setor (ex: 1ª Cia, Seção de Saúde)</li>
            <li>📋 <strong>Seção (Nível 3):</strong> Subdivisão do subsetor — cadastre como Subgrupamento filho de outro Subgrupamento</li>
          </ul>
          <p className="text-sm font-semibold text-blue-800 mt-3 mb-1">Controle de acesso:</p>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>🔑 <strong>Admin:</strong> Acesso total</li>
            <li>🏢 <strong>Usuário de Setor:</strong> Vê dados do setor e todos os subsetores/seções</li>
            <li>🔹 <strong>Usuário de Subsetor/Seção:</strong> Vê apenas sua unidade</li>
          </ul>
          <p className="text-xs text-blue-600 mt-3">Configure as permissões dos usuários em <strong>Configurações → Permissões e Usuários</strong>.</p>
        </div>
      </div>
    </div>
  );
}

function EditRow({ data, setData, grupamentos, onSave, onCancel }) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <Input value={data.nome} onChange={e => setData(d => ({ ...d, nome: e.target.value }))} placeholder="Nome *" />
        <Input value={data.sigla} onChange={e => setData(d => ({ ...d, sigla: e.target.value }))} placeholder="Sigla" />
        <Input value={data.descricao} onChange={e => setData(d => ({ ...d, descricao: e.target.value }))} placeholder="Descrição" className="col-span-2" />
        {data.tipo === 'Subgrupamento' && (
          <div className="col-span-2">
            <select
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
              value={data.grupamento_id}
              onChange={e => setData(d => ({ ...d, grupamento_id: e.target.value }))}
            >
              <option value="">Sem grupamento pai</option>
              {grupamentos.map(g => (
                <option key={g.id} value={g.id}>{g.nome} {g.sigla && `(${g.sigla})`}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onCancel}><X className="w-4 h-4 mr-1" />Cancelar</Button>
        <Button size="sm" className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white" onClick={onSave}><Check className="w-4 h-4 mr-1" />Salvar</Button>
      </div>
    </div>
  );
}