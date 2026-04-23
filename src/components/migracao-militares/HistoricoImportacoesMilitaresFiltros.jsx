import React from 'react';
import { Search, FilterX } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

export default function HistoricoImportacoesMilitaresFiltros({
  filtros,
  onChangeFiltros,
  onLimpar,
  tiposImportacao = [],
  executores = [],
  statusOptions = [],
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-700">Filtros operacionais</h2>
        <Button type="button" variant="ghost" size="sm" onClick={onLimpar} className="text-slate-600">
          <FilterX className="w-4 h-4 mr-1" /> Limpar filtros
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        <div className="xl:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Buscar por lote, referência, observação ou executor"
            value={filtros.busca}
            onChange={(event) => onChangeFiltros({ busca: event.target.value })}
            className="pl-9"
          />
        </div>

        <div>
          <label className="text-xs text-slate-500 mb-1 block">Tipo de importação</label>
          <Select value={filtros.tipoImportacao} onValueChange={(value) => onChangeFiltros({ tipoImportacao: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Todos os tipos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos os tipos</SelectItem>
              {tiposImportacao.map((tipo) => <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs text-slate-500 mb-1 block">Status</label>
          <Select value={filtros.status} onValueChange={(value) => onChangeFiltros({ status: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Todos status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((status) => <SelectItem key={status} value={status}>{status === 'TODOS' ? 'Todos status' : status}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs text-slate-500 mb-1 block">Executor</label>
          <Select value={filtros.executor} onValueChange={(value) => onChangeFiltros({ executor: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Todos executores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos executores</SelectItem>
              {executores.map((executor) => <SelectItem key={executor} value={executor}>{executor}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Data inicial</label>
          <Input type="date" value={filtros.inicio} onChange={(event) => onChangeFiltros({ inicio: event.target.value })} />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Data final</label>
          <Input type="date" value={filtros.fim} onChange={(event) => onChangeFiltros({ fim: event.target.value })} />
        </div>
      </div>
    </div>
  );
}
