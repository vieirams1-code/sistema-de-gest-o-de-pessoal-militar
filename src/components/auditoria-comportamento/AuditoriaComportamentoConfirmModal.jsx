import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/**
 * Lote 1D-D — Modal de confirmação para criação em lote de pendências.
 * Mostra a quantidade selecionada e permite cancelar ou prosseguir.
 */
export default function AuditoriaComportamentoConfirmModal({
  open,
  onOpenChange,
  total,
  isProcessing,
  onConfirm,
  resumo = [],
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar criação de pendências</DialogTitle>
          <DialogDescription>
            Deseja criar {total} pendência{total === 1 ? '' : 's'} de comportamento?
            As pendências ficarão com status “Pendente” para revisão posterior.
            Nenhum comportamento será aplicado automaticamente.
          </DialogDescription>
        </DialogHeader>

        {resumo.length > 0 && (
          <div className="max-h-60 overflow-y-auto rounded border border-slate-200 bg-slate-50 p-3 text-sm">
            <ul className="space-y-1">
              {resumo.map((linha) => (
                <li key={linha.militar_id} className="text-slate-700">
                  <strong>{linha.militar_nome}</strong>{' '}
                  ({linha.posto_graduacao}): {linha.comportamento_atual} → {linha.comportamento_calculado}
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={isProcessing || total === 0}>
            {isProcessing ? 'Criando…' : `Criar ${total} pendência${total === 1 ? '' : 's'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}