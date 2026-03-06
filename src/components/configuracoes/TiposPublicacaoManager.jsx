import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit2, Save, X, ChevronDown, ChevronRight, Info } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";

const CAMPO_TIPOS = [
  { value: 'text', label: 'Texto' },
  { value: 'date', label: 'Data' },
  { value: 'number', label: 'Número' },
  { value: 'textarea', label: 'Texto longo' },
];

const VARIAVEIS_PADRAO = [
  { var: '{{posto_nome}}', desc: 'Posto/Graduação do militar' },
  { var: '{{nome_completo}}', desc: 'Nome completo do militar' },
  { var: '{{matricula}}', desc: 'Matrícula do militar' },
  { var: '{{data_registro}}', desc: 'Data do registro' },
];

const emptyForm = {
  nome: '',
  modulo: 'Livro',
  campos: [],
  template: '',
  ativo: true,
};

function CampoRow({ campo, index, onChange, onRemove }) {
  return (
    <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
      <div className="flex-1 grid grid-cols-3 gap-2">
        <Input
          placeholder="Chave (ex: nome_curso)"
          value={campo.chave}
          onChange={e => onChange(index, 'chave', e.target.value.replace(/\s+/g, '_').toLowerCase())}
          className="text-sm"
        />
        <Input
          placeholder="Label (ex: Nome do Curso)"
          value={campo.label}
          onChange={e => onChange(index, 'label', e.target.value)}
          className="text-sm"
        />
        <Select value={campo.tipo} onValueChange={v => onChange(index, 'tipo', v)}>
          <SelectTrigger className="text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CAMPO_TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <label className="flex items-center gap-1 text-xs text-slate-500 whitespace-nowrap cursor-pointer">
        <input
          type="checkbox"
          checked={campo.obrigatorio || false}
          onChange={e => onChange(index, 'obrigatorio', e.target.checked)}
          className="accent-[#1e3a5f]"
        />
        Obrigatório
      </label>
      <Button variant="ghost" size="icon" onClick={() => onRemove(index)} className="text-red-500 hover:text-red-700 shrink-0">
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}

function TipoForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || emptyForm);
  const [showVars, setShowVars] = useState(false);

  const addCampo = () => {
    setForm(prev => ({
      ...prev,
      campos: [...(prev.campos || []), { chave: '', label: '', tipo: 'text', obrigatorio: false }]
    }));
  };

  const updateCampo = (index, key, value) => {
    setForm(prev => {
      const campos = [...prev.campos];
      campos[index] = { ...campos[index], [key]: value };
      return { ...prev, campos };
    });
  };

  const removeCampo = (index) => {
    setForm(prev => ({ ...prev, campos: prev.campos.filter((_, i) => i !== index) }));
  };

  const inserirVariavel = (varStr) => {
    setForm(prev => ({ ...prev, template: (prev.template || '') + varStr }));
  };

  const camposVars = (form.campos || []).filter(c => c.chave).map(c => `{{${c.chave}}}`);

  return (
    <div className="space-y-5 p-5 bg-slate-50 rounded-xl border border-slate-200">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Nome do Tipo *</Label>
          <Input
            placeholder="Ex: Publicação de Curso Superior"
            value={form.nome}
            onChange={e => setForm(prev => ({ ...prev, nome: e.target.value }))}
          />
        </div>
        <div>
          <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Módulo *</Label>
          <Select value={form.modulo} onValueChange={v => setForm(prev => ({ ...prev, modulo: v }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Livro">Livro</SelectItem>
              <SelectItem value="Publicação Ex Officio">Publicação Ex Officio</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Campos dinâmicos */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-medium text-slate-700">Campos do Formulário</Label>
          <Button size="sm" variant="outline" onClick={addCampo} className="h-7 text-xs">
            <Plus className="w-3 h-3 mr-1" /> Adicionar Campo
          </Button>
        </div>
        <div className="text-xs text-slate-400 mb-2">Cabeçalho: Chave | Label | Tipo | Obrigatório</div>
        <div className="space-y-2">
          {(form.campos || []).map((campo, i) => (
            <CampoRow key={i} campo={campo} index={i} onChange={updateCampo} onRemove={removeCampo} />
          ))}
          {(form.campos || []).length === 0 && (
            <p className="text-xs text-slate-400 py-2">Nenhum campo adicionado. Os campos padrão (militar, data) são sempre incluídos.</p>
          )}
        </div>
      </div>

      {/* Template */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-medium text-slate-700">Template do Texto de Publicação *</Label>
          <button
            type="button"
            onClick={() => setShowVars(!showVars)}
            className="text-xs text-blue-600 flex items-center gap-1 hover:underline"
          >
            <Info className="w-3 h-3" />
            Variáveis disponíveis
            {showVars ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        </div>

        {showVars && (
          <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200 text-xs space-y-1">
            <p className="font-medium text-blue-800 mb-2">Clique para inserir no template:</p>
            <div className="flex flex-wrap gap-2">
              {[...VARIAVEIS_PADRAO, ...camposVars.map(v => ({ var: v, desc: `Campo: ${v}` }))].map((item, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => inserirVariavel(item.var || item)}
                  className="bg-white border border-blue-200 rounded px-2 py-0.5 text-blue-700 hover:bg-blue-100 font-mono"
                  title={item.desc}
                >
                  {item.var || item}
                </button>
              ))}
            </div>
          </div>
        )}

        <Textarea
          placeholder="Ex: ...torna público que {{posto_nome}} {{nome_completo}}, matrícula {{matricula}}, concluiu o curso {{nome_curso}} em {{data_conclusao}}..."
          value={form.template}
          onChange={e => setForm(prev => ({ ...prev, template: e.target.value }))}
          rows={5}
          className="font-mono text-sm"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>
          <X className="w-4 h-4 mr-1" /> Cancelar
        </Button>
        <Button
          onClick={() => onSave(form)}
          disabled={!form.nome.trim() || !form.template.trim()}
          className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
        >
          <Save className="w-4 h-4 mr-1" /> Salvar Tipo
        </Button>
      </div>
    </div>
  );
}

export default function TiposPublicacaoManager() {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null); // id do que está editando
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null });
  const [filtroModulo, setFiltroModulo] = useState('todos');

  const { data: tipos = [] } = useQuery({
    queryKey: ['tipos-publicacao-custom'],
    queryFn: () => base44.entities.TipoPublicacaoCustom.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.TipoPublicacaoCustom.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tipos-publicacao-custom'] });
      setAdding(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TipoPublicacaoCustom.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tipos-publicacao-custom'] });
      setEditing(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.TipoPublicacaoCustom.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tipos-publicacao-custom'] });
      setDeleteDialog({ open: false, id: null });
    }
  });

  const tiposFiltrados = filtroModulo === 'todos' ? tipos : tipos.filter(t => t.modulo === filtroModulo);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-[#1e3a5f]">Tipos de Publicação Personalizados</h2>
          <p className="text-sm text-slate-500 mt-0.5">Crie novos tipos de publicação com campos e templates personalizados.</p>
        </div>
        {!adding && !editing && (
          <Button onClick={() => setAdding(true)} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
            <Plus className="w-4 h-4 mr-2" /> Novo Tipo
          </Button>
        )}
      </div>

      {adding && (
        <div className="mb-6">
          <TipoForm
            onSave={(form) => createMutation.mutate(form)}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}

      {/* Filtro */}
      <div className="flex gap-2 mb-4">
        {['todos', 'Livro', 'Publicação Ex Officio'].map(m => (
          <button
            key={m}
            onClick={() => setFiltroModulo(m)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filtroModulo === m
                ? 'bg-[#1e3a5f] text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {m === 'todos' ? 'Todos' : m}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {tiposFiltrados.length === 0 && !adding && (
          <p className="text-center text-slate-400 py-8 text-sm">
            Nenhum tipo personalizado cadastrado ainda. Clique em "Novo Tipo" para começar.
          </p>
        )}

        {tiposFiltrados.map(tipo => (
          <div key={tipo.id}>
            {editing === tipo.id ? (
              <TipoForm
                initial={tipo}
                onSave={(form) => updateMutation.mutate({ id: tipo.id, data: form })}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <div className="flex items-start justify-between p-4 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-800">{tipo.nome}</span>
                    <Badge className={tipo.modulo === 'Livro' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}>
                      {tipo.modulo}
                    </Badge>
                    {!tipo.ativo && <Badge variant="outline" className="text-slate-400">Inativo</Badge>}
                  </div>
                  {tipo.campos?.length > 0 && (
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {tipo.campos.map((c, i) => (
                        <span key={i} className="text-xs bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-600 font-mono">
                          {`{{${c.chave}}}`}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-slate-400 mt-1 truncate max-w-lg">{tipo.template?.slice(0, 120)}...</p>
                </div>
                <div className="flex gap-1 ml-3 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditing(tipo.id)}
                    className="text-slate-500 hover:text-[#1e3a5f]"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteDialog({ open: true, id: tipo.id })}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, id: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tipo de publicação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O tipo será removido e não aparecerá mais nos formulários.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate(deleteDialog.id)} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}