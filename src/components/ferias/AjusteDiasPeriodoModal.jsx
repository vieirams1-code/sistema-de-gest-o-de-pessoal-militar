import React, { useEffect, useMemo, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { filtrarFeriasDoPeriodo, validarAjusteDiasPeriodo } from './periodoSaldoUtils';

export default function AjusteDiasPeriodoModal({
  open,
  periodo,
  ferias = [],
  saving,
  feedback,
  onOpenChange,
  onSubmit,
}) {
  const [quantidade, setQuantidade] = useState('');
  const [motivo, setMotivo] = useState('');
  const [observacao, setObservacao] = useState('');
  const [erroLocal, setErroLocal] = useState(null);

  useEffect(() => {
    if (!open) return;
    setQuantidade('');
    setMotivo('');
    setObservacao('');
    setErroLocal(null);
  }, [open, periodo?.id]);

  const titulo = 'Adicionar dias ao período';

  const validacao = useMemo(() => {
    if (!periodo || !quantidade) return null;

    const feriasRelacionadas = filtrarFeriasDoPeriodo(periodo.raw || periodo, ferias);
    return validarAjusteDiasPeriodo({
      periodo: periodo.raw || periodo,
      ferias: feriasRelacionadas,
      tipo: 'adicao',
      quantidade,
    });
  }, [periodo, ferias, quantidade]);

  const handleSubmit = async () => {
    setErroLocal(null);

    if (!quantidade || Number(quantidade) <= 0) {
      setErroLocal('Informe uma quantidade de dias maior que zero.');
      return;
    }

    if (!motivo.trim()) {
      setErroLocal('Informe o motivo do ajuste.');
      return;
    }

    if (validacao && !validacao.ok) {
      setErroLocal(validacao.mensagem);
      return;
    }

    try {
      await onSubmit?.({
        quantidade: Number(quantidade),
        motivo: motivo.trim(),
        observacao: observacao.trim(),
      });
    } catch (error) {
      setErroLocal(error?.message || 'Falha ao salvar ajuste de dias.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            Referência {periodo?.referencia || '-'} • ajuste administrativo positivo com recálculo imediato do saldo.
          </DialogDescription>
        </DialogHeader>

        {!!feedback && (
          <Alert className={feedback.type === 'success' ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}>
            <AlertDescription className={feedback.type === 'success' ? 'text-emerald-700' : 'text-red-700'}>
              {feedback.message}
            </AlertDescription>
          </Alert>
        )}

        {!!erroLocal && (
          <Alert className="border-red-200 bg-red-50">
            <AlertDescription className="text-red-700">{erroLocal}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div>
            <p className="text-xs text-slate-500 mb-1">Quantidade de dias</p>
            <Input
              type="number"
              min="1"
              step="1"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              placeholder="Ex.: 3"
            />
          </div>

          <div>
            <p className="text-xs text-slate-500 mb-1">Motivo</p>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: decisão administrativa" />
          </div>

          <div>
            <p className="text-xs text-slate-500 mb-1">Observação (opcional)</p>
            <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={3} />
          </div>

          {validacao?.ok && quantidade ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              Projeção após ajuste: total {validacao.dias_total_projetado}d • saldo {validacao.dias_saldo_projetado}d.
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange?.(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving} className="bg-[#1e3a5f] hover:bg-[#1e3a5f]/90">
            {saving ? 'Salvando...' : 'Confirmar adição'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
