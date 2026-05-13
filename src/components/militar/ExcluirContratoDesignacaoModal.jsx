import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const CONFIRMACAO_EXCLUSAO_CONTRATO = 'EXCLUIR CONTRATO';

export default function ExcluirContratoDesignacaoModal({ open, onOpenChange, contrato, onSubmit, isSubmitting = false }) {
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!open) {
      setConfirmacao('');
      setErro('');
    }
  }, [open]);

  const handleSubmit = async () => {
    if (confirmacao.trim() !== CONFIRMACAO_EXCLUSAO_CONTRATO) {
      setErro(`Digite ${CONFIRMACAO_EXCLUSAO_CONTRATO} para confirmar a exclusão.`);
      return;
    }
    setErro('');
    await onSubmit?.(contrato);
  };

  const descricaoContrato = contrato?.numero_contrato || contrato?.matricula_designacao || contrato?.id || 'contrato selecionado';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir contrato de designação</DialogTitle>
          <DialogDescription>
            Esta ação remove somente o registro do contrato de designação cadastrado por engano.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Esta ação remove apenas o contrato. Ela não desfaz alterações já aplicadas em períodos aquisitivos.</span>
        </div>

        {erro && <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{erro}</div>}

        <div className="space-y-2">
          <p className="text-sm text-slate-600">Contrato: <span className="font-medium text-slate-800">{descricaoContrato}</span></p>
          <Label>Confirmação textual *</Label>
          <Input
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            placeholder={CONFIRMACAO_EXCLUSAO_CONTRATO}
            autoComplete="off"
          />
          <p className="text-xs text-slate-500">Digite exatamente: <span className="font-semibold">{CONFIRMACAO_EXCLUSAO_CONTRATO}</span></p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Voltar</Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={isSubmitting}>Excluir contrato</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
