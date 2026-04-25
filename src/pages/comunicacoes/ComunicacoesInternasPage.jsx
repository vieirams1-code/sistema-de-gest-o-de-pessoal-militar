import React from 'react';
import ComunicacoesMailboxPanel from '@/components/comunicacoes/ComunicacoesMailboxPanel';
import ComunicacoesFiltersPanel from '@/components/comunicacoes/ComunicacoesFiltersPanel';
import ComunicacoesList from '@/components/comunicacoes/ComunicacoesList';
import ComunicacaoPreview from '@/components/comunicacoes/ComunicacaoPreview';
import { useComunicacoes } from '@/hooks/comunicacoes/useComunicacoes';

export default function ComunicacoesInternasPage() {
  const {
    isLoading,
    mailbox,
    setMailbox,
    filters,
    setFilters,
    comunicacoes,
    selectedComunicacao,
    setSelectedId,
  } = useComunicacoes();

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Comunicações Internas</h1>
        <p className="text-sm text-slate-600">Módulo isolado - lote 1 (caixas, filtros, listagem e prévia).</p>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">Carregando comunicações...</div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[280px_minmax(300px,1fr)_minmax(380px,1.2fr)]">
          <div className="space-y-4">
            <ComunicacoesMailboxPanel mailbox={mailbox} setMailbox={setMailbox} comunicacoes={comunicacoes} />
            <ComunicacoesFiltersPanel filters={filters} setFilters={setFilters} />
          </div>

          <ComunicacoesList
            comunicacoes={comunicacoes}
            selectedComunicacao={selectedComunicacao}
            onSelect={setSelectedId}
          />

          <ComunicacaoPreview comunicacao={selectedComunicacao} />
        </div>
      )}
    </div>
  );
}
