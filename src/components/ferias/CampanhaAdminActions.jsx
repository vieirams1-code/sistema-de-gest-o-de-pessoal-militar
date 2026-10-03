import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Edit3, RefreshCw, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function CampanhaAdminActions({ campanha, enabled, disabled = false, onUpdated }) {
  const [modal, setModal] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState('');
  if (!enabled || !campanha?.id) return null;
  const podeProrrogar = ['aberta_coleta', 'aberta', 'ativa', 'em_andamento', 'encerrada'].includes(String(campanha.status || '').toLowerCase());
  const abrir = (tipo) => {
    setFeedback('');
    setModal({ tipo, titulo: campanha.titulo || '', nova_data_fim_militar: campanha.data_fim_militar || '',
      nova_hora_fim_militar: campanha.hora_fim_militar || '23:59', justificativa: '' });
  };
  const salvar = async (evento) => {
    evento.preventDefault();
    if (!enabled || salvando) return;
    setSalvando(true);
    setFeedback('');
    try {
      const res = await base44.functions.invoke('portal_servicos', {
        acao: modal.tipo === 'nome' ? 'PLANO_CAMPANHA_RENOMEAR' : 'PLANO_CAMPANHA_PRORROGAR',
        campanha_id: campanha.id,
        ...(modal.tipo === 'nome' ? { titulo: modal.titulo.trim() } : {
          nova_data_fim_militar: modal.nova_data_fim_militar,
          nova_hora_fim_militar: modal.nova_hora_fim_militar,
          justificativa: modal.justificativa.trim(),
        }),
      });
      await onUpdated?.(res.data?.campanha);
      setModal(null);
    } catch (erro) {
      setFeedback(erro?.response?.data?.error || erro?.message || 'Não foi possível salvar a alteração.');
    } finally {
      setSalvando(false);
    }
  };
  return <>
    <Button type="button" variant="outline" disabled={disabled || salvando} onClick={() => abrir('nome')}><Edit3 className="w-4 h-4 mr-1.5" />Editar nome</Button>
    {podeProrrogar && <Button type="button" variant="outline" disabled={disabled || salvando} onClick={() => abrir('prazo')} className="border-emerald-200 text-emerald-700"><RefreshCw className="w-4 h-4 mr-1.5" />Prorrogar prazo</Button>}
    {modal && createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={modal.tipo === 'nome' ? 'Editar nome da campanha' : 'Prorrogar prazo da campanha'}>
        <form onSubmit={salvar} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4">
          <div className="flex justify-between items-start gap-3">
            <div><h2 className="text-lg font-bold text-slate-900">{modal.tipo === 'nome' ? 'Editar nome da campanha' : 'Prorrogar prazo'}</h2><p className="text-xs text-slate-500">{campanha.titulo}</p></div>
            <Button type="button" variant="ghost" disabled={salvando} aria-label="Fechar" onClick={() => setModal(null)}><X className="w-4 h-4" /></Button>
          </div>
          <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">As respostas serão preservadas. A alteração será registrada no histórico.</p>
          {modal.tipo === 'nome' ? <label className="block text-sm font-bold">Nome da campanha<Input autoFocus required value={modal.titulo} disabled={salvando} onChange={(e) => setModal({ ...modal, titulo: e.target.value })} /></label> : <>
            <p className="text-xs text-slate-600">Prazo atual: {campanha.data_fim_militar || '-'} às {campanha.hora_fim_militar || '23:59'} (Campo Grande). Campanhas encerradas serão reabertas para coleta.</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-bold">Nova data<Input required type="date" disabled={salvando} min={campanha.data_fim_militar || undefined} value={modal.nova_data_fim_militar} onChange={(e) => setModal({ ...modal, nova_data_fim_militar: e.target.value })} /></label>
              <label className="text-sm font-bold">Nova hora<Input required type="time" disabled={salvando} value={modal.nova_hora_fim_militar} onChange={(e) => setModal({ ...modal, nova_hora_fim_militar: e.target.value })} /></label>
            </div>
            <label className="block text-sm font-bold">Justificativa<textarea required minLength={5} disabled={salvando} value={modal.justificativa} onChange={(e) => setModal({ ...modal, justificativa: e.target.value })} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" /></label>
          </>}
          {feedback && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{feedback}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={salvando} onClick={() => setModal(null)}>Cancelar</Button><Button type="submit" disabled={salvando || (modal.tipo === 'nome' && !modal.titulo.trim())}>{salvando ? 'Salvando...' : 'Salvar alteração'}</Button></div>
        </form>
      </div>, document.body)}
  </>;
}
