import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatarDataSegura } from '@/utils/central-pendencias/centralPendencias.helpers';

function ResultadoAplicacao({ resultado }) {
  if (!resultado) return null;

  return (
    <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
      <p className="font-medium">
        Aplicadas: {resultado.totalAplicadas || 0} | Ignoradas: {resultado.totalIgnoradas || 0} | Falhas: {resultado.totalFalhas || 0}
      </p>
    </div>
  );
}

export default function CentralPendenciaActionModal({
  open,
  onOpenChange,
  item,
}) {
  const pendencias = useMemo(() => (Array.isArray(item?.pendenciasComportamento) ? item.pendenciasComportamento : []), [item]);
  const [pendenciaSelecionadaId, setPendenciaSelecionadaId] = useState(null);
  const [loadingAplicacao, setLoadingAplicacao] = useState(false);
  const [erroAplicacao, setErroAplicacao] = useState('');
  const [resultadoAplicacao, setResultadoAplicacao] = useState(null);

  const indiceSelecionado = useMemo(
    () => pendencias.findIndex((pendencia) => pendencia.id === pendenciaSelecionadaId),
    [pendencias, pendenciaSelecionadaId]
  );

  const pendenciaSelecionada = indiceSelecionado >= 0 ? pendencias[indiceSelecionado] : null;

  useEffect(() => {
    if (!open) {
      setPendenciaSelecionadaId(null);
      setErroAplicacao('');
      setResultadoAplicacao(null);
      setLoadingAplicacao(false);
    }
  }, [open]);

  const abrirDetalhe = (pendenciaId) => {
    setErroAplicacao('');
    setResultadoAplicacao(null);
    setPendenciaSelecionadaId(pendenciaId);
  };

  const fecharDetalhe = () => {
    setErroAplicacao('');
    setResultadoAplicacao(null);
    setPendenciaSelecionadaId(null);
  };

  const navegarDetalhe = (direcao) => {
    if (!pendencias.length || indiceSelecionado < 0) return;
    const novoIndice = indiceSelecionado + direcao;
    if (novoIndice < 0 || novoIndice >= pendencias.length) return;
    setErroAplicacao('');
    setResultadoAplicacao(null);
    setPendenciaSelecionadaId(pendencias[novoIndice].id);
  };

  const aplicarPendencia = async () => {
    if (!pendenciaSelecionada?.id || typeof item?.aoAplicarPendenciaComportamento !== 'function') return;

    const confirmar = window.confirm('Aplicar mudança de comportamento deste militar?');
    if (!confirmar) return;

    setLoadingAplicacao(true);
    setErroAplicacao('');
    setResultadoAplicacao(null);

    try {
      const resultado = await item.aoAplicarPendenciaComportamento({ pendenciaId: pendenciaSelecionada.id });
      setResultadoAplicacao(resultado || {});
    } catch (e) {
      setErroAplicacao(e?.message || 'Falha ao aplicar esta pendência.');
    } finally {
      setLoadingAplicacao(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Fila de pendências de comportamento</DialogTitle>
          <DialogDescription>
            Analise as pendências individualmente sem sair da Central.
          </DialogDescription>
        </DialogHeader>

        {!pendenciaSelecionada ? (
          <div className="space-y-3 overflow-auto pr-1">
            <p className="text-sm text-slate-700">
              Total de pendências: <strong>{pendencias.length}</strong>
            </p>
            <div className="space-y-2">
              {pendencias.map((pendencia) => (
                <article key={pendencia.id} className="rounded-lg border border-slate-200 p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-800">{pendencia.militarNome}</p>
                    <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700">{pendencia.status || 'Pendente'}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-xs text-slate-600">
                    <p><strong>Comportamento atual:</strong> {pendencia.comportamentoAtual}</p>
                    <p><strong>Comportamento sugerido:</strong> {pendencia.comportamentoSugerido}</p>
                    <p><strong>Data de referência:</strong> {formatarDataSegura(pendencia.dataReferencia)}</p>
                    <p><strong>Status:</strong> {pendencia.status || 'Pendente'}</p>
                  </div>
                  {pendencia.divergencia ? (
                    <p className="text-xs text-amber-700 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Divergência entre comportamento atual e sugerido.
                    </p>
                  ) : null}
                  <Button type="button" size="sm" onClick={() => abrirDetalhe(pendencia.id)}>
                    Analisar
                  </Button>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3 overflow-auto pr-1">
            <p className="text-xs text-slate-500">
              Pendência {indiceSelecionado + 1} de {pendencias.length}
            </p>
            <div className="rounded-lg border border-slate-200 p-4 space-y-2">
              <h4 className="font-semibold text-slate-800">{pendenciaSelecionada.militarNome}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-slate-700">
                <p><strong>Matrícula:</strong> {pendenciaSelecionada.matricula || '—'}</p>
                <p><strong>Status:</strong> {pendenciaSelecionada.status || 'Pendente'}</p>
                <p><strong>Comportamento atual:</strong> {pendenciaSelecionada.comportamentoAtual}</p>
                <p><strong>Comportamento sugerido:</strong> {pendenciaSelecionada.comportamentoSugerido}</p>
                <p><strong>Data de detecção:</strong> {formatarDataSegura(pendenciaSelecionada.dataDeteccao)}</p>
                <p><strong>Origem:</strong> {pendenciaSelecionada.origem || '—'}</p>
              </div>
              <p className="text-sm text-slate-700"><strong>Justificativa/Cálculo:</strong> {pendenciaSelecionada.justificativa || pendenciaSelecionada.calculoResumo || '—'}</p>
              <p className="text-sm text-slate-700"><strong>Observações relevantes:</strong> {pendenciaSelecionada.observacoes || '—'}</p>

              <Link to="/AvaliacaoComportamento" className="text-xs text-[#1e3a5f] underline">
                Abrir no módulo completo
              </Link>

              {erroAplicacao ? (
                <div className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                  {erroAplicacao}
                </div>
              ) : null}

              <ResultadoAplicacao resultado={resultadoAplicacao} />
            </div>
          </div>
        )}

        <DialogFooter className="justify-between sm:justify-between">
          {!pendenciaSelecionada ? (
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          ) : (
            <div className="w-full flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => navegarDetalhe(-1)} disabled={indiceSelecionado <= 0 || loadingAplicacao}>
                  Anterior
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navegarDetalhe(1)}
                  disabled={indiceSelecionado < 0 || indiceSelecionado >= pendencias.length - 1 || loadingAplicacao}
                >
                  Próxima
                </Button>
              </div>

              <div className="flex items-center gap-2">
                {item?.podeAplicarComportamentoIndividual ? (
                  <>
                    <Button type="button" onClick={aplicarPendencia} disabled={loadingAplicacao}>
                      {loadingAplicacao ? 'Aplicando...' : 'Aplicar esta pendência'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navegarDetalhe(1)}
                      disabled={indiceSelecionado < 0 || indiceSelecionado >= pendencias.length - 1 || loadingAplicacao}
                    >
                      Próxima pendência
                    </Button>
                  </>
                ) : null}
                <Button type="button" variant="outline" onClick={fecharDetalhe} disabled={loadingAplicacao}>
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
