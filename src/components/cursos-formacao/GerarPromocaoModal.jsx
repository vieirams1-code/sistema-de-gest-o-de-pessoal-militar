import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { DESTINO_PROMOCAO_POR_TIPO, STATUS_ELEGIVEIS_PROMOCAO } from '@/services/cursoFormacaoService';
import { STATUS_PARTICIPANTE_LABEL } from './cursoFormacaoConfig';

export default function GerarPromocaoModal({ open, onOpenChange, curso, participantes = [], onConfirmar, saving }) {
  const [form, setForm] = useState({
    quadro: '',
    data_promocao: '',
    data_publicacao: '',
    doems_edicao_numero: '',
    boletim_referencia: '',
    observacoes: '',
  });

  const elegiveis = useMemo(
    () => participantes.filter((p) => STATUS_ELEGIVEIS_PROMOCAO.includes(p.status) && !p.promocao_id),
    [participantes],
  );
  const destino = curso ? DESTINO_PROMOCAO_POR_TIPO[curso.tipo] : '';
  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const handleConfirmar = () => onConfirmar(form);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerar promoção dos aprovados</DialogTitle>
        </DialogHeader>

        <Alert className="bg-blue-50 border-blue-200">
          <Info className="w-4 h-4 text-blue-600" />
          <AlertDescription className="text-xs text-blue-800">
            A promoção será criada como <strong>rascunho</strong> no módulo oficial de Promoções.
            O cadastro do militar só muda após a <strong>publicação oficial</strong>. Destino: <strong>{destino}</strong>.
          </AlertDescription>
        </Alert>

        <div className="space-y-1">
          <p className="text-sm font-medium">Candidatos elegíveis ({elegiveis.length})</p>
          {elegiveis.length === 0 ? (
            <p className="text-xs text-slate-500">Nenhum participante aprovado/aguardando sem promoção vinculada.</p>
          ) : (
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
              {elegiveis.map((p) => (
                <Badge key={p.id} variant="outline" className="text-xs">
                  {p.nome_militar_snapshot} · {STATUS_PARTICIPANTE_LABEL[p.status]}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Quadro</Label>
            <Input value={form.quadro} onChange={(e) => set('quadro', e.target.value)} placeholder="Ex.: QBMP-1.a" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Data da promoção *</Label>
            <Input type="date" value={form.data_promocao} onChange={(e) => set('data_promocao', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Data de publicação</Label>
            <Input type="date" value={form.data_publicacao} onChange={(e) => set('data_publicacao', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">DOEMS / Ato</Label>
            <Input value={form.doems_edicao_numero} onChange={(e) => set('doems_edicao_numero', e.target.value)} placeholder="Ex.: DOEMS 11.111" />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Boletim de referência</Label>
            <Input value={form.boletim_referencia} onChange={(e) => set('boletim_referencia', e.target.value)} />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Observações</Label>
            <Textarea value={form.observacoes} onChange={(e) => set('observacoes', e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleConfirmar} disabled={saving || elegiveis.length === 0 || !form.data_promocao}>
            {saving ? 'Gerando...' : `Gerar promoção (${elegiveis.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}