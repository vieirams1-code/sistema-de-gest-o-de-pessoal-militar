import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const emptyForm = {
  nome: '',
  tipo: 'CFC',
  turma_referencia: '',
  data_inicio: '',
  data_fim: '',
  data_matricula: '',
  ato_publicacao: '',
  observacoes: '',
};

export default function CursoFormacaoFormModal({ open, onOpenChange, onSubmit, saving }) {
  const [form, setForm] = useState(emptyForm);

  const handleChange = (campo, valor) => setForm((prev) => ({ ...prev, [campo]: valor }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSubmit(form);
    setForm(emptyForm);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Curso de Formação</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Nome do curso *</Label>
              <Input value={form.nome} onChange={(e) => handleChange('nome', e.target.value)} required />
            </div>
            <div>
              <Label>Tipo *</Label>
              <Select value={form.tipo} onValueChange={(v) => handleChange('tipo', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CFC">CFC</SelectItem>
                  <SelectItem value="CFS">CFS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Turma</Label>
              <Input value={form.turma_referencia} onChange={(e) => handleChange('turma_referencia', e.target.value)} />
            </div>
            <div>
              <Label>Data início</Label>
              <Input type="date" value={form.data_inicio} onChange={(e) => handleChange('data_inicio', e.target.value)} />
            </div>
            <div>
              <Label>Data fim</Label>
              <Input type="date" value={form.data_fim} onChange={(e) => handleChange('data_fim', e.target.value)} />
            </div>
            <div>
              <Label>Data matrícula</Label>
              <Input type="date" value={form.data_matricula} onChange={(e) => handleChange('data_matricula', e.target.value)} />
            </div>
            <div>
              <Label>Ato/Publicação</Label>
              <Input value={form.ato_publicacao} onChange={(e) => handleChange('ato_publicacao', e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={(e) => handleChange('observacoes', e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Criar curso'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}