import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, ChevronLeft, ChevronRight, RotateCcw, Search, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const statusClass = {
  pronta: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  erro: 'bg-orange-100 text-orange-800 border-orange-200',
  duplicada: 'bg-red-100 text-red-800 border-red-200',
  recusada: 'bg-slate-200 text-slate-700 border-slate-300',
};

const normalizar = (valor) => String(valor ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const possuiClassificacao = (linha) => Boolean(
  String(linha.tipo_classificado || '').trim() && linha.tipo_classificado !== '__fallback__'
);

const tipoBgDaLinha = (linha) => linha.tipo_bg_legado || linha.transformado?.tipo_bg_legado || '—';
const materiaDaLinha = (linha) => linha.materia_legado || linha.tipo_legado || linha.transformado?.materia_legado || '—';
const statusDaLinha = (linha) => linha.recusada
  ? 'recusada'
  : (linha.statusSimplificado || linha.status?.toLowerCase() || 'erro');
const possuiAviso = (linha) => linha.avisos?.length > 0;
const possuiMensagemErro = (linha) => linha.erros?.length > 0;
const possuiErro = (linha) => linha.statusSimplificado === 'erro' || possuiMensagemErro(linha);
const possuiDuplicidade = (linha) => linha.statusSimplificado === 'duplicada';
const estaPendenteClassificacao = (linha) => !linha.recusada && !possuiClassificacao(linha);
const estaPronta = (linha) => !linha.recusada && linha.statusSimplificado === 'pronta' && possuiClassificacao(linha)
  && !possuiMensagemErro(linha) && !possuiAviso(linha);

function ListaMensagens({ itens, tipo = 'aviso' }) {
  if (!itens?.length) return null;

  const Icon = tipo === 'erro' ? AlertCircle : AlertTriangle;
  const itensVisiveis = itens.slice(0, 2);
  const quantidadeOculta = itens.length - itensVisiveis.length;

  return (
    <div className="space-y-0.5">
      {itensVisiveis.map((item, idx) => (
        <p key={idx} className="flex min-w-0 items-start gap-1 leading-tight">
          <Icon className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{item}</span>
        </p>
      ))}
      {quantidadeOculta > 0 && <p className="text-[10px] italic opacity-80">+ {quantidadeOculta} mensagens</p>}
    </div>
  );
}

function Contador({ rotulo, valor, destaque = '' }) {
  return (
    <span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-medium', destaque || 'border-slate-200 bg-white text-slate-600')}>
      {rotulo}: {valor}
    </span>
  );
}

function CampoCompacto({ children, rotulo, className = '' }) {
  return (
    <div className={className}>
      <label className="text-[10px] font-medium text-slate-500">{rotulo}</label>
      {children}
    </div>
  );
}

export default function TabelaRevisaoSimplificadaAlteracoesLegado({
  linhas,
  tiposPublicacaoValidos = [],
  onAlterarLinha,
  onAlternarRecusa,
}) {
  const [selecionadaId, setSelecionadaId] = useState(null);
  const [pesquisa, setPesquisa] = useState('');
  const [filtroClassificacao, setFiltroClassificacao] = useState('todos');
  const [filtroOperacional, setFiltroOperacional] = useState('todos');

  const linhasPesquisadas = useMemo(() => {
    const termo = normalizar(pesquisa.trim());
    if (!termo) return linhas;

    return linhas.filter((linha) => normalizar([
      linha.numero_nota,
      linha.numero_bg_br,
      linha.data_bg_br,
      tipoBgDaLinha(linha),
      materiaDaLinha(linha),
      linha.tipo_classificado,
      linha.texto_publicado,
      ...(linha.erros || []),
      ...(linha.avisos || []),
      linha.statusSimplificado,
      linha.status,
      linha.status_publicacao,
      linha.recusada ? 'recusada recusado' : '',
    ].join(' ')).includes(termo));
  }, [linhas, pesquisa]);

  const linhasFiltradas = useMemo(() => linhasPesquisadas.filter((linha) => {
    if (filtroClassificacao === 'classificados' && !possuiClassificacao(linha)) return false;
    if (filtroClassificacao === 'sem-classificacao' && possuiClassificacao(linha)) return false;

    if (filtroOperacional === 'pendentes-classificacao') return estaPendenteClassificacao(linha);
    if (filtroOperacional === 'erros') return possuiErro(linha);
    if (filtroOperacional === 'avisos') return possuiAviso(linha);
    if (filtroOperacional === 'prontas') return estaPronta(linha);
    if (filtroOperacional === 'duplicadas') return possuiDuplicidade(linha);
    if (filtroOperacional === 'recusadas') return linha.recusada === true;
    return true;
  }), [filtroClassificacao, filtroOperacional, linhasPesquisadas]);

  const contadores = useMemo(() => ({
    total: linhasFiltradas.length,
    pendentesClassificacao: linhasFiltradas.filter(estaPendenteClassificacao).length,
    prontas: linhasFiltradas.filter(estaPronta).length,
    semClassificacao: linhasFiltradas.filter((linha) => !possuiClassificacao(linha)).length,
    classificados: linhasFiltradas.filter(possuiClassificacao).length,
    erros: linhasFiltradas.filter(possuiErro).length,
    avisos: linhasFiltradas.filter(possuiAviso).length,
    duplicadas: linhasFiltradas.filter(possuiDuplicidade).length,
    recusadas: linhasFiltradas.filter((linha) => linha.recusada).length,
  }), [linhasFiltradas]);

  const linhasDuplicadasParaRecusar = linhasFiltradas.filter((linha) => possuiDuplicidade(linha) && !linha.recusada);
  const linhasComErroParaRecusar = linhasFiltradas.filter((linha) => possuiErro(linha) && !linha.recusada);
  const linhasParaRestaurar = linhasFiltradas.filter((linha) => linha.recusada);
  const alternarRecusaEmLote = (linhasAplicaveis, mensagemConfirmacao) => {
    if (!window.confirm(mensagemConfirmacao)) return;
    linhasAplicaveis.forEach((linha) => onAlternarRecusa(linha));
  };

  useEffect(() => {
    if (!linhasFiltradas.length) {
      setSelecionadaId(null);
    } else if (!linhasFiltradas.some((linha) => linha.linhaNumero === selecionadaId)) {
      setSelecionadaId(linhasFiltradas[0].linhaNumero);
    }
  }, [linhasFiltradas, selecionadaId]);

  const selecionadaIndex = linhasFiltradas.findIndex((linha) => linha.linhaNumero === selecionadaId);
  const selecionada = selecionadaIndex >= 0 ? linhasFiltradas[selecionadaIndex] : null;

  const handleNext = () => {
    if (selecionadaIndex < linhasFiltradas.length - 1) setSelecionadaId(linhasFiltradas[selecionadaIndex + 1].linhaNumero);
  };

  const handlePrev = () => {
    if (selecionadaIndex > 0) setSelecionadaId(linhasFiltradas[selecionadaIndex - 1].linhaNumero);
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      if (event.key === 'ArrowDown' && selecionadaIndex < linhasFiltradas.length - 1) {
        event.preventDefault();
        setSelecionadaId(linhasFiltradas[selecionadaIndex + 1].linhaNumero);
      } else if (event.key === 'ArrowUp' && selecionadaIndex > 0) {
        event.preventDefault();
        setSelecionadaId(linhasFiltradas[selecionadaIndex - 1].linhaNumero);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [linhasFiltradas, selecionadaIndex]);

  return (
    <section className="flex min-h-[560px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white lg:min-h-[calc(100vh-220px)] lg:flex-row">
      <aside className="flex max-h-[440px] w-full shrink-0 flex-col border-b border-slate-200 bg-slate-50 lg:max-h-[calc(100vh-220px)] lg:w-[360px] lg:border-b-0 lg:border-r xl:w-[410px]">
        <div className="shrink-0 space-y-1.5 border-b border-slate-200 bg-slate-100 p-2.5">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Revisão simplificada</h3>
            <p className="text-[11px] text-slate-500">Pesquise e concentre a revisão nos registros pendentes.</p>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
            <Input value={pesquisa} onChange={(event) => setPesquisa(event.target.value)} placeholder="Pesquisar nota, BG, matéria, texto..." className="h-8 bg-white pl-8 text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Select value={filtroOperacional} onValueChange={setFiltroOperacional}>
              <SelectTrigger className="h-8 bg-white text-xs" aria-label="Filtro operacional"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendentes-classificacao">Pendentes de classificação</SelectItem>
                <SelectItem value="erros">Com erro</SelectItem>
                <SelectItem value="avisos">Com aviso</SelectItem>
                <SelectItem value="duplicadas">Duplicadas</SelectItem>
                <SelectItem value="prontas">Prontas</SelectItem>
                <SelectItem value="recusadas">Recusadas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroClassificacao} onValueChange={setFiltroClassificacao}>
              <SelectTrigger className="h-8 bg-white text-xs" aria-label="Filtro de classificação"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="sem-classificacao">Apenas sem classificação</SelectItem>
                <SelectItem value="classificados">Apenas classificados</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-1">
            <Contador rotulo="Total filtrado" valor={contadores.total} />
            <Contador rotulo="Pendentes classificação" valor={contadores.pendentesClassificacao} destaque="border-amber-200 bg-amber-50 text-amber-700" />
            <Contador rotulo="Prontas" valor={contadores.prontas} destaque="border-emerald-200 bg-emerald-50 text-emerald-700" />
            <Contador rotulo="Classificados" valor={contadores.classificados} destaque="border-indigo-200 bg-indigo-50 text-indigo-700" />
            <Contador rotulo="Sem classificação" valor={contadores.semClassificacao} destaque="border-amber-200 bg-amber-50 text-amber-700" />
            <Contador rotulo="Erros" valor={contadores.erros} destaque="border-orange-200 bg-orange-50 text-orange-700" />
            <Contador rotulo="Avisos" valor={contadores.avisos} destaque="border-amber-200 bg-amber-50 text-amber-700" />
            <Contador rotulo="Duplicadas" valor={contadores.duplicadas} destaque="border-red-200 bg-red-50 text-red-700" />
            <Contador rotulo="Recusadas" valor={contadores.recusadas} />
          </div>
          <div className="flex flex-wrap gap-1">
            <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-[11px]" disabled={!linhasDuplicadasParaRecusar.length} onClick={() => alternarRecusaEmLote(linhasDuplicadasParaRecusar, `Recusar ${linhasDuplicadasParaRecusar.length} linhas duplicadas visíveis no filtro atual?`)}>Recusar duplicadas</Button>
            <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-[11px]" disabled={!linhasComErroParaRecusar.length} onClick={() => alternarRecusaEmLote(linhasComErroParaRecusar, `Recusar ${linhasComErroParaRecusar.length} linhas com erro visíveis no filtro atual?`)}>Recusar erros</Button>
            <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-[11px]" disabled={!linhasParaRestaurar.length} onClick={() => alternarRecusaEmLote(linhasParaRestaurar, `Restaurar ${linhasParaRestaurar.length} linhas recusadas visíveis no filtro atual?`)}><RotateCcw className="mr-1 h-3 w-3" />Restaurar todas</Button>
          </div>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto p-1.5">
          {!linhasFiltradas.length && <div className="p-4 text-center text-xs text-slate-500">Nenhum registro encontrado para a pesquisa e os filtros aplicados.</div>}
          {linhasFiltradas.map((linha) => {
            const statusVisual = statusDaLinha(linha);
            const classificada = possuiClassificacao(linha);
            const isSelected = linha.linhaNumero === selecionadaId;

            return (
              <div key={linha.linhaNumero} onClick={() => setSelecionadaId(linha.linhaNumero)} className={cn(
                'cursor-pointer rounded-lg border p-1.5 text-left transition-colors',
                isSelected ? 'border-indigo-500 bg-indigo-50 shadow-sm ring-1 ring-indigo-500/20' : 'border-slate-200 bg-white hover:border-slate-300',
                linha.recusada && !isSelected && 'bg-slate-100 opacity-60 text-slate-500',
                !linha.recusada && statusVisual === 'duplicada' && !isSelected && 'border-red-300 bg-red-50',
                !linha.recusada && statusVisual === 'erro' && !isSelected && 'border-orange-300 bg-orange-50'
              )}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <Badge className={cn('border px-1 py-0 text-[9px]', statusClass[statusVisual] || statusClass.erro)}>{statusVisual.toUpperCase()}</Badge>
                    <span className="text-[11px] font-bold text-slate-700">Linha {linha.linhaNumero}</span>
                    <Badge variant="outline" className={cn('px-1 py-0 text-[9px]', classificada ? 'border-emerald-300 text-emerald-700' : 'border-amber-300 text-amber-700')}>{classificada ? 'CLASSIFICADO' : 'SEM CLASSIFICAÇÃO'}</Badge>
                  </div>
                  <Button type="button" variant="ghost" size="icon" title={linha.recusada ? 'Restaurar linha' : 'Recusar linha'} className="h-5 w-5 shrink-0" onClick={(event) => { event.stopPropagation(); onAlternarRecusa(linha); }}>
                    {linha.recusada ? <RotateCcw className="h-3.5 w-3.5 text-slate-600" /> : <XCircle className="h-3.5 w-3.5 text-rose-600" />}
                  </Button>
                </div>
                <div className="mt-0.5 grid grid-cols-3 gap-x-1 text-[10px] leading-tight text-slate-600">
                  <span><strong>Nota:</strong> {linha.numero_nota || '—'}</span>
                  <span><strong>BG:</strong> {linha.numero_bg_br || '—'}</span>
                  <span><strong>Data:</strong> {linha.data_bg_br || '—'}</span>
                  <span className="truncate" title={tipoBgDaLinha(linha)}><strong>Tipo:</strong> {tipoBgDaLinha(linha)}</span>
                  <span className="col-span-2 truncate" title={materiaDaLinha(linha)}><strong>Matéria:</strong> {materiaDaLinha(linha)}</span>
                </div>
                <p className="mt-0.5 truncate text-[10px] leading-tight text-slate-500">{linha.texto_publicado || 'Sem texto publicado.'}</p>
              </div>
            );
          })}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-white">
        {selecionada ? (() => {
          const linha = selecionada;
          const desabilitada = linha.recusada;
          const statusVisual = statusDaLinha(linha);
          const valorTipo = possuiClassificacao(linha) ? linha.tipo_classificado : '__fallback__';

          return (
            <>
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h3 className="text-sm font-bold text-slate-800">Linha {linha.linhaNumero}</h3>
                  <Badge className={cn('border px-1.5 py-0 text-[10px]', statusClass[statusVisual] || statusClass.erro)}>{statusVisual.toUpperCase()}</Badge>
                  <span className="text-[11px] text-slate-500">Status publicação: <strong className="text-slate-700">{linha.status_publicacao || '—'}</strong></span>
                  <span className="text-[11px] text-slate-500">Registro {selecionadaIndex + 1} de {linhasFiltradas.length}</span>
                </div>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={handlePrev} disabled={selecionadaIndex <= 0}><ChevronLeft className="h-3.5 w-3.5" /> Anterior</Button>
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={handleNext} disabled={selecionadaIndex >= linhasFiltradas.length - 1}>Próximo <ChevronRight className="h-3.5 w-3.5" /></Button>
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-1.5 p-2">
                <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-1.5 md:grid-cols-5">
                  <CampoCompacto rotulo="Nota"><Input disabled={desabilitada} value={linha.numero_nota || ''} onChange={(event) => onAlterarLinha(linha, { numero_nota: event.target.value })} className="h-7 bg-white px-2 text-xs" /></CampoCompacto>
                  <CampoCompacto rotulo="BG"><Input disabled={desabilitada} value={linha.numero_bg_br || ''} onChange={(event) => onAlterarLinha(linha, { numero_bg_br: event.target.value })} className="h-7 bg-white px-2 text-xs" /></CampoCompacto>
                  <CampoCompacto rotulo="Data BG"><Input disabled={desabilitada} value={linha.data_bg_br || ''} onChange={(event) => onAlterarLinha(linha, { data_bg_br: event.target.value })} className="h-7 bg-white px-2 text-xs" /></CampoCompacto>
                  <CampoCompacto rotulo="Tipo BG"><Input disabled value={tipoBgDaLinha(linha)} className="h-7 bg-slate-100 px-2 text-xs" /></CampoCompacto>
                  <CampoCompacto rotulo="Matéria" className="col-span-2 md:col-span-1"><Input disabled value={materiaDaLinha(linha)} className="h-7 bg-slate-100 px-2 text-xs" /></CampoCompacto>
                </div>

                <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-1.5">
                  <div className="flex items-center gap-2">
                    <label className="shrink-0 text-[11px] font-semibold text-indigo-800">Tipo classificado</label>
                    <Select disabled={desabilitada} value={valorTipo} onValueChange={(valor) => onAlterarLinha(linha, { tipo_classificado: valor === '__fallback__' ? '' : valor })}>
                      <SelectTrigger className="h-8 bg-white text-xs border-indigo-200"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__fallback__">{linha.tipo_legado || 'Sem classificação'}</SelectItem>
                        {tiposPublicacaoValidos.map((tipo) => <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {(linha.erros?.length > 0 || linha.avisos?.length > 0) && (
                  <div className="grid grid-cols-1 gap-1 md:grid-cols-2">
                    {linha.erros?.length > 0 && <div className="rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-[11px] text-rose-700"><h4 className="font-semibold text-rose-800">Erros bloqueantes</h4><ListaMensagens itens={linha.erros} tipo="erro" /></div>}
                    {linha.avisos?.length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-1.5 text-[11px] text-amber-700"><h4 className="font-semibold text-amber-800">Avisos</h4><ListaMensagens itens={linha.avisos} /></div>}
                  </div>
                )}

                <div className="flex min-h-[110px] flex-1 flex-col">
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Texto publicado</label>
                  <Textarea disabled={desabilitada} value={linha.texto_publicado || ''} onChange={(event) => onAlterarLinha(linha, { texto_publicado: event.target.value })} className="min-h-[110px] flex-1 resize-y p-2 font-mono text-sm leading-snug" placeholder="Conteúdo do texto publicado..." />
                </div>
              </div>

              <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-slate-50 px-3 py-1.5">
                <span className="text-xs text-slate-500">Registro {selecionadaIndex + 1} de {linhasFiltradas.length}</span>
                <Button type="button" size="sm" variant={desabilitada ? 'outline' : 'destructive'} className={cn('h-8', !desabilitada && 'bg-rose-600 hover:bg-rose-700')} onClick={() => onAlternarRecusa(linha)}>
                  {desabilitada ? <RotateCcw className="mr-1.5 h-4 w-4" /> : <XCircle className="mr-1.5 h-4 w-4" />}
                  {desabilitada ? 'Restaurar linha' : 'Recusar linha'}
                </Button>
              </div>
            </>
          );
        })() : (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-500">
            Nenhum registro encontrado para a pesquisa e os filtros aplicados.
          </div>
        )}
      </div>
    </section>
  );
}
