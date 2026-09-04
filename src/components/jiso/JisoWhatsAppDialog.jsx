import React, { useEffect, useState } from 'react';
import { CheckCircle2, MessageCircle, RefreshCw, Send, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { previewConvocacaoJisoWhatsApp, enviarConvocacaoJisoWhatsApp } from '@/services/jisoWhatsAppClient';

export default function JisoWhatsAppDialog({ jiso, open, onOpenChange, onSent }) {
  const [preview, setPreview] = useState(null);
  const [mensagem, setMensagem] = useState('');
  const [error, setError] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentResult, setSentResult] = useState(null);

  useEffect(() => {
    if (!open) return;
    setPreview(null);
    setMensagem('');
    setError(null);
    setSentResult(null);
  }, [open, jiso?.id]);

  const gerarPreview = async () => {
    if (!jiso?.id) return;
    setLoadingPreview(true);
    setError(null);
    setSentResult(null);
    try {
      const data = await previewConvocacaoJisoWhatsApp(jiso.id);
      setPreview(data);
      setMensagem(data?.mensagem || '');
    } catch (err) {
      setPreview(null);
      setMensagem('');
      setError(err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const enviar = async () => {
    if (!jiso?.id || !preview || !mensagem.trim()) return;
    setSending(true);
    setError(null);
    try {
      const result = await enviarConvocacaoJisoWhatsApp(jiso.id, preview, mensagem.trim());
      setSentResult(result);
      await onSent?.(result);
    } catch (err) {
      setError(err);
    } finally {
      setSending(false);
    }
  };

  const errorData = error?.data || {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" /> Convocação JISO por WhatsApp
          </DialogTitle>
          <DialogDescription>
            A mensagem é gerada a partir do template ativo e o comprovante do envio fica registrado na própria JISO.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="font-medium text-slate-900">{jiso?.militar_posto || ''} {jiso?.militar_nome || 'Militar'}</p>
            <p className="text-slate-500 mt-1">
              {jiso?.finalidade_jiso || 'Finalidade não informada'} · {jiso?.data_jiso || 'sem data'} · {jiso?.hora_jiso || 'sem horário'}
            </p>
          </div>

          {!preview && !sentResult && (
            <div className="rounded-lg border border-dashed border-slate-300 p-5 text-center">
              <MessageCircle className="w-9 h-9 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-700">Gere a prévia antes do envio.</p>
              <p className="text-xs text-slate-500 mt-1">O sistema confere template, data, horário, escopo e compatibilidade com os atestados vinculados.</p>
              <Button onClick={gerarPreview} disabled={loadingPreview} className="mt-4" variant="outline">
                {loadingPreview ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <MessageCircle className="w-4 h-4 mr-2" />}
                {loadingPreview ? 'Gerando...' : 'Gerar prévia'}
              </Button>
            </div>
          )}

          {preview && !sentResult && (
            <>
              <div className="grid sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-slate-400 uppercase tracking-wide">Template</p>
                  <p className="font-medium text-slate-700 mt-1">{preview.template_nome || 'Template JISO'}</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-slate-400 uppercase tracking-wide">Atestados vinculados</p>
                  <p className="font-medium text-slate-700 mt-1">{preview.quantidade_atestados ?? 0}</p>
                </div>
              </div>
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Mensagem final</Label>
                  <Button type="button" size="sm" variant="ghost" onClick={gerarPreview} disabled={loadingPreview}>
                    <RefreshCw className={`w-4 h-4 mr-1 ${loadingPreview ? 'animate-spin' : ''}`} /> Atualizar prévia
                  </Button>
                </div>
                <Textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} rows={9} />
                <p className="text-xs text-slate-500">A mensagem pode ser revisada antes do envio. Se os dados da JISO ou o template mudarem, o backend exigirá uma nova prévia.</p>
              </div>
            </>
          )}

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              <div className="flex items-start gap-2">
                <TriangleAlert className="w-5 h-5 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">{error.message || 'Não foi possível processar a convocação.'}</p>
                  {errorData?.sugestao && <p className="mt-1 text-rose-700">{errorData.sugestao}</p>}
                  {Array.isArray(errorData?.variaveis_incompativeis) && errorData.variaveis_incompativeis.length > 0 && (
                    <p className="mt-1 text-xs">Variáveis incompatíveis: {errorData.variaveis_incompativeis.join(', ')}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {sentResult && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">Convocação enviada.</p>
                  <p className="text-sm mt-1">O envio foi registrado na JISO{sentResult?.tracking_saved === false ? ', mas o comprovante não pôde ser persistido.' : '.'}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{sentResult ? 'Fechar' : 'Cancelar'}</Button>
          {preview && !sentResult && (
            <Button onClick={enviar} disabled={sending || !mensagem.trim()} className="bg-emerald-700 hover:bg-emerald-800">
              <Send className="w-4 h-4 mr-2" /> {sending ? 'Enviando...' : 'Enviar WhatsApp'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
