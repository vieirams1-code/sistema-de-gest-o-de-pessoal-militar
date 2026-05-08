import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function EncerrarContratoDesignacaoModal({ open, onOpenChange, contrato, onSubmit, isSubmitting = false }) {
  const [dataFim, setDataFim] = useState('');
  const [dataOperacional, setDataOperacional] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');

  const handleSubmit = async () => {
    if (!dataFim && !dataOperacional) {
      setErro('Informe data fim do contrato ou data de encerramento operacional.');
      return;
    }
    if (!motivo.trim()) {
      setErro('Informe o motivo do encerramento.');
      return;
    }
    setErro('');
    await onSubmit?.(contrato, {
      status_contrato: 'encerrado',
      data_fim_contrato: dataFim,
      data_encerramento_operacional: dataOperacional,
      motivo_encerramento: motivo.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Encerrar contrato de designação</DialogTitle>
          <DialogDescription>Encerrar contrato não altera períodos aquisitivos já existentes neste lote.</DialogDescription>
        </DialogHeader>
        {erro && <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{erro}</div>}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Data fim do contrato</Label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Data de encerramento operacional</Label>
            <Input type="date" value={dataOperacional} onChange={(e) => setDataOperacional(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Motivo do encerramento *</Label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Voltar</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>Encerrar contrato</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
