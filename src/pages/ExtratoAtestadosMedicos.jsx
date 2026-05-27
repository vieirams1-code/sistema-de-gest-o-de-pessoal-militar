import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { fetchScopedExtratoAtestados } from '@/services/getScopedExtratoAtestadosClient';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

const PAGE_SIZE = 30;
const DEFAULT_COLUMNS = {
  selected: true,
  data_inicio: true,
  militar_nome: true,
  lotacao_nome: true,
  status: true,
  necessita_jiso: true,
  medico: true,
  dias: true,
};

export default function ExtratoAtestadosMedicos() {
  const { canAccessModule, isAccessResolved, isLoading: loadingUser } = useCurrentUser();
  const hasAccess = canAccessModule('atestados');
  const [filtros, setFiltros] = useState({ periodoInicio: '', periodoFim: '', militar: '', lotacao: '', status: 'all', jiso: 'all' });
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['extrato-atestados-medicos'],
    queryFn: () => fetchScopedExtratoAtestados(),
    enabled: isAccessResolved && hasAccess,
  });

  const allRows = Array.isArray(data?.atestados) ? data.atestados : [];

  const filteredRows = useMemo(() => allRows.filter((a) => {
    if (filtros.periodoInicio && a.data_inicio && a.data_inicio < filtros.periodoInicio) return false;
    if (filtros.periodoFim && a.data_inicio && a.data_inicio > filtros.periodoFim) return false;
    if (filtros.militar && !String(a.militar_nome || '').toLowerCase().includes(filtros.militar.toLowerCase())) return false;
    if (filtros.lotacao && !String(a.lotacao_nome || a.estrutura_nome || '').toLowerCase().includes(filtros.lotacao.toLowerCase())) return false;
    if (filtros.status !== 'all' && String(a.status || '') !== filtros.status) return false;
    const isJiso = Boolean(a.necessita_jiso) || String(a.fluxo_homologacao || '').toLowerCase() === 'jiso';
    if (filtros.jiso === 'sim' && !isJiso) return false;
    if (filtros.jiso === 'nao' && isJiso) return false;
    return true;
  }), [allRows, filtros]);

  const rows = filteredRows.slice(0, visibleCount);

  const toggleSelection = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loadingUser || !isAccessResolved) return null;
  if (!hasAccess) return <AccessDenied modulo="Atestados" />;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-[#1e3a5f]">Extrato de Atestados Médicos</h1>

      <div className="grid md:grid-cols-6 gap-2">
        <Input type="date" value={filtros.periodoInicio} onChange={(e) => setFiltros((f) => ({ ...f, periodoInicio: e.target.value }))} />
        <Input type="date" value={filtros.periodoFim} onChange={(e) => setFiltros((f) => ({ ...f, periodoFim: e.target.value }))} />
        <Input placeholder="Militar" value={filtros.militar} onChange={(e) => setFiltros((f) => ({ ...f, militar: e.target.value }))} />
        <Input placeholder="Lotação" value={filtros.lotacao} onChange={(e) => setFiltros((f) => ({ ...f, lotacao: e.target.value }))} />
        <select className="border rounded px-2" value={filtros.status} onChange={(e) => setFiltros((f) => ({ ...f, status: e.target.value }))}>
          <option value="all">Status (todos)</option><option value="Ativo">Ativo</option><option value="Encerrado">Encerrado</option><option value="Cancelado">Cancelado</option>
        </select>
        <select className="border rounded px-2" value={filtros.jiso} onChange={(e) => setFiltros((f) => ({ ...f, jiso: e.target.value }))}>
          <option value="all">JISO (todos)</option><option value="sim">Com JISO</option><option value="nao">Sem JISO</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        {Object.keys(DEFAULT_COLUMNS).map((col) => (
          <label key={col} className="flex items-center gap-1">
            <Checkbox checked={columns[col]} onCheckedChange={(v) => setColumns((c) => ({ ...c, [col]: Boolean(v) }))} /> {col}
          </label>
        ))}
      </div>

      {isLoading && <div>Carregando extrato...</div>}
      {isError && <div className="text-red-600">Erro ao carregar: {error?.message || 'desconhecido'}</div>}
      {!isLoading && !isError && filteredRows.length === 0 && <div>Nenhum resultado encontrado.</div>}

      {!isLoading && !isError && filteredRows.length > 0 && (
        <>
          <div className="text-sm text-slate-500">Selecionados: {selectedIds.size}</div>
          <div className="overflow-auto border rounded-lg bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  {columns.selected && <th className="p-2">Sel.</th>}
                  {columns.data_inicio && <th className="p-2 text-left">Início</th>}
                  {columns.militar_nome && <th className="p-2 text-left">Militar</th>}
                  {columns.lotacao_nome && <th className="p-2 text-left">Lotação</th>}
                  {columns.status && <th className="p-2 text-left">Status</th>}
                  {columns.necessita_jiso && <th className="p-2 text-left">JISO</th>}
                  {columns.medico && <th className="p-2 text-left">Médico</th>}
                  {columns.dias && <th className="p-2 text-left">Dias</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t">
                    {columns.selected && <td className="p-2"><Checkbox checked={selectedIds.has(row.id)} onCheckedChange={() => toggleSelection(row.id)} /></td>}
                    {columns.data_inicio && <td className="p-2">{row.data_inicio || '-'}</td>}
                    {columns.militar_nome && <td className="p-2">{row.militar_nome || '-'}</td>}
                    {columns.lotacao_nome && <td className="p-2">{row.lotacao_nome || row.estrutura_nome || '-'}</td>}
                    {columns.status && <td className="p-2">{row.status || '-'}</td>}
                    {columns.necessita_jiso && <td className="p-2">{row.necessita_jiso ? 'Sim' : 'Não'}</td>}
                    {columns.medico && <td className="p-2">{row.medico || '-'}</td>}
                    {columns.dias && <td className="p-2">{row.dias ?? '-'}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {visibleCount < filteredRows.length && (
            <Button variant="outline" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>Carregar mais</Button>
          )}
        </>
      )}
    </div>
  );
}
