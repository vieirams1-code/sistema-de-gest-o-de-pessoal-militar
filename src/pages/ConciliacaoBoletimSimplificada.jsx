import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Check, FileSearch, FileText, Upload } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { listarAtestadosPublicacaoEscopo, listarLivroPublicacoesEscopo } from '@/services/publicacoesPainelService';
import { fetchScopedMilitares } from '@/services/getScopedMilitaresClient';
import { atualizarEscopado, criarEscopado } from '@/services/cudEscopadoClient';
import { criarEventoAuditoriaPublicacao, EVENTO_AUDITORIA_PUBLICACAO } from '@/components/publicacao/publicacaoStateMachine';
import { normalizarNotaBoletim, normalizarBuscaBoletim, analisarBoletimContraRegistros, inferirTipoPublicacaoNota } from '@/utils/boletim/auditoriaPdf';
import { lerBoletimPdf } from '@/utils/boletim/leituraPdf';
import { avaliarVinculoPublicacao } from '@/utils/boletim/avaliarVinculo';

const TIPOS_IMPORTACAO = [
  { value: 'Geral', label: 'Geral', entidade: 'PublicacaoExOfficio' },
  { value: 'Elogio Individual', label: 'Elogio Individual', entidade: 'PublicacaoExOfficio' },
  { value: 'Transcrição de Documentos', label: 'Transcrição de Documentos', entidade: 'PublicacaoExOfficio' },
  { value: 'Designação de Função', label: 'Designação de Função', entidade: 'PublicacaoExOfficio' },
  { value: 'Dispensa de Função', label: 'Dispensa de Função', entidade: 'PublicacaoExOfficio' },
  { value: 'Melhoria de Comportamento', label: 'Melhoria de Comportamento', entidade: 'PublicacaoExOfficio' },
  { value: 'Punição', label: 'Punição (revisar dados específicos)', entidade: 'PublicacaoExOfficio' },
  { value: 'Curso/Estágio', label: 'Curso/Estágio', entidade: 'RegistroLivro' },
  { value: 'Dispensa Recompensa', label: 'Dispensa como Recompensa', entidade: 'RegistroLivro' },
  { value: 'Saída Férias', label: 'Saída de Férias', entidade: 'RegistroLivro' },
  { value: 'Retorno Férias', label: 'Retorno de Férias', entidade: 'RegistroLivro' },
  { value: 'Interrupção de Férias', label: 'Interrupção de Férias', entidade: 'RegistroLivro' },
  { value: 'Licença Maternidade', label: 'Licença Maternidade', entidade: 'RegistroLivro' },
  { value: 'Licença Paternidade', label: 'Licença Paternidade', entidade: 'RegistroLivro' },
  { value: 'Núpcias', label: 'Núpcias', entidade: 'RegistroLivro' },
  { value: 'Luto', label: 'Luto', entidade: 'RegistroLivro' },
  { value: 'Trânsito', label: 'Trânsito', entidade: 'RegistroLivro' },
  { value: 'Instalação', label: 'Instalação', entidade: 'RegistroLivro' },
  { value: 'Deslocamento Missão', label: 'Deslocamento para Missão', entidade: 'RegistroLivro' },
  { value: 'Outro', label: 'Outro (Livro)', entidade: 'RegistroLivro' },
];

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

function rotuloMilitar(m) {
  return [m.posto_graduacao, m.nome_completo || m.nome_guerra, m.matricula ? 'Mat. ' + m.matricula : ''].filter(Boolean).join(' · ');
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
  const [importarId, setImportarId] = useState(null);
  const [militarId, setMilitarId] = useState('');
  const [buscaMilitar, setBuscaMilitar] = useState('');
  const [tipoImportacao, setTipoImportacao] = useState('');
  const [textoImportacao, setTextoImportacao] = useState('');
  const [confirmarImportacao, setConfirmarImportacao] = useState(false);
  const [salvandoImportacao, setSalvandoImportacao] = useState(false);
  const [importados, setImportados] = useState({});

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

  // Somente militares ativos sem RP correspondente. Casos com registro
  // semelhante são para revisão do vínculo, não para criação em duplicidade.
  const notasSemRP = useMemo(() => auditoria.ocorrencias
    .filter(o => {
      if (importados[o.id] || o.registro || !['sem_registro', 'revisar_identidade'].includes(o.status)) return false;
      return !registros.some(r =>
        (r.coletiva ? (r.militares_ids || []).map(String).includes(String(o.militar.id)) : String(r.militar_id) === String(o.militar.id)) &&
        normalizarNotaBoletim(r.nota_para_bg || r.nota_conciliada_boletim) === normalizarNotaBoletim(o.nota.nota) &&
        (!r.numero_bg || String(r.numero_bg).replace(/^0+/, '') === numeroBoletim.replace(/^0+/, '')) &&
        (!r.data_bg || String(r.data_bg).slice(0, 10) === dataBoletim)
      );
    })
    .sort((a, b) => Number(a.nota.pagina) - Number(b.nota.pagina)),
  [auditoria, importados, registros, numeroBoletim, dataBoletim]);

  const listaMilitares = useMemo(() => {
    const termo = normalizarBuscaBoletim(buscaMilitar);
    if (!termo) return militares.slice(0, 40);
    return militares.filter(m => normalizarBuscaBoletim(rotuloMilitar(m)).includes(termo)).slice(0, 60);
  }, [militares, buscaMilitar]);

  const resetarImportacao = () => {
    setImportarId(null); setMilitarId(''); setBuscaMilitar(''); setTipoImportacao('');
    setTextoImportacao(''); setConfirmarImportacao(false);
  };

  const reiniciar = () => {
    setLeitura(null); setSelecoesVinculo({}); setVinculosConfirmados({}); setRevisoesVinculo({}); setImportados({});
    resetarImportacao(); setMensagem(''); setErro('');
  };

  const processarPdf = async () => {
    if (!numeroBoletim.trim() || !dataBoletim) {
      setErro('Informe o número e a data do boletim para fazer a conferência.');
      return;
    }
    if (tipoBoletim === 'BGR' && !isAdmin) {
      setErro('Somente o administrador master pode analisar boletim reservado nesta fase.');
      return;
    }
    setErro(''); setMensagem(''); setLoadingPdf(true); setLeitura(null);
    try {
      const resultado = await lerBoletimPdf(arquivo);
      setLeitura(resultado);
      setSelecoesVinculo({}); setVinculosConfirmados({}); setRevisoesVinculo({}); setImportados({}); resetarImportacao();
      if (!resultado.notas.length) {
        setMensagem('Não foram reconhecidas notas no padrão esperado. Confira o PDF; isto não significa ausência de publicações.');
      } else {
        setMensagem(resultado.notas.length + ' nota(s) identificada(s) no PDF. Confira as propostas antes de confirmar.');
      }
    } catch (e) { setErro(e?.message || 'Não foi possível ler o PDF.'); }
    finally { setLoadingPdf(false); }
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

  const abrirImportacao = item => {
    if (tipoBoletim === 'BGR') return;
    setImportarId(item.id);
    setMilitarId('');
    setBuscaMilitar('');
    const sugestao = inferirTipoPublicacaoNota(item.nota.contexto);
    setTipoImportacao(TIPOS_IMPORTACAO.some(t => t.value === sugestao) ? sugestao : '');
    setTextoImportacao(item.nota.contexto || '');
    setConfirmarImportacao(false);
    setErro('');
  };

  const salvarImportacao = async item => {
    if (tipoBoletim === 'BGR' || !confirmarImportacao || !militarId || !tipoImportacao) return;
    const militar = militares.find(m => String(m.id) === String(militarId));
    const tipo = TIPOS_IMPORTACAO.find(t => t.value === tipoImportacao);
    if (!militar || !tipo || !textoImportacao.trim() || !numeroBoletim.trim() || !dataBoletim) {
      setErro('Confirme militar, tipo e texto para registrar a nota.'); return;
    }
    const podeCriar = tipo.entidade === 'RegistroLivro' ? canAccessAction('adicionar_livro') : canAccessAction('adicionar_publicacoes');
    if (!podeCriar || !canAccessAction('publicar_bg')) {
      setErro('Sem permissão para criar este tipo de RP com publicação em BG.'); return;
    }
    setSalvandoImportacao(true); setErro('');
    try {
      // Reconsulta o backend antes de criar para reduzir risco de RP duplicado.
      const atual = await listarLivroPublicacoesEscopo({ purpose: 'CONCILIACAO' });
      const duplicados = [...(atual.registrosLivro || []), ...(atual.publicacoesExOfficio || []), ...atestados]
        .some(r => (r.coletiva ? (r.militares_ids || []).map(String).includes(String(militar.id)) : String(r.militar_id) === String(militar.id)) &&
          normalizarNotaBoletim(r.nota_para_bg || r.nota_conciliada_boletim) === normalizarNotaBoletim(item.nota.nota) &&
          (!r.numero_bg || String(r.numero_bg).replace(/^0+/, '') === numeroBoletim.replace(/^0+/, '')) &&
          (!r.data_bg || String(r.data_bg).slice(0, 10) === dataBoletim));
      if (duplicados) throw new Error('Já existe RP para este militar e nota. Atualize a tela e confira o cadastro antes de importar.');

      const base = {
        militar_id: militar.id,
        militar_nome: militar.nome_completo || militar.nome_guerra || '',
        militar_posto: militar.posto_graduacao || '',
        militar_matricula: militar.matricula || '',
        nota_para_bg: item.nota.nota_normalizada,
        nota_conciliada_boletim: item.nota.nota_normalizada,
        numero_bg: numeroBoletim.trim(),
        data_bg: dataBoletim,
        status: 'Publicado',
        texto_publicacao: textoImportacao.trim(),
        observacoes: 'Incluído mediante revisão e confirmação manual na Auditoria de BG. Nota ' +
          item.nota.nota + ', página ' + item.nota.pagina + '.',
      };
      const registro = tipo.entidade === 'RegistroLivro'
        ? { ...base, tipo_registro: tipo.value, data_registro: dataBoletim, origem: 'Auditoria BG' }
        : { ...base, tipo: tipo.value, data_publicacao: dataBoletim, criado_por_email: user?.email || '' };

      registro.historico_publicacao = [criarEventoAuditoriaPublicacao({
        registro: { ...registro, origem_tipo: tipo.entidade === 'RegistroLivro' ? 'livro' : 'ex-officio' },
        evento: EVENTO_AUDITORIA_PUBLICACAO.CRIACAO,
        usuario: user,
        resumo: 'Importação manual de nota de BG após confirmação de militar e tipo.',
        estadoNovo: 'Publicado',
        metadata: { origem: 'auditoria_bg_pdf', nota: item.nota.nota, pagina: item.nota.pagina,
          numero_bg: numeroBoletim.trim(), data_bg: dataBoletim },
      })];
      await criarEscopado(tipo.entidade, registro);
      setImportados(p => ({ ...p, [item.id]: true }));
      resetarImportacao();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['conciliacao-publicacoes-bundle'] }),
        queryClient.invalidateQueries({ queryKey: ['registros-livro'] }),
        queryClient.invalidateQueries({ queryKey: ['publicacoes-ex-officio'] }),
        queryClient.invalidateQueries({ queryKey: ['publicacoes'] }),
      ]);
      setMensagem('Nota ' + item.nota.nota + ' importada para o RP do militar confirmado.');
    } catch (e) { setErro(e?.message || 'Não foi possível importar a nota.'); }
    finally { setSalvandoImportacao(false); }
  };

  if (loadingUser || !isAccessResolved) return null;
  if (!hasAccess) return <AccessDenied modulo="Conciliação com Boletim" />;
  const carregando = loadingPublicacoes || loadingMilitares || loadingAtestados;
  const houveFalhaDados = erroPublicacoes || erroAtestados || erroMilitares;

  return (
    <div className="p-4 md:p-8 space-y-5 max-w-[1500px] mx-auto">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-bold text-[#1e3a5f]">Conciliação e auditoria de boletins</CardTitle>
          <p className="text-sm text-slate-500">Envie o PDF para conferir os RP já cadastrados e localizar notas ainda não registradas.</p>
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-lg text-[#1e3a5f] flex items-center gap-2"><FileText className="w-5 h-5" />2. Notas sem RP confirmado</CardTitle>
                <Badge variant="outline">{notasSemRP.length} a conferir</Badge>
              </div>
              <p className="text-sm text-slate-500">Identificação por nome completo ou matrícula no corpo da nota, sem usar sobrenomes isolados ou assinaturas. Confirme o militar antes de importar.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {notasSemRP.length === 0 && <p className="text-sm text-slate-500">Nenhuma nota de militar ativo sem correspondência confirmada foi identificada pelo leitor. Revise o PDF para conferir notas com grafias diferentes.</p>}
              {notasSemRP.map(item => {
                const aberta = importarId === item.id;
                const sugerido = inferirTipoPublicacaoNota(item.nota.contexto);
                return (
                  <div key={item.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex flex-wrap justify-between gap-2 items-center">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">Nota {item.nota.nota}</Badge>
                        <span className="text-sm font-semibold">{sugerido}</span>
                        <span className="text-xs text-slate-500">Pág. {item.nota.pagina}</span>
                      </div>
                      <Button variant="outline" size="sm" disabled={tipoBoletim === 'BGR'}
                        onClick={() => aberta ? resetarImportacao() : abrirImportacao(item)}>
                        <Upload className="w-4 h-4 mr-1.5" />{aberta ? 'Cancelar' : 'Importar para RP'}
                      </Button>
                    </div>
                    <p className="text-xs text-slate-600">
                      Militar identificado: <strong>{rotuloMilitar(item.militar)}</strong>
                      {item.status === 'possivel_correspondencia' && ' · Possível registro semelhante no sistema: confira antes de importar.'}
                      {' · Identificação por ' + item.criterio.toLowerCase() + ' no corpo da nota.'}
                    </p>
                    <TextoNota texto={item.nota.contexto} limite={600} />
                    {aberta && (
                      <div className="border-t pt-4 space-y-3 bg-slate-50/60 rounded-b-lg">
                        <p className="font-semibold text-sm text-[#1e3a5f]">Confirmar importação da Nota {item.nota.nota}</p>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-1">
                            <Label>Militar responsável pelo RP *</Label>
                            <Input placeholder="Buscar militar ativo por nome ou matrícula" value={buscaMilitar}
                              onChange={e => { setBuscaMilitar(e.target.value); setMilitarId(''); }} />
                            <select aria-label="Confirmar militar destinatário da publicação"
                              className="w-full h-10 border rounded-md px-2 text-sm bg-white" value={militarId}
                              onChange={e => setMilitarId(e.target.value)}>
                              <option value="">Selecione explicitamente o militar</option>
                              {listaMilitares.map(m => <option key={m.id} value={m.id}>{rotuloMilitar(m)}</option>)}
                              {militarId && !listaMilitares.some(m => String(m.id) === String(militarId)) && (
                                <option value={militarId}>{rotuloMilitar(militares.find(m => String(m.id) === String(militarId)) || {})}</option>
                              )}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <Label>Tipo do RP *</Label>
                            <select aria-label="Tipo do registro de publicação" value={tipoImportacao}
                              onChange={e => setTipoImportacao(e.target.value)}
                              className="w-full h-10 border rounded-md px-2 text-sm bg-white">
                              <option value="">Selecione o tipo a registrar</option>
                              {TIPOS_IMPORTACAO.map(t => <option key={t.entidade + t.value} value={t.value}>{t.label}</option>)}
                            </select>
                            <p className="text-xs text-slate-500">O tipo sugerido é apenas indicativo. Confirme a classificação correta.</p>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label>Texto da publicação (revisável) *</Label>
                          <textarea aria-label="Texto a importar" rows={5} className="w-full rounded-md border p-3 text-sm bg-white"
                            value={textoImportacao} onChange={e => setTextoImportacao(e.target.value)} />
                        </div>
                        <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
                          <input type="checkbox" checked={confirmarImportacao} onChange={e => setConfirmarImportacao(e.target.checked)} className="mt-1" />
                          Confirmei o militar, o tipo e o texto com o PDF original. Autorizo criar um RP publicado com esta nota e este BG.
                        </label>
                        <div className="flex justify-end">
                          <Button disabled={salvandoImportacao || !confirmarImportacao || !militarId || !tipoImportacao ||
                            !textoImportacao.trim() || !canAccessAction('publicar_bg')}
                            onClick={() => salvarImportacao(item)}>
                            {salvandoImportacao ? 'Importando…' : 'Confirmar e importar RP'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {auditoria.notasSemMilitar.length > 0 && (
                <p className="text-xs text-slate-500">Outras {auditoria.notasSemMilitar.length} nota(s) não tiveram militar ativo identificado e não foram apresentadas para importação automática. A análise não substitui a conferência integral do boletim.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
      <p className="text-xs text-slate-500">A leitura do PDF ocorre localmente no navegador; arquivos e textos não são enviados a serviços externos de IA. Boletins digitalizados podem exigir OCR.</p>
    </div>
  );
}