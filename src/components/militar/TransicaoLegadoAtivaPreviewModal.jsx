import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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
import { Label } from '@/components/ui/label';
import { previsualizarTransicaoLegadoAtiva } from '@/services/transicaoLegadoAtivaClient';
import { arquivarPeriodosDesignacaoEmBloco } from '@/services/arquivarPeriodosDesignacaoEmBlocoClient';

const CONFIRMACAO_TEXTUAL = 'ARQUIVAR PERÍODOS DA ATIVA';

function formatDate(date) {
  if (!date) return '—';
  try { return new Date(`${String(date).slice(0, 10)}T00:00:00`).toLocaleDateString('pt-BR'); } catch (_e) { return date; }
}

function ListaPeriodos({ titulo, itens = [], vazio, renderExtra }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h4 className="font-semibold text-slate-800">{titulo}</h4>
        <Badge variant="outline">{itens.length}</Badge>
      </div>
      {itens.length === 0 ? (
        <p className="text-sm text-slate-500">{vazio}</p>
      ) : (
        <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
          {itens.map((item, index) => (
            <div key={item.id || `${titulo}-${index}`} className="rounded-md border border-slate-100 bg-slate-50 p-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-slate-800">{item.ano_referencia || item.periodo_ref || item.id || 'Período sem referência'}</span>
                {item.status && <Badge variant="secondary">{item.status}</Badge>}
                {item.motivo && <Badge variant="outline">{item.motivo}</Badge>}
                {item.codigo && <Badge variant="outline">{item.codigo}</Badge>}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Fim aquisitivo: {formatDate(item.fim_aquisitivo)} • Saldo: {item.dias_saldo ?? 0} dia(s)
              </p>
              {renderExtra?.(item)}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function RelatorioAplicacao({ resultado }) {
  if (!resultado) return null;
  const resumo = resultado.resumo || resultado.totais || {};
  const detalhes = Array.isArray(resultado.detalhes) ? resultado.detalhes : [];
  const warnings = resultado.meta?.warnings || [];

  return (
    <section className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
      <div className="flex items-start gap-2 text-emerald-900">
        <CheckCircle2 className="h-4 w-4 mt-0.5" />
        <div>
          <h4 className="font-semibold">Legado da Ativa: Aplicado.</h4>
          <p className="text-sm">
            Arquivados: {resumo.arquivados || 0} • Cancelados: {resumo.cancelados || 0} • Já processados: {resumo.ja_processados || 0} • Ignorados: {resumo.ignorados || 0}
          </p>
          {warnings.length > 0 && <p className="text-xs mt-1">Avisos: {warnings.join(', ')}</p>}
        </div>
      </div>

      <div className="rounded-lg border border-emerald-100 bg-white p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h4 className="font-semibold text-slate-800">Detalhes do arquivamento lógico</h4>
          <Badge variant="outline">{detalhes.length}</Badge>
        </div>
        {detalhes.length === 0 ? <p className="text-sm text-slate-500">Nenhum detalhe retornado.</p> : (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {detalhes.map((item, index) => (
              <div key={item.id || `${item.acao || 'detalhe'}-${index}`} className="rounded-md border border-slate-100 bg-slate-50 p-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-800">{item.ano_referencia || item.periodo_aquisitivo_ref || item.id || 'Período sem referência'}</span>
                  <Badge variant="secondary">{item.acao || 'sem ação'}</Badge>
                  {item.status && <Badge variant="outline">{item.status}</Badge>}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {formatDate(item.inicio_aquisitivo)} a {formatDate(item.fim_aquisitivo)}{item.motivo ? ` • ${item.motivo}` : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function CabecalhoPreview({ preview, resumo = {} }) {
  return (
    <section className="space-y-3">
      <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-xs font-medium text-slate-500">Militar</p>
          <p className="truncate font-semibold text-slate-800">{preview.militar?.nome || '—'}</p>
          <p className="truncate text-xs text-slate-500">Matrícula {preview.militar?.matricula || '—'}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-xs font-medium text-slate-500">Contrato</p>
          <p className="truncate font-semibold text-slate-800">{preview.contrato?.numero_contrato || 'Sem número'}</p>
          <p className="truncate text-xs text-slate-500">Início {formatDate(preview.contrato?.data_inicio_contrato)}</p>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-xs font-medium text-blue-600">Nova data-base</p>
          <p className="font-semibold text-blue-900">{formatDate(preview.data_base)}</p>
          <p className="text-xs text-blue-700">Contrato de designação</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-xs font-medium text-slate-500">Períodos analisados</p>
          <p className="font-semibold text-slate-800">{resumo.total || 0}</p>
          <p className="text-xs text-slate-500">Cancelados {resumo.cancelar_periodo_futuro_indevido || 0} • Legado {resumo.marcar_legado_ativa || 0} • Mantidos {resumo.manter || 0}</p>
        </div>
      </div>
    </section>
  );
}

export default function TransicaoLegadoAtivaPreviewModal({ open, onOpenChange, militarId, contrato, contratoAtivo, contratoDesignacaoId }) {
  const queryClient = useQueryClient();
  const contratoPreview = contrato || contratoAtivo || null;
  const contratoId = contratoDesignacaoId || contratoPreview?.id;
  const [preview, setPreview] = useState(null);
  const [resultadoAplicacao, setResultadoAplicacao] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [confirmacaoTextual, setConfirmacaoTextual] = useState('');
  const [confirmacaoManualAberta, setConfirmacaoManualAberta] = useState(false);

  useEffect(() => {
    let active = true;
    async function carregarPreview() {
      if (!open || !militarId || !contratoId) return;
      setLoading(true);
      setError('');
      setPreview(null);
      setResultadoAplicacao(null);
      setConfirmacaoTextual('');
      setConfirmacaoManualAberta(false);
      try {
        const data = await previsualizarTransicaoLegadoAtiva({ militarId, contratoDesignacaoId: contratoId });
        if (active) {
          setPreview(data);
        }
      } catch (err) {
        if (active) setError(err?.message || 'Erro ao carregar prévia da transição.');
      } finally {
        if (active) setLoading(false);
      }
    }
    carregarPreview();
    return () => { active = false; };
  }, [open, militarId, contratoId]);

  const totais = preview?.totais || {};
  const periodos = preview?.periodos || [];
  const usaFluxoPorPeriodo = periodos.length > 0;
  const resumoDecisoes = useMemo(() => ({
    total: periodos.length,
    cancelar_periodo_futuro_indevido: periodos.filter((item) => String(item?.acaoSugerida || item?.acao_sugerida || '').includes('cancelar')).length,
    marcar_legado_ativa: periodos.filter((item) => String(item?.acaoSugerida || item?.acao_sugerida || '').includes('legado')).length,
    manter: periodos.filter((item) => String(item?.acaoSugerida || item?.acao_sugerida || '').includes('manter')).length,
  }), [periodos]);
  const riscosBloqueantes = useMemo(() => (preview?.riscos || []).filter((risco) => risco.bloqueante), [preview?.riscos]);
  const candidatosAplicaveis = usaFluxoPorPeriodo || Number(totais.candidatos || 0) > 0;
  const podeAplicarArquivamento = confirmacaoTextual === CONFIRMACAO_TEXTUAL && candidatosAplicaveis && riscosBloqueantes.length === 0 && !applying;
  const motivoBloqueioAplicacao = riscosBloqueantes.length > 0
    ? 'Há riscos bloqueantes na prévia recalculada.'
    : !candidatosAplicaveis
      ? 'Não há períodos da cadeia antiga para arquivar/cancelar.'
      : confirmacaoTextual !== CONFIRMACAO_TEXTUAL
        ? `Digite exatamente ${CONFIRMACAO_TEXTUAL}.`
        : '';

  const riscosPorPeriodo = useMemo(() => {
    const mapa = new Map();
    (preview?.riscos || []).forEach((risco) => {
      const key = risco.periodo_id || risco.periodo_ref || 'sem_periodo';
      if (!mapa.has(key)) mapa.set(key, []);
      mapa.get(key).push(risco);
    });
    return mapa;
  }, [preview?.riscos]);

  async function invalidarQueriesRelacionadas() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['ver-contratos-designacao', militarId] }),
      queryClient.invalidateQueries({ queryKey: ['ver-periodos', militarId] }),
      queryClient.invalidateQueries({ queryKey: ['ver-ferias', militarId] }),
      queryClient.invalidateQueries({ queryKey: ['militar', militarId] }),
      queryClient.invalidateQueries({ queryKey: ['painel-contratos-designacao'] }),
      queryClient.invalidateQueries({ queryKey: ['pa-bundle'] }),
      queryClient.invalidateQueries({ queryKey: ['periodos-aquisitivos'] }),
      queryClient.invalidateQueries({ queryKey: ['periodos-existentes'] }),
    ]);
  }

  async function handleAplicarArquivamento() {
    if (!podeAplicarArquivamento) return;
    setApplying(true);
    setError('');
    try {
      const resultado = await arquivarPeriodosDesignacaoEmBloco({
        militarId,
        contratoDesignacaoId: contratoId,
        confirmar: true,
      });
      setResultadoAplicacao(resultado);
      setConfirmacaoManualAberta(false);
      await invalidarQueriesRelacionadas();
    } catch (err) {
      const status = err?.status ? ` (${err.status})` : '';
      setError(`${err?.message || 'Erro ao arquivar períodos da ativa.'}${status}`);
      if (err?.body) setResultadoAplicacao(err.body);
    } finally {
      setApplying(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>Prévia da transição para Legado da Ativa</DialogTitle>
          <DialogDescription>
            Relatório de elegibilidade do contrato ativo e preparação local das decisões por período.
          </DialogDescription>
        </DialogHeader>

        <Alert className="border-blue-200 bg-blue-50 text-blue-900">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Preservação histórica e aplicação futura</AlertTitle>
          <AlertDescription>
            As ações planejadas não apagarão períodos, férias, saldos ou publicações. O período permanecerá auditável; apenas seu papel operacional na cadeia de designação será ajustado no lote de aplicação.
          </AlertDescription>
        </Alert>

        {loading && (
          <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-600 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando prévia...
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Não foi possível concluir a operação</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {preview && (
          <div className="space-y-4">
            <CabecalhoPreview preview={preview} resumo={resumoDecisoes} />

            {usaFluxoPorPeriodo ? (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <ListaPeriodos
                    titulo="Períodos anteriores a arquivar como legado"
                    itens={periodos.filter((item) => String(item?.acaoSugerida || item?.acao_sugerida || '').includes('legado'))}
                    vazio="Nenhum período anterior identificado."
                    renderExtra={(item) => <p className="mt-1 text-xs text-slate-500">Ação: {item.acaoSugerida || item.acao_sugerida || 'marcar_legado_ativa'}</p>}
                  />
                  <ListaPeriodos
                    titulo="Períodos futuros indevidos a cancelar"
                    itens={periodos.filter((item) => String(item?.acaoSugerida || item?.acao_sugerida || '').includes('cancelar'))}
                    vazio="Nenhum período futuro indevido identificado."
                    renderExtra={(item) => <p className="mt-1 text-xs text-slate-500">Ação: {item.acaoSugerida || item.acao_sugerida || 'cancelar_futuro_indevido'}</p>}
                  />
                </div>
                <section className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <Label htmlFor="confirmacao-legado-ativa-manual">Confirmação textual obrigatória</Label>
                  <Input
                    id="confirmacao-legado-ativa-manual"
                    value={confirmacaoTextual}
                    onChange={(event) => setConfirmacaoTextual(event.target.value)}
                    placeholder={CONFIRMACAO_TEXTUAL}
                    disabled={applying || Boolean(resultadoAplicacao?.ok)}
                  />
                  <p className="text-xs text-slate-500">Digite exatamente: <strong>{CONFIRMACAO_TEXTUAL}</strong></p>
                  {motivoBloqueioAplicacao && !resultadoAplicacao?.ok && <p className="text-xs text-amber-700">{motivoBloqueioAplicacao}</p>}
                </section>
                <RelatorioAplicacao resultado={resultadoAplicacao} />
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-center text-sm">
                  <div className="rounded-md border p-2"><p className="text-xs text-slate-500">Candidatos</p><p className="font-bold">{totais.candidatos || 0}</p></div>
                  <div className="rounded-md border p-2"><p className="text-xs text-slate-500">Ignorados</p><p className="font-bold">{totais.ignorados || 0}</p></div>
                  <div className="rounded-md border p-2"><p className="text-xs text-slate-500">Já marcados</p><p className="font-bold">{totais.ja_marcados || 0}</p></div>
                  <div className="rounded-md border p-2"><p className="text-xs text-slate-500">Saldo aberto</p><p className="font-bold">{totais.com_saldo_aberto || 0}</p></div>
                  <div className="rounded-md border p-2"><p className="text-xs text-slate-500">Com férias</p><p className="font-bold">{totais.com_ferias_vinculadas || 0}</p></div>
                  <div className="rounded-md border p-2"><p className="text-xs text-slate-500">Bloqueantes</p><p className="font-bold">{totais.bloqueantes || 0}</p></div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <ListaPeriodos
                    titulo="Candidatos"
                    itens={preview.candidatos}
                    vazio="Nenhum período candidato encontrado."
                    renderExtra={(item) => item.riscos?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {item.riscos.map((risco) => <Badge key={risco} variant="outline" className="bg-amber-50 text-amber-800 border-amber-200">{risco}</Badge>)}
                      </div>
                    )}
                  />
                  <ListaPeriodos titulo="Ignorados" itens={preview.ignorados} vazio="Nenhum período ignorado." />
                  <ListaPeriodos titulo="Já marcados" itens={preview.jaMarcados} vazio="Nenhum período já marcado como legado." />
                  <section className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h4 className="font-semibold text-slate-800">Riscos</h4>
                      <Badge variant="outline">{preview.riscos.length}</Badge>
                    </div>
                    {preview.riscos.length === 0 ? <p className="text-sm text-slate-500">Nenhum risco identificado.</p> : (
                      <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                        {Array.from(riscosPorPeriodo.entries()).map(([periodo, riscos]) => (
                          <div key={periodo} className="rounded-md border border-amber-100 bg-amber-50 p-2 text-sm">
                            <p className="font-medium text-amber-900">{periodo}</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {riscos.map((risco, index) => <Badge key={`${risco.codigo}-${index}`} variant="outline" className={risco.bloqueante ? 'border-red-300 text-red-700' : ''}>{risco.codigo}{risco.bloqueante ? ' • bloqueante' : ''}</Badge>)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>

                <section className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <Label htmlFor="confirmacao-legado-ativa">Confirmação textual obrigatória</Label>
                  <Input
                    id="confirmacao-legado-ativa"
                    value={confirmacaoTextual}
                    onChange={(event) => setConfirmacaoTextual(event.target.value)}
                    placeholder={CONFIRMACAO_TEXTUAL}
                    disabled={applying || Boolean(resultadoAplicacao?.ok)}
                  />
                  <p className="text-xs text-slate-500">Digite exatamente: <strong>{CONFIRMACAO_TEXTUAL}</strong></p>
                  {motivoBloqueioAplicacao && !resultadoAplicacao?.ok && <p className="text-xs text-amber-700">{motivoBloqueioAplicacao}</p>}
                </section>

                <RelatorioAplicacao resultado={resultadoAplicacao} />
              </>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange?.(false)}>Fechar</Button>
          <AlertDialog open={confirmacaoManualAberta} onOpenChange={setConfirmacaoManualAberta}>
            <AlertDialogTrigger asChild>
              <Button type="button" disabled={!podeAplicarArquivamento || Boolean(resultadoAplicacao?.ok)}>
                {applying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Arquivar períodos da ativa
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Arquivar períodos da ativa</AlertDialogTitle>
                <AlertDialogDescription>Deseja arquivar logicamente a cadeia antiga e cancelar períodos futuros indevidos deste contrato?</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={applying}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleAplicarArquivamento} disabled={applying}>
                  {applying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Arquivar períodos da ativa
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
