import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function CentralPendenciaActionModal({
  open,
  onOpenChange,
  item,
  loading = false,
  error = '',
  resultado = null,
  onConfirm,
}) {
  const totalPendencias = item?.totalPendenciasComportamento || 0;
  const totalMilitares = item?.totalMilitaresComportamento || 0;
  const falhas = resultado?.falhas || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aprovar pendências de comportamento</DialogTitle>
          <DialogDescription>
            Confirme a aplicação em lote das pendências listadas na Central.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm text-slate-700">
          <p><strong>Total de pendências:</strong> {totalPendencias}</p>
          <p><strong>Militares únicos:</strong> {totalMilitares}</p>
          <p>Esta ação aplicará as mudanças de comportamento pendentes usando as mesmas regras do módulo Avaliação de Comportamento.</p>
          <p>Alguns itens podem ser ignorados ou falhar, e o relatório será exibido ao final.</p>

          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-2 text-red-700">
              {error}
            </div>
          ) : null}

          {resultado ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2">
              <p className="font-medium text-slate-800">
                Aplicadas: {resultado.totalAplicadas || 0} | Ignoradas: {resultado.totalIgnoradas || 0} | Falhas: {resultado.totalFalhas || 0}
              </p>
              {falhas.length > 0 ? (
                <ul className="list-disc pl-5 space-y-1 text-xs text-slate-700">
                  {falhas.slice(0, 5).map((falha, idx) => (
                    <li key={`${falha.pendenciaId || 'sem-id'}-${idx}`}>
                      {falha.pendenciaId || 'Pendência sem ID'}: {falha.erro || falha.motivo || 'falha_na_aplicacao'}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button type="button" onClick={onConfirm} disabled={loading}>
            {loading ? 'Aprovando...' : 'Confirmar aprovação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
