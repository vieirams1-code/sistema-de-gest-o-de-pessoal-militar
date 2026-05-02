import React from 'react';
import { queryClientInstance } from '@/lib/query-client';
import { base44 } from '@/api/base44Client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const STATUS_ATIVO = 'ativo';

const FORM_INICIAL = {
  data_promocao: '',
  data_publicacao: '',
  boletim_referencia: '',
  ato_referencia: '',
  antiguidade_referencia_ordem: '',
  observacoes: '',
  motivo_retificacao: '',
};

const valorTexto = (v) => String(v || '').trim();

const montarPayloadPromocao = (form, militar) => ({
  militar_id: militar.id,
  posto_graduacao_novo: militar.posto_graduacao || '',
  quadro_novo: militar.quadro || '',
  data_promocao: form.data_promocao,
  data_publicacao: form.data_publicacao || '',
  boletim_referencia: form.boletim_referencia || '',
  ato_referencia: form.ato_referencia || '',
  antiguidade_referencia_ordem: form.antiguidade_referencia_ordem === '' ? 0 : Number(form.antiguidade_referencia_ordem),
  observacoes: form.observacoes || '',
  origem_dado: 'manual',
  status_registro: STATUS_ATIVO,
  posto_graduacao_anterior: '',
  quadro_anterior: '',
  antiguidade_referencia_id: '',
});

export default function PromocaoAtualModal({ open, onOpenChange, militar, onSaved }) {
  const [form, setForm] = React.useState(FORM_INICIAL);
  const [registroConflitante, setRegistroConflitante] = React.useState(null);
  const [mensagem, setMensagem] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setForm(FORM_INICIAL);
      setRegistroConflitante(null);
      setMensagem('');
    }
  }, [open, militar?.id]);

  const atualizarDiagnostico = async () => {
    await queryClientInstance.invalidateQueries({ queryKey: ['antiguidade-diagnostico'] });
  };

  const onSave = async () => {
    if (!militar?.id) return;
    if (!form.data_promocao) {
      setMensagem('Informe a data da promoção atual.');
      return;
    }

    setSaving(true);
    setMensagem('');

    try {
      const todos = await base44.entities.HistoricoPromocaoMilitarV2.list();
      const ativosCompativeis = todos.filter((h) =>
        valorTexto(h.status_registro || STATUS_ATIVO).toLowerCase() === STATUS_ATIVO
        && String(h.militar_id || '') === String(militar.id)
        && valorTexto(h.posto_graduacao_novo) === valorTexto(militar.posto_graduacao)
        && valorTexto(h.quadro_novo) === valorTexto(militar.quadro),
      );

      const mesmoDia = ativosCompativeis.find((h) => h.data_promocao === form.data_promocao);
      if (mesmoDia) {
        setMensagem('Já existe registro ativo compatível com este militar/posto/quadro/data.');
        return;
      }

      const payloadBase = montarPayloadPromocao(form, militar);

      const divergente = ativosCompativeis[0] || null;
      if (!divergente) {
        await base44.entities.HistoricoPromocaoMilitarV2.create(payloadBase);
        setMensagem('Promoção atual registrada com sucesso.');
        await atualizarDiagnostico();
        await onSaved?.();
        return;
      }

      setRegistroConflitante(divergente);
      if (!form.motivo_retificacao.trim()) {
        setMensagem('Existe registro ativo com data diferente. Informe o motivo da retificação para continuar.');
        return;
      }

      await base44.entities.HistoricoPromocaoMilitarV2.update(divergente.id, {
        status_registro: 'retificado',
        motivo_retificacao: form.motivo_retificacao,
        observacoes: `${divergente.observacoes || ''} | Retificado: ${form.motivo_retificacao}`.trim(),
      });

      await base44.entities.HistoricoPromocaoMilitarV2.create({
        ...payloadBase,
        motivo_retificacao: form.motivo_retificacao,
        observacoes: `${payloadBase.observacoes || ''} | Retificação: ${form.motivo_retificacao}`.trim(),
      });

      setMensagem('Retificação concluída com novo registro ativo.');
      await atualizarDiagnostico();
      await onSaved?.();
    } catch (e) {
      setMensagem(e?.message || 'Erro ao registrar promoção atual.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Antiguidade / Promoção atual</DialogTitle>
          <DialogDescription>
            Este registro não altera posto ou quadro do militar. Apenas grava dados históricos da promoção atual.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <p><strong>Nome:</strong> {militar?.nome_completo || '—'}</p>
          <p><strong>Nome de guerra:</strong> {militar?.nome_guerra || '—'}</p>
          <p><strong>Matrícula:</strong> {militar?.matricula || '—'}</p>
          <p><strong>Posto/graduação atual:</strong> {militar?.posto_graduacao || '—'}</p>
          <p><strong>Quadro atual:</strong> {militar?.quadro || '—'}</p>
          <p><strong>Lotação:</strong> {militar?.lotacao_atual || militar?.lotacao || '—'}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label>Data da promoção *</Label><Input type="date" value={form.data_promocao} onChange={(e) => setForm((f) => ({ ...f, data_promocao: e.target.value }))} /></div>
          <div><Label>Data da publicação</Label><Input type="date" value={form.data_publicacao} onChange={(e) => setForm((f) => ({ ...f, data_publicacao: e.target.value }))} /></div>
          <div><Label>DOEMS / boletim / referência</Label><Input value={form.boletim_referencia} onChange={(e) => setForm((f) => ({ ...f, boletim_referencia: e.target.value }))} /></div>
          <div><Label>Ato de referência</Label><Input value={form.ato_referencia} onChange={(e) => setForm((f) => ({ ...f, ato_referencia: e.target.value }))} /></div>
          <div><Label>Antiguidade (ordem)</Label><Input value={form.antiguidade_referencia_ordem} onChange={(e) => setForm((f) => ({ ...f, antiguidade_referencia_ordem: e.target.value }))} /></div>
          <div className="md:col-span-2"><Label>Observações</Label><Input value={form.observacoes} onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} /></div>
          {registroConflitante && (
            <div className="md:col-span-2 p-3 border rounded bg-amber-50">
              <p className="text-xs text-amber-900 mb-2">Conflito detectado: já existe registro ativo com data {registroConflitante.data_promocao || '—'} para o mesmo posto/quadro atual.</p>
              <Label>Motivo da retificação *</Label>
              <Input value={form.motivo_retificacao} onChange={(e) => setForm((f) => ({ ...f, motivo_retificacao: e.target.value }))} placeholder="Obrigatório para retificação" />
            </div>
          )}
        </div>

        {mensagem && <p className="text-sm text-slate-700">{mensagem}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={onSave} disabled={saving}>{saving ? 'Salvando...' : 'Registrar promoção atual'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
