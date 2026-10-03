import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Edit, Calendar, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function CampanhaGeralAdminActions({ campanha, enabled, disabled, onUpdated }) {
  const [form, setForm] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  if (!enabled || campanha.tipo === 'PLANO_FERIAS' || campanha.plano_ferias_institucional_id) return null;
  const abrir = (tipo) => {
    setErro('');
    setForm({ tipo, titulo: campanha.titulo || '', data: campanha.data_fim_militar || '', justificativa: '' });
  };
  const salvar = async (e) => {
    e.preventDefault();
    if (salvando || !enabled) return;
    setSalvando(true);
    setErro('');
    try {
      const res = await base44.functions.invoke('portal_servicos', {
        acao: form.tipo === 'nome' ? 'CAMPANHA_RENOMEAR' : 'CAMPANHA_PRORROGAR',
        campanha_id: campanha.id,
        ...(form.tipo === 'nome' ? { titulo: form.titulo.trim() } : { nova_data_fim_militar: form.data, justificativa: form.justificativa.trim() }),
      });
      await onUpdated(res.data.campanha, res.data.message);
      setForm(null);
    } catch (err) {
      setErro(err?.response?.data?.error || err?.message || 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  };
  return <>
    <button type="button" onClick={() => abrir('nome')} disabled={disabled || salvando} title="Editar nome (Admin)" aria-label={`Editar nome de ${campanha.titulo}`} className="p-1.5 text-blue-700 hover:bg-blue-50 rounded"><Edit className="w-4 h-4" /></button>
    {['Aberta_Coleta', 'Encerrada'].includes(campanha.status) && <button type="button" onClick={() => abrir('prazo')} disabled={disabled || salvando} title="Prorrogar prazo (Admin)" aria-label={`Prorrogar prazo de ${campanha.titulo}`} className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded"><Calendar className="w-4 h-4" /></button>}
    {form && createPortal(<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={form.tipo === 'nome' ? 'Editar nome da campanha' : 'Prorrogar prazo'}>
      <form onSubmit={salvar} className="w-full max-w-lg bg-white rounded-2xl p-6 space-y-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold text-lg">{form.tipo === 'nome' ? 'Editar nome da campanha' : 'Prorrogar prazo'}</h2><p className="text-xs text-slate-500">{campanha.titulo}</p></div><Button type="button" variant="ghost" disabled={salvando} aria-label="Fechar" onClick={() => setForm(null)}><X className="w-4 h-4" /></Button></div>
        <p className="text-xs text-blue-900 bg-blue-50 border border-blue-200 rounded-xl p-3">As respostas, documentos e o público da campanha serão preservados.</p>
        {form.tipo === 'nome' ? <label className="block text-sm font-bold">Nome da campanha<Input required autoFocus disabled={salvando} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></label> : <>
          <p className="text-xs text-slate-600">Prazo atual: {campanha.data_fim_militar || 'Não informado'}. Campanhas encerradas serão reabertas para coleta.</p>
          <label className="block text-sm font-bold">Nova data limite<Input required type="date" disabled={salvando} value={form.data} min={campanha.data_fim_militar || undefined} onChange={(e) => setForm({ ...form, data: e.target.value })} /></label>
          <label className="block text-sm font-bold">Justificativa<textarea required minLength={5} disabled={salvando} value={form.justificativa} onChange={(e) => setForm({ ...form, justificativa: e.target.value })} rows={3} className="w-full mt-1 border border-slate-300 rounded-xl p-3" /></label>
        </>}
        {erro && <p role="alert" className="text-red-700 bg-red-50 p-3 rounded-xl text-sm">{erro}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={salvando} onClick={() => setForm(null)}>Cancelar</Button><Button type="submit" disabled={salvando || (form.tipo === 'nome' && !form.titulo.trim())}>{salvando ? 'Salvando...' : 'Salvar alteração'}</Button></div>
      </form>
    </div>, document.body)}
  </>;
}
