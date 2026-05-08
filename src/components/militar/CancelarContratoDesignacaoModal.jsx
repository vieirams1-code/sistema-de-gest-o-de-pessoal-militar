import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function CancelarContratoDesignacaoModal({ open, onOpenChange, contrato, onSubmit, isSubmitting = false }) {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');

  const handleSubmit = async () => {
    if (!motivo.trim()) {
      setErro('Informe o motivo do cancelamento.');
      return;
    }
    setErro('');
    await onSubmit?.(contrato, { status_contrato: 'cancelado', motivo_cancelamento: motivo.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar lançamento de contrato</DialogTitle>
          <DialogDescription>O contrato cancelado permanecerá no histórico e não altera períodos aquisitivos já existentes.</DialogDescription>
        </DialogHeader>
        {erro && <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{erro}</div>}
        <div className="space-y-2">
          <Label>Motivo do cancelamento *</Label>
          <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Voltar</Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={isSubmitting}>Cancelar lançamento</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
