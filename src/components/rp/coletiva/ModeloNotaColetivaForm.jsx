import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function ModeloNotaColetivaForm({ modelo, tipos, tipoInicial, onSave, onCancel, pending }) {
  const [dados, setDados] = useState(modelo || { nome: '', tipo: tipoInicial || 'Geral', cabecalho: '', ativo: true });
  const change = (key, value) => setDados(prev => ({ ...prev, [key]: value }));
  const invalido = !dados.nome.trim() || !dados.cabecalho.trim() || /\{\{[\s\S]*?\}\}/.test(dados.cabecalho);
  return <section className="space-y-3 rounded-md border p-4">
    <h3 className="font-semibold">{modelo ? 'Editar texto coletivo' : 'Novo texto coletivo'}</h3>
    <label className="block space-y-1 text-sm"><span>Nome do modelo</span><Input aria-label="Nome do modelo coletivo" maxLength={150} value={dados.nome} disabled={pending} onChange={e => change('nome', e.target.value)} /></label>
    <label className="block space-y-1 text-sm"><span>Tipo de publicação</span><select aria-label="Tipo do modelo coletivo" className="h-10 w-full rounded-md border bg-background px-3" value={dados.tipo} disabled={pending} onChange={e => change('tipo', e.target.value)}>{tipos.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
    <label className="block space-y-1 text-sm"><span>Cabeçalho sem variáveis</span><Textarea aria-label="Cabeçalho do modelo coletivo" rows={5} maxLength={12000} value={dados.cabecalho} disabled={pending} onChange={e => change('cabecalho', e.target.value)} /></label>
    <p className="text-xs text-muted-foreground">Cadastre somente o texto geral. A relação numerada dos militares será acrescentada na nota.</p>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={dados.ativo} disabled={pending} onChange={e => change('ativo', e.target.checked)} />Modelo ativo</label>
    <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={pending} onClick={onCancel}>Cancelar edição</Button><Button type="button" disabled={pending || invalido} onClick={() => onSave(dados)}>{pending ? 'Salvando…' : 'Salvar modelo coletivo'}</Button></div>
  </section>;
}