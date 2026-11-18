import React from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TIPOS_PROCEDIMENTO, STATUS_PROCEDIMENTO, SITUACOES_PRAZO } from '@/components/procedimentos/procedimentoConfig';

const TODOS = 'todos';

export default function ProcedimentoFiltros({ filtros, onChange, encarregados = [], investigados = [] }) {
  const atualizar = (campo, valor) => onChange({ ...filtros, [campo]: valor === TODOS ? '' : valor });

  const temFiltro = Object.values(filtros).some(Boolean);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={filtros.busca}
            onChange={(e) => atualizar('busca', e.target.value)}
            placeholder="Buscar por número, portaria, objeto ou encarregado..."
            className="pl-9"
          />
        </div>
        {temFiltro && (
          <Button
            type="button"
            variant="ghost"
            className="text-slate-500"
            onClick={() => onChange({ busca: '', tipo: '', status: '', situacao: '', encarregado_id: '', envolvido_id: '' })}
          >
            <X className="mr-1 h-4 w-4" /> Limpar
          </Button>
        )}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-5">
        <Select value={filtros.tipo || TODOS} onValueChange={(v) => atualizar('tipo', v)}>
          <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os tipos</SelectItem>
            {TIPOS_PROCEDIMENTO.map((tipo) => <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filtros.status || TODOS} onValueChange={(v) => atualizar('status', v)}>
          <SelectTrigger><SelectValue placeholder="Situação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os status</SelectItem>
            {STATUS_PROCEDIMENTO.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filtros.situacao || TODOS} onValueChange={(v) => atualizar('situacao', v)}>
          <SelectTrigger><SelectValue placeholder="Prazo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Qualquer prazo</SelectItem>
            {SITUACOES_PRAZO.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filtros.encarregado_id || TODOS} onValueChange={(v) => atualizar('encarregado_id', v)}>
          <SelectTrigger><SelectValue placeholder="Encarregado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os encarregados</SelectItem>
            {encarregados.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filtros.envolvido_id || TODOS} onValueChange={(v) => atualizar('envolvido_id', v)}>
          <SelectTrigger><SelectValue placeholder="Investigado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os investigados</SelectItem>
            {investigados.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}