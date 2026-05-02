import React from 'react';
import { queryClientInstance } from '@/lib/query-client';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { POSTOS_GRADUACOES, QUADROS, resolverQuadroPromocao } from '@/components/antiguidade/promocaoHistoricaUtils';

const STATUS_ATIVO = 'ativo';

const FORM_INICIAL = {
  posto_graduacao_anterior: '',
  posto_graduacao_novo: '',
  quadro_novo: '',
  data_promocao: '',
  data_publicacao: '',
  boletim_referencia: '',
  ato_referencia: '',
  antiguidade_referencia_ordem: '',
  observacoes: '',
};

const valorTexto = (v) => String(v || '').trim();

export default function PromocaoHistoricaModal({ open, onOpenChange, militar, onSaved }) {
  const [form, setForm] = React.useState(FORM_INICIAL);
  const [mensagem, setMensagem] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setForm({ ...FORM_INICIAL, quadro_novo: militar?.quadro || '' });
      setMensagem('');
    }
  }, [open, militar?.id, militar?.quadro]);

  const updateCampo = (campo, valor) => {
    setForm((prev) => {
      const next = { ...prev, [campo]: valor };
      if (campo === 'posto_graduacao_anterior' || campo === 'posto_graduacao_novo' || campo === 'quadro_novo') {
        next.quadro_novo = resolverQuadroPromocao({
          postoAnterior: campo === 'posto_graduacao_anterior' ? valor : next.posto_graduacao_anterior,
          postoNovo: campo === 'posto_graduacao_novo' ? valor : next.posto_graduacao_novo,
          quadroInformado: campo === 'quadro_novo' ? valor : next.quadro_novo,
          quadroAtual: militar?.quadro,
        });
      }
      return next;
    });
  };

  const onSave = async () => {
    if (!militar?.id) return;
    if (!form.data_promocao) return setMensagem('Data da promoção é obrigatória.');
    if (!valorTexto(form.posto_graduacao_novo)) return setMensagem('Posto/graduação novo é obrigatório.');
    if (!valorTexto(form.quadro_novo)) return setMensagem('Quadro novo é obrigatório.');

    setSaving(true);
    setMensagem('');

    try {
      const todos = await base44.entities.HistoricoPromocaoMilitarV2.list();
      const quadroResolvido = resolverQuadroPromocao({
        postoAnterior: form.posto_graduacao_anterior,
        postoNovo: form.posto_graduacao_novo,
        quadroInformado: form.quadro_novo,
        quadroAtual: militar?.quadro,
      });

      const duplicado = todos.find((h) =>
        valorTexto(h.status_registro || STATUS_ATIVO).toLowerCase() === STATUS_ATIVO
        && String(h.militar_id || '') === String(militar.id)
        && valorTexto(h.posto_graduacao_novo) === valorTexto(form.posto_graduacao_novo)
        && valorTexto(h.quadro_novo) === valorTexto(quadroResolvido)
        && valorTexto(h.data_promocao) === valorTexto(form.data_promocao),
      );

      if (duplicado) {
        setMensagem('Duplicidade exata detectada: já existe registro ativo com mesmo posto/quadro/data.');
        return;
      }

      await base44.entities.HistoricoPromocaoMilitarV2.create({
        militar_id: militar.id,
        posto_graduacao_anterior: form.posto_graduacao_anterior || '',
        quadro_anterior: militar?.quadro || '',
        posto_graduacao_novo: form.posto_graduacao_novo,
        quadro_novo: quadroResolvido,
        data_promocao: form.data_promocao,
        data_publicacao: form.data_publicacao || '',
        boletim_referencia: form.boletim_referencia || '',
        ato_referencia: form.ato_referencia || '',
        antiguidade_referencia_ordem: form.antiguidade_referencia_ordem === '' ? null : Number(form.antiguidade_referencia_ordem),
        observacoes: form.observacoes || '',
        origem_dado: 'manual',
        status_registro: STATUS_ATIVO,
        antiguidade_referencia_id: '',
      });

      await queryClientInstance.invalidateQueries({ queryKey: ['antiguidade-diagnostico'] });
      setMensagem('Promoção histórica registrada com sucesso.');
      await onSaved?.();
    } catch (e) {
      setMensagem(e?.message || 'Erro ao registrar promoção histórica.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Adicionar promoção ao histórico</DialogTitle>
          <DialogDescription>Registra promoções anteriores sem alterar posto/quadro atual do militar.</DialogDescription>
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
          <div><Label>Posto/graduação anterior</Label><Input list="postos" value={form.posto_graduacao_anterior} onChange={(e) => updateCampo('posto_graduacao_anterior', e.target.value)} /></div>
          <div><Label>Posto/graduação novo *</Label><Input list="postos" value={form.posto_graduacao_novo} onChange={(e) => updateCampo('posto_graduacao_novo', e.target.value)} /></div>
          <div><Label>Quadro novo *</Label><Input list="quadros" value={form.quadro_novo} onChange={(e) => updateCampo('quadro_novo', e.target.value)} /></div>
          <div><Label>Data da promoção *</Label><Input type="date" value={form.data_promocao} onChange={(e) => updateCampo('data_promocao', e.target.value)} /></div>
          <div><Label>Data da publicação</Label><Input type="date" value={form.data_publicacao} onChange={(e) => updateCampo('data_publicacao', e.target.value)} /></div>
          <div><Label>DOEMS / boletim / referência</Label><Input value={form.boletim_referencia} onChange={(e) => updateCampo('boletim_referencia', e.target.value)} /></div>
          <div><Label>Ato de referência</Label><Input value={form.ato_referencia} onChange={(e) => updateCampo('ato_referencia', e.target.value)} /></div>
          <div><Label>Antiguidade (ordem)</Label><Input value={form.antiguidade_referencia_ordem} onChange={(e) => updateCampo('antiguidade_referencia_ordem', e.target.value)} /></div>
          <div className="md:col-span-2"><Label>Observações</Label><Input value={form.observacoes} onChange={(e) => updateCampo('observacoes', e.target.value)} /></div>
        </div>

        <datalist id="postos">{POSTOS_GRADUACOES.map((item) => <option key={item} value={item} />)}</datalist>
        <datalist id="quadros">{QUADROS.map((item) => <option key={item} value={item} />)}</datalist>

        {mensagem && <p className="text-sm text-slate-700">{mensagem}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={onSave} disabled={saving}>{saving ? 'Salvando...' : 'Adicionar ao histórico'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
