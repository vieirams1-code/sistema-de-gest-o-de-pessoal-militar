import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, FileText, Filter, CalendarRange, ShieldAlert, BookOpenText } from 'lucide-react';

import { base44 } from '@/api/base44Client';
import { getLivroRegistrosContrato } from '@/components/livro/livroService';
import { createPageUrl } from '@/utils';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { Button } from '@/components/ui/button';

const STATUS_PRIORITY = {
  inconsistente: 0,
  aguardando_publicacao: 1,
  aguardando_nota: 2,
  gerada: 3,
};


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

  return {
    ...registro,
    modulo_normalizado: modulo,
    status_codigo: statusCodigo,
    status_label: normalizeStatusLabel(registro, statusCodigo),
  };
}

function sortRegistrosDesc(registros = []) {
  return [...registros].sort((a, b) => {
    const dataA = new Date(a.data_registro || a.data_inicio || a.created_date || 0).getTime();
    const dataB = new Date(b.data_registro || b.data_inicio || b.created_date || 0).getTime();
    return dataB - dataA;
  });
}

function getStatusPriority(statusCodigo = '') {
  return STATUS_PRIORITY[statusCodigo] ?? 99;
}

function sortRegistrosByOperationalPriority(registros = []) {
  return [...registros].sort((a, b) => {
    const priorityDiff = getStatusPriority(a.status_codigo) - getStatusPriority(b.status_codigo);
    if (priorityDiff !== 0) return priorityDiff;

    const dataA = new Date(a.data_registro || a.data_inicio || a.created_date || 0).getTime();
    const dataB = new Date(b.data_registro || b.data_inicio || b.created_date || 0).getTime();
    return dataB - dataA;
  });
}

function formatOperationalSummary({ inconsistentes = 0, aguardando_publicacao = 0 } = {}) {
  if (!inconsistentes && !aguardando_publicacao) {
    return 'Nenhum registro crítico no momento. Revise os demais status conforme necessário.';
  }

  const partes = [];
  if (inconsistentes) partes.push(`${inconsistentes} registro${inconsistentes > 1 ? 's' : ''} inconsistente${inconsistentes > 1 ? 's' : ''}`);
  if (aguardando_publicacao) partes.push(`${aguardando_publicacao} pronto${aguardando_publicacao > 1 ? 's' : ''} para publicação`);

  return `Você possui ${partes.join(' e ')}.`;
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

  const resumoOperacional = useMemo(
    () => formatOperationalSummary(metricas),
    [metricas]
  );

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

        <div className="mb-6 rounded-2xl border border-[#1e3a5f]/10 bg-white px-5 py-4 shadow-sm">
          <p className="text-sm font-medium text-slate-600">{resumoOperacional}</p>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard icon={FileText} label="Total" value={metricas.total} helper="Todos os registros visíveis" />
          <MetricCard icon={Filter} label="Aguardando publicação" value={metricas.aguardando_publicacao} helper="Prontos para boletim" />
          <MetricCard icon={CalendarRange} label="Aguardando nota" value={metricas.aguardando_nota} helper="Dependem de nota para BG" />
          <MetricCard icon={BookOpenText} label="Publicados" value={metricas.gerada} helper="Já lançados em BG" />
          <MetricCard icon={ShieldAlert} label="Inconsistências" value={metricas.inconsistentes} helper="Requer conferência" />
        </div>

        {isLoading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
            Carregando registros...
          </div>
        )}
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
