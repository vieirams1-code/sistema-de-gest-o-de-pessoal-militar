import React from 'react';
import { CheckCircle2, Loader2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CoberturaLista from '@/components/ferias/CoberturaLista';

export default function CoberturaPlanoFerias({ loading, error, onRetry, podeCriar, militares, selecionados, onToggle, onToggleTodos, onCriar }) {
  if (error) return <div role="alert" className="my-5 rounded-xl border p-5 text-destructive">{error}<Button variant="outline" onClick={onRetry} className="ml-3">Tentar novamente</Button></div>;
  if (loading) return <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />Calculando cobertura do plano...</div>;
  if (!militares.length) return <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-10 text-center"><CheckCircle2 className="mx-auto h-9 w-9 text-emerald-600" /><h3 className="mt-3 font-black text-emerald-900">Cobertura completa no seu escopo</h3><p className="mt-1 text-sm text-emerald-700">Todos os militares elegíveis já estão incluídos em alguma campanha deste plano.</p></div>;
  const todos = militares.every((m) => selecionados.includes(m.militar_id));
  return <><CoberturaLista militares={militares} selecionados={selecionados} onToggle={onToggle} onToggleTodos={onToggleTodos} />{selecionados.length > 0 && <div className="sticky bottom-4 z-20 mx-auto mt-4 flex max-w-xl items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-white p-3 shadow-xl"><span className="text-sm font-bold text-slate-700">{selecionados.length} selecionado(s)</span><Button disabled={!podeCriar} title={!podeCriar ? 'Exige plano ativo e permissão para gerenciar campanhas.' : undefined} onClick={onCriar} className="h-auto whitespace-normal bg-primary text-primary-foreground"><UserPlus className="h-4 w-4" />Criar campanha com {selecionados.length} selecionado(s)</Button></div>}</>;
}