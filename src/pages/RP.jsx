import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, FileText, Filter, CalendarRange, ShieldAlert, BookOpenText } from 'lucide-react';

import { getLivroRegistrosContrato } from '@/components/livro/livroService';
import { createPageUrl } from '@/utils';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { Button } from '@/components/ui/button';
import { calcularMetricasPublicacao, listarAtestadosPublicacaoEscopo, listarPublicacoesExOfficioEscopo } from '@/services/publicacoesPainelService';
import { calcularStatusPublicacaoRegistro, normalizarStatusPublicacao, STATUS_PUBLICACAO } from '@/components/publicacao/publicacaoStateMachine';

function mapStatusContratoParaControle(statusCodigo) {
  if (statusCodigo === 'gerada') return STATUS_PUBLICACAO.PUBLICADO;
  if (statusCodigo === 'aguardando_publicacao') return STATUS_PUBLICACAO.AGUARDANDO_PUBLICACAO;
  if (statusCodigo === 'aguardando_nota') return STATUS_PUBLICACAO.AGUARDANDO_NOTA;
  if (statusCodigo === 'inconsistente') return 'Inconsistente';
  return STATUS_PUBLICACAO.AGUARDANDO_NOTA;
}

function getStatusCanonicoRP(registro = {}) {
  const statusBase =
    registro.status_canonico ||
    registro.status_calculado ||
    registro.status_publicacao ||
    registro.status ||
    (registro.origem_tipo === 'livro' ? mapStatusContratoParaControle(registro.status_codigo) : calcularStatusPublicacaoRegistro(registro));

  return normalizarStatusPublicacao(statusBase) || calcularStatusPublicacaoRegistro(registro);
}

function formatOperationalSummary({ inconsistentes = 0, aguardandoPublicacao = 0 } = {}) {
  if (!inconsistentes && !aguardandoPublicacao) {
    return 'Nenhum registro crítico no momento. Revise os demais status conforme necessário.';
  }

  const partes = [];
  if (inconsistentes) partes.push(`${inconsistentes} registro${inconsistentes > 1 ? 's' : ''} inconsistente${inconsistentes > 1 ? 's' : ''}`);
  if (aguardandoPublicacao) partes.push(`${aguardandoPublicacao} pronto${aguardandoPublicacao > 1 ? 's' : ''} para publicação`);

  return `Você possui ${partes.join(' e ')}.`;
}

export default function RP() {
  const { canAccessModule, isAccessResolved, isLoading: loadingUser, isAdmin, getMilitarScopeFilters } = useCurrentUser();

  const hasAccess = canAccessModule('livro') || canAccessModule('publicacoes');

  const { data: registrosBrutos = [], isLoading } = useQuery({
    queryKey: ['registro-rp-lista', isAdmin],
    queryFn: async () => {
      const [contratoLivro, publicacoesExOfficio, atestados] = await Promise.all([
        getLivroRegistrosContrato({ isAdmin, getMilitarScopeFilters }),
        listarPublicacoesExOfficioEscopo({ isAdmin, getMilitarScopeFilters }),
        listarAtestadosPublicacaoEscopo({ isAdmin, getMilitarScopeFilters }),
      ]);

      const registrosLivro = (contratoLivro?.registros_livro || []).map((registro) => ({
        ...registro,
        origem_tipo: 'livro',
        status_calculado: mapStatusContratoParaControle(registro.status_codigo),
      }));

      const registrosExOfficio = publicacoesExOfficio.map((registro) => ({
        ...registro,
        origem_tipo: 'ex-officio',
      }));

      const registrosAtestados = atestados.map((registro) => ({
        ...registro,
        origem_tipo: 'atestado',
      }));

      return [...registrosLivro, ...registrosExOfficio, ...registrosAtestados];
    },
    enabled: isAccessResolved && hasAccess,
    staleTime: 30000,
  });

  const metricas = useMemo(() => calcularMetricasPublicacao(registrosBrutos, {
    getStatusCanonico: getStatusCanonicoRP,
    isInconsistente: (registro) => registro.status_calculado === 'Inconsistente',
  }), [registrosBrutos]);

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
              Resumo espelho do módulo Controle de Publicações, usando a mesma fonte e mesma regra de contagem.
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
          <MetricCard icon={Filter} label="Aguardando publicação" value={metricas.aguardandoPublicacao} helper="Prontos para boletim" />
          <MetricCard icon={CalendarRange} label="Aguardando nota" value={metricas.aguardandoNota} helper="Dependem de nota para BG" />
          <MetricCard icon={BookOpenText} label="Publicados" value={metricas.publicados} helper="Já lançados em BG" />
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
