import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileSearch, Info, Newspaper, Sparkles } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { fetchScopedMilitares } from '@/services/getScopedMilitaresClient';
import { listarLivroPublicacoesEscopo } from '@/services/publicacoesPainelService';
import { lerDiarioOficialPdf } from '@/utils/boletim/leituraDoems';
import { analisarDocumentoComIA } from '@/services/analiseConciliacaoIaClient';
import SugestoesRevisaoIA from '@/components/conciliacao-boletim/SugestoesRevisaoIA';
import ArquivoDoemsCard from '@/components/conciliacao-boletim/ArquivoDoemsCard';
import { encontrarDuplicidadeDoems, importarNotaConciliacao } from '@/services/conciliacaoImportService';
import {
  arquivarDiarioConciliacao,
  atualizarStatusDiario,
  listarDiariosConciliacao,
  obterUrlArquivoDiario,
  registrarImportacaoDiario,
  salvarAnaliseIaDiario,
} from '@/services/doemsConciliacaoService';

const MAX_SUGESTOES_ARQUIVADAS = 40;
const LIMITE_CONTEXTO_ARQUIVADO = 1000;

export default function ConciliacaoDOEMS() {
  const queryClient = useQueryClient();
  const { isAccessResolved, isLoading: loadingUser, canAccessModule, canAccessAction, user } = useCurrentUser();

  const hasAccess = canAccessModule('conciliacao_boletim') && canAccessAction('visualizar_conciliacao_boletim');
  const podeCriarPublicacao = canAccessAction('adicionar_publicacoes');
  const podeCriarLivro = canAccessAction('adicionar_livro');
  const podeImportar = podeCriarPublicacao || podeCriarLivro;

  const [numeroEdicao, setNumeroEdicao] = useState('');
  const [dataPublicacao, setDataPublicacao] = useState('');
  const [arquivo, setArquivo] = useState(null);
  const [registroId, setRegistroId] = useState('');
  const [leitura, setLeitura] = useState(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [sugestoes, setSugestoes] = useState([]);
  const [observacoesIa, setObservacoesIa] = useState('');
  const [metaIa, setMetaIa] = useState(null);
  const [importados, setImportados] = useState({});
  const [rejeitados, setRejeitados] = useState({});
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [revisaoArquivada, setRevisaoArquivada] = useState(false);

  const { data: bundleMilitares = {}, isLoading: loadingMilitares, isError: erroMilitares } = useQuery({
    queryKey: ['conciliacao-doems-militares-ativos'],
    queryFn: () => fetchScopedMilitares({ fetchAll: true, statusCadastro: 'Ativo', includeFoto: false }),
    enabled: isAccessResolved && hasAccess,
    staleTime: 60000,
  });

  const { data: diarios = [], isLoading: carregandoDiarios } = useQuery({
    queryKey: ['conciliacao-doems-arquivados'],
    queryFn: listarDiariosConciliacao,
    enabled: isAccessResolved && hasAccess,
  });

  const militares = useMemo(
    () => (bundleMilitares?.militares || []).filter(m => m.status_cadastro === 'Ativo'),
    [bundleMilitares],
  );

  const limparRevisao = () => {
    setSugestoes([]); setObservacoesIa(''); setMetaIa(null); setImportados({}); setRejeitados({});
    setRevisaoArquivada(false);
  };

  const lerPdf = async () => {
    if (!numeroEdicao.trim() || !dataPublicacao) {
      setErro('Informe a edição e a data do Diário Oficial.');
      return;
    }
    if (!arquivo) {
      setErro('Selecione o PDF do Diário Oficial.');
      return;
    }
    setErro(''); setMensagem(''); setAviso(''); setLoadingPdf(true); setLeitura(null); limparRevisao();
    try {
      const resultado = await lerDiarioOficialPdf(arquivo);
      setLeitura(resultado);
      let complemento = '';
      try {
        const { registro, jaExistia } = await arquivarDiarioConciliacao({
          arquivo, numeroEdicao, dataPublicacao, leitura: resultado, usuario: user,
        });
        setRegistroId(registro?.id || '');
        queryClient.invalidateQueries({ queryKey: ['conciliacao-doems-arquivados'] });
        complemento = jaExistia
          ? ' Este diário já constava no arquivo; os dados foram atualizados.'
          : ' Diário registrado no arquivo de conciliação.';
      } catch (e) {
        setAviso('O diário foi lido, mas não foi possível guardar o PDF no arquivo: ' + (e?.message || 'falha no armazenamento') + '.');
      }

      if (!resultado.trechos.length) {
        setMensagem('Nenhum trecho de texto utilizável foi reconhecido no PDF. Confira se o arquivo não é digitalizado.' + complemento);
      } else {
        setMensagem(`${resultado.trechos.length} trecho(s) preparado(s) para análise. A leitura não envia nada para IA.` + complemento);
      }
    } catch (e) {
      setErro(e?.message || 'Não foi possível ler o PDF do Diário Oficial.');
    } finally {
      setLoadingPdf(false);
    }
  };

  const analisar = async () => {
    if (!leitura?.trechos?.length) return;
    setErro(''); setMensagem(''); setAnalisando(true);
    try {
      const resultado = await analisarDocumentoComIA({
        tipo: 'DOEMS',
        numero: numeroEdicao,
        data: dataPublicacao,
        itens: leitura.trechos,
        militares,
      });
      const porId = new Map(leitura.trechos.map(trecho => [String(trecho.id), trecho]));
      const comItem = (resultado.sugestoes || [])
        .map(sugestao => ({ ...sugestao, item: porId.get(String(sugestao.item_id)) || null }))
        .filter(sugestao => sugestao.item);
      setSugestoes(comItem);
      setObservacoesIa(resultado.observacoes || '');
      setMetaIa(resultado.meta || null);
      setRevisaoArquivada(false);

      if (registroId) {
        const paraArquivar = {
          sugestoes: comItem.slice(0, MAX_SUGESTOES_ARQUIVADAS).map(sugestao => ({
            ...sugestao,
            item: undefined,
            pagina: sugestao.item?.pagina || '',
            contexto_revisao: String(sugestao.item?.contexto || '').slice(0, LIMITE_CONTEXTO_ARQUIVADO),
          })),
          observacoes: resultado.observacoes || '',
          meta: resultado.meta || {},
        };
        try {
          await salvarAnaliseIaDiario(registroId, { resultado: paraArquivar, usuario: user });
          queryClient.invalidateQueries({ queryKey: ['conciliacao-doems-arquivados'] });
        } catch (e) {
          setAviso('A análise foi concluída, mas não foi possível guardá-la no arquivo: ' + (e?.message || 'falha ao salvar') + '.');
        }
      }

      setMensagem(comItem.length
        ? `${comItem.length} sugestão(ões) para revisão. Nada foi gravado.`
        : 'A análise não encontrou vínculos com evidência suficiente. Confira o diário manualmente.');
    } catch (e) {
      setErro(e?.message || 'Não foi possível concluir a análise assistida por IA.');
    } finally {
      setAnalisando(false);
    }
  };

  const retomarAnalise = (diario) => {
    setErro(''); setMensagem(''); setAviso('');
    try {
      const salvo = JSON.parse(diario.analise_ia_json || '{}');
      const sugestoesSalvas = (salvo.sugestoes || []).map(sugestao => ({
        ...sugestao,
        item: {
          id: sugestao.item_id,
          pagina: sugestao.pagina || '',
          contexto: sugestao.contexto_revisao || '',
        },
      }));
      setNumeroEdicao(diario.numero_edicao || '');
      setDataPublicacao(String(diario.data_publicacao || '').slice(0, 10));
      setRegistroId(diario.id);
      setLeitura(null);
      setSugestoes(sugestoesSalvas);
      setObservacoesIa(salvo.observacoes || '');
      setMetaIa(salvo.meta || null);
      setImportados({});
      setRejeitados({});
      setRevisaoArquivada(true);
      setMensagem(`Revisão do DOEMS ${diario.numero_edicao} retomada sem nova chamada de IA.`);
    } catch (e) {
      setErro('Não foi possível reabrir a análise salva deste diário.');
    }
  };

  const importar = async ({ sugestao, militar, tipo, texto }) => {
    if (!numeroEdicao.trim() || !dataPublicacao) {
      throw new Error('Informe a edição e a data do Diário Oficial antes de importar.');
    }
    const atual = await listarLivroPublicacoesEscopo({ purpose: 'CONCILIACAO' });
    const registrosAtuais = [...(atual.registrosLivro || []), ...(atual.publicacoesExOfficio || [])];
    if (encontrarDuplicidadeDoems({
      registros: registrosAtuais,
      militarId: militar.id,
      edicao: numeroEdicao,
      dataPublicacao,
      texto,
    })) {
      throw new Error('Já existe RP deste militar para este trecho e esta edição do DOEMS.');
    }

    await importarNotaConciliacao({
      militar,
      tipo,
      texto,
      pagina: sugestao.item?.pagina || '',
      doemsEdicao: numeroEdicao.trim(),
      doemsData: dataPublicacao,
      origem: 'doems_ia',
      observacao: `Incluído a partir do DOEMS ${numeroEdicao} de ${dataPublicacao}, após análise assistida por IA e revisão manual. Trecho da página ${sugestao.item?.pagina || '—'}.`,
      user,
    });

    const atualizados = { ...importados, [sugestao.item_id]: true };
    setImportados(atualizados);
    setMensagem('Trecho importado para o RP do militar confirmado.');
    if (registroId) {
      registrarImportacaoDiario(registroId, Object.keys(atualizados).length)
        .then(() => queryClient.invalidateQueries({ queryKey: ['conciliacao-doems-arquivados'] }))
        .catch(() => {});
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['registros-livro'] }),
      queryClient.invalidateQueries({ queryKey: ['publicacoes-ex-officio'] }),
      queryClient.invalidateQueries({ queryKey: ['publicacoes'] }),
    ]);
  };

  const abrirArquivoDiario = async (diario) => {
    setErro('');
    try {
      const url = await obterUrlArquivoDiario(diario.arquivo_uri);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setErro('Não foi possível abrir o PDF guardado no arquivo.');
    }
  };

  const alternarStatusDiario = async (diario) => {
    setErro('');
    const novoStatus = diario.status === 'Concluído' ? 'Em conciliação' : 'Concluído';
    try {
      await atualizarStatusDiario(diario.id, novoStatus);
      queryClient.invalidateQueries({ queryKey: ['conciliacao-doems-arquivados'] });
    } catch (e) {
      setErro(e?.message || 'Não foi possível atualizar a situação do diário.');
    }
  };

  if (loadingUser || !isAccessResolved) return null;
  if (!hasAccess) return <AccessDenied modulo="Conciliação de Diário Oficial" />;

  const visiveis = sugestoes.filter(sugestao => !rejeitados[sugestao.item_id]);
  const carregandoBase = loadingMilitares;

  return (
    <div className="p-4 md:p-8 space-y-5 max-w-[1500px] mx-auto">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-bold text-[#1e3a5f] flex items-center gap-2">
            <Newspaper className="w-5 h-5" />Conciliação de Diário Oficial (DOEMS)
          </CardTitle>
          <p className="text-sm text-slate-500">
            Fluxo separado do BG/BGR. Leia o diário, identifique os atos relativos ao efetivo com apoio opcional de IA
            e importe somente o que você revisar e confirmar.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)_auto] md:items-end">
            <div>
              <Label>Edição / número</Label>
              <Input
                value={numeroEdicao}
                placeholder="Ex.: 0123"
                onChange={e => { setNumeroEdicao(e.target.value); limparRevisao(); setLeitura(null); }}
              />
            </div>
            <div>
              <Label>Data de publicação</Label>
              <Input
                type="date"
                value={dataPublicacao}
                onChange={e => { setDataPublicacao(e.target.value); limparRevisao(); setLeitura(null); }}
              />
            </div>
            <div>
              <Label>PDF do Diário Oficial</Label>
              <Input
                type="file"
                accept=".pdf,application/pdf"
                onChange={e => { setArquivo(e.target.files?.[0] || null); setLeitura(null); limparRevisao(); }}
              />
            </div>
            <Button onClick={lerPdf} disabled={loadingPdf || carregandoBase || !arquivo} className="bg-[#1e3a5f] hover:bg-[#294c75]">
              <FileSearch className="w-4 h-4 mr-2" />{loadingPdf ? 'Lendo…' : 'Ler PDF'}
            </Button>
          </div>

          {carregandoBase && <p className="text-sm text-slate-500">Carregando o efetivo autorizado…</p>}
          {erroMilitares && <p className="text-sm text-red-700">Não foi possível consultar o efetivo. A análise por IA fica indisponível até corrigir a consulta.</p>}
          {erro && <p role="alert" className="text-sm text-red-700 font-medium">{erro}</p>}
          {mensagem && <p role="status" className="text-sm text-emerald-700">{mensagem}</p>}
          {aviso && <p role="alert" className="text-sm text-amber-700">{aviso}</p>}
          {leitura?.paginasSemTexto?.length > 0 && (
            <p className="text-sm text-amber-700">
              {leitura.paginasSemTexto.length} página(s) sem texto extraível; confira PDF digitalizado/OCR antes de importar.
            </p>
          )}
          {leitura?.truncado && (
            <p className="text-sm text-amber-700">
              A leitura foi limitada aos primeiros trechos do documento. Para conferir o restante, use o PDF original.
            </p>
          )}
          {!carregandoBase && !erroMilitares && militares.length === 0 && (
            <p className="text-sm text-amber-700">Nenhum militar ativo foi retornado no escopo. A análise por IA não pode ser considerada completa.</p>
          )}
          <p className="text-xs text-slate-500">
            A leitura do PDF ocorre localmente no navegador. O texto só é enviado a serviços de IA quando você aciona a análise.
          </p>
        </CardContent>
      </Card>

      <ArquivoDoemsCard
        diarios={diarios}
        carregando={carregandoDiarios}
        onAbrirArquivo={abrirArquivoDiario}
        onRetomarAnalise={retomarAnalise}
        onAlternarStatus={alternarStatusDiario}
      />

      {(leitura?.trechos?.length > 0 || revisaoArquivada) && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg text-[#1e3a5f] flex items-center gap-2">
                <Sparkles className="w-5 h-5" />Análise assistida por IA
              </CardTitle>
              <Badge variant="outline">
                {revisaoArquivada ? 'revisão salva' : `${leitura?.trechos?.length || 0} trecho(s)`}
              </Badge>
            </div>
            <p className="text-sm text-slate-500">
              A IA aponta quais trechos do diário se referem a militares do efetivo. Toda importação depende de revisão e
              confirmação individual.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {!revisaoArquivada && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                <p className="text-xs text-slate-600 flex items-start gap-1.5">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
                  A análise envia o texto destes trechos e os militares citados no documento para a IA. Cada análise consome
                  aproximadamente 1 crédito de integração do plano; refazer a análise consome novamente.
                </p>
                <Button onClick={analisar} disabled={analisando || erroMilitares || militares.length === 0} className="bg-[#1e3a5f] hover:bg-[#294c75]">
                  <Sparkles className="w-4 h-4 mr-2" />{analisando ? 'Analisando…' : 'Analisar com IA'}
                </Button>
              </div>
            )}

            {analisando && <p className="text-sm text-slate-500">Analisando o diário… isso pode levar até um minuto.</p>}
            {observacoesIa && <p className="text-xs text-slate-600">{observacoesIa}</p>}
            {metaIa && (
              <p className="text-xs text-slate-500">
                {metaIa.itensAnalisados || 0} item(ns) analisado(s) · {metaIa.candidatosConsiderados || 0} militar(es) comparado(s).
              </p>
            )}
            {revisaoArquivada && (
              <p className="text-xs text-slate-500">
                Revisão carregada do arquivo. Para analisar o diário novamente, leia o PDF outra vez.
              </p>
            )}

            {visiveis.length > 0 ? (
              <SugestoesRevisaoIA
                sugestoes={visiveis}
                militares={militares}
                podeImportar={podeImportar}
                importados={importados}
                onImportar={importar}
                onRejeitar={(sugestao) => setRejeitados(prev => ({ ...prev, [sugestao.item_id]: true }))}
                rotuloItem={(item) => `Trecho · pág. ${item?.pagina || '—'}`}
              />
            ) : (
              !analisando && (
                <p className="text-sm text-slate-500">
                  {sugestoes.length
                    ? 'Todas as sugestões foram rejeitadas ou importadas nesta revisão.'
                    : 'Nenhuma sugestão apresentada ainda. A análise é opcional.'}
                </p>
              )
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}