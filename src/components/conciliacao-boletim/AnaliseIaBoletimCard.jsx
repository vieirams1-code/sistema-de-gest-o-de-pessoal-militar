import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bot, Info, RotateCcw, Sparkles } from 'lucide-react';
import SugestoesRevisaoIA from '@/components/conciliacao-boletim/SugestoesRevisaoIA';
import { analisarDocumentoComIA } from '@/services/analiseConciliacaoIaClient';
import { listarLivroPublicacoesEscopo } from '@/services/publicacoesPainelService';
import {
  encontrarDuplicidadeBoletim,
  importarNotaConciliacao,
} from '@/services/conciliacaoImportService';

export default function AnaliseIaBoletimCard({
  boletimId,
  notas = [],
  militares = [],
  numeroBoletim,
  dataBoletim,
  tipoBoletim = 'BG',
  analiseAnterior = null,
  podeImportar = false,
  onSalvarAnalise,
  onMarcarStatus,
  onAtualizar,
  user,
}) {
  const [sugestoes, setSugestoes] = useState([]);
  const [observacoes, setObservacoes] = useState('');
  const [meta, setMeta] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [importados, setImportados] = useState({});
  const [rejeitados, setRejeitados] = useState({});

  const itensPorId = useMemo(() => new Map(notas.map(nota => [String(nota.id), nota])), [notas]);

  useEffect(() => {
    setSugestoes([]); setObservacoes(''); setMeta(null); setErro(''); setMensagem('');
    setImportados({}); setRejeitados({});
  }, [boletimId, numeroBoletim, dataBoletim]);

  const aplicarResultado = (resultado) => {
    const comItem = (resultado?.sugestoes || [])
      .map(sugestao => ({ ...sugestao, item: itensPorId.get(String(sugestao.item_id)) || null }))
      .filter(sugestao => sugestao.item);
    setSugestoes(comItem);
    setObservacoes(resultado?.observacoes || '');
    setMeta(resultado?.meta || null);
    const importadas = {};
    const rejeitadas = {};
    for (const sugestao of resultado?.sugestoes || []) {
      if (sugestao.status === 'importada') importadas[sugestao.item_id] = true;
      if (sugestao.status === 'rejeitada') rejeitadas[sugestao.item_id] = true;
    }
    setImportados(importadas);
    setRejeitados(rejeitadas);
    return comItem;
  };

  // Ao reabrir um boletim do arquivo, retoma a análise salva automaticamente,
  // sem nova chamada de IA e sem perder as decisões já tomadas.
  const aplicadoRef = useRef('');
  useEffect(() => {
    if (!analiseAnterior) return;
    const chave = `${boletimId || 'sem-registro'}:${analiseAnterior.em || ''}`;
    if (aplicadoRef.current === chave) return;
    if (!(analiseAnterior.sugestoes || []).some(sugestao => itensPorId.has(String(sugestao.item_id)))) return;
    aplicadoRef.current = chave;
    aplicarResultado(analiseAnterior);
    setMensagem('Análise salva carregada. Nenhuma chamada de IA foi feita agora.');
  }, [analiseAnterior, itensPorId, boletimId]);

  const analisar = async () => {
    setErro(''); setMensagem(''); setCarregando(true);
    try {
      const resultado = await analisarDocumentoComIA({
        tipo: tipoBoletim,
        numero: numeroBoletim,
        data: dataBoletim,
        itens: notas.map(nota => ({
          id: nota.id,
          numero: nota.nota,
          pagina: nota.pagina,
          contexto: nota.contexto,
        })),
        militares,
      });
      const aplicadas = aplicarResultado(resultado);
      if (onSalvarAnalise) await onSalvarAnalise(resultado);
      const metaResultado = resultado?.meta || {};
      const partes = [];
      if (metaResultado.itensIdentificados) partes.push(`${metaResultado.itensIdentificados} identificada(s)`);
      if (metaResultado.itensAmbiguos) partes.push(`${metaResultado.itensAmbiguos} para conferência`);
      if (metaResultado.itensSemCorrespondencia) partes.push(`${metaResultado.itensSemCorrespondencia} sem correspondência`);
      setMensagem(aplicadas.length
        ? `${partes.join(' · ')}. Revise e confirme cada importação. Nada foi gravado.`
        : 'A análise não retornou itens para revisão. Confira o documento manualmente.');
    } catch (e) {
      setErro(e?.message || 'Não foi possível concluir a análise assistida por IA.');
    } finally {
      setCarregando(false);
    }
  };

  const retomarAnalise = () => {
    setErro(''); setMensagem('');
    const aplicadas = aplicarResultado(analiseAnterior);
    if (!aplicadas.length) {
      setErro('A análise salva não corresponde às notas deste boletim. Faça uma nova análise.');
      return;
    }
    setMensagem('Análise anterior carregada. Nenhuma chamada de IA foi feita agora.');
  };

  const importar = async ({ sugestao, militar, tipo, texto }) => {
    const nota = sugestao.item;
    const atual = await listarLivroPublicacoesEscopo({ purpose: 'CONCILIACAO' });
    const registrosAtuais = [...(atual.registrosLivro || []), ...(atual.publicacoesExOfficio || [])];
    if (encontrarDuplicidadeBoletim({
      registros: registrosAtuais,
      militarId: militar.id,
      nota: nota.nota,
      numeroBg: numeroBoletim,
      dataBoletim,
    })) {
      throw new Error('Já existe RP para este militar e nota. Atualize a tela e confira o cadastro antes de importar.');
    }
    await importarNotaConciliacao({
      militar,
      tipo,
      texto,
      nota: nota.nota_normalizada || nota.nota,
      pagina: nota.pagina,
      numeroBg: numeroBoletim,
      dataBoletim,
      origem: 'boletim_ia',
      observacao: `Incluído após análise assistida por IA e revisão manual. Nota ${nota.nota}, página ${nota.pagina}.`,
      user,
    });
    setImportados(prev => ({ ...prev, [sugestao.item_id]: true }));
    await onMarcarStatus?.(sugestao.item_id, 'importada');
    setMensagem(`Nota ${nota.nota} importada para o RP do militar confirmado.`);
    onAtualizar?.();
  };

  const visiveis = sugestoes.filter(sugestao => !rejeitados[sugestao.item_id]);
  const analiseSalvaCompativel = Boolean(analiseAnterior)
    && (analiseAnterior.sugestoes || []).some(sugestao => itensPorId.has(String(sugestao.item_id)));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg text-[#1e3a5f] flex items-center gap-2">
            <Bot className="w-5 h-5" />2. Análise assistida por IA
          </CardTitle>
          <Badge variant="outline">{notas.length} nota(s) pendente(s)</Badge>
        </div>
        <p className="text-sm text-slate-500">
          Opcional. A conciliação das publicações já cadastradas continua sendo feita pela leitura local, sem IA.
          Cada nota é comparada apenas com os militares cujo nome aparece no texto dela — a IA não escolhe livremente
          entre o efetivo.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {notas.length === 0 && (
          <p className="text-sm text-slate-500">Nenhuma nota pendente de identificação neste boletim. A análise por IA não é necessária.</p>
        )}

        {notas.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
            <p className="text-xs text-slate-600 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
              A análise envia o texto destas {notas.length} nota(s) e o efetivo para a IA. Só é considerado citado o militar cujo
              nome completo cadastrado ou matrícula aparece na própria nota; nome de guerra e nomes parecidos não vinculam.
              Cada análise consome aproximadamente 1 crédito de integração do plano; refazer a análise consome novamente.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={analisar} disabled={carregando} className="bg-[#1e3a5f] hover:bg-[#294c75]">
                <Sparkles className="w-4 h-4 mr-2" />{carregando ? 'Analisando…' : 'Analisar com IA'}
              </Button>
              {analiseSalvaCompativel && sugestoes.length === 0 && (
                <Button variant="outline" onClick={retomarAnalise} disabled={carregando}>
                  <RotateCcw className="w-4 h-4 mr-2" />Usar análise salva (sem custo)
                </Button>
              )}
              {analiseAnterior?.em && (
                <span className="text-xs text-slate-500">
                  Análise salva em {new Date(analiseAnterior.em).toLocaleString('pt-BR')}
                  {analiseAnterior.por ? ` por ${analiseAnterior.por}` : ''}
                </span>
              )}
            </div>
          </div>
        )}

        {carregando && <p className="text-sm text-slate-500">Analisando o documento… isso pode levar até um minuto.</p>}
        {erro && <p role="alert" className="text-sm text-red-700 font-medium">{erro}</p>}
        {mensagem && <p role="status" className="text-sm text-emerald-700">{mensagem}</p>}
        {observacoes && <p className="text-xs text-slate-600">{observacoes}</p>}
        {meta && (
          <p className="text-xs text-slate-500">
            {meta.itensAnalisados} item(ns) analisado(s) · {meta.candidatosConsiderados} militar(es) no efetivo comparado.
          </p>
        )}
        {meta?.itensIgnorados > 0 && (
          <p role="alert" className="text-xs text-amber-700">
            {meta.itensIgnorados} nota(s) não couberam nesta análise (limite de {meta.itensAnalisados} por chamada). Analise o restante em outro boletim ou reduza o intervalo.
          </p>
        )}

        {visiveis.length > 0 && (
          <SugestoesRevisaoIA
            sugestoes={visiveis}
            militares={militares}
            podeImportar={podeImportar}
            importados={importados}
            onImportar={importar}
            onRejeitar={(sugestao) => {
              setRejeitados(prev => ({ ...prev, [sugestao.item_id]: true }));
              onMarcarStatus?.(sugestao.item_id, 'rejeitada');
            }}
            rotuloItem={(item) => `Nota ${item?.nota || '—'} · pág. ${item?.pagina || '—'}`}
          />
        )}
      </CardContent>
    </Card>
  );
}