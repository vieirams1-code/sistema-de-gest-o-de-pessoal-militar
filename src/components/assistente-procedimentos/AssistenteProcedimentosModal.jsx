import React, { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { MessageCircleQuestion, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { buscarResposta, aplicarContexto } from './assistenteProcedimentosService';

export default function AssistenteProcedimentosModal({ tipoProcedimento = '', procedimento = {} }) {
  const [open, setOpen] = useState(false);
  const [pergunta, setPergunta] = useState('');
  const [respostaAtual, setRespostaAtual] = useState(null);

  const { data: baseConhecimento = [], isLoading: loadingBase } = useQuery({
    queryKey: ['assistente-procedimentos-base', tipoProcedimento],
    queryFn: async () => {
      if (!tipoProcedimento) return [];
      return base44.entities.BaseConhecimentoProcedimento.filter({ tipo_procedimento: tipoProcedimento });
    },
    enabled: open,
  });

  const sugestoes = useMemo(() => {
    return baseConhecimento
      .map((item) => item.pergunta_exemplo)
      .filter(Boolean)
      .slice(0, 5);
  }, [baseConhecimento]);

  const logMutation = useMutation({
    mutationFn: async (payload) => base44.entities.AssistenteLog.create(payload),
  });

  const handleBuscar = async (textoPergunta) => {
    const perguntaAtual = (textoPergunta || pergunta || '').trim();
    if (!perguntaAtual) return;

    const respostaBase = buscarResposta(perguntaAtual, tipoProcedimento, baseConhecimento);
    const respostaComContexto = aplicarContexto(respostaBase, procedimento);
    setRespostaAtual(respostaComContexto);

    const item = respostaComContexto.item || {};

    await logMutation.mutateAsync({
      tipo_procedimento: tipoProcedimento,
      pergunta: perguntaAtual,
      pergunta_normalizada: respostaComContexto.perguntaNormalizada,
      base_conhecimento_id: item.id || '',
      resposta_objetiva: item.resposta_objetiva || respostaComContexto.mensagem || '',
      resposta_detalhada: item.resposta_detalhada || '',
      fundamento_legal: item.fundamento_legal || '',
      referencia_norma: item.referencia_norma || '',
      procedimento_id: procedimento.id || '',
      status_procedimento: procedimento.status || procedimento.status_publicacao || '',
      prazo: procedimento.prazo || procedimento.data_termino || '',
      prorrogacoes: String(procedimento.prorrogacoes || procedimento.qtd_prorrogacoes || ''),
      sugestao_pratica: respostaComContexto.sugestaoPratica || '',
      score_correspondencia: respostaComContexto.score || 0,
      sem_correspondencia: !respostaComContexto.item,
      data_pergunta: new Date().toISOString().split('T')[0],
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="gap-2">
          <MessageCircleQuestion className="h-4 w-4" />
          Assistente
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Assistente de Procedimentos</DialogTitle>
          <DialogDescription>
            Consulta estruturada por base de conhecimento interna para o tipo selecionado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={pergunta}
              onChange={(event) => setPergunta(event.target.value)}
              placeholder="Digite sua pergunta sobre o procedimento..."
            />
            <Button type="button" onClick={() => handleBuscar()} disabled={!pergunta.trim() || loadingBase || logMutation.isPending}>
              {logMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Consultar'}
            </Button>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Sugestões rápidas</p>
            <div className="flex flex-wrap gap-2">
              {sugestoes.length > 0 ? sugestoes.map((sugestao) => (
                <Button
                  key={sugestao}
                  type="button"
                  variant="secondary"
                  className="h-auto whitespace-normal text-left"
                  onClick={() => {
                    setPergunta(sugestao);
                    handleBuscar(sugestao);
                  }}
                >
                  {sugestao}
                </Button>
              )) : (
                <p className="text-xs text-slate-500">Sem sugestões disponíveis para este tipo.</p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="mb-2 text-sm font-medium text-slate-700">Resposta</p>
            {!respostaAtual && <p className="text-sm text-slate-500">Faça uma pergunta para visualizar a orientação.</p>}

            {respostaAtual && !respostaAtual.item && (
              <p className="text-sm text-amber-700">{respostaAtual.mensagem}</p>
            )}

            {respostaAtual?.item && (
              <div className="space-y-2 text-sm text-slate-700">
                <p><strong>Resposta objetiva:</strong> {respostaAtual.item.resposta_objetiva || 'Não informado.'}</p>
                <p><strong>Detalhamento:</strong> {respostaAtual.item.resposta_detalhada || 'Não informado.'}</p>
                <p><strong>Fundamento legal:</strong> {respostaAtual.item.fundamento_legal || 'Não informado.'}</p>
                <p><strong>Sugestão prática:</strong> {respostaAtual.sugestaoPratica || 'Revise o procedimento conforme a norma aplicável.'}</p>
                {respostaAtual.contextoAplicado && (
                  <p><strong>Contexto aplicado:</strong> {respostaAtual.contextoAplicado}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
