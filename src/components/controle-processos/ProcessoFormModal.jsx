import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { AlertTriangle } from 'lucide-react';
import InteressadosSelector from './InteressadosSelector';
import { TIPOS_INTERNOS, SISTEMAS_ORIGEM, PRIORIDADES } from '@/utils/controle-processos/controleProcessosConfig';
import { sanitizarLinkExterno } from '@/utils/controle-processos/sanitizarLinkExterno';

const ESTADO_INICIAL = {
  tipo_interno: '',
  sistema_origem: '',
  nup: '',
  numero_documento: '',
  titulo: '',
  assunto: '',
  descricao_operacional: '',
  link_externo: '',
  caixa_atual_id: '',
  responsavel_id: '',
  prioridade: 'Normal',
  prazo: '',
  interessados: [],
};

export default function ProcessoFormModal({ open, onClose, onSubmit, caixas = [], processo = null, salvando = false }) {
  const [form, setForm] = useState(ESTADO_INICIAL);
  const [alertaLink, setAlertaLink] = useState(null);

  useEffect(() => {
    if (!open) return;
    if (processo) {
      setForm({
        ...ESTADO_INICIAL,
        ...processo,
        interessados: (processo.interessados_ids || []).map((id) => ({ id, nome: id })),
      });
    } else {
      setForm(ESTADO_INICIAL);
    }
    setAlertaLink(null);
  }, [open, processo]);

  const set = (campo, valor) => setForm((prev) => ({ ...prev, [campo]: valor }));

  const handleLinkBlur = () => {
    if (!form.link_externo) {
      setAlertaLink(null);
      return;
    }
    const { linkLimpo, removeu, paramsRemovidos } = sanitizarLinkExterno(form.link_externo);
    if (removeu) {
      set('link_externo', linkLimpo);
      setAlertaLink(`Removemos dados sensíveis do link (${paramsRemovidos.join(', ')}). Mantivemos apenas o endereço do processo.`);
    }
  };

  const podeSalvar = form.tipo_interno && form.titulo && form.caixa_atual_id && !salvando;

  const handleSubmit = () => {
    if (!podeSalvar) return;
    const { interessados, ...rest } = form;
    const { linkLimpo, removeu, paramsRemovidos } = sanitizarLinkExterno(rest.link_externo);
    if (removeu) {
      setAlertaLink(`Removemos dados sensíveis do link (${paramsRemovidos.join(', ')}). Mantivemos apenas o endereço do processo.`);
    }
    onSubmit({
      ...rest,
      link_externo: linkLimpo,
      prazo: rest.prazo || undefined,
      interessados_ids: interessados.map((i) => i.id),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{processo ? 'Editar processo' : 'Novo processo'}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          <div className="space-y-1.5">
            <Label>Tipo interno *</Label>
            <Select value={form.tipo_interno} onValueChange={(v) => set('tipo_interno', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {TIPOS_INTERNOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Sistema de origem</Label>
            <Select value={form.sistema_origem} onValueChange={(v) => set('sistema_origem', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {SISTEMAS_ORIGEM.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>NUP</Label>
            <Input value={form.nup} onChange={(e) => set('nup', e.target.value)} placeholder="Número Único de Protocolo" />
          </div>

          <div className="space-y-1.5">
            <Label>Número do documento</Label>
            <Input value={form.numero_documento} onChange={(e) => set('numero_documento', e.target.value)} />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label>Título interno *</Label>
            <Input value={form.titulo} onChange={(e) => set('titulo', e.target.value)} />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label>Assunto</Label>
            <Input value={form.assunto} onChange={(e) => set('assunto', e.target.value)} />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label>Descrição operacional</Label>
            <Textarea value={form.descricao_operacional} onChange={(e) => set('descricao_operacional', e.target.value)} rows={3} />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label>Link externo</Label>
            <Input
              value={form.link_externo}
              onChange={(e) => set('link_externo', e.target.value)}
              onBlur={handleLinkBlur}
              placeholder="https://..."
            />
            {alertaLink && (
              <p className="flex items-start gap-1.5 text-xs text-amber-700">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                {alertaLink}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Caixa inicial *</Label>
            <Select value={form.caixa_atual_id} onValueChange={(v) => set('caixa_atual_id', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {caixas.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-slate-500">Nenhuma caixa disponível.</div>
                ) : (
                  caixas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Responsável (e-mail)</Label>
            <Input value={form.responsavel_id} onChange={(e) => set('responsavel_id', e.target.value)} placeholder="opcional" />
          </div>

          <div className="space-y-1.5">
            <Label>Prioridade</Label>
            <Select value={form.prioridade} onValueChange={(v) => set('prioridade', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORIDADES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Prazo</Label>
            <Input type="date" value={form.prazo || ''} onChange={(e) => set('prazo', e.target.value)} />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label>Militares interessados</Label>
            <InteressadosSelector value={form.interessados} onChange={(v) => set('interessados', v)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={salvando}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!podeSalvar}>{salvando ? 'Salvando...' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
