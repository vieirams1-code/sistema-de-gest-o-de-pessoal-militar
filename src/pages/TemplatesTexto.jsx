import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, FileText, Save, Info } from 'lucide-react';

const MODULOS = ['Livro', 'Publicação Ex Officio', 'Atestado', 'JISO'];

const TIPOS_POR_MODULO = {
  'Livro': ['Saída Férias', 'Retorno Férias', 'Licença Maternidade', 'Licença Paternidade', 'Núpcias', 'Luto', 'Cedência', 'Transferência para RR', 'Trânsito', 'Instalação', 'Dispensa Recompensa', 'Dispensa Desconto Férias', 'Deslocamento Missão', 'Curso/Estágio'],
  'Publicação Ex Officio': ['Elogio Individual', 'Melhoria de Comportamento', 'Punição', 'Geral', 'Designação / Dispensa de Função', 'Ata JISO', 'Transcrição de Documentos', 'Interrupção de Férias'],
  'Atestado': ['Homologação pelo Comandante', 'Encaminhamento JISO'],
  'JISO': ['Ata JISO', 'Resultado JISO'],
};

const VARIAVEIS_COMUNS = [
  '{{posto_nome}}', '{{nome_completo}}', '{{matricula}}',
  '{{data_inicio}}', '{{data_termino}}', '{{data_retorno}}',
  '{{dias}}', '{{dias_extenso}}', '{{periodo_aquisitivo}}', '{{fracionamento}}'
];

export default function TemplatesTexto() {
  const queryClient = useQueryClient();
  const [moduloFiltro, setModuloFiltro] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates-texto'],
    queryFn: () => base44.entities.TemplateTexto.list('-created_date'),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => data.id
      ? base44.entities.TemplateTexto.update(data.id, data)
      : base44.entities.TemplateTexto.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates-texto'] });
      setShowForm(false);
      setEditingTemplate(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.TemplateTexto.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['templates-texto'] })
  });

  const filtered = templates.filter(t => {
    const matchesModulo = moduloFiltro === 'all' || t.modulo === moduloFiltro;
    const matchesSearch = !searchTerm || 
      t.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.tipo_registro?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesModulo && matchesSearch;
  });

  const handleEdit = (t) => {
    setEditingTemplate({ ...t });
    setShowForm(true);
  };

  const handleNew = () => {
    setEditingTemplate({ modulo: 'Livro', tipo_registro: '', nome: '', template: '', observacoes: '', ativo: true });
    setShowForm(true);
  };

  const moduloColor = {
    'Livro': 'bg-blue-100 text-blue-700',
    'Publicação Ex Officio': 'bg-purple-100 text-purple-700',
    'Atestado': 'bg-red-100 text-red-700',
    'JISO': 'bg-orange-100 text-orange-700',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#1e3a5f]">Templates de Texto</h1>
            <p className="text-slate-500">Padrões de texto para publicações — editáveis por tipo/módulo</p>
          </div>
          <Button onClick={handleNew} className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white">
            <Plus className="w-4 h-4 mr-2" /> Novo Template
          </Button>
        </div>

        {/* Info */}
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">Como funcionam os templates</p>
                <p>Use variáveis entre chaves duplas para dados dinâmicos. Exemplo: <code className="bg-blue-100 px-1 rounded">{'{{nome_completo}}'}</code>, <code className="bg-blue-100 px-1 rounded">{'{{dias}}'}</code>.</p>
                <p className="mt-1">Quando um template está cadastrado para um tipo de registro, ele é usado como base — os dados do registro preenchem as variáveis automaticamente.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-6 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Input
              placeholder="Buscar por nome ou tipo..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-4 h-10 border-slate-200"
            />
          </div>
          <Select value={moduloFiltro} onValueChange={setModuloFiltro}>
            <SelectTrigger className="w-48 h-10 border-slate-200">
              <SelectValue placeholder="Módulo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Módulos</SelectItem>
              {MODULOS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center">
            <FileText className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">Nenhum template encontrado. Crie o primeiro!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(t => (
              <div key={t.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-slate-800">{t.nome}</span>
                      <Badge className={moduloColor[t.modulo] || 'bg-slate-100 text-slate-700'}>{t.modulo}</Badge>
                      <Badge variant="outline" className="text-xs">{t.tipo_registro}</Badge>
                      {!t.ativo && <Badge className="bg-red-100 text-red-600">Inativo</Badge>}
                    </div>
                    <p className="text-sm text-slate-500 line-clamp-2 mt-1">{t.template}</p>
                    {t.observacoes && <p className="text-xs text-slate-400 mt-1 italic">{t.observacoes}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-[#1e3a5f]" onClick={() => handleEdit(t)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => deleteMutation.mutate(t.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de edição */}
      <Dialog open={showForm} onOpenChange={(v) => { if (!v) { setShowForm(false); setEditingTemplate(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#1e3a5f]">
              {editingTemplate?.id ? 'Editar Template' : 'Novo Template'}
            </DialogTitle>
          </DialogHeader>

          {editingTemplate && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Módulo <span className="text-red-500">*</span></Label>
                  <Select value={editingTemplate.modulo} onValueChange={v => setEditingTemplate(p => ({ ...p, modulo: v, tipo_registro: '' }))}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MODULOS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Tipo de Registro <span className="text-red-500">*</span></Label>
                  <Select value={editingTemplate.tipo_registro} onValueChange={v => setEditingTemplate(p => ({ ...p, tipo_registro: v }))}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {(TIPOS_POR_MODULO[editingTemplate.modulo] || []).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700">Nome do Template <span className="text-red-500">*</span></Label>
                <Input value={editingTemplate.nome} onChange={e => setEditingTemplate(p => ({ ...p, nome: e.target.value }))} className="mt-1.5" placeholder="Ex: Saída de Férias Padrão" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-sm font-medium text-slate-700">Texto do Template <span className="text-red-500">*</span></Label>
                </div>
                <Textarea
                  value={editingTemplate.template}
                  onChange={e => setEditingTemplate(p => ({ ...p, template: e.target.value }))}
                  rows={8}
                  className="font-mono text-sm"
                  placeholder="Digite o texto do template. Use {{variavel}} para dados dinâmicos."
                />
              </div>

              {/* Variáveis disponíveis */}
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <p className="text-xs font-semibold text-slate-600 mb-2">Variáveis disponíveis (clique para copiar):</p>
                <div className="flex flex-wrap gap-1.5">
                  {VARIAVEIS_COMUNS.map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => {
                        const textArea = document.querySelector('textarea.font-mono');
                        if (textArea) {
                          const start = textArea.selectionStart;
                          const end = textArea.selectionEnd;
                          const newText = editingTemplate.template.substring(0, start) + v + editingTemplate.template.substring(end);
                          setEditingTemplate(p => ({ ...p, template: newText }));
                        } else {
                          setEditingTemplate(p => ({ ...p, template: p.template + v }));
                        }
                      }}
                      className="text-xs bg-white border border-slate-300 rounded px-2 py-0.5 text-slate-600 hover:bg-[#1e3a5f] hover:text-white hover:border-[#1e3a5f] transition-colors font-mono"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700">Observações / Referência Legal</Label>
                <Textarea value={editingTemplate.observacoes || ''} onChange={e => setEditingTemplate(p => ({ ...p, observacoes: e.target.value }))} rows={2} className="mt-1.5" placeholder="Ex: Art. 49, II, do Decreto nº 5.698/1990" />
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="ativo" checked={editingTemplate.ativo !== false} onChange={e => setEditingTemplate(p => ({ ...p, ativo: e.target.checked }))} className="w-4 h-4" />
                <Label htmlFor="ativo" className="text-sm text-slate-700 cursor-pointer">Template ativo</Label>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                <Button variant="outline" onClick={() => { setShowForm(false); setEditingTemplate(null); }}>Cancelar</Button>
                <Button
                  onClick={() => saveMutation.mutate(editingTemplate)}
                  disabled={saveMutation.isPending || !editingTemplate.nome || !editingTemplate.tipo_registro || !editingTemplate.template}
                  className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white"
                >
                  {saveMutation.isPending ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  ) : <Save className="w-4 h-4 mr-2" />}
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}