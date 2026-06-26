import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ACOES_SOLICITADAS } from '@/utils/controle-processos/controleProcessosConfig';

const ESTADO_INICIAL = {
  caixa_destino_id: '',
  destinatario_id: '',
  acao_solicitada: '',
  mensagem: '',
  prazo: '',
  urgente: false,
};

export default function TramitarModal({ open, onClose, onSubmit, caixas = [], processo = null, salvando = false }) {
  const [form, setForm] = useState(ESTADO_INICIAL);

  useEffect(() => {
    if (open) setForm(ESTADO_INICIAL);
  }, [open]);

  const set = (campo, valor) => setForm((prev) => ({ ...prev, [campo]: valor }));
  const podeSalvar = form.caixa_destino_id && !salvando;
  const caixasDestino = caixas.filter((c) => c.id !== processo?.caixa_atual_id);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Tramitar processo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Caixa de destino *</Label>
            <Select value={form.caixa_destino_id} onValueChange={(v) => set('caixa_destino_id', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {caixasDestino.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Destinatário (e-mail)</Label>
            <Input value={form.destinatario_id} onChange={(e) => set('destinatario_id', e.target.value)} placeholder="opcional" />
          </div>

          <div className="space-y-1.5">
            <Label>Ação solicitada</Label>
            <Select value={form.acao_solicitada} onValueChange={(v) => set('acao_solicitada', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {ACOES_SOLICITADAS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Mensagem / despacho interno</Label>
            <Textarea value={form.mensagem} onChange={(e) => set('mensagem', e.target.value)} rows={3} />
          </div>

          <div className="space-y-1.5">
            <Label>Prazo</Label>
            <Input type="date" value={form.prazo} onChange={(e) => set('prazo', e.target.value)} />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={form.urgente} onCheckedChange={(v) => set('urgente', Boolean(v))} />
            <span className="text-sm text-slate-700">Marcar como urgente</span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={salvando}>Cancelar</Button>
          <Button onClick={() => onSubmit(form)} disabled={!podeSalvar}>{salvando ? 'Tramitando...' : 'Tramitar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}