import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, Search, X } from 'lucide-react';

export default function HistoricoImportacoesMilitaresFiltros({
  filtros,
  onChangeFiltros,
  onLimpar,
  opcoes,
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center gap-2 text-slate-700">
        <Filter className="w-4 h-4" />
        <p className="text-sm font-semibold">Filtros operacionais</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        <div className="xl:col-span-2">
          <label className="text-xs text-slate-500">Busca textual</label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-8"
              placeholder="Arquivo, referência do lote, observação..."
              value={filtros.busca}
              onChange={(event) => onChangeFiltros({ busca: event.target.value })}
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-500">Tipo de importação</label>
          <Select value={filtros.tipoImportacao || 'todos'} onValueChange={(valor) => onChangeFiltros({ tipoImportacao: valor === 'todos' ? '' : valor })}>
            <SelectTrigger>
              <SelectValue placeholder="Todos os tipos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {(opcoes?.tiposImportacao || []).map((tipo) => (
                <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-slate-500">Status final</label>
          <Select value={filtros.statusGeral || 'todos'} onValueChange={(valor) => onChangeFiltros({ statusGeral: valor === 'todos' ? '' : valor })}>
            <SelectTrigger>
              <SelectValue placeholder="Todos os status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {(opcoes?.statusDisponiveis || []).map((status) => (
                <SelectItem key={status} value={status}>{status}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-slate-500">Usuário executor</label>
          <Input
            placeholder="Nome ou e-mail"
            value={filtros.executor}
            onChange={(event) => onChangeFiltros({ executor: event.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-slate-500">Período de</label>
          <Input type="date" value={filtros.inicio} onChange={(event) => onChangeFiltros({ inicio: event.target.value })} />
        </div>
        <div>
          <label className="text-xs text-slate-500">Até</label>
          <Input type="date" value={filtros.fim} onChange={(event) => onChangeFiltros({ fim: event.target.value })} />
        </div>
        <div className="flex items-end">
          <Button type="button" variant="ghost" onClick={onLimpar} className="text-slate-600">
            <X className="w-4 h-4 mr-2" /> Limpar filtros
          </Button>
        </div>
      </div>
    </div>
  );
}
