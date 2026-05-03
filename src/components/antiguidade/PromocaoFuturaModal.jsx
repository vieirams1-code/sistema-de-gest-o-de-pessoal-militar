import React from 'react';
import { queryClientInstance } from '@/lib/query-client';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getProximoPosto, resolverQuadroPromocaoFutura } from '@/components/antiguidade/promocaoHistoricaUtils';

const STATUS_PREVISTO = 'previsto';
const STATUS_ATIVO = 'ativo';

const FORM_INICIAL = { data_promocao: '', data_publicacao: '', boletim_referencia: '', ato_referencia: '', antiguidade_referencia_ordem: '', observacoes: '' };
const valorTexto = (v) => String(v || '').trim();

export default function PromocaoFuturaModal({ open, onOpenChange, militar, onSaved, registroEdicao = null }) {
  const [form, setForm] = React.useState(FORM_INICIAL);
  const [mensagem, setMensagem] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const postoPrevisto = React.useMemo(() => getProximoPosto(registroEdicao?.posto_graduacao_anterior || militar?.posto_graduacao), [registroEdicao?.posto_graduacao_anterior, militar?.posto_graduacao]);
  const quadroBase = registroEdicao?.quadro_anterior || militar?.quadro;
  const quadroPrevisto = React.useMemo(() => resolverQuadroPromocaoFutura({ postoAtual: registroEdicao?.posto_graduacao_anterior || militar?.posto_graduacao, postoPrevisto, quadroAtual: quadroBase }), [registroEdicao?.posto_graduacao_anterior, militar?.posto_graduacao, postoPrevisto, quadroBase]);

  React.useEffect(() => {
    if (!open) return;
    if (registroEdicao) {
      setForm({
        data_promocao: registroEdicao.data_promocao || '',
        data_publicacao: registroEdicao.data_publicacao || '',
        boletim_referencia: registroEdicao.boletim_referencia || '',
        ato_referencia: registroEdicao.ato_referencia || '',
        antiguidade_referencia_ordem: registroEdicao.antiguidade_referencia_ordem ?? '',
        observacoes: registroEdicao.observacoes || '',
      });
    } else setForm(FORM_INICIAL);
    setMensagem('');
  }, [open, registroEdicao]);

  const onSave = async () => {
    if (!militar?.id) return;
    if (!postoPrevisto) return setMensagem('Não foi possível calcular o próximo posto para previsão.');
    if (!form.data_promocao) return setMensagem('Data prevista da promoção é obrigatória.');
    setSaving(true); setMensagem('');
    try {
      const todos = await base44.entities.HistoricoPromocaoMilitarV2.list();
      const duplicado = todos.find((h) =>
        String(h.id || '') !== String(registroEdicao?.id || '')
        && String(h.militar_id || '') === String(militar.id)
        && valorTexto(h.posto_graduacao_novo) === valorTexto(postoPrevisto)
        && valorTexto(h.quadro_novo) === valorTexto(quadroPrevisto)
        && valorTexto(h.data_promocao) === valorTexto(form.data_promocao)
        && ['previsto', STATUS_ATIVO].includes(valorTexto(h.status_registro).toLowerCase()));
      if (duplicado) return setMensagem('Já existe promoção prevista/ativa com mesmo posto, quadro e data para este militar.');

      const payload = {
        militar_id: militar.id,
        posto_graduacao_anterior: registroEdicao?.posto_graduacao_anterior || militar?.posto_graduacao || '',
        quadro_anterior: registroEdicao?.quadro_anterior || militar?.quadro || '',
        posto_graduacao_novo: postoPrevisto,
        quadro_novo: quadroPrevisto,
        data_promocao: form.data_promocao,
        data_publicacao: form.data_publicacao || '',
        boletim_referencia: form.boletim_referencia || '',
        ato_referencia: form.ato_referencia || '',
        antiguidade_referencia_ordem: form.antiguidade_referencia_ordem === '' ? null : Number(form.antiguidade_referencia_ordem),
        observacoes: form.observacoes || '',
        origem_dado: 'manual',
        status_registro: STATUS_PREVISTO,
      };

      if (registroEdicao?.id) await base44.entities.HistoricoPromocaoMilitarV2.update(registroEdicao.id, payload);
      else await base44.entities.HistoricoPromocaoMilitarV2.create(payload);

      await queryClientInstance.invalidateQueries({ queryKey: ['antiguidade-diagnostico'] });
      await onSaved?.();
      onOpenChange(false);
    } catch (e) { setMensagem(e?.message || 'Erro ao salvar promoção futura.'); } finally { setSaving(false); }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>{registroEdicao ? 'Editar promoção futura' : 'Nova promoção futura / prevista'}</DialogTitle><DialogDescription>Promoções previstas não alteram o cadastro funcional até a efetivação.</DialogDescription></DialogHeader>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm"><p><strong>Militar:</strong> {militar?.nome_completo || '—'}</p><p><strong>Matrícula:</strong> {militar?.matricula || '—'}</p><p><strong>Posto atual:</strong> {registroEdicao?.posto_graduacao_anterior || militar?.posto_graduacao || '—'}</p><p><strong>Quadro atual:</strong> {registroEdicao?.quadro_anterior || militar?.quadro || '—'}</p><p><strong>Lotação:</strong> {militar?.lotacao_atual || militar?.lotacao || '—'}</p></div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3"><div><Label>Posto previsto</Label><Input value={postoPrevisto || '—'} readOnly /></div><div><Label>Quadro previsto</Label><Input value={quadroPrevisto || '—'} readOnly /></div><div><Label>Data prevista da promoção *</Label><Input type="date" value={form.data_promocao} onChange={(e) => setForm((p) => ({ ...p, data_promocao: e.target.value }))} /></div><div><Label>Data da publicação</Label><Input type="date" value={form.data_publicacao} onChange={(e) => setForm((p) => ({ ...p, data_publicacao: e.target.value }))} /></div><div><Label>DOEMS / boletim / referência</Label><Input value={form.boletim_referencia} onChange={(e) => setForm((p) => ({ ...p, boletim_referencia: e.target.value }))} /></div><div><Label>Ato de referência</Label><Input value={form.ato_referencia} onChange={(e) => setForm((p) => ({ ...p, ato_referencia: e.target.value }))} /></div><div><Label>Antiguidade (ordem)</Label><Input value={form.antiguidade_referencia_ordem} onChange={(e) => setForm((p) => ({ ...p, antiguidade_referencia_ordem: e.target.value }))} /></div><div className="md:col-span-2"><Label>Observações</Label><Input value={form.observacoes} onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))} /></div></div>
    {mensagem && <p className="text-sm text-slate-700">{mensagem}</p>}
    <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button><Button onClick={onSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar promoção futura'}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
