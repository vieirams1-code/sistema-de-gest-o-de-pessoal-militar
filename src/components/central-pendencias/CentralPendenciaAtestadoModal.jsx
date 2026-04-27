import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatarDataSegura } from '@/utils/central-pendencias/centralPendencias.helpers';

export default function CentralPendenciaAtestadoModal({
  open,
  onOpenChange,
  pendenciasAtestado = [],
  indiceAtual = 0,
  onSelecionarIndice,
}) {
  const indiceSeguro = Number.isInteger(indiceAtual) ? indiceAtual : 0;

  const pendenciaAtual = useMemo(() => {
    if (!pendenciasAtestado.length) return null;
    if (indiceSeguro < 0 || indiceSeguro >= pendenciasAtestado.length) return null;
    return pendenciasAtestado[indiceSeguro];
  }, [indiceSeguro, pendenciasAtestado]);

  const linkModuloCompleto = useMemo(() => {
    if (!pendenciaAtual) return '';
    if (pendenciaAtual.atestadoId) {
      return `${createPageUrl('VerAtestado')}?id=${pendenciaAtual.atestadoId}`;
    }
    return pendenciaAtual.origemLink || '';
  }, [pendenciaAtual]);

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

        {!pendenciaAtual ? (
          <div className="text-sm text-slate-600">Nenhuma pendência de atestado disponível.</div>
        ) : (
          <div className="space-y-3 overflow-auto pr-1">
            <p className="text-xs text-slate-500">
              Pendência {indiceSeguro + 1} de {pendenciasAtestado.length}
            </p>

            <div className="rounded-lg border border-slate-200 p-4 space-y-2">
              <h4 className="font-semibold text-slate-800">{pendenciaAtual.militar || '—'}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-slate-700">
                <p><strong>Matrícula:</strong> {pendenciaAtual.militarMatricula || '—'}</p>
                <p><strong>Tipo de atestado:</strong> {pendenciaAtual.tipoAtestado || pendenciaAtual.titulo || '—'}</p>
                <p><strong>Data inicial:</strong> {formatarDataSegura(pendenciaAtual.dataInicial)}</p>
                <p><strong>Data final:</strong> {formatarDataSegura(pendenciaAtual.dataFinal || pendenciaAtual.dataReferencia)}</p>
                <p><strong>Quantidade de dias:</strong> {pendenciaAtual.quantidadeDias || '—'}</p>
                <p><strong>Situação/Status:</strong> {pendenciaAtual.statusAtestado || pendenciaAtual.situacao || '—'}</p>
                <p><strong>Necessidade de homologação/JISO:</strong> {pendenciaAtual.necessitaHomologacaoJiso || '—'}</p>
                <p><strong>Origem do registro:</strong> {pendenciaAtual.origemRegistro || pendenciaAtual.origem || '—'}</p>
              </div>

              <p className="text-sm text-slate-700"><strong>Observações:</strong> {pendenciaAtual.observacoesAtestado || '—'}</p>

              {linkModuloCompleto ? (
                <Link to={linkModuloCompleto} className="text-xs text-[#1e3a5f] underline">
                  Abrir no módulo completo
                </Link>
              ) : null}
            </div>
          </div>
        )}

        <DialogFooter className="justify-between sm:justify-between">
          <div className="w-full flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => navegar(-1)} disabled={indiceSeguro <= 0}>
                Pendência anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navegar(1)}
                disabled={indiceSeguro >= pendenciasAtestado.length - 1}
              >
                Próxima pendência
              </Button>
            </div>

            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
