import React from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

export default function NotaColetivaTexto({ dados, onChange, disabled, composicao }) {
  const usar = dados.modo_texto_coletivo === 'lista';
  const consulta = useInfiniteQuery({ queryKey: ['modelos-nota-coletiva', 'ativos', dados.tipo], initialPageParam: undefined, enabled: usar,
    queryFn: ({ pageParam }) => base44.entities.ModeloNotaColetiva.filter({ tipo: dados.tipo, ativo: true }, { sort: 'nome', limit: 50, cursor: pageParam }),
    getNextPageParam: last => last.has_more ? last.next_cursor : undefined });
  const modelos = consulta.data?.pages.flatMap(p => p.items) || [];
  return <section className="space-y-4">
    <label className="flex items-center gap-2 text-sm font-medium"><input aria-label="Usar template coletivo" type="checkbox" checked={usar} disabled={disabled} onChange={e => onChange('modo_texto_coletivo', e.target.checked ? 'lista' : 'livre')} />Usar template coletivo</label>
    {usar && <>
      <label className="block space-y-1 text-sm"><span>Modelo de texto coletivo</span><select aria-label="Modelo de texto coletivo" className="h-10 w-full rounded-md border bg-background px-3" value={dados.modelo_coletivo_id || ''} disabled={disabled || consulta.isPending} onChange={e => { const m = modelos.find(v => v.id === e.target.value); onChange('modelo_coletivo_id', m?.id || ''); if (m) onChange('cabecalho_coletiva', m.cabecalho); }}><option value="">Selecione um modelo ou digite o cabeçalho</option>{dados.modelo_coletivo_id && !modelos.some(m => m.id === dados.modelo_coletivo_id) && <option value={dados.modelo_coletivo_id}>Modelo anteriormente utilizado (texto preservado)</option>}{modelos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}</select></label>
      {consulta.isPending && <p role="status">Carregando modelos…</p>}{consulta.isError && <p role="alert" className="text-destructive">Não foi possível carregar os modelos.</p>}
      {consulta.isSuccess && !modelos.length && <p className="text-sm text-muted-foreground">Nenhum modelo ativo para este tipo. Você pode digitar o cabeçalho abaixo.</p>}
      {consulta.hasNextPage && <Button type="button" variant="outline" disabled={consulta.isFetchingNextPage} onClick={() => consulta.fetchNextPage()}>Carregar mais modelos</Button>}
      <label className="block space-y-1 text-sm"><span>Cabeçalho desta nota *</span><Textarea aria-label="Cabeçalho desta nota" required rows={4} maxLength={12000} disabled={disabled} value={dados.cabecalho_coletiva || ''} onChange={e => onChange('cabecalho_coletiva', e.target.value)} /></label>
      <p className="text-xs text-muted-foreground">Texto livre, sem variáveis. Alterar este cabeçalho não altera o modelo. A relação será numerada por antiguidade.</p>
      {composicao.carregando && <p role="status">Ordenando militares por antiguidade…</p>}{composicao.erro && <p role="alert" className="text-destructive">{composicao.erro.message}</p>}
      {composicao.pendencias > 0 && <p className="text-sm text-muted-foreground">Há dados de antiguidade incompletos em {composicao.pendencias} militar(es). Confira a ordem antes de salvar.</p>}
    </>}
    <label className="block space-y-1 text-sm"><span>{usar ? 'Prévia integral da publicação' : 'Texto integral da publicação *'}</span><Textarea aria-label="Texto integral da publicação" rows={9} required readOnly={usar} disabled={disabled} value={composicao.texto || ''} onChange={e => onChange('texto_publicacao', e.target.value)} placeholder={usar ? 'Selecione os militares para montar a relação.' : 'Cole a ata completa, incluindo os resultados dos militares.'} /></label>
    <label className="block space-y-1 text-sm"><span>Observações internas</span><Textarea aria-label="Observações internas da nota" rows={2} disabled={disabled} value={dados.observacoes || ''} onChange={e => onChange('observacoes', e.target.value)} /></label>
  </section>;
}