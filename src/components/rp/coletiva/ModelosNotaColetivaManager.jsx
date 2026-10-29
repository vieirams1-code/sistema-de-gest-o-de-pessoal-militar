import React, { useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { getEffectiveEmail } from '@/services/getScopedMilitaresClient';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ModeloNotaColetivaForm from '@/components/rp/coletiva/ModeloNotaColetivaForm';
import ModeloNotaColetivaItem from '@/components/rp/coletiva/ModeloNotaColetivaItem';

export default function ModelosNotaColetivaManager({ tipos, tipoInicial }) {
  const [open, setOpen] = useState(false);
  const [edicao, setEdicao] = useState(undefined);
  const [mensagem, setMensagem] = useState(null);
  const client = useQueryClient();
  const consulta = useInfiniteQuery({ queryKey: ['modelos-nota-coletiva', 'gestao'], initialPageParam: undefined, enabled: open,
    queryFn: ({ pageParam }) => base44.entities.ModeloNotaColetiva.list({ sort: '-created_date', limit: 30, cursor: pageParam }),
    getNextPageParam: last => last.has_more ? last.next_cursor : undefined });
  const mutation = useMutation({
    mutationFn: async ({ dados, excluir }) => {
      const response = await base44.functions.invoke('cudEscopado', { entityName: 'ModeloNotaColetiva', operation: excluir ? 'delete' : dados.id ? 'update' : 'create', registroId: excluir || dados.id, data: dados || {}, effectiveEmail: getEffectiveEmail() });
      if (response.data?.error) throw new Error(response.data.error);
      return response.data.data;
    },
    onSuccess: async resultado => { await client.invalidateQueries({ queryKey: ['modelos-nota-coletiva'] }); setEdicao(undefined); setMensagem({ id: resultado.id, texto: resultado.deleted ? 'Modelo coletivo excluído.' : 'Modelo coletivo salvo.' }); },
  });
  const iniciar = modelo => { setEdicao(modelo); setMensagem(null); mutation.reset(); };
  return <>
    <Button type="button" variant="outline" onClick={() => setOpen(true)}>Gerenciar textos coletivos</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>Textos para notas coletivas</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">Cadastro separado dos templates individuais. É permitido cadastrar vários modelos para o mesmo tipo.</p>
      {mensagem && <p role="status" data-modelo-salvo-id={mensagem.id}>{mensagem.texto}</p>}
      {mutation.isError && <p role="alert" className="text-destructive">{mutation.error.message}</p>}
      {edicao !== undefined ? <ModeloNotaColetivaForm key={edicao?.id || 'novo'} modelo={edicao} tipos={tipos} tipoInicial={tipoInicial} pending={mutation.isPending} onCancel={() => setEdicao(undefined)} onSave={dados => mutation.mutate({ dados })} /> : <Button type="button" onClick={() => iniciar(null)}>Novo texto coletivo</Button>}
      {consulta.isPending && <p>Carregando modelos…</p>}{consulta.isError && <p role="alert">Não foi possível carregar os modelos.</p>}
      {consulta.data?.pages.flatMap(p => p.items).map(m => <ModeloNotaColetivaItem key={m.id} modelo={m} onEdit={iniciar} pending={mutation.isPending} onDelete={id => mutation.mutate({ excluir: id })} />)}
      {consulta.isSuccess && !consulta.data.pages[0].items.length && <p>Nenhum texto coletivo cadastrado.</p>}
      {consulta.hasNextPage && <Button type="button" variant="outline" disabled={consulta.isFetchingNextPage} onClick={() => consulta.fetchNextPage()}>Carregar mais modelos</Button>}
    </DialogContent></Dialog>
  </>;
}