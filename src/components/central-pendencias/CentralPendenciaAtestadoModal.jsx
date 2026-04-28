import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { createPageUrl } from '@/utils';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  encaminharAtestadoParaJiso,
  isStatusAtestadoBloqueado,
  marcarAtestadoJisoEmAnalise,
} from '@/services/atestadosService';
import { formatarDataSegura } from '@/utils/central-pendencias/centralPendencias.helpers';

function normalizarTexto(valor) {
  return String(valor || '').trim().toLowerCase();
}

export default function CentralPendenciaAtestadoModal({
  open,
  onOpenChange,
  pendenciasAtestado = [],
  indiceAtual = 0,
  onSelecionarIndice,
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { canAccessAction } = useCurrentUser();
  const indiceSeguro = Number.isInteger(indiceAtual) ? indiceAtual : 0;

  const pendenciaAtual = useMemo(() => {
    if (!pendenciasAtestado.length) return null;
    if (indiceSeguro < 0 || indiceSeguro >= pendenciasAtestado.length) return null;
    return pendenciasAtestado[indiceSeguro];
  }, [indiceSeguro, pendenciasAtestado]);

  const atestadoIdAtual = pendenciaAtual?.atestadoId || null;

  const { data: atestadoDetalhado, refetch: refetchAtestado } = useQuery({
    queryKey: ['atestado-central-modal', atestadoIdAtual],
    queryFn: async () => {
      if (!atestadoIdAtual) return null;
      const rows = await base44.entities.Atestado.filter({ id: atestadoIdAtual });
      return rows?.[0] || null;
    },
    enabled: open && Boolean(atestadoIdAtual),
    staleTime: 0,
  });

  const atestadoView = useMemo(() => {
    if (!pendenciaAtual) return null;
    return {
      ...pendenciaAtual,
      statusAtestado: atestadoDetalhado?.status_jiso || atestadoDetalhado?.status || pendenciaAtual.statusAtestado,
      necessitaHomologacaoJiso: atestadoDetalhado?.necessita_jiso ? 'Sim' : pendenciaAtual.necessitaHomologacaoJiso,
      observacoesAtestado: atestadoDetalhado?.observacoes || pendenciaAtual.observacoesAtestado,
    };
  }, [atestadoDetalhado, pendenciaAtual]);

  const statusJisoNormalizado = normalizarTexto(atestadoDetalhado?.status_jiso || atestadoView?.statusAtestado);
  const atestadoBloqueado = isStatusAtestadoBloqueado({
    statusJiso: atestadoDetalhado?.status_jiso || atestadoView?.statusAtestado,
    status: atestadoDetalhado?.status,
  });

  const precisaFluxoJiso = Boolean(
    atestadoDetalhado?.necessita_jiso
    || normalizarTexto(atestadoDetalhado?.fluxo_homologacao).includes('jiso')
    || Number(atestadoDetalhado?.dias || atestadoView?.quantidadeDias || 0) > 15
  );

  const jaEncaminhadoParaJiso = Boolean(
    atestadoDetalhado?.data_jiso_agendada
    || atestadoDetalhado?.jiso_id
    || statusJisoNormalizado.includes('aguardando jiso')
    || statusJisoNormalizado.includes('homologado pela jiso')
    || statusJisoNormalizado.includes('em análise')
  );

  const podeEncaminharParaJiso = Boolean(
    atestadoIdAtual
    && atestadoDetalhado
    && !atestadoBloqueado
    && precisaFluxoJiso
    && !jaEncaminhadoParaJiso
    && (canAccessAction('registrar_decisao_jiso') || canAccessAction('gerir_jiso'))
  );

  const existeStatusLeve = atestadoDetalhado && Object.prototype.hasOwnProperty.call(atestadoDetalhado, 'status_jiso');

  const podeMarcarComoAnalisado = Boolean(
    atestadoIdAtual
    && existeStatusLeve
    && !atestadoBloqueado
    && !statusJisoNormalizado.includes('em análise')
    && (canAccessAction('editar_atestados') || canAccessAction('registrar_decisao_jiso') || canAccessAction('gerir_jiso'))
  );

  const linkModuloCompleto = useMemo(() => {
    if (!pendenciaAtual) return '';
    if (pendenciaAtual.atestadoId) {
      return `${createPageUrl('VerAtestado')}?id=${pendenciaAtual.atestadoId}`;
    }
    return pendenciaAtual.origemLink || '';
  }, [pendenciaAtual]);

  const sincronizarCentralEAberto = async () => {
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

  const marcarAnalisadoMutation = useMutation({
    mutationFn: async () => {
      if (!atestadoDetalhado?.id) throw new Error('Atestado não carregado para marcação.');
      await marcarAtestadoJisoEmAnalise(atestadoDetalhado);
    },
    onSuccess: async () => {
      await sincronizarCentralEAberto();
      toast({ title: 'Atestado marcado como analisado', description: 'Status leve atualizado com sucesso.' });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao marcar como analisado',
        description: error?.message || 'Não foi possível concluir a ação.',
        variant: 'destructive',
      });
    },
  });

  const emAcao = encaminharJisoMutation.isPending || marcarAnalisadoMutation.isPending;

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

                {podeMarcarComoAnalisado ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => marcarAnalisadoMutation.mutate()}
                    disabled={emAcao}
                  >
                    {marcarAnalisadoMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Marcar como analisado
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
