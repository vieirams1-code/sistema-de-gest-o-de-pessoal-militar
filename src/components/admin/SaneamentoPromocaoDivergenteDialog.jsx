// @ts-nocheck
import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2, RefreshCw, ShieldAlert, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import {
  auditarMilitaresDivergentesPromocao,
  CONFIRMACAO_SINCRONIZACAO_PROMOCAO,
  sincronizarCadastroMilitarComHistorico,
} from '@/services/saneamentoPromocaoMilitarDivergenteService';

const QUERY_KEY = ['admin-saneamento-promocao-divergente-preview'];

export default function SaneamentoPromocaoDivergenteDialog({ isAdmin = false }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirmacao, setConfirmacao] = useState('');
  const [selectedMilitarId, setSelectedMilitarId] = useState('');

  const previewQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: auditarMilitaresDivergentesPromocao,
    enabled: isAdmin && open,
    staleTime: 0,
  });

  const divergencias = useMemo(() => previewQuery.data || [], [previewQuery.data]);
  const alvo = useMemo(() => divergencias.find((item) => item.militar_id === selectedMilitarId) || null, [divergencias, selectedMilitarId]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!alvo) throw new Error('Selecione um militar para sincronizar.');
      return sincronizarCadastroMilitarComHistorico({ militarId: alvo.militar_id, historico: alvo, confirmacao });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ predicate: (q) => (q.queryKey || []).some((v) => String(v).toLowerCase().includes('militar')) });
      await previewQuery.refetch();
      setConfirmacao('');
      setSelectedMilitarId('');
      toast({ title: 'Sincronização concluída', description: 'Cadastro Militar atualizado com posto/quadro do histórico ativo mais recente.' });
    },
    onError: (error) => {
      toast({ title: 'Falha ao sincronizar', description: error?.message || 'Erro inesperado', variant: 'destructive' });
    },
  });

  if (!isAdmin) return null;

  return (
    <>
      <Button type="button" variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100" onClick={() => setOpen(true)}>
        <Wrench className="w-4 h-4 mr-2" /> Sanear promoção divergente
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-7xl max-h-[92vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#1e3a5f]"><ShieldAlert className="w-5 h-5 text-amber-600" />Saneamento controlado de promoção divergente</DialogTitle>
            <DialogDescription>Dry-run por padrão. Apenas após confirmação textual será feito update restrito a posto_graduacao/quadro de um militar por vez.</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><div className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 flex-none" /><p>Nunca altera histórico/promoção. Só Militar.update com payload <code>{'{ posto_graduacao, quadro }'}</code>.</p></div></div>
          <div className="flex items-center justify-between">
            <Badge variant="outline">Divergências (dry-run): {divergencias.length}</Badge>
            <Button type="button" variant="outline" size="sm" onClick={() => previewQuery.refetch()} disabled={previewQuery.isFetching || mutation.isPending}><RefreshCw className="h-4 w-4 mr-2" />Recarregar</Button>
          </div>
          <ScrollArea className="h-[42vh] rounded-lg border">
            <Table>
              <TableHeader className="sticky top-0 bg-slate-50"><TableRow><TableHead></TableHead><TableHead>Militar</TableHead><TableHead>Matrícula</TableHead><TableHead>Posto atual</TableHead><TableHead>Quadro atual</TableHead><TableHead>Posto histórico</TableHead><TableHead>Quadro histórico</TableHead><TableHead>Data promoção</TableHead><TableHead>Publicação/Ato</TableHead><TableHead>Histórico ID</TableHead></TableRow></TableHeader>
              <TableBody>
                {previewQuery.isLoading ? <TableRow><TableCell colSpan={10} className="py-8 text-center text-slate-500"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Carregando auditoria...</TableCell></TableRow> : divergencias.length === 0 ? <TableRow><TableCell colSpan={10} className="py-8 text-center text-slate-500">Nenhuma divergência encontrada.</TableCell></TableRow> : divergencias.map((item) => (
                  <TableRow key={item.historico_id}>
                    <TableCell><input type="radio" name="militar-sync" checked={selectedMilitarId === item.militar_id} onChange={() => setSelectedMilitarId(item.militar_id)} /></TableCell>
                    <TableCell>{item.nome}</TableCell><TableCell>{item.matricula}</TableCell><TableCell>{item.posto_atual_militar}</TableCell><TableCell>{item.quadro_atual_militar}</TableCell><TableCell>{item.posto_historico_ativo}</TableCell><TableCell>{item.quadro_historico_ativo}</TableCell><TableCell>{item.data_promocao || '—'}</TableCell><TableCell>{item.publicacao_ato}</TableCell><TableCell className="font-mono text-xs">{item.historico_id}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="confirmacao-promocao-sync">Digite exatamente: <span className="font-mono text-amber-700">{CONFIRMACAO_SINCRONIZACAO_PROMOCAO}</span></label>
            <Input id="confirmacao-promocao-sync" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} placeholder={CONFIRMACAO_SINCRONIZACAO_PROMOCAO} disabled={mutation.isPending} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={mutation.isPending}>Fechar</Button>
            <Button type="button" className="bg-amber-700 hover:bg-amber-800 text-white" disabled={confirmacao !== CONFIRMACAO_SINCRONIZACAO_PROMOCAO || !alvo || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Sincronizar cadastro com histórico</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
