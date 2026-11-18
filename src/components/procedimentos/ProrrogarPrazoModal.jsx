import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { registrarPrazoProcedimentoEscopado } from '@/services/procedimentosEscopadoClient';
import { formatarData } from '@/components/procedimentos/procedimentoConfig';

function addDias(base, dias) {
  const texto = String(base || '').slice(0, 10);
  if (!texto) return '';
  const data = new Date(`${texto}T00:00:00Z`);
  if (Number.isNaN(data.getTime())) return '';
  data.setUTCDate(data.getUTCDate() + Number(dias || 0));
  return data.toISOString().slice(0, 10);
}

export default function ProrrogarPrazoModal({ open, onOpenChange, procedimento, onSaved }) {
  const { toast } = useToast();
  const [dias, setDias] = useState(30);
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDias(30);
    setMotivo('');
  }, [open, procedimento?.id]);

  const base = procedimento?.prazo_final || procedimento?.data_instauracao || '';
  const novoPrazo = addDias(base, dias);

  const handleSalvar = async () => {
    if (!Number(dias)) {
      toast({ title: 'Informe a quantidade de dias.', variant: 'destructive' });
      return;
    }
    setSalvando(true);
    try {
      await registrarPrazoProcedimentoEscopado(procedimento.id, { dias: Number(dias), motivo });
      toast({ title: 'Prorrogação registrada.', description: `Novo prazo final: ${formatarData(novoPrazo)}` });
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      toast({ title: 'Erro ao prorrogar prazo', description: e.message, variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Prorrogar prazo</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            Prazo atual: <strong>{formatarData(base)}</strong> · {procedimento?.numero_procedimento || 'sem número'}
          </p>
          <div>
            <Label>Dias de prorrogação</Label>
            <Input type="number" min="1" value={dias} onChange={(e) => setDias(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Motivo / fundamento</Label>
            <Textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} className="mt-1" placeholder="Ex.: complexidade da instrução, diligências pendentes..." />
          </div>
          <p className="text-sm text-slate-700">
            Novo prazo final: <strong>{formatarData(novoPrazo)}</strong>
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={salvando}>{salvando ? 'Registrando...' : 'Registrar prorrogação'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}