import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { validarDispensaComDescontoFerias } from './feriasRules';

export default function DispensaDescontoFeriasModal({
  open,
  periodo,
  saving,
  onOpenChange,
  onSubmit,
}) {
  const [form, setForm] = useState({
    quantidade: '',
    motivo: '',
    observacao: '',
  });
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (!open) return;
    setForm({ quantidade: '', motivo: '', observacao: '' });
    setFeedback(null);
  }, [open, periodo?.id]);

  const handleSubmit = async () => {
    setFeedback(null);

    const validacao = validarDispensaComDescontoFerias({
      periodo,
      quantidade: form.quantidade,
    });

    if (!validacao.ok) {
      setFeedback({ type: 'error', message: validacao.mensagem });
      return;
    }

    if (!form.motivo.trim()) {
      setFeedback({ type: 'error', message: 'Informe o motivo da dispensa com desconto.' });
      return;
    }

    try {
      await onSubmit?.({
        periodoId: periodo?.id,
        quantidade: Number(form.quantidade),
        motivo: form.motivo.trim(),
        observacao: form.observacao.trim(),
      });

      setFeedback({
        type: 'success',
        message: 'Dispensa com desconto em férias registrada com sucesso.',
      });

      onOpenChange?.(false);
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error?.message || 'Erro ao registrar dispensa com desconto em férias.',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Dispensa com Desconto em Férias</DialogTitle>
          <DialogDescription>
            Registra o ato administrativo, aplica ajuste negativo no período aquisitivo e prepara publicação no fluxo de controle.
          </DialogDescription>
        </DialogHeader>

        {!!feedback && (
          <Alert className={feedback.type === 'success' ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}>
            <AlertDescription className={feedback.type === 'success' ? 'text-emerald-700' : 'text-red-700'}>
              {feedback.message}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <p><span className="font-semibold">Período:</span> {periodo?.referencia || '-'}</p>
            <p><span className="font-semibold">Base/Ajuste/Saldo:</span> {periodo?.dias_base ?? 30}d / {periodo?.dias_ajuste ?? 0}d / {periodo?.dias_saldo ?? 0}d</p>
          </div>

          <div>
            <p className="text-xs text-slate-500 mb-1">Quantidade de dias a descontar</p>
            <Input
              type="number"
              min={1}
              step={1}
              value={form.quantidade}
              onChange={(e) => setForm((prev) => ({ ...prev, quantidade: e.target.value }))}
              placeholder="Ex.: 5"
            />
          </div>

          <div>
            <p className="text-xs text-slate-500 mb-1">Motivo</p>
            <Input
              value={form.motivo}
              onChange={(e) => setForm((prev) => ({ ...prev, motivo: e.target.value }))}
              placeholder="Ex.: Decisão administrativa"
            />
          </div>

          <div>
            <p className="text-xs text-slate-500 mb-1">Observação</p>
            <Textarea
              value={form.observacao}
              onChange={(e) => setForm((prev) => ({ ...prev, observacao: e.target.value }))}
              placeholder="Detalhes complementares para auditoria/publicação"
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange?.(false)} disabled={saving}>Cancelar</Button>
            <Button className="bg-[#1e3a5f] hover:bg-[#1e3a5f]/90" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Registrando...' : 'Registrar dispensa'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
