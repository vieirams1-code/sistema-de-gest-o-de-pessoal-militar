import ComunicacoesSidebar from '@/components/comunicacoes/ComunicacoesSidebar';
import ComunicacoesList from '@/components/comunicacoes/ComunicacoesList';
import ComunicacaoPreview from '@/components/comunicacoes/ComunicacaoPreview';
import { useComunicacoes } from '@/hooks/comunicacoes/useComunicacoes';

export default function ComunicacoesInternasPage() {
  const {
    mailbox,
    setMailbox,
    filters,
    setFilter,
    resetSpecialBoxFilters,
    comunicacoes,
    selectedComunicacao,
    selectedId,
    setSelectedId,
  } = useComunicacoes();

  const handleSelectSpecialBox = (specialKey) => {
    resetSpecialBoxFilters();
    setFilter(specialKey);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Comunicações Internas</h1>
        <p className="text-sm text-slate-600">Módulo isolado - Lote 1 (listagem, filtros e visualização).</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <section className="xl:col-span-3">
          <ComunicacoesSidebar
            mailbox={mailbox}
            onMailboxChange={setMailbox}
            filters={filters}
            onToggleFilter={setFilter}
            onSelectSpecialBox={handleSelectSpecialBox}
          />
        </section>

        <section className="xl:col-span-4">
          <ComunicacoesList
            comunicacoes={comunicacoes}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </section>

        <section className="xl:col-span-5">
          <ComunicacaoPreview comunicacao={selectedComunicacao} />
        </section>
      </div>
    </div>
  );
}
