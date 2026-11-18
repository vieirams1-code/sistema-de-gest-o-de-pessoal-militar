import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import MilitarSelector from '@/components/atestado/MilitarSelector';
import EnvolvidosEditor from '@/components/procedimentos/EnvolvidosEditor';
import { criarProcedimentoEscopado, atualizarProcedimentoEscopado } from '@/services/procedimentosEscopadoClient';
import { TIPOS_PROCEDIMENTO, STATUS_PROCEDIMENTO, PRIORIDADES } from '@/components/procedimentos/procedimentoConfig';

function addDias(base, dias) {
  const texto = String(base || '').slice(0, 10);
  if (!texto) return '';
  const data = new Date(`${texto}T00:00:00Z`);
  if (Number.isNaN(data.getTime())) return '';
  data.setUTCDate(data.getUTCDate() + Number(dias || 0));
  return data.toISOString().slice(0, 10);
}

const FORM_INICIAL = {
  tipo_procedimento: 'PAD',
  numero_procedimento: '',
  numero_portaria: '',
  data_portaria: '',
  data_instauracao: '',
  prazo_inicial_dias: 60,
  prazo_final: '',
  autoridade_instauradora: '',
  encarregado_id: '',
  encarregado_nome: '',
  encarregado_posto: '',
  encarregado_quadro: '',
  encarregado_matricula: '',
  unidade: '',
  objeto: '',
  sigiloso: false,
  prioridade_risco: 'Média',
  status: 'Instaurado',
  resultado_solucao: '',
  observacoes: '',
};

export default function ProcedimentoFormModal({ open, onOpenChange, procedimento, envolvidos = [], onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState(FORM_INICIAL);
  const [envolvidosForm, setEnvolvidosForm] = useState([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({ ...FORM_INICIAL, ...(procedimento || {}) });
    setEnvolvidosForm((envolvidos || []).map((e) => ({ ...e })));
  }, [open, procedimento]);

  const alterar = (campo, valor) => {
    setForm((prev) => {
      const proximo = { ...prev, [campo]: valor };
      if ((campo === 'data_instauracao' || campo === 'prazo_inicial_dias') && !procedimento) {
        proximo.prazo_final = addDias(
          campo === 'data_instauracao' ? valor : prev.data_instauracao,
          campo === 'prazo_inicial_dias' ? valor : prev.prazo_inicial_dias,
        );
      }
      return proximo;
    });
  };

  const handleSalvar = async () => {
    if (!form.tipo_procedimento) {
      toast({ title: 'Informe o tipo do procedimento.', variant: 'destructive' });
      return;
    }
    setSalvando(true);
    try {
      const payload = {
        ...form,
        prazo_inicial_dias: Number(form.prazo_inicial_dias || 0),
        envolvidos: envolvidosForm,
      };
      if (procedimento?.id) {
        await atualizarProcedimentoEscopado(procedimento.id, payload);
      } else {
        await criarProcedimentoEscopado(payload);
      }
      toast({ title: procedimento?.id ? 'Procedimento atualizado.' : 'Procedimento cadastrado.' });
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      toast({ title: 'Erro ao salvar procedimento', description: e.message, variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{procedimento?.id ? 'Editar procedimento' : 'Novo procedimento'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Tipo *</Label>
              <Select value={form.tipo_procedimento} onValueChange={(v) => alterar('tipo_procedimento', v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_PROCEDIMENTO.map((tipo) => <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nº do procedimento</Label>
              <Input value={form.numero_procedimento} onChange={(e) => alterar('numero_procedimento', e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Nº da portaria</Label>
              <Input value={form.numero_portaria} onChange={(e) => alterar('numero_portaria', e.target.value)} className="mt-1" />
            </div>
          </div>

          <p className="text-xs text-slate-500">Informe os dados da portaria já emitida. Na ficha, você poderá gerar a publicação para o boletim.</p>

          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <Label>Data da portaria</Label>
              <Input type="date" value={form.data_portaria || ''} onChange={(e) => alterar('data_portaria', e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Instauração</Label>
              <Input type="date" value={form.data_instauracao || ''} onChange={(e) => alterar('data_instauracao', e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Prazo (dias)</Label>
              <Input type="number" min="0" value={form.prazo_inicial_dias} onChange={(e) => alterar('prazo_inicial_dias', e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Prazo final</Label>
              <Input type="date" value={form.prazo_final || ''} onChange={(e) => alterar('prazo_final', e.target.value)} className="mt-1" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Autoridade instauradora</Label>
              <Input value={form.autoridade_instauradora} onChange={(e) => alterar('autoridade_instauradora', e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Unidade</Label>
              <Input value={form.unidade} onChange={(e) => alterar('unidade', e.target.value)} className="mt-1" />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <MilitarSelector
              value={form.encarregado_id}
              onChange={(_, valor) => alterar('encarregado_id', valor || '')}
              onMilitarSelect={(militar) => {
                setForm((prev) => ({
                  ...prev,
                  encarregado_id: militar?.id || '',
                  encarregado_nome: militar?.nome_completo || militar?.nome_guerra || '',
                  encarregado_posto: militar?.posto_graduacao || '',
                  encarregado_quadro: militar?.quadro || '',
                  encarregado_matricula: militar?.matricula || '',
                }));
              }}
            />
          </div>

          <div>
            <Label>Objeto / fato apurado</Label>
            <Textarea rows={3} value={form.objeto} onChange={(e) => alterar('objeto', e.target.value)} className="mt-1" />
          </div>

          <div>
            <Label className="mb-2 block">Envolvidos</Label>
            <EnvolvidosEditor envolvidos={envolvidosForm} onChange={setEnvolvidosForm} />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => alterar('status', v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_PROCEDIMENTO.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioridade / risco</Label>
              <Select value={form.prioridade_risco} onValueChange={(v) => alterar('prioridade_risco', v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORIDADES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.sigiloso === true}
                  onChange={(e) => alterar('sigiloso', e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Procedimento sigiloso
              </label>
            </div>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea rows={2} value={form.observacoes} onChange={(e) => alterar('observacoes', e.target.value)} className="mt-1" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar procedimento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}