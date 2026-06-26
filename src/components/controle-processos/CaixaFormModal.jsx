import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const ESTADO_INICIAL = {
  nome: '',
  descricao: '',
  unidade_id: '',
  usuarios_ids: '',
  gestores_ids: '',
  ativa: true,
};

// Emails são gerenciados como texto separado por vírgula/quebra de linha.
function parseEmails(texto) {
  return String(texto || '')
    .split(/[,;\n]/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export default function CaixaFormModal({ open, onClose, onSubmit, caixa = null, salvando = false }) {
  const [form, setForm] = useState(ESTADO_INICIAL);

  useEffect(() => {
    if (!open) return;
    if (caixa) {
      setForm({
        nome: caixa.nome || '',
        descricao: caixa.descricao || '',
        unidade_id: caixa.unidade_id || '',
        usuarios_ids: (caixa.usuarios_ids || []).join(', '),
        gestores_ids: (caixa.gestores_ids || []).join(', '),
        ativa: caixa.ativa !== false,
      });
    } else {
      setForm(ESTADO_INICIAL);
    }
  }, [open, caixa]);

  const set = (campo, valor) => setForm((prev) => ({ ...prev, [campo]: valor }));
  const podeSalvar = form.nome.trim() && !salvando;

  const handleSubmit = () => {
    if (!podeSalvar) return;
    onSubmit({
      nome: form.nome.trim(),
      descricao: form.descricao,
      unidade_id: form.unidade_id,
      usuarios_ids: parseEmails(form.usuarios_ids),
      gestores_ids: parseEmails(form.gestores_ids),
      ativa: form.ativa,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{caixa ? 'Editar caixa processual' : 'Nova caixa processual'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={form.nome} onChange={(e) => set('nome', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea value={form.descricao} onChange={(e) => set('descricao', e.target.value)} rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>Membros (e-mails)</Label>
            <Textarea
              value={form.usuarios_ids}
              onChange={(e) => set('usuarios_ids', e.target.value)}
              rows={2}
              placeholder="Separados por vírgula"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Gestores (e-mails)</Label>
            <Textarea
              value={form.gestores_ids}
              onChange={(e) => set('gestores_ids', e.target.value)}
              rows={2}
              placeholder="Separados por vírgula"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={salvando}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!podeSalvar}>{salvando ? 'Salvando...' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}