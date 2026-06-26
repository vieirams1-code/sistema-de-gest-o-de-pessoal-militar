import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Search, X } from 'lucide-react';
import {
  TIPOS_INTERNOS, SISTEMAS_ORIGEM, PRIORIDADES, STATUS_PROCESSO,
} from '@/utils/controle-processos/controleProcessosConfig';

const TODOS = '__todos__';

export default function ProcessosFiltros({ filtros, setFiltros, caixas = [], onLimpar }) {
  const set = (campo, valor) => setFiltros((prev) => ({ ...prev, [campo]: valor === TODOS ? '' : valor }));

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={filtros.busca}
          onChange={(e) => set('busca', e.target.value)}
          placeholder="Buscar por título, NUP, assunto ou número do documento..."
          className="pl-9"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Select value={filtros.caixa || TODOS} onValueChange={(v) => set('caixa', v)}>
          <SelectTrigger><SelectValue placeholder="Caixa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas as caixas</SelectItem>
            {caixas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filtros.status || TODOS} onValueChange={(v) => set('status', v)}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os status</SelectItem>
            {STATUS_PROCESSO.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filtros.tipo || TODOS} onValueChange={(v) => set('tipo', v)}>
          <SelectTrigger><SelectValue placeholder="Tipo interno" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os tipos</SelectItem>
            {TIPOS_INTERNOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filtros.prioridade || TODOS} onValueChange={(v) => set('prioridade', v)}>
          <SelectTrigger><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas as prioridades</SelectItem>
            {PRIORIDADES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filtros.sistema || TODOS} onValueChange={(v) => set('sistema', v)}>
          <SelectTrigger><SelectValue placeholder="Sistema de origem" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os sistemas</SelectItem>
            {SISTEMAS_ORIGEM.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filtros.prazo || TODOS} onValueChange={(v) => set('prazo', v)}>
          <SelectTrigger><SelectValue placeholder="Prazo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Qualquer prazo</SelectItem>
            <SelectItem value="atrasado">Atrasados</SelectItem>
            <SelectItem value="hoje">Vencem hoje</SelectItem>
            <SelectItem value="proximo">Vencem em até 3 dias</SelectItem>
            <SelectItem value="sem_prazo">Sem prazo</SelectItem>
          </SelectContent>
        </Select>

        <Input
          value={filtros.interessado}
          onChange={(e) => set('interessado', e.target.value)}
          placeholder="Interessado (ID do militar)"
        />
        <Input
          value={filtros.responsavel}
          onChange={(e) => set('responsavel', e.target.value)}
          placeholder="Responsável (e-mail)"
        />
      </div>

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={onLimpar}>
          <X className="w-4 h-4 mr-1" /> Limpar filtros
        </Button>
      </div>
    </div>
  );
}