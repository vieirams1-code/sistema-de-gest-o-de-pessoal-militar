import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { fetchScopedAtestadosBundle } from '@/services/getScopedAtestadosBundleClient';
import { jisoContextKey, invalidateJisoQueries } from '@/services/jisoService';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { createPageUrl } from '@/utils';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  encaminharAtestadoParaJiso,
  isStatusAtestadoBloqueado,
} from '@/services/atestadosService';
import { formatarDataSegura } from '@/utils/central-pendencias/centralPendencias.helpers';

export default function CentralPendenciaAtestadoModal({
  open,
  onOpenChange,
  pendenciasAtestado = [],
  indiceAtual = 0,
  onSelecionarIndice,
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { canAccessAction, user } = useCurrentUser();
  const indiceSeguro = Number.isInteger(indiceAtual) ? indiceAtual : 0;

  const pendenciaAtual = useMemo(() => {
    if (!pendenciasAtestado.length) return null;
    if (indiceSeguro < 0 || indiceSeguro >= pendenciasAtestado.length) return null;
    return pendenciasAtestado[indiceSeguro];
  }, [indiceSeguro, pendenciasAtestado]);

  const atestadoIdAtual = pendenciaAtual?.atestadoId || null;

  const { data: atestadoDetalhado, refetch: refetchAtestado } = useQuery({
    queryKey: ['atestado-central-modal', atestadoIdAtual, jisoContextKey(user?.email)],
    queryFn: async () => {
      if (!atestadoIdAtual) return null;
      const bundle = await fetchScopedAtestadosBundle();
      return bundle.atestados.find(item => item.id === atestadoIdAtual) || null;
    },
    enabled: open && Boolean(atestadoIdAtual),
    staleTime: 0,
  });

  const atestadoView = useMemo(() => {
    if (!pendenciaAtual) return null;
    return {
      ...pendenciaAtual,
      statusAtestado: atestadoDetalhado?.status_jiso || atestadoDetalhado?.status || pendenciaAtual.statusAtestado,
      necessitaHomologacaoJiso: atestadoDetalhado?.jiso_id_derivado ? 'JISO vinculada' : 'Sem JISO vinculada',
      observacoesAtestado: atestadoDetalhado?.observacoes || pendenciaAtual.observacoesAtestado,
    };
  }, [atestadoDetalhado, pendenciaAtual]);

  const atestadoBloqueado = isStatusAtestadoBloqueado({
    statusJiso: atestadoDetalhado?.status_jiso || atestadoView?.statusAtestado,
    status: atestadoDetalhado?.status,
  });

  const jisoId = atestadoDetalhado?.jiso_id_derivado || atestadoDetalhado?.jiso_id;
  const podeEncaminharParaJiso = Boolean(atestadoIdAtual && atestadoDetalhado && !atestadoBloqueado && !atestadoDetalhado.jiso_vinculo_ativo && canAccessAction('gerir_jiso'));

  const linkModuloCompleto = useMemo(() => {
    if (!pendenciaAtual) return '';
    if (jisoId) return createPageUrl('EditarJISO') + '?jiso_id=' + jisoId;
    if (pendenciaAtual.atestadoId) {
      return `${createPageUrl('VerAtestado')}?id=${pendenciaAtual.atestadoId}`;
    }
    return pendenciaAtual.origemLink || '';
  }, [pendenciaAtual, jisoId]);

  const sincronizarCentralEAberto = async () => {
    await invalidateJisoQueries(queryClient);
    await queryClient.invalidateQueries({ queryKey: ['central-pendencias'] });
    if (atestadoIdAtual) {
      await queryClient.invalidateQueries({ queryKey: ['atestado-central-modal', atestadoIdAtual] });
      await queryClient.invalidateQueries({ queryKey: ['atestado', atestadoIdAtual] });
    }
    await refetchAtestado();
  };

  const encaminharJisoMutation = useMutation({
    mutationFn: async () => {
      if (!atestadoDetalhado?.id) throw new Error('Atestado não carregado para encaminhamento.');
      await encaminharAtestadoParaJiso(atestadoDetalhado);
    },
    onSuccess: async () => {
      await sincronizarCentralEAberto();
      toast({ title: 'Encaminhado para JISO', description: 'Fluxo operacional atualizado na Central.' });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao encaminhar para JISO',
        description: error?.message || 'Não foi possível concluir a ação.',
        variant: 'destructive',
      });
    },
  });

  const emAcao = encaminharJisoMutation.isPending;

  const navegar = (direcao) => {
    const proximoIndice = indiceSeguro + direcao;
    if (proximoIndice < 0 || proximoIndice >= pendenciasAtestado.length) return;
    if (typeof onSelecionarIndice === 'function') onSelecionarIndice(proximoIndice);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Análise de pendência de atestado</DialogTitle>
          <DialogDescription>
            Analise esta pendência sem sair da Central.
          </DialogDescription>
        </DialogHeader>

        {!atestadoView ? (
          <div className="text-sm text-slate-600">Nenhuma pendência de atestado disponível.</div>
        ) : (
          <div className="space-y-3 overflow-auto pr-1">
            <p className="text-xs text-slate-500">
              Pendência {indiceSeguro + 1} de {pendenciasAtestado.length}
            </p>

            <div className="rounded-lg border border-slate-200 p-4 space-y-2">
              <h4 className="font-semibold text-slate-800">{atestadoView.militar || '—'}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-slate-700">
                <p><strong>Matrícula:</strong> {atestadoView.militarMatricula || '—'}</p>
                <p><strong>Tipo de atestado:</strong> {atestadoView.tipoAtestado || atestadoView.titulo || '—'}</p>
                <p><strong>Data inicial:</strong> {formatarDataSegura(atestadoView.dataInicial)}</p>
                <p><strong>Data final:</strong> {formatarDataSegura(atestadoView.dataFinal || atestadoView.dataReferencia)}</p>
                <p><strong>Quantidade de dias:</strong> {atestadoView.quantidadeDias || '—'}</p>
                <p><strong>Situação/Status:</strong> {atestadoView.statusAtestado || atestadoView.situacao || '—'}</p>
                <p><strong>Necessidade de homologação/JISO:</strong> {atestadoView.necessitaHomologacaoJiso || '—'}</p>
                <p><strong>Origem do registro:</strong> {atestadoView.origemRegistro || atestadoView.origem || '—'}</p>
              </div>

              <p className="text-sm text-slate-700"><strong>Observações:</strong> {atestadoView.observacoesAtestado || '—'}</p>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                {podeEncaminharParaJiso ? (
                  <Button
                    type="button"
                    variant="default"
                    onClick={() => encaminharJisoMutation.mutate()}
                    disabled={emAcao}
                    className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
                  >
                    {encaminharJisoMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Encaminhar para JISO
                  </Button>
                ) : null}

                {linkModuloCompleto ? (
                  <Link to={linkModuloCompleto} className="text-xs text-[#1e3a5f] underline">
                    Abrir no módulo completo
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="justify-between sm:justify-between">
          <div className="w-full flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => navegar(-1)} disabled={indiceSeguro <= 0 || emAcao}>
                Pendência anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navegar(1)}
                disabled={indiceSeguro >= pendenciasAtestado.length - 1 || emAcao}
              >
                Próxima pendência
              </Button>
            </div>

            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={emAcao}>
              Fechar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
