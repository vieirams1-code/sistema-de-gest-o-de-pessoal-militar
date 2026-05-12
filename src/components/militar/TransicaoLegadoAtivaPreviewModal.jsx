import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import { aplicarTransicaoLegadoAtiva, previsualizarTransicaoLegadoAtiva } from '@/services/transicaoLegadoAtivaClient';
import TransicaoDesignacaoPeriodosGrid, { calcularResumoDecisoes, criarDecisoesIniciais } from './TransicaoDesignacaoPeriodosGrid';
import TransicaoDesignacaoResumoAcoes from './TransicaoDesignacaoResumoAcoes';

const CONFIRMACAO_TEXTUAL = 'MARCAR LEGADO DA ATIVA';

function formatDate(date) {
  if (!date) return '—';
  try { return new Date(`${String(date).slice(0, 10)}T00:00:00`).toLocaleDateString('pt-BR'); } catch (_e) { return date; }
}

function plural(total, singular, pluralText) {
  return `${total || 0} ${total === 1 ? singular : pluralText}`;
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
  const totais = resultado.totais || {};
  const warnings = resultado.meta?.warnings || [];
  return (
    <section className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
      <div className="flex items-start gap-2 text-emerald-900">
        <CheckCircle2 className="h-4 w-4 mt-0.5" />
        <div>
          <h4 className="font-semibold">Relatório de aplicação</h4>
          <p className="text-sm">Aplicados: {totais.aplicados || 0} • Ignorados: {totais.ignorados || 0} • Já marcados: {totais.ja_marcados || 0} • Conflitos: {totais.conflitos || 0}</p>
          {warnings.length > 0 && <p className="text-xs mt-1">Avisos: {warnings.join(', ')}</p>}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ListaPeriodos titulo="Aplicados" itens={resultado.aplicados} vazio="Nenhum período aplicado nesta execução." />
        <ListaPeriodos titulo="Ignorados" itens={resultado.ignorados} vazio="Nenhum período ignorado." />
        <ListaPeriodos titulo="Já marcados" itens={resultado.jaMarcados} vazio="Nenhum período já estava marcado." />
        <ListaPeriodos titulo="Conflitos" itens={resultado.conflitos} vazio="Nenhum conflito encontrado." />
      </div>
    </section>
  );
}

function CabecalhoPreview({ preview, totais }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs text-slate-500">Militar</p>
        <p className="font-semibold text-slate-800">{preview.militar?.nome || '—'}</p>
        <p className="text-slate-500">{preview.militar?.nome_guerra || '—'} • {preview.militar?.matricula || '—'}</p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs text-slate-500">Contrato ativo</p>
        <p className="font-semibold text-slate-800">{preview.contrato?.numero_contrato || 'Sem número'}</p>
        <p className="text-slate-500">Boletim: {preview.contrato?.boletim_publicacao || '—'} • Início: {formatDate(preview.contrato?.data_inicio_contrato)}</p>
      </div>
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
        <p className="text-xs text-blue-600">Data-base resolvida</p>
        <p className="text-xl font-bold text-blue-900">{formatDate(preview.data_base)}</p>
        <p className="text-blue-700">{plural(totais.periodos_analisados || preview.periodos?.length, 'período analisado', 'períodos analisados')}</p>
      </div>
    </div>
  );
}

export default function TransicaoLegadoAtivaPreviewModal({ open, onOpenChange, militarId, contrato }) {
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState(null);
  const [resultadoAplicacao, setResultadoAplicacao] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [confirmacaoTextual, setConfirmacaoTextual] = useState('');
  const [acoesSelecionadas, setAcoesSelecionadas] = useState({});
  const [previewHash, setPreviewHash] = useState(null);

  useEffect(() => {
    let active = true;
    async function carregarPreview() {
      if (!open || !militarId || !contrato?.id) return;
      setLoading(true);
      setError('');
      setPreview(null);
      setResultadoAplicacao(null);
      setConfirmacaoTextual('');
      setAcoesSelecionadas({});
      setPreviewHash(null);
      try {
        const data = await previsualizarTransicaoLegadoAtiva({ militarId, contratoDesignacaoId: contrato.id });
        if (active) {
          setPreview(data);
          setPreviewHash(data?.preview_hash || data?.meta?.previewHash || null);
          setAcoesSelecionadas(criarDecisoesIniciais(data?.periodos || []));
        }
      } catch (err) {
        if (active) setError(err?.message || 'Erro ao carregar prévia da transição.');
      } finally {
        if (active) setLoading(false);
      }
    }
    carregarPreview();
    return () => { active = false; };
  }, [open, militarId, contrato?.id]);

  const totais = preview?.totais || {};
  const periodos = preview?.periodos || [];
  const usaFluxoPorPeriodo = periodos.length > 0;
  const resumoDecisoes = useMemo(() => calcularResumoDecisoes(periodos, acoesSelecionadas), [periodos, acoesSelecionadas]);
  const riscosBloqueantes = useMemo(() => (preview?.riscos || []).filter((risco) => risco.bloqueante), [preview?.riscos]);
  const candidatosAplicaveis = Number(totais.candidatos || 0) > 0;
  const podeAplicarLegado = !usaFluxoPorPeriodo && confirmacaoTextual === CONFIRMACAO_TEXTUAL && candidatosAplicaveis && riscosBloqueantes.length === 0 && !applying;
  const motivoBloqueioAplicacao = riscosBloqueantes.length > 0
    ? 'Há riscos bloqueantes na prévia recalculada.'
    : !candidatosAplicaveis
      ? 'Não há candidatos aplicáveis.'
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
      queryClient.invalidateQueries({ queryKey: ['pa-bundle'] }),
      queryClient.invalidateQueries({ queryKey: ['periodos-aquisitivos'] }),
    ]);
  }

  async function handleAplicarLegado() {
    if (!podeAplicarLegado) return;
    setApplying(true);
    setError('');
    try {
      const resultado = await aplicarTransicaoLegadoAtiva({
        militarId,
        contratoDesignacaoId: contrato.id,
        confirmacaoTextual,
        previewHash,
      });
      setResultadoAplicacao(resultado);
      await invalidarQueriesRelacionadas();
    } catch (err) {
      const status = err?.status ? ` (${err.status})` : '';
      setError(`${err?.message || 'Erro ao aplicar transição.'}${status}`);
      if (err?.body) setResultadoAplicacao(err.body);
    } finally {
      setApplying(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
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

        {usaFluxoPorPeriodo && (
          <Alert className="border-amber-200 bg-amber-50 text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Aplicação manual será liberada no próximo lote</AlertTitle>
            <AlertDescription>
              Esta tela prepara as decisões por período. A aplicação manual será liberada em lote posterior. As decisões, o previewHash e a confirmação textual ficam apenas em estado local nesta versão.
            </AlertDescription>
          </Alert>
        )}

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
            <CabecalhoPreview preview={preview} totais={totais} />

            {usaFluxoPorPeriodo ? (
              <>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  <p><strong>Hash da prévia:</strong> {previewHash || '—'}</p>
                  <p><strong>Estado preparado:</strong> confirmacaoTextual, acoesSelecionadas e previewHash permanecem locais e não são enviados para aplicação neste lote.</p>
                </div>
                <TransicaoDesignacaoResumoAcoes resumo={resumoDecisoes} />
                <TransicaoDesignacaoPeriodosGrid periodos={periodos} acoesSelecionadas={acoesSelecionadas} onChange={setAcoesSelecionadas} />
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
          {usaFluxoPorPeriodo ? (
            <Button type="button" disabled>Aplicação manual será liberada no próximo lote.</Button>
          ) : (
            <Button type="button" onClick={handleAplicarLegado} disabled={!podeAplicarLegado || Boolean(resultadoAplicacao?.ok)}>
              {applying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Aplicar transição
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
