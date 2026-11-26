import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Check, FileSearch } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { listarAtestadosPublicacaoEscopo, listarLivroPublicacoesEscopo } from '@/services/publicacoesPainelService';
import { fetchScopedMilitares } from '@/services/getScopedMilitaresClient';
import { atualizarEscopado } from '@/services/cudEscopadoClient';
import { normalizarNotaBoletim, analisarBoletimContraRegistros } from '@/utils/boletim/auditoriaPdf';
import { lerBoletimPdf } from '@/utils/boletim/leituraPdf';
import { avaliarVinculoPublicacao } from '@/utils/boletim/avaliarVinculo';
import ArquivoBoletinsSheet from '@/components/conciliacao-boletim/ArquivoBoletinsSheet';
import AnaliseIaBoletimCard from '@/components/conciliacao-boletim/AnaliseIaBoletimCard';
import {
  arquivarBoletimConciliacao,
  atualizarStatusBoletimConciliacao,
  excluirBoletimConciliacao,
  listarBoletinsConciliacao,
  marcarStatusSugestaoIaBoletim,
  obterUrlArquivoBoletim,
  salvarAnaliseIaBoletim,
} from '@/services/boletimConciliacaoService';

function TextoNota({ texto, limite = 195 }) {
  const [aberto, setAberto] = useState(false);
  const value = String(texto || '');
  return (
    <div className="space-y-1">
      <p className="text-sm leading-5 text-slate-700 whitespace-pre-wrap break-words">
        {aberto || value.length <= limite ? value : value.slice(0, limite) + '…'}
      </p>
      {value.length > limite && (
        <button type="button" className="text-xs font-medium text-blue-700 hover:underline"
          onClick={() => setAberto(!aberto)}>{aberto ? 'Recolher texto' : 'Ler texto completo'}</button>
      )}
    </div>
  );
}

function ehPublicado(registro) {
  return Boolean(registro?.numero_bg && registro?.data_bg);
}

function tipoRegistro(registro) {
  if (registro.__entidade === 'Atestado') return 'Atestado';
  return registro.tipo_registro || registro.tipo || 'Registro';
}

function normalizarLista(registrosLivro, publicacoesExOfficio, atestados) {
  return [
    ...registrosLivro.map(r => ({ ...r, __entidade: 'RegistroLivro' })),
    ...publicacoesExOfficio.map(r => ({ ...r, __entidade: 'PublicacaoExOfficio' })),
    ...atestados.map(r => ({ ...r, __entidade: 'Atestado' })),
  ];
}

function ChavePublicacao({ pub }) {
  return <span className="text-xs text-slate-500">Nota {pub.nota_para_bg || '—'} · {tipoRegistro(pub)}</span>;
}

export default function ConciliacaoBoletimSimplificada() {
  const queryClient = useQueryClient();
  const { isAdmin, isAccessResolved, isLoading: loadingUser, hasGlobalScope, getMilitarScopeFilters,
    canAccessModule, canAccessAction, user } = useCurrentUser();

  const hasAccess = canAccessModule('conciliacao_boletim') && canAccessAction('visualizar_conciliacao_boletim');
  const [tipoBoletim, setTipoBoletim] = useState('BG');
  const [numeroBoletim, setNumeroBoletim] = useState('');
  const [dataBoletim, setDataBoletim] = useState('');
  const [arquivo, setArquivo] = useState(null);
  const [leitura, setLeitura] = useState(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [selecoesVinculo, setSelecoesVinculo] = useState({});
  const [vinculosConfirmados, setVinculosConfirmados] = useState({});
  const [revisoesVinculo, setRevisoesVinculo] = useState({});
  const [salvandoVinculo, setSalvandoVinculo] = useState(null);
  const [avisoArquivo, setAvisoArquivo] = useState('');
  const [boletimRegistroId, setBoletimRegistroId] = useState('');
  const [analiseAnterior, setAnaliseAnterior] = useState(null);
  const [reabrindoId, setReabrindoId] = useState('');

  const { data: bundle = {}, isLoading: loadingPublicacoes, isError: erroPublicacoes } = useQuery({
    queryKey: ['conciliacao-publicacoes-bundle'],
    queryFn: () => listarLivroPublicacoesEscopo({ purpose: 'CONCILIACAO' }),
    enabled: isAccessResolved && hasAccess,
  });
  const { data: atestados = [], isLoading: loadingAtestados, isError: erroAtestados } = useQuery({
    queryKey: ['conciliacao-atestados-publicacao'],
    queryFn: () => listarAtestadosPublicacaoEscopo({ isAdmin, hasGlobalScope, getMilitarScopeFilters }),
    enabled: isAccessResolved && hasAccess,
  });
  const { data: bundleMilitares = {}, isLoading: loadingMilitares, isError: erroMilitares } = useQuery({
    queryKey: ['conciliacao-boletim-militares-ativos'],
    queryFn: () => fetchScopedMilitares({ fetchAll: true, statusCadastro: 'Ativo', includeFoto: false }),
    enabled: isAccessResolved && hasAccess,
    staleTime: 60000,
  });

  const { data: boletinsArquivados = [], isLoading: carregandoArquivo } = useQuery({
    queryKey: ['conciliacao-boletins-arquivados'],
    queryFn: listarBoletinsConciliacao,
    enabled: isAccessResolved && hasAccess,
  });

  const militares = useMemo(() => (bundleMilitares?.militares || []).filter(m => m.status_cadastro === 'Ativo'), [bundleMilitares]);
  const registros = useMemo(() => normalizarLista(bundle.registrosLivro || [], bundle.publicacoesExOfficio || [], atestados),
    [bundle, atestados]);
  const notas = leitura?.notas || [];

  const pendentesComNota = useMemo(() => {
    const numeros = new Set(notas.map(n => normalizarNotaBoletim(n.nota)));
    return registros.filter(r => !ehPublicado(r) && r.nota_para_bg && numeros.has(normalizarNotaBoletim(r.nota_para_bg)));
  }, [registros, notas]);

  const auditoria = useMemo(() => {
    if (!leitura || erroMilitares || erroPublicacoes || erroAtestados) return { ocorrencias: [], notasSemMilitar: [] };
    return analisarBoletimContraRegistros(notas, militares, registros, { numeroBoletim, dataBoletim });
  }, [leitura, notas, militares, registros, numeroBoletim, dataBoletim, erroMilitares, erroPublicacoes, erroAtestados]);

  // Conciliações já registradas neste boletim: mostram o que foi vinculado
  // entre a nota do PDF e o RP, inclusive o que veio da análise de IA.
  const conciliacoesFeitas = useMemo(() => {
    const numeroLimpo = String(numeroBoletim || '').replace(/^0+/, '');
    if (!numeroLimpo) return [];
    return registros.filter(r => ehPublicado(r)
      && String(r.numero_bg || '').replace(/^0+/, '') === numeroLimpo
      && (!r.data_bg || String(r.data_bg).slice(0, 10) === dataBoletim));
  }, [registros, numeroBoletim, dataBoletim]);

  const reiniciar = () => {
    setLeitura(null); setSelecoesVinculo({}); setVinculosConfirmados({}); setRevisoesVinculo({});
    setMensagem(''); setErro('');
    setBoletimRegistroId(''); setAnaliseAnterior(null);
  };

  // Notas que a leitura local não conseguiu vincular com confiança: são as
  // candidatas à análise assistida por IA (opcional).
  const notasParaIa = useMemo(() => {
    const comConfianca = new Set();
    for (const ocorrencia of auditoria.ocorrencias || []) {
      if (ocorrencia.status !== 'revisar_identidade') comConfianca.add(String(ocorrencia.nota.id));
    }
    return notas.filter(nota => !comConfianca.has(String(nota.id)));
  }, [auditoria, notas]);

  const processarPdf = async () => {
    if (!numeroBoletim.trim() || !dataBoletim) {
      setErro('Informe o número e a data do boletim para fazer a conferência.');
      return;
    }
    if (tipoBoletim === 'BGR' && !isAdmin) {
      setErro('Somente o administrador master pode analisar boletim reservado nesta fase.');
      return;
    }
    setErro(''); setMensagem(''); setAvisoArquivo(''); setLoadingPdf(true); setLeitura(null);
    try {
      const resultado = await lerBoletimPdf(arquivo);
      setLeitura(resultado);
      setSelecoesVinculo({}); setVinculosConfirmados({}); setRevisoesVinculo({});

      const auditoriaLeitura = analisarBoletimContraRegistros(resultado.notas, militares, registros, { numeroBoletim, dataBoletim });
      let complemento = '';
      try {
        const { registro, jaExistia } = await arquivarBoletimConciliacao({
          arquivo, tipo: tipoBoletim, numero: numeroBoletim, dataBoletim, leitura: resultado, auditoria: auditoriaLeitura, usuario: user,
        });
        setBoletimRegistroId(registro?.id || '');
        let analiseSalva = null;
        try { analiseSalva = registro?.analise_ia_json ? JSON.parse(registro.analise_ia_json) : null; } catch { analiseSalva = null; }
        setAnaliseAnterior(analiseSalva
          ? { ...analiseSalva, em: registro?.analise_ia_em || '', por: registro?.analise_ia_por_email || '' }
          : null);
        queryClient.invalidateQueries({ queryKey: ['conciliacao-boletins-arquivados'] });
        complemento = jaExistia
          ? ' Este boletim já constava no arquivo; os dados foram atualizados.'
          : ' Boletim registrado no arquivo de conciliação.';
      } catch (e) {
        setAvisoArquivo('O boletim foi analisado, mas não foi possível guardar o PDF no arquivo: ' + (e?.message || 'falha no armazenamento') + '.');
      }

      if (!resultado.notas.length) {
        setMensagem('Não foram reconhecidas notas no padrão esperado. Confira o PDF; isto não significa ausência de publicações.' + complemento);
      } else {
        setMensagem(resultado.notas.length + ' nota(s) identificada(s) no PDF. Confira as propostas antes de confirmar.' + complemento);
      }
    } catch (e) { setErro(e?.message || 'Não foi possível ler o PDF.'); }
    finally { setLoadingPdf(false); }
  };

  const abrirArquivoBoletim = async (boletim) => {
    setErro('');
    try {
      const url = await obterUrlArquivoBoletim(boletim.arquivo_uri);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setErro('Não foi possível abrir o PDF guardado no arquivo.');
    }
  };

  const alterarStatusBoletim = async (boletim, status) => {
    setErro('');
    try {
      await atualizarStatusBoletimConciliacao(boletim.id, status);
      queryClient.invalidateQueries({ queryKey: ['conciliacao-boletins-arquivados'] });
    } catch (e) {
      setErro(e?.message || 'Não foi possível atualizar a situação do boletim.');
    }
  };

  const excluirBoletim = async (boletim) => {
    setErro('');
    try {
      await excluirBoletimConciliacao(boletim.id);
      if (boletim.id === boletimRegistroId) reiniciar();
      queryClient.invalidateQueries({ queryKey: ['conciliacao-boletins-arquivados'] });
      setMensagem(boletim.tipo + ' Nº ' + boletim.numero + ' removido do arquivo de conciliação.');
    } catch (e) {
      setErro(e?.message || 'Não foi possível excluir o boletim do arquivo.');
    }
  };

  // Reabre o boletim arquivado: relê o PDF guardado e retoma a análise de IA salva.
  const reabrirBoletim = async (boletim) => {
    setErro(''); setMensagem(''); setAvisoArquivo('');
    if (boletim.tipo === 'BGR' && !isAdmin) {
      setErro('Somente o administrador master pode reabrir boletim reservado nesta fase.');
      return;
    }
    if (!boletim.arquivo_uri) {
      setErro('Este boletim não tem PDF guardado no arquivo.');
      return;
    }
    setReabrindoId(boletim.id); setLoadingPdf(true); setLeitura(null);
    try {
      const url = await obterUrlArquivoBoletim(boletim.arquivo_uri);
      const resposta = await fetch(url);
      if (!resposta.ok) throw new Error('Não foi possível baixar o PDF guardado no arquivo.');
      const blob = await resposta.blob();
      const nomeArquivo = /\.pdf$/i.test(boletim.arquivo_nome || '')
        ? boletim.arquivo_nome
        : (boletim.tipo || 'boletim') + '-' + (boletim.numero || 'arquivo') + '.pdf';
      const file = new File([blob], nomeArquivo, { type: 'application/pdf' });

      let analiseSalva = null;
      try { analiseSalva = boletim.analise_ia_json ? JSON.parse(boletim.analise_ia_json) : null; } catch { analiseSalva = null; }

      setTipoBoletim(boletim.tipo || 'BG');
      setNumeroBoletim(boletim.numero || '');
      setDataBoletim(String(boletim.data_boletim || '').slice(0, 10));
      setArquivo(file);
      setBoletimRegistroId(boletim.id);
      setAnaliseAnterior(analiseSalva
        ? { ...analiseSalva, em: boletim.analise_ia_em || '', por: boletim.analise_ia_por_email || '' }
        : null);

      const resultado = await lerBoletimPdf(file);
      setLeitura(resultado);
      setSelecoesVinculo({}); setVinculosConfirmados({}); setRevisoesVinculo({});

      if (boletim.status === 'Concluído') {
        await atualizarStatusBoletimConciliacao(boletim.id, 'Em análise');
        queryClient.invalidateQueries({ queryKey: ['conciliacao-boletins-arquivados'] });
      }
      setMensagem(boletim.tipo + ' Nº ' + boletim.numero + ' reaberto: ' + resultado.notas.length + ' nota(s) relida(s) do PDF guardado.');
    } catch (e) {
      setErro(e?.message || 'Não foi possível reabrir o boletim arquivado.');
    } finally {
      setReabrindoId(''); setLoadingPdf(false);
    }
  };

  const idRegistro = r => r.__entidade + ':' + r.id;
  const notaSugerida = pub => {
    const numero = normalizarNotaBoletim(pub.nota_para_bg);
    return notas.find(n => normalizarNotaBoletim(n.nota) === numero) || null;
  };

  const confirmarVinculo = async (pub) => {
    if (tipoBoletim === 'BGR') return;
    const chave = idRegistro(pub);
    const notaId = selecoesVinculo[chave] || notaSugerida(pub)?.id;
    const nota = notas.find(n => n.id === notaId);
    const avaliacao = avaliarVinculoPublicacao(pub, nota, militares, leitura || {});
    if (!nota || !canAccessAction('publicar_bg') || avaliacao.bloqueado ||
        (avaliacao.exigeRevisao && !revisoesVinculo[chave])) {
      setErro('Revise a nota, o militar e o conteúdo; confirme explicitamente as divergências antes de publicar.');
      return;
    }
    setSalvandoVinculo(chave); setErro('');
    try {
      const payload = {
        numero_bg: numeroBoletim.trim(),
        data_bg: dataBoletim,
        nota_conciliada_boletim: nota.nota_normalizada,
        ...(pub.__entidade === 'Atestado' ? { status_publicacao: 'Publicado' } : { status: 'Publicado' }),
      };
      await atualizarEscopado(pub.__entidade, pub.id, payload);
      setVinculosConfirmados(v => ({ ...v, [chave]: true }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['conciliacao-publicacoes-bundle'] }),
        queryClient.invalidateQueries({ queryKey: ['conciliacao-atestados-publicacao'] }),
        queryClient.invalidateQueries({ queryKey: ['registros-livro'] }),
        queryClient.invalidateQueries({ queryKey: ['publicacoes-ex-officio'] }),
        queryClient.invalidateQueries({ queryKey: ['publicacoes'] }),
      ]);
      setMensagem('Vínculo da nota ' + nota.nota + ' confirmado e registro atualizado.');
    } catch (e) { setErro(e?.message || 'Falha ao confirmar vínculo.'); }
    finally { setSalvandoVinculo(null); }
  };

  if (loadingUser || !isAccessResolved) return null;
  if (!hasAccess) return <AccessDenied modulo="Conciliação com Boletim" />;
  const carregando = loadingPublicacoes || loadingMilitares || loadingAtestados;
  const houveFalhaDados = erroPublicacoes || erroAtestados || erroMilitares;

  return (
    <div className="p-4 md:p-8 space-y-5 max-w-[1500px] mx-auto">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl font-bold text-[#1e3a5f]">Conciliação e auditoria de boletins</CardTitle>
              <p className="text-sm text-slate-500">Envie o PDF para conferir os RP já cadastrados e localizar notas ainda não registradas.</p>
            </div>
            <ArquivoBoletinsSheet
              boletins={boletinsArquivados}
              carregando={carregandoArquivo}
              reabrindoId={reabrindoId}
              onAbrirArquivo={abrirArquivoBoletim}
              onReabrir={reabrirBoletim}
              onAlterarStatus={alterarStatusBoletim}
              onExcluir={excluirBoletim}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)_auto] md:items-end">
            <div><Label>Boletim</Label>
              <select aria-label="Tipo de boletim" className="w-full h-10 rounded-md border px-2 bg-white" value={tipoBoletim}
                onChange={e => { setTipoBoletim(e.target.value); reiniciar(); }}>
                <option value="BG">Geral (BG)</option>
                {isAdmin && <option value="BGR">Reservado (BGR)</option>}
              </select>
            </div>
            <div><Label>Número</Label><Input value={numeroBoletim} placeholder="Ex.: 045" onChange={e => { setNumeroBoletim(e.target.value); reiniciar(); }} /></div>
            <div><Label>Data</Label><Input type="date" value={dataBoletim} onChange={e => { setDataBoletim(e.target.value); reiniciar(); }} /></div>
            <div><Label>PDF do boletim</Label><Input type="file" accept=".pdf,application/pdf" onChange={e => { setArquivo(e.target.files?.[0] || null); reiniciar(); }} /></div>
            <Button onClick={processarPdf} disabled={loadingPdf || carregando || !arquivo} className="bg-[#1e3a5f] hover:bg-[#294c75]">
              <FileSearch className="w-4 h-4 mr-2" />{loadingPdf ? 'Lendo…' : 'Analisar PDF'}
            </Button>
          </div>
          {carregando && <p className="text-sm text-slate-500">Carregando RP e efetivo autorizado…</p>}
          {houveFalhaDados && <p className="text-sm text-red-700">Não foi possível consultar integralmente o RP ou o efetivo. A auditoria está indisponível até corrigir a consulta.</p>}
          {erro && <p role="alert" className="text-sm text-red-700 font-medium">{erro}</p>}
          {mensagem && <p role="status" className="text-sm text-emerald-700">{mensagem}</p>}
          {avisoArquivo && <p role="alert" className="text-sm text-amber-700">{avisoArquivo}</p>}
          {leitura && (
            <p className="text-xs text-slate-600">
              {leitura.notas.filter(n => n.relacionados?.encontrada).length} de {leitura.notas.length} nota(s) com a seção
              "Militares relacionados com a nota" reconhecida.
            </p>
          )}
          {leitura?.paginasSemTexto?.length > 0 && <p className="text-sm text-amber-700">
            {leitura.paginasSemTexto.length} página(s) sem texto extraível; confira PDF digitalizado/OCR antes de importar.
          </p>}
          {leitura?.notas?.some(n => n.textoTruncado) && <p className="text-sm text-amber-700">Algumas notas extensas tiveram o texto limitado. Confira o PDF original antes de qualquer gravação.</p>}
          {(leitura?.paginasComDuasColunas?.length || 0) > 0 && <p className="text-xs text-slate-500">Leitura por colunas aplicada em {leitura.paginasComDuasColunas.length} página(s).</p>}
          {(leitura?.paginasLayoutIncertos?.length || 0) > 0 && <p role="alert" className="text-sm text-amber-700">Layout complexo nas páginas {leitura.paginasLayoutIncertos.join(', ')}. Compare com o PDF original antes de confirmar.</p>}
          {!carregando && !erroMilitares && militares.length === 0 && <p className="text-sm text-amber-700">Nenhum militar ativo foi retornado no escopo. A busca por notas sem RP não pode ser considerada completa.</p>}
          {tipoBoletim === 'BGR' && <p className="text-xs text-amber-700">BGR: somente leitura local para o administrador master; nenhuma gravação no RP nesta fase.</p>}
        </CardContent>
      </Card>

      {leitura && !houveFalhaDados && !carregando && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-lg text-[#1e3a5f] flex items-center gap-2"><ArrowLeftRight className="w-5 h-5" />1. Conciliar publicações</CardTitle>
                <span className="text-sm text-slate-500">{pendentesComNota.length} encontrada(s) na base</span>
              </div>
              <p className="text-sm text-slate-500">Confira lado a lado. Somente o botão de confirmação grava a publicação no SGP.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendentesComNota.length === 0 && <p className="text-sm text-slate-500">Nenhum RP pendente com nota correspondente neste boletim.</p>}
              {pendentesComNota.map(pub => {
                const chave = idRegistro(pub);
                const sugerida = notaSugerida(pub);
                const escolhida = notas.find(n => n.id === (selecoesVinculo[chave] || sugerida?.id)) || null;
                const confirmado = Boolean(vinculosConfirmados[chave]);
                const avaliacao = avaliarVinculoPublicacao(pub, escolhida, militares, leitura);
                const podeConfirmar = !confirmado && salvandoVinculo !== chave && tipoBoletim !== 'BGR' &&
                  canAccessAction('publicar_bg') && !avaliacao.bloqueado &&
                  (!avaliacao.exigeRevisao || revisoesVinculo[chave]);
                return (
                  <div key={chave} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                    <div className="px-3 py-2 border-b flex flex-wrap justify-between items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">Nota {pub.nota_para_bg}</Badge>
                        <span className="text-xs text-slate-500">{tipoRegistro(pub)}</span>
                      </div>
                      <Badge className={avaliacao.compativel ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}>
                        {avaliacao.compativel ? 'Dados compatíveis · confira' : 'Requer conferência'}
                      </Badge>
                    </div>
                    <div className="grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x">
                      <div className="px-3 py-2.5 bg-slate-50 space-y-1.5 min-w-0">
                        <p className="text-xs font-semibold text-slate-500 uppercase">RP no sistema</p>
                        <p className="text-sm font-semibold">{pub.militar_nome || pub.nome_completo || 'Militar cadastrado'}</p>
                        <TextoNota texto={pub.texto_publicacao || pub.texto || pub.documento_texto || 'Sem texto no RP.'} limite={220} />
                      </div>
                      <div className="px-3 py-2.5 space-y-1.5 min-w-0">
                        <div className="flex justify-between items-center gap-2">
                          <p className="text-xs font-semibold text-blue-700 uppercase">Nota do boletim</p>
                          <span className="text-xs text-slate-500">Pág. {escolhida?.pagina || '—'}</span>
                        </div>
                        <select aria-label={'Nota para o RP ' + pub.id}
                          className="w-full h-8 rounded-md border px-2 text-xs bg-white"
                          disabled={confirmado || tipoBoletim === 'BGR'}
                          value={escolhida?.id || ''}
                          onChange={e => {
                            setSelecoesVinculo(v => ({ ...v, [chave]: e.target.value }));
                            setRevisoesVinculo(v => ({ ...v, [chave]: false }));
                          }}>
                          {notas.map(n => <option key={n.id} value={n.id}>Nota {n.nota} · página {n.pagina}</option>)}
                        </select>
                        <TextoNota texto={escolhida?.contexto || 'Nota não encontrada.'} limite={220} />
                      </div>
                    </div>
                    <div className="px-3 py-2 border-t flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                        <span className={avaliacao.numeroOK ? 'text-emerald-700' : 'text-red-700'}>
                          {avaliacao.numeroOK ? '✓' : '✕'} Número da nota
                        </span>
                        <span className={avaliacao.identidade === 'confirmada' ? 'text-emerald-700' : 'text-amber-700'}>
                          {avaliacao.identidade === 'confirmada' ? '✓' : '!'} Militar
                        </span>
                        <span className={avaliacao.textoOK ? 'text-emerald-700' : 'text-amber-700'}>
                          {avaliacao.textoOK ? '✓' : '!'} Texto {avaliacao.similaridade}% de similaridade indicativa
                        </span>
                        {avaliacao.problemas.length > 0 && (
                          <span className="text-amber-700">{avaliacao.problemas.join(' · ')}</span>
                        )}
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        {avaliacao.exigeRevisao && !avaliacao.bloqueado ? (
                          <label className="flex items-start gap-2 text-xs text-amber-800 cursor-pointer">
                            <input type="checkbox" className="mt-0.5" checked={Boolean(revisoesVinculo[chave])}
                              onChange={e => setRevisoesVinculo(v => ({ ...v, [chave]: e.target.checked }))} />
                            Conferi a identidade, o tipo e o conteúdo no PDF original. Confirmo este vínculo apesar das divergências indicadas.
                          </label>
                        ) : (
                          <span className="text-xs text-slate-500">
                            {avaliacao.bloqueado ? 'Vínculo bloqueado: o número da nota não corresponde ao RP.' : 'A confirmação é individual.'}
                          </span>
                        )}
                        <Button size="sm" className="shrink-0" disabled={!podeConfirmar}
                          onClick={() => confirmarVinculo(pub)}>
                          <Check className="w-4 h-4 mr-1.5" />
                          {confirmado ? 'Confirmado' : salvandoVinculo === chave ? 'Confirmando…' : 'Confirmar vínculo'}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {conciliacoesFeitas.length > 0 && (
                <details className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-emerald-900">
                    {conciliacoesFeitas.length} conciliação(ões) já registrada(s) neste boletim
                  </summary>
                  <p className="mt-2 text-xs text-emerald-800">
                    Notas do PDF que já foram vinculadas ao RP, incluindo as importadas pela análise de IA.
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {conciliacoesFeitas.map(registro => (
                      <div key={idRegistro(registro)} className="rounded border bg-white px-2 py-1.5">
                        <p className="text-xs font-semibold text-slate-800">
                          {registro.militar_nome || registro.nome_completo || 'Militar cadastrado'} · Nota{' '}
                          {registro.nota_para_bg || registro.nota_conciliada_boletim || '—'}
                        </p>
                        <p className="text-xs text-slate-500">{tipoRegistro(registro)} · publicado no {registro.numero_bg}</p>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </CardContent>
          </Card>

          <AnaliseIaBoletimCard
            boletimId={boletimRegistroId}
            notas={notasParaIa}
            militares={militares}
            numeroBoletim={numeroBoletim.trim()}
            dataBoletim={dataBoletim}
            tipoBoletim={tipoBoletim}
            analiseAnterior={analiseAnterior}
            podeImportar={canAccessAction('adicionar_publicacoes') || canAccessAction('adicionar_livro')}
            onSalvarAnalise={async (resultado) => {
              if (!boletimRegistroId) return;
              await salvarAnaliseIaBoletim(boletimRegistroId, { resultado, usuario: user });
              queryClient.invalidateQueries({ queryKey: ['conciliacao-boletins-arquivados'] });
            }}
            onMarcarStatus={async (itemId, status) => {
              if (!boletimRegistroId) return;
              try {
                await marcarStatusSugestaoIaBoletim(boletimRegistroId, itemId, status);
              } catch {
                // A decisão já foi aplicada na tela; falhar aqui não desfaz a importação.
              }
            }}
            onAtualizar={() => {
              queryClient.invalidateQueries({ queryKey: ['conciliacao-publicacoes-bundle'] });
              queryClient.invalidateQueries({ queryKey: ['registros-livro'] });
              queryClient.invalidateQueries({ queryKey: ['publicacoes-ex-officio'] });
              queryClient.invalidateQueries({ queryKey: ['publicacoes'] });
            }}
            user={user}
          />
        </>
      )}
      <p className="text-xs text-slate-500">A leitura do PDF ocorre localmente no navegador; a análise por IA, quando acionada, envia apenas o texto das notas pendentes e os militares do efetivo. Boletins digitalizados podem exigir OCR.</p>
    </div>
  );
}