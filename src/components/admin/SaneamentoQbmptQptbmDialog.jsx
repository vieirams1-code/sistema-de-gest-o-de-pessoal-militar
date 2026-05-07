// @ts-nocheck
import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2, RefreshCw, ShieldAlert, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import {
  converterMilitaresQbmptParaQptbm,
  listarMilitaresQbmptLegado,
  QBMPT_LEGADO_FILTRO,
  QBMPT_PARA_QPTBM_PAYLOAD,
} from '@/services/saneamentoQuadroMilitarService';

const CONFIRMACAO_EXATA = 'CONVERTER QBMPT PARA QPTBM';
const QUERY_KEY_QBMPT = ['admin-saneamento-qbmpt-qptbm-preview'];

function invalidarQueriesMilitarEfetivo(queryClient) {
  return queryClient.invalidateQueries({
    predicate: (query) => {
      const chave = (query.queryKey || []).map((parte) => String(parte).toLowerCase()).join('|');
      return chave.includes('militar') || chave.includes('militares') || chave.includes('efetivo');
    },
  });
}

export default function SaneamentoQbmptQptbmDialog({ isAdmin = false }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [confirmacao, setConfirmacao] = useState('');
  const [relatorio, setRelatorio] = useState(null);

  const previewQuery = useQuery({
    queryKey: QUERY_KEY_QBMPT,
    queryFn: listarMilitaresQbmptLegado,
    enabled: isAdmin && open,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const militares = useMemo(() => previewQuery.data || [], [previewQuery.data]);
  const confirmacaoValida = confirmacao === CONFIRMACAO_EXATA;

  const mutation = useMutation({
    mutationFn: () => converterMilitaresQbmptParaQptbm(militares),
    onSuccess: async (resultado) => {
      setRelatorio(resultado);
      await invalidarQueriesMilitarEfetivo(queryClient);
      await previewQuery.refetch();
      toast({
        title: 'Saneamento QBMPT → QPTBM finalizado',
        description: `${resultado.totalAtualizado} registro(s) atualizado(s); ${resultado.falhas.length} falha(s).`,
        variant: resultado.falhas.length > 0 ? 'destructive' : undefined,
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha no saneamento QBMPT → QPTBM',
        description: error?.message || 'Erro inesperado ao atualizar Militar.quadro.',
        variant: 'destructive',
      });
    },
  });

  if (!isAdmin) return null;

  const handleOpenChange = (nextOpen) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setConfirmacao('');
      setRelatorio(null);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
        onClick={() => handleOpenChange(true)}
      >
        <Wrench className="w-4 h-4 mr-2" />
        Sanear QBMPT → QPTBM
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-6xl max-h-[92vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#1e3a5f]">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              Saneamento administrativo de quadro legado
            </DialogTitle>
            <DialogDescription>
              Prévia somente leitura de militares com Militar.quadro exatamente igual a "QBMPT". A confirmação atualiza apenas {'{ quadro: "QPTBM" }'}.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
              <div>
                <p className="font-semibold">Ação restrita a administradores.</p>
                <p>Filtro da prévia: <code>{JSON.stringify(QBMPT_LEGADO_FILTRO)}</code>. Payload de update: <code>{JSON.stringify(QBMPT_PARA_QPTBM_PAYLOAD)}</code>.</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <Badge variant="outline">Total encontrado: {militares.length}</Badge>
              {previewQuery.isFetching && <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Atualizando prévia...</span>}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => previewQuery.refetch()} disabled={previewQuery.isFetching || mutation.isPending}>
              <RefreshCw className="h-4 w-4 mr-2" /> Recarregar prévia
            </Button>
          </div>

          {previewQuery.isError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Não foi possível listar os militares QBMPT: {previewQuery.error?.message || 'erro desconhecido'}
            </div>
          ) : (
            <ScrollArea className="h-[42vh] rounded-lg border">
              <Table>
                <TableHeader className="sticky top-0 bg-slate-50">
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Posto/Graduação</TableHead>
                    <TableHead>Nome de guerra</TableHead>
                    <TableHead>Nome completo</TableHead>
                    <TableHead>Matrícula</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Lotação</TableHead>
                    <TableHead>Quadro atual</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-slate-500">
                        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                        Carregando prévia sem alterar dados...
                      </TableCell>
                    </TableRow>
                  ) : militares.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-slate-500">
                        Nenhum militar com quadro bruto QBMPT foi encontrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    militares.map((militar) => (
                      <TableRow key={militar.id}>
                        <TableCell className="max-w-[160px] truncate font-mono text-xs">{militar.id}</TableCell>
                        <TableCell>{militar.posto_graduacao || '—'}</TableCell>
                        <TableCell>{militar.nome_guerra || '—'}</TableCell>
                        <TableCell className="max-w-[220px] truncate">{militar.nome_completo || '—'}</TableCell>
                        <TableCell>{militar.matricula || militar.matricula_atual || '—'}</TableCell>
                        <TableCell>{militar.status_cadastro || '—'}</TableCell>
                        <TableCell className="max-w-[220px] truncate">{militar.lotacao_informativa || 'Sem lotação'}</TableCell>
                        <TableCell><Badge className="bg-amber-100 text-amber-800 border border-amber-200">{militar.quadro || '—'}</Badge></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="confirmacao-qbmpt">
              Digite exatamente: <span className="font-mono text-amber-700">{CONFIRMACAO_EXATA}</span>
            </label>
            <Input
              id="confirmacao-qbmpt"
              value={confirmacao}
              onChange={(event) => setConfirmacao(event.target.value)}
              placeholder={CONFIRMACAO_EXATA}
              disabled={mutation.isPending || militares.length === 0}
            />
          </div>

          {relatorio && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Relatório final</p>
              <p>Total encontrado: {relatorio.totalEncontrado}</p>
              <p>Total atualizado: {relatorio.totalAtualizado}</p>
              <p>Falhas: {relatorio.falhas.length}</p>
              <p className="break-all">IDs atualizados: {relatorio.idsAtualizados.length ? relatorio.idsAtualizados.join(', ') : '—'}</p>
              {relatorio.falhas.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-red-700">
                  {relatorio.falhas.map((falha) => (
                    <li key={falha.id}>{falha.id}: {falha.mensagem}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={mutation.isPending}>Fechar</Button>
            <Button
              type="button"
              className="bg-amber-700 hover:bg-amber-800 text-white"
              disabled={!confirmacaoValida || militares.length === 0 || previewQuery.isFetching || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar saneamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
