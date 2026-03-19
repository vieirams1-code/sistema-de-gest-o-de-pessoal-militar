import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Plus, FileText, Filter, CalendarRange, ShieldAlert, UserRound, ExternalLink, BookOpenText } from 'lucide-react';

import { base44 } from '@/api/base44Client';
import { getLivroRegistrosContrato } from '@/components/livro/livroService';
import { createPageUrl } from '@/utils';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
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

const MODULO_OPTIONS = [
  { value: 'todos', label: 'Todos' },
  { value: 'Livro', label: 'Livro' },
  { value: 'Ex Officio', label: 'Ex Officio' },
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

function normalizeModulo(modulo = '', registro = {}) {
  const valor = String(modulo || registro?.modulo || registro?.origem_tipo || '').trim().toLowerCase();

  if (valor === 'livro') return 'Livro';
  if (valor === 'ex officio' || valor === 'exofficio' || valor === 'ex-officio' || valor === 'publicação ex officio' || valor === 'publicacao ex officio') {
    return 'Ex Officio';
  }

  if (registro?.origem_tipo === 'livro' || registro?.tipo_label || registro?.status_codigo || registro?.vinculos) return 'Livro';
  if (registro?.origem_tipo === 'ex-officio' || registro?.tipo || registro?._origem === 'ex-officio') return 'Ex Officio';

  return modulo || 'Livro';
}

function getModuloBadgeClasses(modulo) {
  return modulo === 'Livro'
    ? 'border-blue-200 bg-blue-100 text-blue-700'
    : 'border-violet-200 bg-violet-100 text-violet-700';
}

function normalizeStatus(registro) {
  const statusBase = registro.status_codigo || registro.status || registro.status_publicacao || '';
  const valor = String(statusBase).trim().toLowerCase();

  if (valor === 'publicado' || valor === 'gerada') return 'gerada';
  if (valor === 'aguardando publicação' || valor === 'aguardando_publicacao') return 'aguardando_publicacao';
  if (valor === 'aguardando nota' || valor === 'aguardando_nota') return 'aguardando_nota';
  if (valor === 'inconsistente') return 'inconsistente';
  return valor || 'ativo';
}

function normalizeStatusLabel(registro, statusCodigo) {
  if (registro.status_label) return registro.status_label;

  switch (statusCodigo) {
    case 'gerada':
      return 'Publicado';
    case 'aguardando_publicacao':
      return 'Aguardando publicação';
    case 'aguardando_nota':
      return 'Aguardando nota';
    case 'inconsistente':
      return 'Inconsistente';
    default:
      return registro.status || registro.status_publicacao || 'Ativo';
  }
}

function normalizeRegistro(registro) {
  const statusCodigo = normalizeStatus(registro);
  const modulo = normalizeModulo(registro.modulo, registro);
  const militar = registro.militar || {};

  return {
    ...registro,
    modulo_normalizado: modulo,
    status_codigo: statusCodigo,
    status_label: normalizeStatusLabel(registro, statusCodigo),
    tipo_label: registro.tipo_label || registro.tipo_registro || registro.tipo || 'Registro RP',
    data_display: registro.data_display || registro.data_registro || registro.data_inicio || registro.created_date || '-',
    origem: registro.origem || registro.origem_tipo || modulo,
    militar: {
      id: militar.id || registro.militar_id,
      nome_guerra: militar.nome_guerra || registro.militar_nome || registro.nome_guerra || registro.nome || 'Não informado',
      posto_graduacao: militar.posto_graduacao || registro.militar_posto_graduacao || registro.posto_graduacao || registro.posto || 'Posto não informado',
      matricula: militar.matricula || registro.militar_matricula || '-',
    },
    publicacao: {
      nota_para_bg: registro.publicacao?.nota_para_bg || registro.nota_para_bg || '-',
      numero_bg: registro.publicacao?.numero_bg || registro.numero_bg || '',
      data_bg: registro.publicacao?.data_bg || registro.data_bg || '-',
    },
    detalhes: registro.detalhes || registro.detalhes_contrato || { observacoes: registro.observacoes || '' },
    inconsistencia: registro.inconsistencia || registro.inconsistencia_contrato || null,
    vinculos: registro.vinculos || registro.vinculos_contrato || null,
  };
}

function buildSearchText(registro) {
  return [
    registro.tipo_label,
    registro.modulo_normalizado,
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

function sortRegistrosDesc(registros = []) {
  return [...registros].sort((a, b) => {
    const dataA = new Date(a.data_registro || a.data_inicio || a.created_date || 0).getTime();
    const dataB = new Date(b.data_registro || b.data_inicio || b.created_date || 0).getTime();
    return dataB - dataA;
  });
}

async function getPublicacoesExOfficioRP({ isAdmin, getMilitarScopeFilters }) {
  if (isAdmin) {
    return base44.entities.PublicacaoExOfficio.list('-created_date');
  }

  const scopeFilters = getMilitarScopeFilters();
  if (!scopeFilters.length) return [];

  const militarQueries = await Promise.all(scopeFilters.map((f) => base44.entities.Militar.filter(f)));
  const militaresAcesso = militarQueries.flat();
  const militarIds = [...new Set(militaresAcesso.map((m) => m.id).filter(Boolean))];
  if (!militarIds.length) return [];

  const arrays = await Promise.all(
    militarIds.map((id) => base44.entities.PublicacaoExOfficio.filter({ militar_id: id }, '-created_date'))
  );

  const map = new Map();
  arrays.flat().forEach((item) => map.set(item.id, item));
  return Array.from(map.values()).sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
}

export default function RP() {
  const { canAccessModule, isAccessResolved, isLoading: loadingUser, isAdmin, getMilitarScopeFilters } = useCurrentUser();
  const [busca, setBusca] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [tipoFilter, setTipoFilter] = useState('todos');
  const [moduloFilter, setModuloFilter] = useState('todos');

  const hasAccess = canAccessModule('livro') || canAccessModule('publicacoes');

  const { data: registrosBrutos = [], isLoading } = useQuery({
    queryKey: ['registro-rp-lista', isAdmin],
    queryFn: async () => {
      const [contratoLivro, publicacoesExOfficio] = await Promise.all([
        getLivroRegistrosContrato({ isAdmin, getMilitarScopeFilters }),
        getPublicacoesExOfficioRP({ isAdmin, getMilitarScopeFilters }),
      ]);

      const registrosLivro = (contratoLivro?.registros_livro || []).map((registro) => ({
        ...registro,
        modulo: 'Livro',
        origem_tipo: 'livro',
      }));

      const registrosExOfficio = publicacoesExOfficio.map((registro) => ({
        ...registro,
        modulo: 'Ex Officio',
        origem_tipo: 'ex-officio',
      }));

      return sortRegistrosDesc([...registrosLivro, ...registrosExOfficio]);
    },
    enabled: isAccessResolved && hasAccess,
    staleTime: 30000,
  });

  const registros = useMemo(() => registrosBrutos.map(normalizeRegistro), [registrosBrutos]);

  const tiposDisponiveis = useMemo(() => {
    const tipos = [...new Set(registros.map((registro) => registro.tipo_label).filter(Boolean))];
    return tipos.sort((a, b) => a.localeCompare(b));
  }, [registros]);

  const registrosFiltrados = useMemo(() => {
    const buscaNormalizada = busca.trim().toLowerCase();

    return registros.filter((registro) => {
      if (statusFilter !== 'todos' && registro.status_codigo !== statusFilter) return false;
      if (tipoFilter !== 'todos' && registro.tipo_label !== tipoFilter) return false;
      if (moduloFilter !== 'todos' && registro.modulo_normalizado !== moduloFilter) return false;
      if (buscaNormalizada && !buildSearchText(registro).includes(buscaNormalizada)) return false;
      return true;
    });
  }, [registros, busca, statusFilter, tipoFilter, moduloFilter]);

  const metricas = useMemo(() => {
    const totais = {
      total: registros.length,
      aguardando_publicacao: 0,
      aguardando_nota: 0,
      gerada: 0,
      inconsistentes: 0,
    };

    registros.forEach((registro) => {
      if (registro.status_codigo === 'aguardando_publicacao') totais.aguardando_publicacao += 1;
      if (registro.status_codigo === 'aguardando_nota') totais.aguardando_nota += 1;
      if (registro.status_codigo === 'gerada') totais.gerada += 1;
      if (registro.status_codigo === 'inconsistente') totais.inconsistentes += 1;
    });

    return totais;
  }, [registros]);

  if (!loadingUser && isAccessResolved && !hasAccess) {
    return <AccessDenied modulo="RP — Registro de Publicações" />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#1e3a5f]/15 bg-white px-3 py-1 text-xs font-medium text-[#1e3a5f] shadow-sm">
              <BookOpenText className="h-3.5 w-3.5" />
              RP — Registro de Publicações
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-[#1e3a5f]">Painel Operacional de Registros</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Gestão unificada dos registros do Livro e das publicações Ex Officio, com foco em ação rápida e conferência operacional.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <a href={createPageUrl('CadastrarRegistroRP')}>
                <Plus className="mr-2 h-4 w-4" />
                Novo registro
              </a>
            </Button>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard icon={FileText} label="Total" value={metricas.total} helper="Todos os registros visíveis" />
          <MetricCard icon={Filter} label="Aguardando publicação" value={metricas.aguardando_publicacao} helper="Prontos para boletim" />
          <MetricCard icon={CalendarRange} label="Aguardando nota" value={metricas.aguardando_nota} helper="Dependem de nota para BG" />
          <MetricCard icon={BookOpenText} label="Publicados" value={metricas.gerada} helper="Já lançados em BG" />
          <MetricCard icon={ShieldAlert} label="Inconsistências" value={metricas.inconsistentes} helper="Requer conferência" />
        </div>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1.4fr,0.8fr,0.8fr,0.8fr]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por militar, matrícula, tipo, nota ou observação"
                className="pl-9"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={moduloFilter} onValueChange={setModuloFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Módulo" />
              </SelectTrigger>
              <SelectContent>
                {MODULO_OPTIONS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
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
                  <SelectItem key={tipo} value={tipo}>
                    {tipo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
              Carregando registros...
            </div>
          ) : registrosFiltrados.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
              <FileText className="mx-auto mb-3 h-8 w-8 text-slate-400" />
              <h3 className="text-base font-semibold text-slate-700">Nenhum registro encontrado</h3>
              <p className="mt-1 text-sm text-slate-500">
                Ajuste os filtros ou cadastre um novo registro para iniciar o fluxo.
              </p>
            </div>
          ) : (
            registrosFiltrados.map((registro) => {
              const grupo = getTipoGrupo(registro.tipo_label);
              return (
                <div key={`${registro.modulo_normalizado}-${registro.id}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getModuloBadgeClasses(registro.modulo_normalizado)}`}>
                          {registro.modulo_normalizado}
                        </span>
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getTipoGrupoClasses(grupo)}`}>
                          {grupo}
                        </span>
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusClasses(registro.status_codigo)}`}>
                          {registro.status_label}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-lg font-semibold text-[#1e3a5f]">{registro.tipo_label}</h2>
                      </div>

                      <div className="mt-3 grid gap-3 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-4">
                        <InfoLine icon={UserRound} label="Militar" value={registro.militar?.nome_guerra} />
                        <InfoLine label="Posto/Graduação" value={registro.militar?.posto_graduacao} />
                        <InfoLine label="Matrícula" value={registro.militar?.matricula} />
                        <InfoLine label="Data" value={registro.data_display} />
                        <InfoLine label="Nota p/ BG" value={registro.publicacao?.nota_para_bg || '-'} />
                        <InfoLine label="Nº BG" value={registro.publicacao?.numero_bg || '-'} />
                        <InfoLine label="Data BG" value={registro.publicacao?.data_bg || '-'} />
                        <InfoLine label="Origem" value={registro.origem || '-'} />
                      </div>

                      {(registro.detalhes?.observacoes || registro.inconsistencia?.motivo_curto || registro.vinculos?.periodo?.label) && (
                        <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-4">
                          {registro.vinculos?.periodo?.label && (
                            <p className="text-sm text-slate-600">
                              <span className="font-medium text-slate-700">Período vinculado:</span> {registro.vinculos.periodo.label}
                            </p>
                          )}
                          {registro.detalhes?.observacoes && (
                            <p className="text-sm text-slate-600">
                              <span className="font-medium text-slate-700">Observações:</span> {registro.detalhes.observacoes}
                            </p>
                          )}
                          {registro.inconsistencia?.motivo_curto && (
                            <p className="text-sm text-red-700">
                              <span className="font-medium">Inconsistência:</span> {registro.inconsistencia.motivo_curto}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 justify-start lg:justify-end">
                      <Button asChild variant="ghost">
                        <a href={createPageUrl('Publicacoes')}>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Publicações
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, helper }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="rounded-xl bg-[#1e3a5f]/10 p-2 text-[#1e3a5f]">
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-2xl font-bold text-[#1e3a5f]">{value}</span>
      </div>
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </div>
  );
}

function InfoLine({ icon: Icon, label, value }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <div className="flex items-center gap-2">
        {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" /> : null}
        <p className="truncate text-sm font-medium text-slate-700">{value || '-'}</p>
      </div>
    </div>
  );
}