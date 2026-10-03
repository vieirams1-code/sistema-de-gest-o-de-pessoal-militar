import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock3, Eye, FileSearch, RefreshCw, Search, ShieldAlert, XCircle } from 'lucide-react';

import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const ACOES_INCLUIDAS = new Set(['atualizar_militar_confirmado', 'atualizacao_militar_falhou']);

function texto(valor) {
  return String(valor ?? '').trim();
}

function normalizar(valor) {
  return texto(valor).normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
}

function formatarDataHora(valor) {
  if (!valor) return '—';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return texto(valor) || '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(data);
}

function formatarData(valor) {
  if (!valor) return '—';
  const partes = texto(valor).split('T')[0].split('-');
  if (partes.length !== 3) return texto(valor);
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function primeiroValor(objeto, campos) {
  for (const campo of campos) {
    if (texto(objeto?.[campo])) return texto(objeto[campo]);
  }
  return '';
}

function extrairRegistro(log, historicos, promocoes, militares) {
  const metadata = log?.metadata && typeof log.metadata === 'object' ? log.metadata : {};
  const historico = historicos.find((item) => String(item?.id || '') === String(metadata.historico_id || ''));
  const promocaoId = texto(historico?.promocao_id) || texto(metadata.promocao_id);
  const promocao = promocoes.find((item) => String(item?.id || '') === promocaoId);
  const militarId = texto(metadata.militar_id) || texto(historico?.militar_id);
  const militar = militares.find((item) => String(item?.id || '') === militarId);
  const anterior = metadata.dados_anteriores && typeof metadata.dados_anteriores === 'object' ? metadata.dados_anteriores : {};
  const novo = metadata.dados_novos && typeof metadata.dados_novos === 'object' ? metadata.dados_novos : {};

  return {
    id: log.id,
    log,
    metadata,
    historico,
    promocao,
    militar,
    militarId,
    promocaoId,
    status: log.acao === 'atualizar_militar_confirmado' ? 'confirmada' : 'falha',
    dataEvento: log.created_date || log.data_pergunta || metadata.data_hora || '',
    dataPromocao: historico?.data_promocao || promocao?.data_promocao || '',
    anterior,
    novo,
    postoAnterior: primeiroValor(anterior, ['posto_graduacao', 'posto_graduação', 'posto_graduacao_atual', 'posto_grad', 'posto', 'graduacao']),
    postoNovo: primeiroValor(novo, ['posto_graduacao', 'posto_graduação', 'posto_graduacao_atual', 'posto_grad', 'posto', 'graduacao']),
    quadroAnterior: primeiroValor(anterior, ['quadro', 'quadro_atual', 'militar_quadro']),
    quadroNovo: primeiroValor(novo, ['quadro', 'quadro_atual', 'militar_quadro']),
    descricao: texto(log.descricao) || 'Aplicação automática de promoção no cadastro.',
    executor: texto(metadata.executado_por) || texto(log.created_by) || 'Sistema',
  };
}

function nomeMilitar(registro) {
  return texto(registro.militar?.nome_guerra) || texto(registro.militar?.nome_completo) || registro.militarId || 'Militar não identificado';
}

function camposAlterados(registro) {
  const chaves = new Set([...Object.keys(registro.anterior || {}), ...Object.keys(registro.novo || {})]);
  return [...chaves].filter((campo) => texto(registro.anterior?.[campo]) !== texto(registro.novo?.[campo]));
}

function statusBadge(status) {
  return status === 'confirmada'
    ? <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100"><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Confirmada</Badge>
    : <Badge variant="destructive"><XCircle className="mr-1 h-3.5 w-3.5" />Falha/rollback</Badge>;
}

export default function HistoricoAlteracoesPromocoes() {
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('todas');
  const [registroSelecionado, setRegistroSelecionado] = useState(null);

  const logsQuery = useQuery({
    queryKey: ['historico-alteracoes-promocoes-automaticas'],
    queryFn: async () => {
      const entity = base44.entities.AssistenteLog;
      if (!entity) return [];
      if (typeof entity.filter === 'function') return entity.filter({ tipo: 'sincronizacao_promocao' });
      if (typeof entity.list === 'function') return entity.list();
      return [];
    },
  });
  const historicosQuery = useQuery({
    queryKey: ['historico-alteracoes-promocoes-v2'],
    queryFn: () => base44.entities.HistoricoPromocaoMilitarV2.list(),
  });
  const promocoesQuery = useQuery({
    queryKey: ['historico-alteracoes-promocoes-pais'],
    queryFn: () => base44.entities.Promocao.list(),
  });
  const militaresQuery = useQuery({
    queryKey: ['historico-alteracoes-promocoes-militares'],
    queryFn: () => base44.entities.Militar.list(),
  });

  const registros = useMemo(() => {
    const historicos = historicosQuery.data || [];
    const promocoes = promocoesQuery.data || [];
    const militares = militaresQuery.data || [];
    return (logsQuery.data || [])
      .filter((log) => texto(log?.tipo) === 'sincronizacao_promocao' && ACOES_INCLUIDAS.has(texto(log?.acao)))
      .map((log) => extrairRegistro(log, historicos, promocoes, militares))
      .sort((a, b) => String(b.dataEvento).localeCompare(String(a.dataEvento)));
  }, [historicosQuery.data, logsQuery.data, militaresQuery.data, promocoesQuery.data]);

  const registrosFiltrados = useMemo(() => {
    const termo = normalizar(busca);
    return registros.filter((registro) => {
      const correspondeStatus = statusFiltro === 'todas' || registro.status === statusFiltro;
      const textoBusca = normalizar([
        nomeMilitar(registro),
        registro.militar?.matricula,
        registro.postoAnterior,
        registro.postoNovo,
        registro.quadroAnterior,
        registro.quadroNovo,
        registro.promocao?.boletim_referencia,
        registro.promocao?.ato_referencia,
        registro.promocaoId,
      ].join(' '));
      return correspondeStatus && (!termo || textoBusca.includes(termo));
    });
  }, [busca, registros, statusFiltro]);

  const confirmadas = registros.filter((registro) => registro.status === 'confirmada').length;
  const falhas = registros.filter((registro) => registro.status === 'falha').length;
  const carregando = logsQuery.isLoading || historicosQuery.isLoading || promocoesQuery.isLoading || militaresQuery.isLoading;
  const erro = logsQuery.error || historicosQuery.error || promocoesQuery.error || militaresQuery.error;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <FileSearch className="h-4 w-4" />
              Carreira / Promoções
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Alterações automáticas de posto/graduação</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Registro somente das alterações cadastrais executadas pelo fluxo oficial de publicação de promoções,
              com estado anterior, destino confirmado, militar, promoção e data da operação.
            </p>
          </div>
          <Button variant="outline" onClick={() => {
            logsQuery.refetch();
            historicosQuery.refetch();
            promocoesQuery.refetch();
            militaresQuery.refetch();
          }} disabled={carregando}>
            <RefreshCw className={`mr-2 h-4 w-4 ${carregando ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        <Alert className="border-blue-200 bg-blue-50 text-blue-950">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Fonte de auditoria</AlertTitle>
          <AlertDescription>
            A tela lê o log durável criado antes da alteração cadastral e atualizado após a releitura do militar.
            Registros sem confirmação ficam identificados como falha/rollback e não são apresentados como alteração concluída.
          </AlertDescription>
        </Alert>

        {erro && (
          <Alert variant="destructive">
            <AlertTitle>Não foi possível carregar o registro</AlertTitle>
            <AlertDescription>{erro.message || 'Verifique sua permissão e tente novamente.'}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-500">Total de operações</p><p className="mt-1 text-3xl font-semibold text-slate-900">{registros.length}</p></div><Clock3 className="h-8 w-8 text-slate-400" /></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-500">Alterações confirmadas</p><p className="mt-1 text-3xl font-semibold text-emerald-700">{confirmadas}</p></div><CheckCircle2 className="h-8 w-8 text-emerald-500" /></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-500">Falhas / rollback</p><p className="mt-1 text-3xl font-semibold text-red-700">{falhas}</p></div><ShieldAlert className="h-8 w-8 text-red-500" /></div></CardContent></Card>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input className="pl-9" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar militar, matrícula, promoção, ato ou posto..." />
              </div>
              <Select value={statusFiltro} onValueChange={setStatusFiltro}>
                <SelectTrigger className="w-full md:w-52"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as operações</SelectItem>
                  <SelectItem value="confirmada">Somente confirmadas</SelectItem>
                  <SelectItem value="falha">Somente falhas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Registro das alterações ({registrosFiltrados.length})</CardTitle></CardHeader>
          <CardContent>
            {carregando ? <div className="py-16 text-center text-sm text-slate-500">Carregando registro...</div> : registrosFiltrados.length === 0 ? (
              <div className="py-16 text-center text-sm text-slate-500">Nenhuma alteração automática encontrada para os filtros atuais.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Data da operação</TableHead><TableHead>Militar</TableHead><TableHead>Alteração executada</TableHead><TableHead>Promoção</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ação</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {registrosFiltrados.map((registro) => (
                      <TableRow key={registro.id} className="cursor-pointer" onClick={() => setRegistroSelecionado(registro)}>
                        <TableCell className="whitespace-nowrap text-sm">{formatarDataHora(registro.dataEvento)}</TableCell>
                        <TableCell><div className="font-medium text-slate-900">{nomeMilitar(registro)}</div><div className="text-xs text-slate-500">{texto(registro.militar?.matricula) || registro.militarId}</div></TableCell>
                        <TableCell><div className="flex items-center gap-2 font-medium text-slate-800"><span>{registro.postoAnterior || '—'}</span><ArrowRight className="h-4 w-4 text-slate-400" /><span>{registro.postoNovo || '—'}</span></div><div className="text-xs text-slate-500">{registro.quadroAnterior || '—'} → {registro.quadroNovo || '—'}</div></TableCell>
                        <TableCell><div className="text-sm">{registro.promocao ? `Promoção para ${registro.promocao.posto_graduacao || registro.postoNovo || '—'}` : 'Promoção não localizada'}</div><div className="text-xs text-slate-500">{formatarData(registro.dataPromocao)}{registro.promocao?.ato_referencia ? ` • ${registro.promocao.ato_referencia}` : ''}</div></TableCell>
                        <TableCell>{statusBadge(registro.status)}</TableCell>
                        <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={(event) => { event.stopPropagation(); setRegistroSelecionado(registro); }}><Eye className="mr-1 h-4 w-4" />Detalhes</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(registroSelecionado)} onOpenChange={(open) => !open && setRegistroSelecionado(null)}>
        <DialogContent className="max-w-3xl">
          {registroSelecionado && (
            <>
              <DialogHeader>
                <DialogTitle>Detalhes da alteração cadastral</DialogTitle>
                <DialogDescription>{nomeMilitar(registroSelecionado)} • operação em {formatarDataHora(registroSelecionado.dataEvento)}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-amber-200 bg-amber-50/50"><CardHeader className="pb-3"><CardTitle className="text-sm text-amber-900">Estado anterior</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p><strong>Posto/graduação:</strong> {registroSelecionado.postoAnterior || '—'}</p><p><strong>Quadro:</strong> {registroSelecionado.quadroAnterior || '—'}</p><p><strong>Campos gravados:</strong> {camposAlterados(registroSelecionado).join(', ') || 'não informado'}</p></CardContent></Card>
                <Card className="border-emerald-200 bg-emerald-50/50"><CardHeader className="pb-3"><CardTitle className="text-sm text-emerald-900">Destino confirmado</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p><strong>Posto/graduação:</strong> {registroSelecionado.postoNovo || '—'}</p><p><strong>Quadro:</strong> {registroSelecionado.quadroNovo || '—'}</p><p><strong>Resultado:</strong> {registroSelecionado.status === 'confirmada' ? 'Relido e confirmado no cadastro do militar.' : 'Não confirmado; operação marcada para análise.'}</p></CardContent></Card>
              </div>
              <div className="rounded-lg border bg-slate-50 p-4 text-sm text-slate-700">
                <p><strong>Militar:</strong> {nomeMilitar(registroSelecionado)} ({texto(registroSelecionado.militar?.matricula) || registroSelecionado.militarId})</p>
                <p><strong>Promoção:</strong> {registroSelecionado.promocaoId || '—'}</p>
                <p><strong>Data da promoção:</strong> {formatarData(registroSelecionado.dataPromocao)}</p>
                <p><strong>Executado por:</strong> {registroSelecionado.executor}</p>
                <p className="mt-2"><strong>Descrição:</strong> {registroSelecionado.descricao}</p>
              </div>
              <DialogFooter>
                {registroSelecionado.militarId && <Button asChild variant="outline"><Link to={`${createPageUrl('VerMilitar')}?id=${registroSelecionado.militarId}`}>Abrir ficha do militar</Link></Button>}
                {registroSelecionado.promocaoId && <Button asChild><Link to={`${createPageUrl('DetalhePromocao')}?id=${registroSelecionado.promocaoId}`}>Abrir promoção</Link></Button>}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
