import React, { useEffect, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { fetchScopedMilitares, getEffectiveEmail } from '@/services/getScopedMilitaresClient';

export default function MilitaresNotaSelector({ selecionados, onChange, disabled }) {
  const [busca, setBusca] = useState('');
  const [termo, setTermo] = useState('');
  useEffect(() => { const timer = setTimeout(() => setTermo(busca.trim()), 350); return () => clearTimeout(timer); }, [busca]);
  const consulta = useInfiniteQuery({
    queryKey: ['nota-coletiva-militares', getEffectiveEmail() || 'self', termo], initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchScopedMilitares({ search: termo, statusCadastro: 'Ativo', limit: 50, offset: pageParam, includeFoto: false }),
    getNextPageParam: (last, pages) => last.militares.length === 50 ? pages.length * 50 : undefined, staleTime: 60000,
  });
  const lista = consulta.data?.pages.flatMap(p => p.militares) || [];
  const toggle = m => onChange(selecionados.some(v => v.militar_id === m.id)
    ? selecionados.filter(v => v.militar_id !== m.id)
    : [...selecionados, { militar_id: m.id, militar_nome: m.nome_completo, militar_posto: m.posto_graduacao, militar_matricula: m.matricula }]);
  return <section className="space-y-3">
    <h2 className="font-semibold">Militares vinculados ({selecionados.length})</h2>
    <Input aria-label="Buscar militares para a nota" placeholder="Buscar por nome ou matrícula" value={busca} onChange={e => setBusca(e.target.value)} disabled={disabled} />
    {consulta.isLoading && <p role="status">Carregando militares…</p>}
    {consulta.isError && <p role="alert" className="text-destructive">Não foi possível consultar o efetivo. <Button type="button" variant="outline" onClick={() => consulta.refetch()}>Tentar novamente</Button></p>}
    {!consulta.isLoading && !consulta.isError && !lista.length && <p className="text-muted-foreground">Nenhum militar encontrado.</p>}
    <div className="max-h-60 overflow-y-auto rounded-md border divide-y">
      {lista.map(m => <label key={m.id} className="flex items-start gap-3 p-3 cursor-pointer text-sm">
        <input type="checkbox" aria-label={'Vincular ' + m.nome_completo} checked={selecionados.some(v => v.militar_id === m.id)} onChange={() => toggle(m)} disabled={disabled || (selecionados.length >= 500 && !selecionados.some(v => v.militar_id === m.id))} />
        <span>{m.posto_graduacao} · {m.nome_completo}<span className="block text-xs text-muted-foreground">Matrícula {m.matricula || 'não informada'}</span></span>
      </label>)}
    </div>
    {consulta.hasNextPage && <Button type="button" variant="outline" disabled={consulta.isFetchingNextPage} onClick={() => consulta.fetchNextPage()}>Carregar mais militares</Button>}
    <ul className="space-y-1 text-sm">{selecionados.map(m => <li key={m.militar_id} className="flex items-center justify-between gap-2 border rounded p-2">
      <span>{m.militar_posto} · {m.militar_nome}</span><Button type="button" variant="ghost" size="sm" aria-label={'Retirar ' + m.militar_nome} disabled={disabled} onClick={() => onChange(selecionados.filter(v => v.militar_id !== m.militar_id))}>Retirar</Button>
    </li>)}</ul>
  </section>;
}