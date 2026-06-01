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

function ListaMensagens({ itens, tipo = 'aviso' }) {
  if (!itens?.length) return null;

  const Icon = tipo === 'erro' ? AlertCircle : AlertTriangle;

  return (
    <div className="space-y-1">
      {itens.map((item, idx) => (
        <p key={idx} className="flex items-start gap-1.5 leading-snug">
          <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{item}</span>
        </p>
      ))}
    </div>
  );
}

function Contador({ rotulo, valor, destaque }) {
  return (
    <span className={cn('rounded border px-1.5 py-0.5 text-[11px] font-medium', destaque || 'border-slate-200 bg-white text-slate-600')}>
      {rotulo}: {valor}
    </span>
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
    if (filtroClassificacao === 'classificados') return possuiClassificacao(linha);
    if (filtroClassificacao === 'sem-classificacao') return !possuiClassificacao(linha);
    return true;
  }), [filtroClassificacao, linhasPesquisadas]);

  const contadores = useMemo(() => ({
    total: linhasFiltradas.length,
    semClassificacao: linhasFiltradas.filter((linha) => !possuiClassificacao(linha)).length,
    classificados: linhasFiltradas.filter(possuiClassificacao).length,
    erros: linhasFiltradas.filter((linha) => linha.statusSimplificado === 'erro' || linha.erros?.length > 0).length,
    duplicados: linhasFiltradas.filter((linha) => linha.statusSimplificado === 'duplicada').length,
    recusados: linhasFiltradas.filter((linha) => linha.recusada).length,
  }), [linhasFiltradas]);

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
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col lg:flex-row min-h-[600px] lg:h-[calc(100vh-220px)]">
      <aside className="w-full lg:w-[340px] xl:w-[380px] shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-50 flex flex-col lg:h-full max-h-[440px] lg:max-h-full">
        <div className="p-3 border-b border-slate-200 bg-slate-100 shrink-0 space-y-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Revisão simplificada</h3>
            <p className="text-xs text-slate-500">Pesquise e concentre a revisão nos registros pendentes.</p>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
            <Input value={pesquisa} onChange={(event) => setPesquisa(event.target.value)} placeholder="Pesquisar nota, BG, matéria, texto..." className="h-9 pl-8 bg-white text-xs" />
          </div>
          <Select value={filtroClassificacao} onValueChange={setFiltroClassificacao}>
            <SelectTrigger className="h-9 bg-white text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="sem-classificacao">Apenas sem classificação</SelectItem>
              <SelectItem value="classificados">Apenas classificados</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex flex-wrap gap-1">
            <Contador rotulo="Total" valor={contadores.total} />
            <Contador rotulo="Sem classificação" valor={contadores.semClassificacao} destaque="border-amber-200 bg-amber-50 text-amber-700" />
            <Contador rotulo="Classificados" valor={contadores.classificados} destaque="border-emerald-200 bg-emerald-50 text-emerald-700" />
            <Contador rotulo="Erros" valor={contadores.erros} destaque="border-orange-200 bg-orange-50 text-orange-700" />
            <Contador rotulo="Duplicados" valor={contadores.duplicados} destaque="border-red-200 bg-red-50 text-red-700" />
            <Contador rotulo="Recusados" valor={contadores.recusados} />
          </div>
        </div>

        <div className="p-2 space-y-1.5 overflow-y-auto flex-1">
          {!linhasFiltradas.length && (
            <div className="p-4 text-center text-xs text-slate-500">Nenhum registro encontrado para a pesquisa e o filtro aplicados.</div>
          )}
          {linhasFiltradas.map((linha) => {
            const statusVisual = statusDaLinha(linha);
            const classificada = possuiClassificacao(linha);
            const isSelected = linha.linhaNumero === selecionadaId;

            return (
              <div
                key={linha.linhaNumero}
                onClick={() => setSelecionadaId(linha.linhaNumero)}
                className={cn(
                  'p-2 rounded-lg border cursor-pointer transition-colors text-left',
                  isSelected ? 'border-indigo-500 bg-indigo-50 shadow-sm ring-1 ring-indigo-500/20' : 'border-slate-200 bg-white hover:border-slate-300',
                  linha.recusada && !isSelected && 'bg-slate-100 opacity-60 text-slate-500',
                  !linha.recusada && statusVisual === 'duplicada' && !isSelected && 'border-red-300 bg-red-50',
                  !linha.recusada && statusVisual === 'erro' && !isSelected && 'border-orange-300 bg-orange-50'
                )}
              >
                <div className="flex justify-between items-center gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Badge className={cn('border text-[10px] px-1.5 py-0', statusClass[statusVisual] || statusClass.erro)}>{statusVisual.toUpperCase()}</Badge>
                    <span className="text-xs font-bold text-slate-700">Linha {linha.linhaNumero}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    title={linha.recusada ? 'Restaurar linha' : 'Recusar linha'}
                    className="w-6 h-6 shrink-0"
                    onClick={(event) => { event.stopPropagation(); onAlternarRecusa(linha); }}
                  >
                    {linha.recusada ? <RotateCcw className="w-3.5 h-3.5 text-slate-600" /> : <XCircle className="w-3.5 h-3.5 text-rose-600" />}
                  </Button>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] leading-tight text-slate-600">
                  <span><strong>Nota:</strong> {linha.numero_nota || '—'}</span>
                  <span><strong>BG:</strong> {linha.numero_bg_br || '—'}</span>
                  <span><strong>Data:</strong> {linha.data_bg_br || '—'}</span>
                  <span className="truncate" title={tipoBgDaLinha(linha)}><strong>Tipo:</strong> {tipoBgDaLinha(linha)}</span>
                  <span className="col-span-2 truncate" title={materiaDaLinha(linha)}><strong>Matéria:</strong> {materiaDaLinha(linha)}</span>
                </div>
                <div className="mt-1 flex items-center gap-1">
                  <Badge variant="outline" className={cn('text-[10px] px-1 py-0', classificada ? 'border-emerald-300 text-emerald-700' : 'border-amber-300 text-amber-700')}>
                    {classificada ? 'CLASSIFICADO' : 'SEM CLASSIFICAÇÃO'}
                  </Badge>
                </div>
                <p className="mt-1 text-[11px] leading-tight text-slate-500 line-clamp-2">{linha.texto_publicado || 'Sem texto publicado.'}</p>
              </div>
            );
          })}
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col bg-white">
        {selecionada ? (() => {
          const linha = selecionada;
          const desabilitada = linha.recusada;
          const statusVisual = statusDaLinha(linha);
          const valorTipo = possuiClassificacao(linha) ? linha.tipo_classificado : '__fallback__';

          return (
            <>
              <div className="px-3 py-2 border-b border-slate-200 bg-white shrink-0">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-800">Linha {linha.linhaNumero}</h3>
                    <Badge className={cn('border px-1.5 py-0 text-[11px]', statusClass[statusVisual] || statusClass.erro)}>{statusVisual.toUpperCase()}</Badge>
                  </div>
                  <div className="flex gap-1.5">
                    <Button variant="outline" size="sm" className="h-8" onClick={handlePrev} disabled={selecionadaIndex <= 0}><ChevronLeft className="w-4 h-4" /> Anterior</Button>
                    <Button variant="outline" size="sm" className="h-8" onClick={handleNext} disabled={selecionadaIndex >= linhasFiltradas.length - 1}>Próximo <ChevronRight className="w-4 h-4" /></Button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2">
                  <div><label className="text-[11px] font-medium text-slate-500">Linha</label><Input disabled value={linha.linhaNumero} className="h-8 bg-slate-100 px-2 text-xs" /></div>
                  <div><label className="text-[11px] font-medium text-slate-500">Status</label><Input disabled value={statusVisual.toUpperCase()} className="h-8 bg-slate-100 px-2 text-xs" /></div>
                  <div><label className="text-[11px] font-medium text-slate-500">Status publicação</label><Input disabled value={linha.status_publicacao || '—'} className="h-8 bg-slate-100 px-2 text-xs" /></div>
                  <div><label className="text-[11px] font-medium text-slate-500">Nota</label><Input disabled={desabilitada} value={linha.numero_nota || ''} onChange={(event) => onAlterarLinha(linha, { numero_nota: event.target.value })} className="h-8 bg-white px-2 text-xs" /></div>
                  <div><label className="text-[11px] font-medium text-slate-500">BG</label><Input disabled={desabilitada} value={linha.numero_bg_br || ''} onChange={(event) => onAlterarLinha(linha, { numero_bg_br: event.target.value })} className="h-8 bg-white px-2 text-xs" /></div>
                  <div><label className="text-[11px] font-medium text-slate-500">Data BG</label><Input disabled={desabilitada} value={linha.data_bg_br || ''} onChange={(event) => onAlterarLinha(linha, { data_bg_br: event.target.value })} className="h-8 bg-white px-2 text-xs" /></div>
                  <div><label className="text-[11px] font-medium text-slate-500">Tipo BG</label><Input disabled value={tipoBgDaLinha(linha)} className="h-8 bg-slate-100 px-2 text-xs" /></div>
                  <div><label className="text-[11px] font-medium text-slate-500">Matéria legado</label><Input disabled value={materiaDaLinha(linha)} className="h-8 bg-slate-100 px-2 text-xs" /></div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[minmax(240px,0.8fr)_minmax(0,2fr)] gap-3">
                  <div className="bg-indigo-50/60 border border-indigo-100 rounded-lg p-2">
                    <label className="block text-xs font-semibold text-indigo-800 mb-1">Tipo classificado</label>
                    <Select disabled={desabilitada} value={valorTipo} onValueChange={(valor) => onAlterarLinha(linha, { tipo_classificado: valor === '__fallback__' ? '' : valor })}>
                      <SelectTrigger className="h-9 bg-white border-indigo-200 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__fallback__">{linha.tipo_legado || 'Sem classificação'}</SelectItem>
                        {tiposPublicacaoValidos.map((tipo) => <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {(linha.erros?.length > 0 || linha.avisos?.length > 0) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {linha.erros?.length > 0 && <div className="bg-rose-50 border border-rose-200 rounded-lg p-2 text-xs text-rose-700"><h4 className="font-semibold text-rose-800 mb-1">Erros bloqueantes</h4><ListaMensagens itens={linha.erros} tipo="erro" /></div>}
                      {linha.avisos?.length > 0 && <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-700"><h4 className="font-semibold text-amber-800 mb-1">Avisos</h4><ListaMensagens itens={linha.avisos} /></div>}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Texto publicado</label>
                  <Textarea disabled={desabilitada} value={linha.texto_publicado || ''} onChange={(event) => onAlterarLinha(linha, { texto_publicado: event.target.value })} className="min-h-[190px] resize-y font-mono text-sm leading-snug p-3" placeholder="Conteúdo do texto publicado..." />
                </div>
              </div>

              <div className="px-3 py-2 border-t border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
                <span className="text-xs text-slate-500">Registro {selecionadaIndex + 1} de {linhasFiltradas.length} no filtro atual</span>
                <Button type="button" size="sm" variant={desabilitada ? 'outline' : 'destructive'} className={cn('h-8', !desabilitada && 'bg-rose-600 hover:bg-rose-700')} onClick={() => onAlternarRecusa(linha)}>
                  {desabilitada ? <RotateCcw className="w-4 h-4 mr-1.5" /> : <XCircle className="w-4 h-4 mr-1.5" />}
                  {desabilitada ? 'Restaurar linha' : 'Recusar linha'}
                </Button>
              </div>
            </>
          );
        })() : (
          <div className="flex items-center justify-center h-full p-6 text-center text-slate-500 text-sm">
            Nenhum registro encontrado para a pesquisa e o filtro aplicados.
          </div>
        )}
      </div>
    </section>
  );
}
