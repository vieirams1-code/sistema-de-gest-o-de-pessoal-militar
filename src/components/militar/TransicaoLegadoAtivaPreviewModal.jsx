import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
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
import { previsualizarTransicaoLegadoAtiva } from '@/services/transicaoLegadoAtivaClient';

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

export default function TransicaoLegadoAtivaPreviewModal({ open, onOpenChange, militarId, contrato }) {
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    async function carregarPreview() {
      if (!open || !militarId || !contrato?.id) return;
      setLoading(true);
      setError('');
      setPreview(null);
      try {
        const data = await previsualizarTransicaoLegadoAtiva({ militarId, contratoDesignacaoId: contrato.id });
        if (active) setPreview(data);
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
  const riscosPorPeriodo = useMemo(() => {
    const mapa = new Map();
    (preview?.riscos || []).forEach((risco) => {
      const key = risco.periodo_id || risco.periodo_ref || 'sem_periodo';
      if (!mapa.has(key)) mapa.set(key, []);
      mapa.get(key).push(risco);
    });
    return mapa;
  }, [preview?.riscos]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Prévia da transição para Legado da Ativa</DialogTitle>
          <DialogDescription>
            Relatório de elegibilidade do contrato ativo antes de qualquer aplicação operacional.
          </DialogDescription>
        </DialogHeader>

        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Esta etapa é apenas uma prévia. Nenhum período será alterado.</AlertTitle>
          <AlertDescription>Aplicação será liberada em lote posterior.</AlertDescription>
        </Alert>

        {loading && (
          <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-600 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando prévia...
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Não foi possível gerar a prévia</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {preview && (
          <div className="space-y-4">
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
                <p className="text-blue-700">{plural(totais.periodos_analisados, 'período analisado', 'períodos analisados')}</p>
              </div>
            </div>

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
                          {riscos.map((risco, index) => <Badge key={`${risco.codigo}-${index}`} variant="outline">{risco.codigo}{risco.bloqueante ? ' • bloqueante' : ''}</Badge>)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange?.(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
