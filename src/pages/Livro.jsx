import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Plus, FileText, Filter, CalendarRange, ShieldAlert, UserRound, ExternalLink, BookOpenText } from 'lucide-react';

import { createPageUrl } from '@/utils';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { getLivroRegistrosContrato } from '@/components/livro/livroService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STATUS_OPTIONS = [
  { value: 'todos', label: 'Todos os status' },
  { value: 'ativo', label: 'Ativos' },
  { value: 'aguardando_nota', label: 'Aguardando nota' },
  { value: 'aguardando_publicacao', label: 'Aguardando publicação' },
  { value: 'gerada', label: 'Publicados' },
  { value: 'inconsistente', label: 'Inconsistentes' },
];

function getStatusClasses(statusCodigo) {
  switch (statusCodigo) {
    case 'gerada':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'aguardando_publicacao':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'aguardando_nota':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'inconsistente':
      return 'bg-red-100 text-red-700 border-red-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

function getTipoGrupo(tipoLabel = '') {
  const tipo = tipoLabel.toLowerCase();

  if (tipo.includes('férias')) return 'Férias';
  if (tipo.includes('licença') || tipo.includes('luto') || tipo.includes('núpcias')) return 'Afastamentos';
  if (tipo.includes('transfer') || tipo.includes('trânsito') || tipo.includes('instalação') || tipo.includes('cedência')) return 'Movimentação';
  if (tipo.includes('missão') || tipo.includes('dispensa')) return 'Operacional';
  return 'Outros';
}

function getTipoGrupoClasses(grupo) {
  switch (grupo) {
    case 'Férias':
      return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    case 'Afastamentos':
      return 'bg-violet-50 text-violet-700 border-violet-200';
    case 'Movimentação':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'Operacional':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
}

function buildSearchText(registro) {
  return [
    registro.tipo_label,
    registro.militar?.nome_guerra,
    registro.militar?.posto_graduacao,
    registro.militar?.matricula,
    registro.status_label,
    registro.origem,
    registro.publicacao?.nota_para_bg,
    registro.publicacao?.numero_bg,
    registro.vinculos?.periodo?.label,
    registro.detalhes?.observacoes,
    registro.inconsistencia?.motivo_curto,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export default function Livro() {
  const { isAdmin, getMilitarScopeFilters, isAccessResolved } = useCurrentUser();
  const [busca, setBusca] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [tipoFilter, setTipoFilter] = useState('todos');

  const { data: contratoLivro, isLoading } = useQuery({
    queryKey: ['livro-consulta', isAdmin],
    queryFn: () => getLivroRegistrosContrato({ isAdmin, getMilitarScopeFilters }),
    enabled: isAccessResolved,
    staleTime: 30000,
  });

  const registros = useMemo(() => contratoLivro?.registros_livro || [], [contratoLivro]);

  const tiposDisponiveis = useMemo(() => {
    const tipos = [...new Set(registros.map((registro) => registro.tipo_label).filter(Boolean))];
    return tipos.sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [registros]);

  const registrosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return registros.filter((registro) => {
      if (statusFilter !== 'todos' && registro.status_codigo !== statusFilter) return false;
      if (tipoFilter !== 'todos' && registro.tipo_label !== tipoFilter) return false;
      if (termo && !buildSearchText(registro).includes(termo)) return false;
      return true;
    });
  }, [registros, busca, statusFilter, tipoFilter]);

  const metricas = useMemo(() => ({
    total: registrosFiltrados.length,
    aguardandoNota: registrosFiltrados.filter((item) => item.status_codigo === 'aguardando_nota').length,
    aguardandoPublicacao: registrosFiltrados.filter((item) => item.status_codigo === 'aguardando_publicacao').length,
    inconsistentes: registrosFiltrados.filter((item) => item.status_codigo === 'inconsistente').length,
  }), [registrosFiltrados]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <BookOpenText className="h-4 w-4" /> Livro de Registros
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#1e3a5f]">Consulta operacional do Livro</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Consulte os lançamentos do Livro com foco em operação diária: encontre rápido o militar, veja o status real da publicação,
              diferencie o tipo do registro e siga direto para a ação necessária.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
              <a href={createPageUrl('CadastrarRegistroLivro')}>
                <Plus className="mr-2 h-4 w-4" /> Novo registro
              </a>
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Registros visíveis</p>
            <p className="mt-3 text-3xl font-bold text-slate-900">{metricas.total}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Aguardando nota</p>
            <p className="mt-3 text-3xl font-bold text-amber-900">{metricas.aguardandoNota}</p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Aguardando publicação</p>
            <p className="mt-3 text-3xl font-bold text-blue-900">{metricas.aguardandoPublicacao}</p>
          </div>
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Inconsistências</p>
            <p className="mt-3 text-3xl font-bold text-red-900">{metricas.inconsistentes}</p>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Filter className="h-4 w-4" /> Filtros de consulta
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(220px,0.7fr)_minmax(260px,0.9fr)]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Buscar por militar, tipo, matrícula, BG, nota ou observação"
                className="pl-9"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo de registro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                {tiposDisponiveis.map((tipo) => (
                  <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {isLoading && (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
              Carregando registros do Livro...
            </div>
          )}

          {!isLoading && registrosFiltrados.length === 0 && (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
              <p className="text-lg font-semibold text-slate-800">Nenhum registro encontrado</p>
              <p className="mt-2 text-sm text-slate-500">Ajuste os filtros ou cadastre um novo registro no Livro.</p>
            </div>
          )}

          {registrosFiltrados.map((registro) => {
            const grupoTipo = getTipoGrupo(registro.tipo_label);

            return (
              <article key={registro.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getTipoGrupoClasses(grupoTipo)}`}>{grupoTipo}</span>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClasses(registro.status_codigo)}`}>{registro.status_label}</span>
                      {registro.vinculos?.cadeia?.existe && (
                        <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          Cadeia com {registro.vinculos.cadeia.total_eventos} evento(s)
                        </span>
                      )}
                    </div>

                    <h2 className="mt-3 text-xl font-bold text-slate-900">{registro.tipo_label}</h2>

                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <UserRound className="h-3.5 w-3.5" /> Militar
                        </div>
                        <p className="mt-2 text-sm font-semibold text-slate-900">{registro.militar?.nome_guerra || 'Não informado'}</p>
                        <p className="text-sm text-slate-600">{registro.militar?.posto_graduacao || 'Posto não informado'}</p>
                        <p className="text-xs text-slate-500">Matrícula: {registro.militar?.matricula || '-'}</p>
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-3">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <CalendarRange className="h-3.5 w-3.5" /> Período
                        </div>
                        <p className="mt-2 text-sm font-semibold text-slate-900">{registro.data_display || '-'}</p>
                        <p className="text-xs text-slate-500">Origem: {registro.origem || '-'}</p>
                        {registro.vinculos?.periodo?.label && (
                          <p className="text-xs text-slate-500">Período aquisitivo: {registro.vinculos.periodo.label}</p>
                        )}
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-3">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <FileText className="h-3.5 w-3.5" /> Publicação
                        </div>
                        <p className="mt-2 text-sm font-semibold text-slate-900">{registro.publicacao?.numero_bg ? `BG ${registro.publicacao.numero_bg}` : 'Sem BG gerado'}</p>
                        <p className="text-xs text-slate-500">Data BG: {registro.publicacao?.data_bg || '-'}</p>
                        <p className="text-xs text-slate-500 line-clamp-2">Nota: {registro.publicacao?.nota_para_bg || '-'}</p>
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-3">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <ShieldAlert className="h-3.5 w-3.5" /> Atenção operacional
                        </div>
                        <p className="mt-2 text-sm font-semibold text-slate-900">
                          {registro.inconsistencia?.motivo_curto || 'Sem alerta crítico'}
                        </p>
                        <p className="text-xs text-slate-500 line-clamp-2">
                          {registro.inconsistencia?.detalhe || registro.detalhes?.observacoes || 'Registro sem observações operacionais adicionais.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col gap-2 lg:w-52">
                    <Button asChild variant="outline" className="justify-between">
                      <a href={`${createPageUrl('CadastrarRegistroLivro')}?id=${registro.id}`}>
                        Editar registro <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                    {registro.militar?.id && (
                      <Button asChild variant="outline" className="justify-between">
                        <a href={`${createPageUrl('FichaMilitar')}?id=${registro.militar.id}`}>
                          Ver ficha militar <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    {registro.vinculos?.ferias?.id && (
                      <Button asChild variant="outline" className="justify-between">
                        <a href={createPageUrl('Ferias')}>
                          Ir para férias <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
