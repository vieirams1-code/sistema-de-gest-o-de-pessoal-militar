import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarClock, Filter, Search } from 'lucide-react';
import { format } from 'date-fns';
import { buildAfastamentosVigentes, sortAfastamentosByRetorno } from '@/services/afastamentosVigentesService';
import { useScopedMilitarIds, filtrarPorMilitarIdsPermitidos } from '@/hooks/useScopedMilitarIds';

function formatDateBR(date) {
  if (!date) return '—';
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return '—';
  return format(parsed, 'dd/MM/yyyy');
}

function getTipoOptions(lista = []) {
  return [...new Set(lista.map((item) => item.tipoAfastamento).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function getOrigemOptions(lista = []) {
  return [...new Set(lista.map((item) => item.origem).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export default function AfastamentosVigentesPanel() {
  const [militarFilter, setMilitarFilter] = useState('');
  const [tipoFilter, setTipoFilter] = useState('all');
  const [origemFilter, setOrigemFilter] = useState('all');

  // Lote 1D-E: escopo transversal — filtra todas as entidades por militar_id
  // dentro do escopo do usuário. Para admin (scopedIds === null), mantém global.
  const { ids: scopedIds, isAdmin: scopedIsAdmin, isReady: scopedReady } = useScopedMilitarIds();
  const scopeKey = scopedIsAdmin ? 'admin' : (scopedIds || []).join(',');

  const { data: atestados = [] } = useQuery({
    queryKey: ['painel-afastamentos-atestados', scopeKey],
    queryFn: async () => {
      const lista = await base44.entities.Atestado.list('-created_date');
      return filtrarPorMilitarIdsPermitidos(lista, scopedIds);
    },
    enabled: scopedReady,
  });

  const { data: ferias = [] } = useQuery({
    queryKey: ['painel-afastamentos-ferias', scopeKey],
    queryFn: async () => {
      const lista = await base44.entities.Ferias.list('-data_inicio');
      return filtrarPorMilitarIdsPermitidos(lista, scopedIds);
    },
    enabled: scopedReady,
  });

  const { data: registrosLivro = [] } = useQuery({
    queryKey: ['painel-afastamentos-livro', scopeKey],
    queryFn: async () => {
      const lista = await base44.entities.RegistroLivro.list('-created_date');
      return filtrarPorMilitarIdsPermitidos(lista, scopedIds);
    },
    enabled: scopedReady,
  });

  const { data: militaresLtip = [] } = useQuery({
    queryKey: ['painel-afastamentos-ltip', scopeKey],
    queryFn: async () => {
      const lista = await base44.entities.Militar.filter({ condicao: 'LTIP' }, '-ltip_data_inicio', 500);
      return filtrarPorMilitarIdsPermitidos(
        lista.map((m) => ({ ...m, militar_id: m.id })),
        scopedIds,
      );
    },
    enabled: scopedReady,
  });

  const afastamentos = useMemo(() => {
    const base = buildAfastamentosVigentes({ atestados, ferias, registrosLivro, militaresLtip });
    return [...base].sort(sortAfastamentosByRetorno);
  }, [atestados, ferias, registrosLivro, militaresLtip]);

  const tipoOptions = useMemo(() => getTipoOptions(afastamentos), [afastamentos]);
  const origemOptions = useMemo(() => getOrigemOptions(afastamentos), [afastamentos]);

  const afastamentosFiltrados = useMemo(() => {
    const militarTerm = militarFilter.trim().toLowerCase();

    return afastamentos.filter((item) => {
      const matchMilitar = !militarTerm || String(item.militarNome || '').toLowerCase().includes(militarTerm);
      const matchTipo = tipoFilter === 'all' || item.tipoAfastamento === tipoFilter;
      const matchOrigem = origemFilter === 'all' || item.origem === origemFilter;
      return matchMilitar && matchTipo && matchOrigem;
    });
  }, [afastamentos, militarFilter, tipoFilter, origemFilter]);

  const totaisPorOrigem = useMemo(() => {
    return afastamentos.reduce((acc, item) => {
      acc[item.origem] = (acc[item.origem] || 0) + 1;
      return acc;
    }, {});
  }, [afastamentos]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-[#1e3a5f]" />
            <h2 className="font-semibold text-slate-800">Painel de Afastamentos Vigentes</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">Ordenação aplicada: retorno mais próximo; sem retorno previsto, início mais recente.</p>
        </div>
        <Badge className="bg-[#1e3a5f]/10 text-[#1e3a5f] border border-[#1e3a5f]/20">
          {afastamentosFiltrados.length} em curso
        </Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs text-slate-500">Total vigente</p>
          <p className="text-xl font-bold text-slate-800">{afastamentos.length}</p>
        </div>
        {Object.entries(totaisPorOrigem).map(([origem, total]) => (
          <div key={origem} className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-500">{origem}</p>
            <p className="text-xl font-bold text-slate-800">{total}</p>
          </div>
        ))}
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4">
        <div className="flex items-center gap-2 text-slate-600 mb-2">
          <Filter className="w-4 h-4" />
          <span className="text-sm font-medium">Filtros</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              className="pl-9 bg-white"
              placeholder="Filtrar por militar"
              value={militarFilter}
              onChange={(event) => setMilitarFilter(event.target.value)}
            />
          </div>
          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="Tipo de afastamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {tipoOptions.map((tipo) => (
                <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={origemFilter} onValueChange={setOrigemFilter}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as origens</SelectItem>
              {origemOptions.map((origem) => (
                <SelectItem key={origem} value={origem}>{origem}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-slate-200 text-slate-500">
              <th className="py-2 pr-2">Militar</th>
              <th className="py-2 pr-2">Posto/Graduação</th>
              <th className="py-2 pr-2">Tipo</th>
              <th className="py-2 pr-2">Origem</th>
              <th className="py-2 pr-2">Início</th>
              <th className="py-2 pr-2">Término/Retorno</th>
              <th className="py-2 pr-2">Situação</th>
            </tr>
          </thead>
          <tbody>
            {afastamentosFiltrados.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500">Nenhum afastamento vigente para os filtros aplicados.</td>
              </tr>
            )}
            {afastamentosFiltrados.map((item) => (
              <tr key={item.id} className="border-b border-slate-100">
                <td className="py-2 pr-2">
                  <div className="font-medium text-slate-800">{item.militarNome}</div>
                  {item.possuiConflitoSimultaneo && (
                    <Badge className="mt-1 bg-orange-100 text-orange-700 border border-orange-200">Múltiplos vigentes</Badge>
                  )}
                </td>
                <td className="py-2 pr-2">{item.postoGraduacao || '—'}</td>
                <td className="py-2 pr-2">{item.tipoAfastamento}</td>
                <td className="py-2 pr-2">{item.origem}</td>
                <td className="py-2 pr-2">{formatDateBR(item.dataInicio)}</td>
                <td className="py-2 pr-2">{formatDateBR(item.dataTermino)}</td>
                <td className="py-2 pr-2">{item.status || 'Ativo'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}