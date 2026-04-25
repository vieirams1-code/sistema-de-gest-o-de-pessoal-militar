import React from "react";
import { MessageSquare, Plus } from "lucide-react";
import ComunicacoesSidebar from "../../components/comunicacoes/ComunicacoesSidebar";
import ComunicacoesListPanel from "../../components/comunicacoes/ComunicacoesListPanel";
import ComunicacaoPreviewPanel from "../../components/comunicacoes/ComunicacaoPreviewPanel";
import { useComunicacoesInbox } from "../../hooks/comunicacoes/useComunicacoesInbox";
import {
  canAccessComunicacoes,
  isComunicacoesFeatureEnabled,
} from "../../utils/comunicacoes/comunicacoes.access";
import {
  COMUNICACOES_ACCESS_PERMISSION,
  COMUNICACOES_MODULE_KEY,
} from "../../utils/comunicacoes/comunicacoes.constants";

const DEFAULT_CURRENT_USER = {
  permissions: [COMUNICACOES_ACCESS_PERMISSION],
};

const DEFAULT_FEATURE_FLAGS = {
  [COMUNICACOES_MODULE_KEY]: true,
};

function InfoScreen({ title, description }) {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-6">
      <div className="max-w-lg w-full bg-white rounded-3xl border border-slate-200 p-8 shadow-sm text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <MessageSquare className="text-slate-500" size={24} />
        </div>

        <h1 className="text-xl font-bold text-slate-900 mb-2">{title}</h1>
        <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

export default function ComunicacoesPage({
  currentUser = DEFAULT_CURRENT_USER,
  featureFlags = DEFAULT_FEATURE_FLAGS,
  currentUserName = "Usuário do Sistema",
  currentUserRole = "Comunicações Internas",
}) {
  const featureEnabled = isComunicacoesFeatureEnabled(featureFlags);
  const accessGranted = canAccessComunicacoes({ currentUser, featureFlags });

  const {
    loading,
    error,
    query,
    mailbox,
    quickFilter,
    counters,
    filteredItems,
    selectedId,
    selectedItem,
    setQuery,
    handleSelect,
    handleMailboxChange,
    handleQuickFilterToggle,
    clearFilters,
  } = useComunicacoesInbox();

  if (!featureEnabled) {
    return (
      <InfoScreen
        title="Módulo de Comunicações Internas desabilitado"
        description="A feature flag do módulo ainda não está habilitada para este ambiente."
      />
    );
  }

  if (!accessGranted) {
    return (
      <InfoScreen
        title="Acesso não autorizado"
        description="O usuário atual não possui a permissão acessar_comunicacoes."
      />
    );
  }

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900 font-sans overflow-hidden">
      <ComunicacoesSidebar
        mailbox={mailbox}
        counters={counters}
        onMailboxChange={handleMailboxChange}
        currentUserName={currentUserName}
        currentUserRole={currentUserRole}
      />

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Comunicações Internas
            </p>
            <h1 className="text-lg font-bold text-slate-900">
              Caixa e Visualização
            </h1>
          </div>

          <button
            type="button"
            disabled
            className="flex items-center gap-2 bg-slate-100 text-slate-400 px-4 py-2 rounded-xl text-sm font-bold cursor-not-allowed"
            title="A criação de peças entra nos próximos lotes."
          >
            <Plus size={18} />
            Nova Comunicação
          </button>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <ComunicacoesListPanel
            items={filteredItems}
            loading={loading}
            error={error}
            selectedId={selectedId}
            onSelect={handleSelect}
            query={query}
            onQueryChange={setQuery}
            quickFilter={quickFilter}
            onQuickFilterToggle={handleQuickFilterToggle}
            onClearFilters={clearFilters}
          />

          <ComunicacaoPreviewPanel item={selectedItem} />
        </div>
      </main>
    </div>
  );
}
