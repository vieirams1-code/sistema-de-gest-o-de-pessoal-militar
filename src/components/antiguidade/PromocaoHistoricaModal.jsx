import React from 'react';
import { queryClientInstance } from '@/lib/query-client';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  getPostoAnteriorPrevisto,
  getPostosHistoricosPermitidos,
  isPromocaoIgualOuAcimaDoPostoAtual,
  resolverQuadroPromocao,
} from '@/components/antiguidade/promocaoHistoricaUtils';

const STATUS_ATIVO = 'ativo';

const FORM_INICIAL = {
  posto_alcancado_historico: '',
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

  const postosPermitidos = React.useMemo(() => getPostosHistoricosPermitidos(militar?.posto_graduacao), [militar?.posto_graduacao]);

  React.useEffect(() => {
    if (open) {
      setForm({ ...FORM_INICIAL });
      setMensagem('');
    }
  }, [open, militar?.id]);

  const onSelectPosto = (postoNovo) => {
    const postoAnterior = getPostoAnteriorPrevisto(postoNovo);
    const quadroNovo = resolverQuadroPromocao({
      postoAnterior,
      postoNovo,
      quadroAtual: militar?.quadro,
      quadroAnteriorInformado: militar?.quadro,
    });

    setForm((prev) => ({
      ...prev,
      posto_alcancado_historico: postoNovo,
      posto_graduacao_novo: postoNovo,
      posto_graduacao_anterior: postoAnterior,
      quadro_novo: quadroNovo,
    }));
  };

  const onSave = async () => {
    if (!militar?.id) return;
    if (!form.data_promocao) return setMensagem('Data da promoção é obrigatória.');
    if (!valorTexto(form.posto_graduacao_novo)) return setMensagem('Selecione o posto/graduação alcançado na promoção histórica.');

    const postoInvalido = !postosPermitidos.includes(form.posto_graduacao_novo)
      || isPromocaoIgualOuAcimaDoPostoAtual({ postoAtual: militar?.posto_graduacao, postoNovo: form.posto_graduacao_novo });

    if (postoInvalido) {
      return setMensagem('Este fluxo registra apenas promoções anteriores. Não é permitido lançar posto igual ou acima do posto atual do militar.');
    }

    setSaving(true);
    setMensagem('');

    try {
      const todos = await base44.entities.HistoricoPromocaoMilitarV2.list();
      const quadroResolvido = resolverQuadroPromocao({
        postoAnterior: form.posto_graduacao_anterior,
        postoNovo: form.posto_graduacao_novo,
        quadroAtual: militar?.quadro,
        quadroAnteriorInformado: militar?.quadro,
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

      const promocaoAtualAtiva = todos.find((h) =>
        valorTexto(h.status_registro || STATUS_ATIVO).toLowerCase() === STATUS_ATIVO
        && String(h.militar_id || '') === String(militar.id)
        && valorTexto(h.posto_graduacao_novo) === valorTexto(militar?.posto_graduacao)
        && valorTexto(h.quadro_novo) === valorTexto(militar?.quadro)
        && valorTexto(h.data_promocao),
      );

      if (promocaoAtualAtiva?.data_promocao && String(form.data_promocao) > String(promocaoAtualAtiva.data_promocao)) {
        setMensagem('A data da promoção histórica anterior não pode ser posterior à data da promoção atual.');
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
          <DialogTitle>Adicionar promoção anterior ao histórico</DialogTitle>
          <DialogDescription>Este lançamento registra promoções anteriores da carreira. Não altera o posto atual do militar.</DialogDescription>
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
          <div>
            <Label>Posto/graduação alcançado na promoção histórica *</Label>
            <select className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" value={form.posto_alcancado_historico} onChange={(e) => onSelectPosto(e.target.value)}>
              <option value="">Selecione...</option>
              {postosPermitidos.map((posto) => <option key={posto} value={posto}>{posto}</option>)}
            </select>
          </div>
          <div><Label>Data da promoção *</Label><Input type="date" value={form.data_promocao} onChange={(e) => setForm((prev) => ({ ...prev, data_promocao: e.target.value }))} /></div>
          <div><Label>Posto/graduação anterior previsto</Label><Input value={form.posto_graduacao_anterior || 'Ingresso/Inicial'} readOnly /></div>
          <div><Label>Posto/graduação novo</Label><Input value={form.posto_graduacao_novo} readOnly /></div>
          <div><Label>Quadro do registro histórico</Label><Input value={form.quadro_novo} readOnly /></div>
          <div><Label>Data da publicação</Label><Input type="date" value={form.data_publicacao} onChange={(e) => setForm((prev) => ({ ...prev, data_publicacao: e.target.value }))} /></div>
          <div><Label>DOEMS / boletim / referência</Label><Input value={form.boletim_referencia} onChange={(e) => setForm((prev) => ({ ...prev, boletim_referencia: e.target.value }))} /></div>
          <div><Label>Ato de referência</Label><Input value={form.ato_referencia} onChange={(e) => setForm((prev) => ({ ...prev, ato_referencia: e.target.value }))} /></div>
          <div><Label>Antiguidade (ordem)</Label><Input value={form.antiguidade_referencia_ordem} onChange={(e) => setForm((prev) => ({ ...prev, antiguidade_referencia_ordem: e.target.value }))} /></div>
          <div className="md:col-span-2"><Label>Observações</Label><Input value={form.observacoes} onChange={(e) => setForm((prev) => ({ ...prev, observacoes: e.target.value }))} /></div>
        </div>

        {mensagem && <p className="text-sm text-slate-700">{mensagem}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={onSave} disabled={saving}>{saving ? 'Salvando...' : 'Adicionar promoção anterior'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
