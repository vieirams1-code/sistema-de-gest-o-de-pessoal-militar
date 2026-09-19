import React, { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { ClipboardCheck, FileUp, Plus, Search, Users, CheckCircle2, AlertTriangle, XCircle, UserMinus, Save, RotateCcw, Eye, Pencil, Trash2, Download, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { centralConferenciasService } from '@/services/centralConferenciasService';
import { cruzarListagem, extrairNomesPlanilha, prepararLinhasTexto } from '@/utils/centralConferencias';

const PDFJS_CDN_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs';
const PDFJS_WORKER_CDN_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';

const STATUS = {
  ENCONTRADO: { label: 'Encontrado', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CONFIRMADO: { label: 'Confirmado', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  DUVIDOSO: { label: 'Duvidoso', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  NAO_LOCALIZADO: { label: 'Não localizado', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  AUSENTE_NA_LISTA: { label: 'Ausente na lista', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  IGNORADO: { label: 'Ignorado', cls: 'bg-slate-50 text-slate-500 border-slate-200' },
};

async function extrairPdf(file) {
  const mod = await import(/* @vite-ignore */ PDFJS_CDN_URL);
  mod.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN_URL;
  const loadingTask = mod.getDocument({ data: await file.arrayBuffer(), useWorkerFetch: false });
  const pdf = await loadingTask.promise;
  const linhas = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    let atual = '';
    let ultimoY = null;
    for (const item of content.items || []) {
      const y = Math.round(item?.transform?.[5] || 0);
      if (ultimoY !== null && Math.abs(y - ultimoY) > 3 && atual.trim()) {
        linhas.push(atual.trim());
        atual = '';
      }
      atual += (atual ? ' ' : '') + String(item?.str || '');
      ultimoY = y;
    }
    if (atual.trim()) linhas.push(atual.trim());
  }
  return linhas.filter(Boolean);
}

async function lerArquivo(file) {
  const ext = String(file?.name || '').split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return { linhas: await extrairPdf(file), tipo: 'PDF' };
  if (['xlsx', 'xls', 'csv'].includes(ext)) {
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const extraido = extrairNomesPlanilha(rows);
    return {
      linhas: extraido.linhas,
      tipo: ext === 'csv' ? 'CSV' : 'XLSX',
      colunaNome: extraido.colunaNome,
      cabecalhoDetectado: extraido.cabecalhoDetectado,
    };
  }
  return { linhas: prepararLinhasTexto(await file.text()), tipo: 'TXT' };
}

function nomeMilitar(m) { return m?.nome_completo || m?.nome || m?.nome_guerra || 'Militar sem nome'; }

function linhasExportacao(itens = []) {
  return itens.map((i) => ({
    Tipo: i.tipo_linha === 'ENTRADA' ? 'Recebido na lista' : 'Militar do universo',
    Recebido: i.entrada_original || '',
    Militar: i.militar_nome || '',
    Matricula: i.militar_matricula || '',
    'Posto/Graduação': i.militar_posto_graduacao || '',
    Status: STATUS[i.status]?.label || i.status || '',
    'Confiança (%)': Math.round((i.score || 0) * 100),
    Critério: i.criterio || '',
    Observação: i.observacao || '',
  }));
}

function exportarConferencia(itens, titulo, formato = 'xlsx') {
  const dados = linhasExportacao(itens);
  const nomeSeguro = String(titulo || 'conferencia').replace(/[^a-zA-Z0-9-_]+/g, '_').replace(/^_+|_+$/g, '') || 'conferencia';
  const ws = XLSX.utils.json_to_sheet(dados);
  if (formato === 'csv') {
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${nomeSeguro}.csv`; a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Conferência');
  XLSX.writeFile(wb, `${nomeSeguro}.xlsx`);
}

export default function CentralConferencias() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, canAccessAction, isLoading, isAccessResolved } = useCurrentUser();
  const podeVer = isAdmin || canAccessAction('perm_visualizar_central_conferencias');
  const podeGerir = isAdmin || canAccessAction('perm_gerir_central_conferencias');
  const fileRef = useRef(null);

  const [nova, setNova] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState('');
  const [fonteNome, setFonteNome] = useState('');
  const [fonteTipo, setFonteTipo] = useState('TEXTO');
  const [linhasArquivo, setLinhasArquivo] = useState([]);
  const [universoTipo, setUniversoTipo] = useState('TODO_ESCOPO');
  const [universoRefId, setUniversoRefId] = useState('');
  const [buscaManual, setBuscaManual] = useState('');
  const [selecionados, setSelecionados] = useState(new Set());
  const [resultado, setResultado] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState('TODOS');
  const [lendoArquivo, setLendoArquivo] = useState(false);
  const [editandoId, setEditandoId] = useState('');
  const [detalhe, setDetalhe] = useState(null);
  const [buscaHistorico, setBuscaHistorico] = useState('');
  const [statusHistorico, setStatusHistorico] = useState('TODOS');

  const bootstrap = useQuery({
    queryKey: ['central-conferencias-bootstrap'],
    queryFn: () => centralConferenciasService.bootstrap(),
    enabled: podeVer && isAccessResolved,
  });
  const historico = useQuery({
    queryKey: ['central-conferencias-historico'],
    queryFn: () => centralConferenciasService.listar(),
    enabled: podeVer && isAccessResolved,
  });

  const militares = bootstrap.data?.militares || [];
  const grupos = bootstrap.data?.grupos || [];
  const membros = bootstrap.data?.membros || [];

  const lotacoes = useMemo(() => {
    const map = new Map();
    militares.forEach((m) => {
      const id = String(m?.estrutura_id || m?.subgrupamento_id || '');
      const nome = m?.estrutura_nome || m?.subgrupamento_nome || '';
      if (id && nome) map.set(id, nome);
    });
    return [...map.entries()].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [militares]);

  const universo = useMemo(() => {
    if (universoTipo === 'TODO_ESCOPO') return militares;
    if (universoTipo === 'LOTACAO') return militares.filter((m) => String(m?.estrutura_id || m?.subgrupamento_id || '') === universoRefId);
    if (universoTipo === 'GRUPO') {
      const ids = new Set(membros.filter((x) => String(x?.grupo_id) === universoRefId && x?.ativo !== false).map((x) => String(x.militar_id)));
      return militares.filter((m) => ids.has(String(m.id)));
    }
    return militares.filter((m) => selecionados.has(String(m.id)));
  }, [militares, membros, universoTipo, universoRefId, selecionados]);

  const militaresBusca = useMemo(() => {
    const q = buscaManual.trim().toLowerCase();
    if (!q) return [];
    return militares.filter((m) => [nomeMilitar(m), m?.nome_guerra, m?.matricula, m?.posto_graduacao].some((v) => String(v || '').toLowerCase().includes(q))).slice(0, 20);
  }, [militares, buscaManual]);

  const linhas = useMemo(() => linhasArquivo.length ? linhasArquivo : prepararLinhasTexto(texto), [linhasArquivo, texto]);

  const executar = () => {
    if (!titulo.trim()) return toast({ title: 'Informe um título', description: 'Ex.: Curso de Salvamento Veicular — matriculados.', variant: 'destructive' });
    if (!linhas.length) return toast({ title: 'Lista vazia', description: 'Cole nomes ou importe um arquivo.', variant: 'destructive' });
    if (!universo.length) return toast({ title: 'Universo vazio', description: 'Escolha um grupo, lotação ou militares para comparar.', variant: 'destructive' });
    setResultado(cruzarListagem({ linhas, militares: universo }));
    setFiltroStatus('TODOS');
  };

  const salvar = useMutation({
    mutationFn: async () => {
      if (!resultado) throw new Error('Execute a conferência antes de salvar.');
      const refNome = universoTipo === 'GRUPO'
        ? grupos.find((g) => String(g.id) === universoRefId)?.nome || ''
        : universoTipo === 'LOTACAO'
          ? lotacoes.find((l) => l.id === universoRefId)?.nome || ''
          : universoTipo === 'SELECAO_MANUAL' ? 'Seleção manual' : 'Todo o efetivo visível';
      const r = resultado.resumo;
      const cabecalho = {
        titulo: titulo.trim(),
        fonte_nome: fonteNome,
        fonte_tipo: fonteTipo,
        universo_tipo: universoTipo,
        universo_ref_id: universoRefId,
        universo_ref_nome: refNome,
        universo_ids_json: JSON.stringify(universo.map((m) => String(m.id))),
        total_universo: r.totalUniverso,
        total_entrada: r.totalEntrada,
        total_encontrados: resultado.itens.filter((i) => ['ENCONTRADO','CONFIRMADO'].includes(i.status)).length,
        total_duvidosos: resultado.itens.filter((i) => i.status === 'DUVIDOSO').length,
        total_nao_localizados: resultado.itens.filter((i) => i.status === 'NAO_LOCALIZADO').length,
        total_ausentes_universo: resultado.itens.filter((i) => i.status === 'AUSENTE_NA_LISTA').length,
        status: resultado.itens.some((i) => i.status === 'DUVIDOSO') ? 'EM_REVISAO' : 'CONCLUIDA',
        parametros_json: JSON.stringify({ limiarAutomatico: 0.94, limiarDuvidoso: 0.78 }),
      };
      return editandoId
        ? centralConferenciasService.atualizar(editandoId, cabecalho, resultado.itens)
        : centralConferenciasService.salvar(cabecalho, resultado.itens);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['central-conferencias-historico'] });
      toast({ title: editandoId ? 'Conferência atualizada' : 'Conferência salva', description: editandoId ? 'As alterações foram gravadas no histórico.' : 'O resultado foi registrado no histórico.' });
      setNova(false);
      setEditandoId('');
      setDetalhe(null);
    },
    onError: (err) => toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' }),
  });

  const reset = () => {
    setTitulo(''); setTexto(''); setFonteNome(''); setFonteTipo('TEXTO'); setLinhasArquivo([]);
    setUniversoTipo('TODO_ESCOPO'); setUniversoRefId(''); setSelecionados(new Set()); setResultado(null); setBuscaManual('');
    setEditandoId('');
  };

  const abrirDetalhe = async (id) => {
    try {
      const data = await centralConferenciasService.detalhar(id);
      setDetalhe(data);
    } catch (err) {
      toast({ title: 'Erro ao abrir conferência', description: err.message, variant: 'destructive' });
    }
  };

  const editarConferencia = (data) => {
    const conf = data?.conferencia;
    const itens = data?.itens || [];
    if (!conf) return;
    setEditandoId(String(conf.id));
    setTitulo(conf.titulo || '');
    setFonteNome(conf.fonte_nome || '');
    setFonteTipo(conf.fonte_tipo || 'TEXTO');
    setUniversoTipo(conf.universo_tipo || 'TODO_ESCOPO');
    setUniversoRefId(conf.universo_ref_id || '');
    let ids = [];
    try { ids = JSON.parse(conf.universo_ids_json || '[]'); } catch { ids = []; }
    setSelecionados(new Set((ids || []).map(String)));
    const entradas = itens.filter((i) => i.tipo_linha === 'ENTRADA').map((i) => i.entrada_original).filter(Boolean);
    setLinhasArquivo(entradas);
    setTexto('');
    setResultado({
      itens,
      resumo: {
        totalEntrada: conf.total_entrada || entradas.length,
        totalUniverso: conf.total_universo || ids.length,
        encontrados: conf.total_encontrados || 0,
        duvidosos: conf.total_duvidosos || 0,
        naoLocalizados: conf.total_nao_localizados || 0,
        ausentesUniverso: conf.total_ausentes_universo || 0,
      },
    });
    setFiltroStatus('TODOS');
    setDetalhe(null);
    setNova(true);
  };

  const excluir = useMutation({
    mutationFn: (id) => centralConferenciasService.excluir(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['central-conferencias-historico'] });
      setDetalhe(null);
      toast({ title: 'Conferência excluída' });
    },
    onError: (err) => toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' }),
  });

  const confirmarExclusao = (conf) => {
    if (window.confirm(`Excluir definitivamente a conferência "${conf?.titulo || ''}"? Esta ação também remove os itens do histórico.`)) {
      excluir.mutate(conf.id);
    }
  };

  const onFile = async (file) => {
    if (!file) return;
    setLendoArquivo(true);
    try {
      const parsed = await lerArquivo(file);
      setLinhasArquivo(parsed.linhas);
      setFonteNome(file.name);
      setFonteTipo(parsed.tipo);
      setTexto('');
      const detalheColuna = Number.isInteger(parsed.colunaNome) && parsed.colunaNome >= 0
        ? ` Coluna de nome identificada: ${XLSX.utils.encode_col(parsed.colunaNome)}.`
        : '';
      toast({ title: 'Arquivo lido', description: `${parsed.linhas.length} nome(s) identificado(s).${detalheColuna}` });
    } catch (err) {
      toast({ title: 'Não foi possível ler o arquivo', description: err.message, variant: 'destructive' });
    } finally { setLendoArquivo(false); }
  };

  const confirmarSugestao = (idx) => {
    setResultado((prev) => ({
      ...prev,
      itens: prev.itens.map((i, n) => n === idx ? { ...i, status: 'CONFIRMADO', criterio: `${i.criterio}_CONFIRMADO_MANUALMENTE` } : i),
    }));
  };
  const ignorarSugestao = (idx) => {
    setResultado((prev) => ({
      ...prev,
      itens: prev.itens.map((i, n) => n === idx ? { ...i, status: 'NAO_LOCALIZADO', militar_id: '', militar_nome: '', militar_matricula: '', militar_posto_graduacao: '', criterio: 'SUGESTAO_REJEITADA' } : i),
    }));
  };

  if (isLoading || !isAccessResolved) return null;
  if (!podeVer) return <AccessDenied modulo="Central de Conferências" />;

  const itensVisiveis = (resultado?.itens || []).filter((i) => filtroStatus === 'TODOS' || i.status === filtroStatus);

  return <div className="min-h-screen bg-slate-50 p-6">
    <div className="max-w-[1500px] mx-auto space-y-6">
      <header className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><ClipboardCheck className="w-7 h-7 text-indigo-600" />Central de Conferências</h1>
          <p className="text-sm text-slate-500 mt-1">Cruze listas externas com o efetivo visível no seu escopo, trate divergências e mantenha histórico.</p>
        </div>
        {podeGerir && <Button onClick={() => { reset(); setNova(true); }}><Plus className="w-4 h-4 mr-2" />Nova conferência</Button>}
      </header>

      {!nova && <Card>
        <CardHeader><CardTitle className="text-base">Conferências recentes</CardTitle></CardHeader>
        <CardContent>
          {historico.isLoading && <p className="text-sm text-slate-500">Carregando histórico...</p>}
          {!historico.isLoading && !(historico.data?.conferencias || []).length && <div className="py-10 text-center text-slate-500"><ClipboardCheck className="w-10 h-10 mx-auto mb-3 text-slate-300" /><p>Nenhuma conferência registrada.</p></div>}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {(historico.data?.conferencias || []).map((c) => <div key={c.id} className="rounded-xl border bg-white p-4">
              <div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-900">{c.titulo}</p><p className="text-xs text-slate-500 mt-1">{c.universo_ref_nome || 'Todo o efetivo visível'} · {c.total_entrada || 0} linha(s) recebida(s)</p></div><Badge variant="outline">{c.status === 'CONCLUIDA' ? 'Concluída' : 'Em revisão'}</Badge></div>
              <div className="grid grid-cols-4 gap-2 mt-4 text-center text-xs"><div><b className="block text-emerald-700 text-lg">{c.total_encontrados || 0}</b>encontrados</div><div><b className="block text-amber-700 text-lg">{c.total_duvidosos || 0}</b>duvidosos</div><div><b className="block text-rose-700 text-lg">{c.total_nao_localizados || 0}</b>não localizados</div><div><b className="block text-slate-700 text-lg">{c.total_ausentes_universo || 0}</b>ausentes</div></div>
            </div>)}
          </div>
        </CardContent>
      </Card>}

      {nova && <>
        <Card>
          <CardHeader><CardTitle className="text-base">1. Fonte e universo da conferência</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><Label>Título</Label><Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Curso X — lista de matriculados" /></div><div><Label>Universo de comparação</Label><select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={universoTipo} onChange={(e) => { setUniversoTipo(e.target.value); setUniversoRefId(''); setResultado(null); }}><option value="TODO_ESCOPO">Todo o efetivo visível</option><option value="LOTACAO">Uma lotação/unidade</option><option value="GRUPO">Grupo do efetivo</option><option value="SELECAO_MANUAL">Seleção manual</option></select></div></div>

            {universoTipo === 'LOTACAO' && <div><Label>Lotação/unidade</Label><select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={universoRefId} onChange={(e) => setUniversoRefId(e.target.value)}><option value="">Selecione...</option>{lotacoes.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}</select></div>}
            {universoTipo === 'GRUPO' && <div><Label>Grupo</Label><select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={universoRefId} onChange={(e) => setUniversoRefId(e.target.value)}><option value="">Selecione...</option>{grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}</select></div>}
            {universoTipo === 'SELECAO_MANUAL' && <div className="space-y-3"><Label>Selecionar militares</Label><div className="relative"><Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" /><Input className="pl-9" value={buscaManual} onChange={(e) => setBuscaManual(e.target.value)} placeholder="Nome, guerra, matrícula ou posto..." /></div>{buscaManual && <div className="border rounded-lg max-h-56 overflow-auto divide-y">{militaresBusca.map((m) => <button type="button" key={m.id} className="w-full p-3 text-left hover:bg-slate-50 flex justify-between gap-3" onClick={() => setSelecionados((old) => { const n = new Set(old); n.has(String(m.id)) ? n.delete(String(m.id)) : n.add(String(m.id)); return n; })}><span><b className="text-sm">{nomeMilitar(m)}</b><span className="block text-xs text-slate-500">{m.posto_graduacao || '—'} · {m.matricula || 'sem matrícula'}</span></span>{selecionados.has(String(m.id)) && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}</button>)}</div>}<p className="text-xs text-slate-500">{selecionados.size} militar(es) selecionado(s).</p></div>}

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 items-start">
              <div><Label>Colar lista</Label><Textarea rows={9} value={texto} disabled={!!linhasArquivo.length} onChange={(e) => setTexto(e.target.value)} placeholder={'Cole um nome por linha. Pode conter posto/graduação e matrícula.\nEx.: 1º Sgt BM João da Silva\nCb BM Maria Souza'} /></div>
              <div className="self-center text-xs font-bold text-slate-400">OU</div>
              <div className="rounded-xl border border-dashed p-6 text-center bg-slate-50"><FileUp className="w-8 h-8 mx-auto text-slate-400 mb-2" /><p className="text-sm font-medium">Importar arquivo</p><p className="text-xs text-slate-500 mb-4">PDF com texto, XLSX, CSV ou TXT</p><input ref={fileRef} type="file" className="hidden" accept=".pdf,.xlsx,.xls,.csv,.txt" onChange={(e) => onFile(e.target.files?.[0])} /><Button variant="outline" disabled={lendoArquivo} onClick={() => fileRef.current?.click()}>{lendoArquivo ? 'Lendo...' : 'Escolher arquivo'}</Button>{fonteNome && <div className="mt-3 text-xs text-slate-600">{fonteNome} · {linhasArquivo.length} linha(s)<Button variant="ghost" size="sm" className="ml-2 h-7" onClick={() => { setLinhasArquivo([]); setFonteNome(''); setFonteTipo('TEXTO'); if (fileRef.current) fileRef.current.value = ''; }}>Remover</Button></div>}</div>
            </div>
            <div className="flex items-center justify-between gap-3 border-t pt-4"><p className="text-sm text-slate-500">Universo atual: <b>{universo.length}</b> militar(es) · Entrada: <b>{linhas.length}</b> linha(s)</p><div className="flex gap-2"><Button variant="outline" onClick={() => setNova(false)}>Cancelar</Button><Button onClick={executar}><ClipboardCheck className="w-4 h-4 mr-2" />Conferir lista</Button></div></div>
          </CardContent>
        </Card>

        {resultado && <Card>
          <CardHeader><div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"><div><CardTitle className="text-base">2. Resultado da conferência</CardTitle><p className="text-xs text-slate-500 mt-1">Correspondências duvidosas exigem revisão humana antes do fechamento.</p></div><div className="flex gap-2"><Button variant="outline" onClick={executar}><RotateCcw className="w-4 h-4 mr-2" />Recalcular</Button><Button disabled={salvar.isPending} onClick={() => salvar.mutate()}><Save className="w-4 h-4 mr-2" />Salvar no histórico</Button></div></div></CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Resumo icon={Users} label="Universo" value={resultado.resumo.totalUniverso} />
              <Resumo icon={CheckCircle2} label="Encontrados" value={resultado.itens.filter((i) => ['ENCONTRADO','CONFIRMADO'].includes(i.status)).length} />
              <Resumo icon={AlertTriangle} label="Duvidosos" value={resultado.itens.filter((i) => i.status === 'DUVIDOSO').length} />
              <Resumo icon={XCircle} label="Não localizados" value={resultado.itens.filter((i) => i.status === 'NAO_LOCALIZADO').length} />
              <Resumo icon={UserMinus} label="Ausentes na lista" value={resultado.itens.filter((i) => i.status === 'AUSENTE_NA_LISTA').length} />
            </div>
            <div className="flex gap-2 flex-wrap">{['TODOS','ENCONTRADO','DUVIDOSO','NAO_LOCALIZADO','AUSENTE_NA_LISTA'].map((s) => <Button key={s} size="sm" variant={filtroStatus === s ? 'default' : 'outline'} onClick={() => setFiltroStatus(s)}>{s === 'TODOS' ? 'Todos' : STATUS[s]?.label}</Button>)}</div>
            <div className="border rounded-xl overflow-hidden bg-white"><div className="max-h-[580px] overflow-auto divide-y">{itensVisiveis.map((item) => {
              const idx = resultado.itens.indexOf(item);
              return <div key={`${item.tipo_linha}-${item.ordem}-${idx}`} className="p-4 grid grid-cols-1 lg:grid-cols-[1.2fr_1.2fr_auto] gap-4 items-center">
                <div><p className="text-xs font-bold uppercase text-slate-400">{item.tipo_linha === 'ENTRADA' ? 'Recebido na lista' : 'Militar do universo'}</p><p className="font-medium text-slate-900 mt-1">{item.tipo_linha === 'ENTRADA' ? item.entrada_original : item.militar_nome}</p>{item.tipo_linha === 'AUSENTE_UNIVERSO' && <p className="text-xs text-slate-500">{item.militar_posto_graduacao} · {item.militar_matricula || 'sem matrícula'}</p>}</div>
                <div>{item.tipo_linha === 'ENTRADA' && item.militar_nome ? <><p className="text-xs font-bold uppercase text-slate-400">Correspondência sugerida</p><p className="font-medium text-slate-900 mt-1">{item.militar_nome}</p><p className="text-xs text-slate-500">{item.militar_posto_graduacao} · {item.militar_matricula || 'sem matrícula'} · {Math.round((item.score || 0) * 100)}%</p></> : item.tipo_linha === 'ENTRADA' ? <p className="text-sm text-slate-400">Nenhuma correspondência confiável.</p> : null}</div>
                <div className="flex items-center gap-2 justify-start lg:justify-end"><Badge variant="outline" className={STATUS[item.status]?.cls}>{STATUS[item.status]?.label || item.status}</Badge>{item.status === 'DUVIDOSO' && <><Button size="sm" variant="outline" onClick={() => confirmarSugestao(idx)}>Aceitar</Button><Button size="sm" variant="ghost" onClick={() => ignorarSugestao(idx)}>Rejeitar</Button></>}</div>
              </div>;
            })}{!itensVisiveis.length && <p className="p-8 text-center text-sm text-slate-500">Nenhum item neste filtro.</p>}</div></div>
          </CardContent>
        </Card>}
      </>}
    </div>
  </div>;
}

function Resumo({ icon: Icon, label, value }) {
  return <div className="rounded-xl border bg-white p-4"><div className="flex items-center gap-2 text-slate-500"><Icon className="w-4 h-4" /><span className="text-xs font-medium">{label}</span></div><p className="text-2xl font-bold text-slate-900 mt-2">{value}</p></div>;
}
