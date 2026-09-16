import React, { useMemo, useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import CoberturaPeriodoChips from '@/components/ferias/CoberturaPeriodoChips';

const normalizar = (valor) => String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export default function CoberturaLista({ militares, selecionados, onToggle, onToggleTodos }) {
  const [busca, setBusca] = useState('');
  const [lotacao, setLotacao] = useState('');
  const lotacoes = useMemo(() => [...new Set(militares.map(m => m.lotacao_nome || 'Sem lotação'))].sort((a,b) => a.localeCompare(b,'pt-BR')), [militares]);
  const filtrados = militares.filter(m => (!lotacao || (m.lotacao_nome || 'Sem lotação') === lotacao) && normalizar(`${m.militar_nome} ${m.militar_posto} ${m.militar_matricula}`).includes(normalizar(busca.trim())));
  return <section data-testid="cobertura-lista" className="mt-5 overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
    <div className="grid gap-3 border-b bg-muted/40 p-4 sm:grid-cols-[minmax(0,1fr)_240px]">
      <label className="relative"><span className="sr-only">Buscar na cobertura</span><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><input aria-label="Buscar na cobertura" placeholder="Nome, posto ou matrícula..." value={busca} onChange={e => setBusca(e.target.value)} className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label>
      <select aria-label="Filtrar cobertura por lotação" value={lotacao} onChange={e => setLotacao(e.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm"><option value="">Todas as lotações</option>{lotacoes.map(nome => <option key={nome} value={nome}>{nome}</option>)}</select>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 text-xs text-muted-foreground">
      <label className="flex items-center gap-2"><input type="checkbox" checked={militares.every(m => selecionados.includes(m.militar_id))} onChange={onToggleTodos} />Selecionar todos os não cobertos ({militares.length})</label>
      <span role="status">{filtrados.length} de {militares.length} militar(es)</span>
    </div>
    {filtrados.map(m => <div key={m.militar_id} data-cobertura-item className="flex items-start gap-3 border-b px-4 last:border-b-0">
      <input className="mt-5 h-4 w-4 shrink-0" aria-label={`Selecionar ${m.militar_nome}`} type="checkbox" checked={selecionados.includes(m.militar_id)} onChange={() => onToggle(m.militar_id)} />
      <details className="group min-w-0 flex-1">
        <summary className="flex cursor-pointer list-none items-center gap-3 py-3 [&::-webkit-details-marker]:hidden">
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-open:rotate-90" />
          <span className="min-w-0 flex-1"><span className="block break-words text-sm font-bold">{m.militar_nome}</span><span className="block text-xs text-muted-foreground">{m.militar_posto || '-'} · {m.militar_matricula || 'sem matrícula'}</span><span className="block text-xs text-muted-foreground md:hidden">{m.lotacao_nome || 'Sem lotação'}</span></span>
          <span data-cobertura-lotacao className="hidden max-w-[30%] text-sm text-muted-foreground md:block">{m.lotacao_nome || 'Sem lotação'}</span>
          <span className="shrink-0 rounded-full bg-secondary px-2 py-1 text-xs font-semibold">{(m.periodos_elegiveis || []).length} período(s)</span>
        </summary>
        <div className="border-t pb-4 pt-3"><p className="mb-2 text-xs font-semibold text-muted-foreground">Períodos aquisitivos elegíveis</p><CoberturaPeriodoChips periodos={m.periodos_elegiveis} /></div>
      </details>
    </div>)}
    {!filtrados.length && <p className="p-10 text-center text-sm text-muted-foreground">Nenhum militar encontrado com os filtros selecionados.</p>}
  </section>;
}