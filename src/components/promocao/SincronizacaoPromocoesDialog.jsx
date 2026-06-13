import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, History, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { diagnosticarDivergenciasGraduacoes, executarSincronizacaoGraduacoes, dataFormatada } from '@/services/promocaoService';

export default function SincronizacaoPromocoesDialog({ open, onOpenChange }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [etapa, setEtapa] = useState('preview'); // 'preview', 'summary'
  const [resultadoExecucao, setResultadoExecucao] = useState(null);

  const previewQuery = useQuery({
    queryKey: ['sincronizacao-promocoes-preview'],
    queryFn: diagnosticarDivergenciasGraduacoes,
    enabled: open && etapa === 'preview',
    staleTime: 0,
  });

  const syncMutation = useMutation({
    mutationFn: executarSincronizacaoGraduacoes,
    onSuccess: (data) => {
      setResultadoExecucao(data);
      setEtapa('summary');
      queryClient.invalidateQueries({ queryKey: ['promocoes-operacionais'] });
      queryClient.invalidateQueries({ queryKey: ['promocoes-operacionais-militares'] });
      queryClient.invalidateQueries({ queryKey: ['militares-consulta-rapida-scoped'] });
      queryClient.invalidateQueries({ queryKey: ['gestor-efetivo-militares'] });
      queryClient.invalidateQueries({ queryKey: ['gestor-efetivo-lotacoes'] });
      queryClient.invalidateQueries({ queryKey: ['militar'] });
      toast({ title: 'Sincronização concluída', description: 'Os cadastros militares foram atualizados com sucesso.' });
    },
    onError: (error) => {
      toast({ title: 'Erro na sincronização', description: error.message, variant: 'destructive' });
    },
  });

  const divergencias = previewQuery.data?.resumo?.divergencias || [];
  const resumo = previewQuery.data?.resumo || {};

  const handleSincronizar = () => {
    if (window.confirm('Deseja realmente sincronizar as graduações? Esta ação atualizará o cadastro principal dos militares com base na promoção mais recente.')) {
      syncMutation.mutate();
    }
  };

  const handleClose = () => {
    setEtapa('preview');
    setResultadoExecucao(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#1e3a5f]">
            <History className="w-5 h-5 text-blue-600" />
            Sincronização de Graduações Atuais
          </DialogTitle>
          <DialogDescription>
            Ajuste automático do cadastro principal do militar com base na última promoção publicada oficialmente (Histórico V2).
          </DialogDescription>
        </DialogHeader>

        {etapa === 'preview' && (
          <div className="flex-1 overflow-hidden flex flex-col space-y-4">
            <Alert className="bg-blue-50 border-blue-200">
              <ShieldAlert className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-800">Modo de Diagnóstico</AlertTitle>
              <AlertDescription className="text-blue-700">
                Abaixo estão listados os militares cujo cadastro atual difere da promoção publicada mais recente.
                Nenhuma alteração foi feita ainda.
              </AlertDescription>
            </Alert>

            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Badge variant="outline" className="bg-slate-50">Analisados: {resumo.analisados || 0}</Badge>
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Divergências: {divergencias.length}</Badge>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Compatíveis: {resumo.compativeis || 0}</Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => previewQuery.refetch()}
                disabled={previewQuery.isFetching}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${previewQuery.isFetching ? 'animate-spin' : ''}`} />
                Atualizar Preview
              </Button>
            </div>

            <ScrollArea className="flex-1 rounded-lg border border-slate-200">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                  <TableRow>
                    <TableHead>Militar</TableHead>
                    <TableHead>Matrícula</TableHead>
                    <TableHead>Cadastro Atual</TableHead>
                    <TableHead>Última Promoção</TableHead>
                    <TableHead>Data Promoção</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center text-slate-500">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                        Analisando promoções e cadastros...
                      </TableCell>
                    </TableRow>
                  ) : divergencias.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center text-slate-500">
                        Nenhuma divergência encontrada. Todos os militares com promoção publicada estão com cadastro compatível.
                      </TableCell>
                    </TableRow>
                  ) : (
                    divergencias.map((div, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{div.nome}</TableCell>
                        <TableCell className="text-slate-500">{div.matricula}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-normal">
                            {div.posto_anterior} / {div.quadro_anterior}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                            {div.posto_novo} / {div.quadro_novo}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{dataFormatada(div.data_promocao)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        {etapa === 'summary' && resultadoExecucao && (
          <div className="flex-1 space-y-6 py-4">
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Sincronização Finalizada</h3>
              <p className="text-slate-500">O processo foi concluído com sucesso.</p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-50 rounded-xl p-4 text-center border border-slate-100">
                <p className="text-sm text-slate-500 uppercase font-semibold">Analisados</p>
                <p className="text-3xl font-bold text-slate-900">{resultadoExecucao.resumo?.analisados || 0}</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4 text-center border border-green-100">
                <p className="text-sm text-green-600 uppercase font-semibold">Atualizados</p>
                <p className="text-3xl font-bold text-green-700">{resultadoExecucao.resumo?.atualizados || 0}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 text-center border border-slate-100">
                <p className="text-sm text-slate-500 uppercase font-semibold">Ignorados</p>
                <p className="text-3xl font-bold text-slate-900">{resultadoExecucao.resumo?.ignorados || 0}</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-900">Nota sobre registros ignorados</p>
                <p className="text-xs text-amber-800 mt-1">
                  Militares sem nenhuma promoção publicada ou com cadastro atual superior à última promoção encontrada foram ignorados para evitar inconsistências ou rebaixamentos indevidos.
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="border-t pt-4">
          {etapa === 'preview' ? (
            <>
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button
                onClick={handleSincronizar}
                disabled={divergencias.length === 0 || syncMutation.isPending}
                className="bg-blue-700 hover:bg-blue-800"
              >
                {syncMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sincronizar {divergencias.length} divergências
              </Button>
            </>
          ) : (
            <Button onClick={handleClose} className="w-full">Fechar Resumo</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
