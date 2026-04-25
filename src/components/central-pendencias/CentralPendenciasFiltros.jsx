import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function CentralPendenciasFiltros({ filtros, setFiltros }) {
  const update = (campo, valor) => setFiltros((prev) => ({ ...prev, [campo]: valor }));

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
      <Select value={filtros.categoria} onValueChange={(v) => update('categoria', v)}>
        <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas</SelectItem>
          <SelectItem value="publicacoes">Publicações</SelectItem>
          <SelectItem value="atestados">Atestados</SelectItem>
          <SelectItem value="ferias">Férias</SelectItem>
          <SelectItem value="comportamento">Comportamento</SelectItem>
          <SelectItem value="legado">Legado/Outros</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filtros.prioridade} onValueChange={(v) => update('prioridade', v)}>
        <SelectTrigger><SelectValue placeholder="Prioridade" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas</SelectItem>
          <SelectItem value="critica">Crítica</SelectItem>
          <SelectItem value="alta">Alta</SelectItem>
          <SelectItem value="media">Média</SelectItem>
          <SelectItem value="baixa">Baixa</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filtros.situacao} onValueChange={(v) => update('situacao', v)}>
        <SelectTrigger><SelectValue placeholder="Situação" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas</SelectItem>
          <SelectItem value="aguardando">Aguardando</SelectItem>
          <SelectItem value="pendente">Pendente</SelectItem>
          <SelectItem value="vencido">Vencido</SelectItem>
          <SelectItem value="interrompida">Interrompida</SelectItem>
        </SelectContent>
      </Select>

      <Input value={filtros.texto} onChange={(e) => update('texto', e.target.value)} placeholder="Texto livre" />

      <Select value={filtros.ordenacao} onValueChange={(v) => update('ordenacao', v)}>
        <SelectTrigger><SelectValue placeholder="Ordenação" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="prioridade_desc">Prioridade</SelectItem>
          <SelectItem value="data_desc">Data (mais recente)</SelectItem>
          <SelectItem value="data_asc">Data (mais antiga)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
