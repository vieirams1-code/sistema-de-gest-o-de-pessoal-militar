import React from 'react';
import useCentralPendencias from '@/hooks/central-pendencias/useCentralPendencias';
import CentralPendenciasHeader from '@/components/central-pendencias/CentralPendenciasHeader';
import CentralPendenciasResumoCards from '@/components/central-pendencias/CentralPendenciasResumoCards';
import CentralPendenciasFiltros from '@/components/central-pendencias/CentralPendenciasFiltros';
import CentralPendenciasList from '@/components/central-pendencias/CentralPendenciasList';
import CentralPendenciasEmptyState from '@/components/central-pendencias/CentralPendenciasEmptyState';

export default function CentralPendencias() {
  const {
    isLoading,
    error,
    pendencias,
    resumo,
    filtros,
    setFiltros,
    refetch,
    errosCategorias,
  } = useCentralPendencias();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <CentralPendenciasHeader onRefresh={refetch} loading={isLoading} />

        {errosCategorias.length > 0 ? (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 text-sm">
            Algumas categorias não puderam ser carregadas nesta leitura: {errosCategorias.join(', ')}.
          </div>
        ) : null}

        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm">
            Falha ao carregar dados da Central. Tente atualizar em instantes.
          </div>
        ) : null}

        <CentralPendenciasResumoCards resumo={resumo} />
        <CentralPendenciasFiltros filtros={filtros} setFiltros={setFiltros} />

        {isLoading ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500">
            Carregando pendências operacionais...
          </div>
        ) : null}

        {!isLoading && pendencias.length === 0 ? <CentralPendenciasEmptyState /> : null}

        {!isLoading && pendencias.length > 0 ? <CentralPendenciasList pendencias={pendencias} /> : null}
      </div>
    </div>
  );
}
