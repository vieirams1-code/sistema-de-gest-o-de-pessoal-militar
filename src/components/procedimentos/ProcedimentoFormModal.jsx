import React, { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import AssistenteProcedimentosModal from '@/components/assistente-procedimentos/AssistenteProcedimentosModal';
import { ENVOLVIDO_TIPOS, PRIORIDADES, STATUS_PENDENCIA, STATUS_PROCEDIMENTO, TIPOS_PROCEDIMENTO } from '@/utils/procedimentos/procedimentosConstants';

const newEnvolvido = () => ({ tipo_envolvido: 'investigado/sindicado', nome: '', responsavel: '', observacao: '' });
const newPendencia = () => ({ descricao: '', responsavel: '', prazo: '', status: 'aberta', observacao: '' });
const newPrazo = () => ({ tipo_prazo: 'inicial', data_prazo: '', motivo_prorrogacao: '', nova_data_final: '' });
const newViatura = () => ({ viatura: '', prefixo: '', placa: '', dano_avaria: '', condutor: '', situacao_viatura: '', estimativa_prejuizo: '' });

function DynamicList({ title, items, setItems, renderFields, onAdd, onRemoveItem }) {
  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-slate-800">{title}</h4>
        <Button type="button" variant="secondary" size="sm" onClick={onAdd}><Plus className="w-4 h-4 mr-1" />Adicionar</Button>
      </div>
      {items.map((item, index) => (
        <div key={`${title}-${index}`} className="border rounded-md p-3 space-y-3 bg-slate-50">
          {renderFields(item, index)}
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-red-600"
              onClick={() => {
                const currentItem = items[index];
                if (onRemoveItem) onRemoveItem(currentItem);
                setItems((prev) => prev.filter((_, i) => i !== index));
              }}
            >
              <Trash2 className="w-4 h-4 mr-1" /> Remover
            </Button>
          </div>
        </div>
      ))}
      {items.length === 0 && <p className="text-sm text-slate-500">Nenhum item informado.</p>}
    </div>
  );
}

export default function ProcedimentoFormModal({ initialData, onSubmit, saving, triggerLabel = 'Novo Procedimento' }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => ({
    tipo_procedimento: initialData?.tipo_procedimento || '',
    numero_procedimento: initialData?.numero_procedimento || '',
    numero_portaria: initialData?.numero_portaria || '',
    data_portaria: initialData?.data_portaria || '',
    data_instauracao: initialData?.data_instauracao || '',
    prazo_final: initialData?.prazo_final || '',
    autoridade_instauradora: initialData?.autoridade_instauradora || '',
    responsavel_id: initialData?.responsavel_id || '',
    responsavel_nome: initialData?.responsavel_nome || '',
    unidade: initialData?.unidade || '',
    objeto: initialData?.objeto || '',
    sigiloso: Boolean(initialData?.sigiloso),
    observacoes: initialData?.observacoes || '',
    status: initialData?.status || 'Em andamento',
    prioridade_risco: initialData?.prioridade_risco || 'Média',
  }));

  const [envolvidos, setEnvolvidos] = useState(initialData?.envolvidos?.length ? initialData.envolvidos : []);
  const [pendencias, setPendencias] = useState(initialData?.pendencias?.length ? initialData.pendencias : []);
  const [prazos, setPrazos] = useState(initialData?.prazos?.length ? initialData.prazos : []);
  const [viaturas, setViaturas] = useState(initialData?.viaturas?.length ? initialData.viaturas : []);
  const [removedIds, setRemovedIds] = useState({
    envolvidos: [],
    pendencias: [],
    prazos: [],
    viaturas: [],
  });

  const procedimentoContexto = useMemo(() => ({
    id: initialData?.id,
    status: form.status,
    prazo: form.prazo_final,
    prorrogacoes: prazos.filter((p) => p.tipo_prazo === 'prorrogacao').length,
    tipo: form.tipo_procedimento,
    objeto: form.objeto,
  }), [form, prazos, initialData]);

  const updateItem = (setter, index, field, value) => {
    setter((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const markRemoved = (collectionKey, item) => {
    if (!item?.id) return;
    setRemovedIds((prev) => ({
      ...prev,
      [collectionKey]: [...new Set([...(prev[collectionKey] || []), item.id])],
    }));
  };

  const handleSave = async () => {
    const viaturasPermitidas = form.tipo_procedimento === 'Inquérito Técnico';
    const viaturasParaSalvar = viaturasPermitidas ? viaturas : [];
    const viaturasRemovidasPorTipo = viaturasPermitidas
      ? []
      : viaturas.filter((item) => item?.id).map((item) => item.id);

    await onSubmit({
      procedimento: { ...initialData, ...form },
      envolvidos,
      pendencias,
      prazos,
      viaturas: viaturasParaSalvar,
      removedIds: {
        ...removedIds,
        viaturas: [...new Set([...(removedIds.viaturas || []), ...viaturasRemovidasPorTipo])],
      },
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData?.id ? 'Detalhar/Editar Procedimento' : 'Cadastrar Procedimento'}</DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-4">
          <div><Label>Tipo</Label><Select value={form.tipo_procedimento} onValueChange={(v) => setForm((p) => ({ ...p, tipo_procedimento: v }))}><SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger><SelectContent>{TIPOS_PROCEDIMENTO.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Número Procedimento</Label><Input value={form.numero_procedimento} onChange={(e) => setForm((p) => ({ ...p, numero_procedimento: e.target.value }))} /></div>
          <div><Label>Número Portaria</Label><Input value={form.numero_portaria} onChange={(e) => setForm((p) => ({ ...p, numero_portaria: e.target.value }))} /></div>
          <div><Label>Data Portaria</Label><Input type="date" value={form.data_portaria} onChange={(e) => setForm((p) => ({ ...p, data_portaria: e.target.value }))} /></div>
          <div><Label>Data Instauração</Label><Input type="date" value={form.data_instauracao} onChange={(e) => setForm((p) => ({ ...p, data_instauracao: e.target.value }))} /></div>
          <div><Label>Prazo Final</Label><Input type="date" value={form.prazo_final} onChange={(e) => setForm((p) => ({ ...p, prazo_final: e.target.value }))} /></div>
          <div><Label>Autoridade instauradora</Label><Input value={form.autoridade_instauradora} onChange={(e) => setForm((p) => ({ ...p, autoridade_instauradora: e.target.value }))} /></div>
          <div><Label>Responsável (id)</Label><Input value={form.responsavel_id} onChange={(e) => setForm((p) => ({ ...p, responsavel_id: e.target.value }))} /></div>
          <div><Label>Responsável (nome)</Label><Input value={form.responsavel_nome} onChange={(e) => setForm((p) => ({ ...p, responsavel_nome: e.target.value }))} /></div>
          <div><Label>Unidade/Setor</Label><Input value={form.unidade} onChange={(e) => setForm((p) => ({ ...p, unidade: e.target.value }))} /></div>
          <div><Label>Status</Label><Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUS_PROCEDIMENTO.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Prioridade/Risco</Label><Select value={form.prioridade_risco} onValueChange={(v) => setForm((p) => ({ ...p, prioridade_risco: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRIORIDADES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
        </div>

        <div className="space-y-2 mt-4">
          <Label>Objeto / Resumo</Label>
          <Textarea value={form.objeto} onChange={(e) => setForm((p) => ({ ...p, objeto: e.target.value }))} />
        </div>

        <div className="space-y-2">
          <Label>Observações</Label>
          <Textarea value={form.observacoes} onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))} />
        </div>

        <div className="flex items-center gap-2 py-1">
          <Switch checked={form.sigiloso} onCheckedChange={(v) => setForm((p) => ({ ...p, sigiloso: v }))} />
          <span className="text-sm">Procedimento sigiloso</span>
        </div>

        <DynamicList
          title="Envolvidos"
          items={envolvidos}
          setItems={setEnvolvidos}
          onAdd={() => setEnvolvidos((prev) => [...prev, newEnvolvido()])}
          onRemoveItem={(item) => markRemoved('envolvidos', item)}
          renderFields={(item, index) => (
            <div className="grid md:grid-cols-2 gap-2">
              <Select value={item.tipo_envolvido} onValueChange={(v) => updateItem(setEnvolvidos, index, 'tipo_envolvido', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ENVOLVIDO_TIPOS.map((tipo) => <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>)}</SelectContent></Select>
              <Input placeholder="Nome" value={item.nome} onChange={(e) => updateItem(setEnvolvidos, index, 'nome', e.target.value)} />
              <Input placeholder="Responsável" value={item.responsavel} onChange={(e) => updateItem(setEnvolvidos, index, 'responsavel', e.target.value)} />
              <Input placeholder="Observação" value={item.observacao} onChange={(e) => updateItem(setEnvolvidos, index, 'observacao', e.target.value)} />
            </div>
          )}
        />

        <DynamicList
          title="Pendências"
          items={pendencias}
          setItems={setPendencias}
          onAdd={() => setPendencias((prev) => [...prev, newPendencia()])}
          onRemoveItem={(item) => markRemoved('pendencias', item)}
          renderFields={(item, index) => (
            <div className="grid md:grid-cols-2 gap-2">
              <Input placeholder="Descrição" value={item.descricao} onChange={(e) => updateItem(setPendencias, index, 'descricao', e.target.value)} />
              <Input placeholder="Responsável" value={item.responsavel} onChange={(e) => updateItem(setPendencias, index, 'responsavel', e.target.value)} />
              <Input type="date" value={item.prazo} onChange={(e) => updateItem(setPendencias, index, 'prazo', e.target.value)} />
              <Select value={item.status} onValueChange={(v) => updateItem(setPendencias, index, 'status', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUS_PENDENCIA.map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}</SelectContent></Select>
              <Input className="md:col-span-2" placeholder="Observação" value={item.observacao} onChange={(e) => updateItem(setPendencias, index, 'observacao', e.target.value)} />
            </div>
          )}
        />

        <DynamicList
          title="Prazos e prorrogações"
          items={prazos}
          setItems={setPrazos}
          onAdd={() => setPrazos((prev) => [...prev, newPrazo()])}
          onRemoveItem={(item) => markRemoved('prazos', item)}
          renderFields={(item, index) => (
            <div className="grid md:grid-cols-2 gap-2">
              <Select value={item.tipo_prazo} onValueChange={(v) => updateItem(setPrazos, index, 'tipo_prazo', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="inicial">prazo inicial</SelectItem><SelectItem value="prorrogacao">prorrogação</SelectItem></SelectContent></Select>
              <Input type="date" value={item.data_prazo} onChange={(e) => updateItem(setPrazos, index, 'data_prazo', e.target.value)} />
              <Input placeholder="Motivo da prorrogação" value={item.motivo_prorrogacao} onChange={(e) => updateItem(setPrazos, index, 'motivo_prorrogacao', e.target.value)} />
              <Input type="date" value={item.nova_data_final} onChange={(e) => updateItem(setPrazos, index, 'nova_data_final', e.target.value)} />
            </div>
          )}
        />

        {form.tipo_procedimento === 'Inquérito Técnico' && (
          <DynamicList
            title="Dados de Viaturas/Materiais (IT)"
            items={viaturas}
            setItems={setViaturas}
            onAdd={() => setViaturas((prev) => [...prev, newViatura()])}
            onRemoveItem={(item) => markRemoved('viaturas', item)}
            renderFields={(item, index) => (
              <div className="grid md:grid-cols-2 gap-2">
                <Input placeholder="Viatura" value={item.viatura} onChange={(e) => updateItem(setViaturas, index, 'viatura', e.target.value)} />
                <Input placeholder="Prefixo" value={item.prefixo} onChange={(e) => updateItem(setViaturas, index, 'prefixo', e.target.value)} />
                <Input placeholder="Placa" value={item.placa} onChange={(e) => updateItem(setViaturas, index, 'placa', e.target.value)} />
                <Input placeholder="Dano / avaria" value={item.dano_avaria} onChange={(e) => updateItem(setViaturas, index, 'dano_avaria', e.target.value)} />
                <Input placeholder="Condutor" value={item.condutor} onChange={(e) => updateItem(setViaturas, index, 'condutor', e.target.value)} />
                <Input placeholder="Situação da viatura" value={item.situacao_viatura} onChange={(e) => updateItem(setViaturas, index, 'situacao_viatura', e.target.value)} />
                <Input placeholder="Estimativa de prejuízo" value={item.estimativa_prejuizo} onChange={(e) => updateItem(setViaturas, index, 'estimativa_prejuizo', e.target.value)} className="md:col-span-2" />
              </div>
            )}
          />
        )}

        <div className="flex flex-wrap justify-between gap-2 pt-2">
          <AssistenteProcedimentosModal tipoProcedimento={form.tipo_procedimento} procedimento={procedimentoContexto} />
          <Button type="button" onClick={handleSave} disabled={saving || !form.tipo_procedimento || !form.objeto}>
            {saving ? 'Salvando...' : 'Salvar procedimento'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
