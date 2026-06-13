import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { STATUS_PARTICIPANTE_LABEL } from './cursoFormacaoConfig';
import { STATUS_PARTICIPANTE_EDITAVEIS, STATUS_QUE_EXIGEM_JUSTIFICATIVA } from '@/services/cursoFormacaoService';

export default function AlterarStatusModal({ open, onOpenChange, participante, onConfirmar, saving }) {
  const [status, setStatus] = useState('aprovado');
  const [justificativa, setJustificativa] = useState('');

  useEffect(() => {
    if (open) {
      setStatus('aprovado');
      setJustificativa('');
    }
  }, [open]);

  const exigeJustificativa = STATUS_QUE_EXIGEM_JUSTIFICATIVA.includes(status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Alterar Status do Participante</DialogTitle>
        </DialogHeader>
        {participante && (
          <p className="text-sm text-slate-600">
            {participante.posto_origem} {participante.nome_militar_snapshot} · {participante.matricula_snapshot}
          </p>
        )}
        <div className="space-y-3">
          <div>
            <Label>Novo status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_PARTICIPANTE_EDITAVEIS.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_PARTICIPANTE_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Justificativa {exigeJustificativa && <span className="text-red-500">*</span>}</Label>
            <Textarea value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            type="button"
            disabled={saving || (exigeJustificativa && !justificativa.trim())}
            onClick={() => onConfirmar(status, justificativa)}
          >
            {saving ? 'Salvando...' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}